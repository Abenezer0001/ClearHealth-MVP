import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { searchTrials, getTrialByNctId } from "./clinical-trials";
import { trialSearchParamsSchema } from "@shared/trials";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { auth } from "./auth";
import { fromNodeHeaders } from "better-auth/node";
import {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  fetchPatientData,
  getAvailableProviders,
  getStoredToken,
  clearStoredToken,
} from "./smart-fhir";
import { getMongoDb, getNextSequence } from "./mongo";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session?.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      return next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }
  };

  // Role-based access middleware
  const requireRole = (...allowedRoles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(req.headers),
        });

        if (!session?.user) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const userRole = (session.user as any).role;
        if (!userRole || !allowedRoles.includes(userRole)) {
          return res.status(403).json({ error: "Forbidden: insufficient permissions" });
        }

        return next();
      } catch (error) {
        console.error("Role middleware error:", error);
        return res.status(403).json({ error: "Forbidden" });
      }
    };
  };

  // =========================================================================
  // User Role Management
  // =========================================================================

  // Set user role (only if not already set)
  app.patch("/api/user/role", requireAuth, async (req, res) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session?.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { role } = req.body;
      if (!role || !["patient", "coordinator"].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be 'patient' or 'coordinator'" });
      }

      // Check if user already has a role
      const currentRole = (session.user as any).role;
      if (currentRole) {
        return res.status(400).json({ error: "Role already set" });
      }

      // Update role in database
      const db = await getMongoDb();
      await db.collection("user").updateOne(
        { id: session.user.id },
        { $set: { role } }
      );

      console.log("User", session.user.id, "role set to:", role);
      res.json({ success: true, role });
    } catch (error) {
      console.error("Role update error:", error);
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  // =========================================================================
  // Clinical Trials API Routes
  // =========================================================================

  app.use("/api/trials", requireAuth);

  // Search clinical trials
  app.get("/api/trials/search", async (req, res) => {
    try {
      const params = trialSearchParamsSchema.parse(req.query);
      const results = await searchTrials(params);
      res.json(results);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ error: validationError.message });
      } else {
        console.error("Trial search error:", error);
        res.status(500).json({ error: "Failed to search trials" });
      }
    }
  });

  // Get single trial by NCT ID
  app.get("/api/trials/:nctId", async (req, res) => {
    try {
      const { nctId } = req.params;

      if (!nctId || !nctId.startsWith("NCT")) {
        return res.status(400).json({ error: "Invalid NCT ID format" });
      }

      const trial = await getTrialByNctId(nctId);

      if (!trial) {
        return res.status(404).json({ error: "Trial not found" });
      }

      res.json(trial);
    } catch (error) {
      console.error("Get trial error:", error);
      res.status(500).json({ error: "Failed to fetch trial" });
    }
  });

  // =========================================================================
  // SMART on FHIR API Routes
  // =========================================================================

  // Get available EHR providers
  app.get("/api/smart/providers", (req, res) => {
    res.json({ providers: getAvailableProviders() });
  });

  // Initiate SMART authorization flow
  app.post("/api/smart/authorize", requireAuth, async (req, res) => {
    try {
      const { provider } = req.body;

      if (!provider) {
        return res.status(400).json({ error: "Provider ID required" });
      }

      // Build the redirect URI based on the request origin
      const origin = req.headers.origin || `http://localhost:${process.env.PORT || 5000}`;
      const redirectUri = `${origin}/smart/callback`;

      const { authorizationUrl, state } = await buildAuthorizationUrl(provider, redirectUri);

      res.json({ authorizationUrl, state });
    } catch (error) {
      console.error("SMART authorize error:", error);
      res.status(500).json({ error: "Failed to initiate authorization" });
    }
  });

  // Handle SMART OAuth callback (token exchange)
  app.post("/api/smart/callback", requireAuth, async (req, res) => {
    try {
      const { code, state } = req.body;

      if (!code || !state) {
        return res.status(400).json({ error: "Code and state required" });
      }

      const { token, fhirBaseUrl } = await exchangeCodeForToken(code, state);

      // Store the patient ID in session or return it
      res.json({
        success: true,
        patientId: token.patient,
        scope: token.scope,
        expiresIn: token.expires_in,
      });
    } catch (error) {
      console.error("SMART callback error:", error);
      res.status(500).json({ error: "Failed to exchange authorization code" });
    }
  });

  // Fetch patient data using stored token
  app.get("/api/smart/patient-data/:patientId", requireAuth, async (req, res) => {
    try {
      const { patientId } = req.params;

      if (!patientId) {
        return res.status(400).json({ error: "Patient ID required" });
      }

      const token = getStoredToken(patientId);
      if (!token) {
        return res.status(401).json({ error: "No valid token found. Please reconnect your health record." });
      }

      // Use the SMART sandbox FHIR base URL
      const fhirBaseUrl = "https://launch.smarthealthit.org/v/r4/fhir";
      const profile = await fetchPatientData(fhirBaseUrl, token.access_token, patientId);

      res.json({
        profile,
        rawResourceCount: {
          conditions: profile.conditions.length,
          observations: profile.labResults.length,
          medications: profile.medications.length,
        },
      });
    } catch (error) {
      console.error("Fetch patient data error:", error);
      res.status(500).json({ error: "Failed to fetch patient data" });
    }
  });

  // Disconnect (clear stored token)
  app.post("/api/smart/disconnect", requireAuth, async (req, res) => {
    try {
      const { patientId } = req.body;

      if (patientId) {
        clearStoredToken(patientId);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("SMART disconnect error:", error);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  // =========================================================================
  // Debug endpoint to fetch patient data without OAuth (SMART Sandbox open access)
  // =========================================================================
  app.get("/api/smart/demo-patient/:patientId", async (req, res) => {
    try {
      const { patientId } = req.params;
      const fhirBaseUrl = "https://launch.smarthealthit.org/v/r4/fhir";

      console.log(`Fetching demo patient data for: ${patientId}`);

      // The SMART Sandbox allows open access without auth for testing
      const https = await import("https");

      const fetchFHIR = (url: string): Promise<any> => {
        return new Promise((resolve, reject) => {
          https.get(url, { headers: { Accept: "application/fhir+json" } }, (response) => {
            let data = "";
            response.on("data", (chunk) => (data += chunk));
            response.on("end", () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(e);
              }
            });
          }).on("error", reject);
        });
      };

      // Fetch all resources in parallel
      const [patient, conditions, observations, medications] = await Promise.all([
        fetchFHIR(`${fhirBaseUrl}/Patient/${patientId}`),
        fetchFHIR(`${fhirBaseUrl}/Condition?patient=${patientId}&_count=50`),
        fetchFHIR(`${fhirBaseUrl}/Observation?patient=${patientId}&category=laboratory&_count=20`),
        fetchFHIR(`${fhirBaseUrl}/MedicationRequest?patient=${patientId}&_count=20`),
      ]);

      // Normalize the data
      const profile = {
        id: patient.id,
        name: patient.name?.[0]
          ? `${patient.name[0].given?.join(" ") || ""} ${patient.name[0].family || ""}`.trim()
          : "Unknown",
        gender: patient.gender || "unknown",
        birthDate: patient.birthDate,
        conditions: (conditions.entry || []).map((e: any) => ({
          id: e.resource?.id,
          name: e.resource?.code?.coding?.[0]?.display || e.resource?.code?.text || "Unknown",
          code: e.resource?.code?.coding?.[0]?.code,
          status: e.resource?.clinicalStatus?.coding?.[0]?.code || "unknown",
          onsetDate: e.resource?.onsetDateTime?.split("T")[0],
        })),
        labResults: (observations.entry || []).slice(0, 10).map((e: any) => ({
          id: e.resource?.id,
          name: e.resource?.code?.coding?.[0]?.display || e.resource?.code?.text || "Unknown",
          value: e.resource?.valueQuantity?.value,
          unit: e.resource?.valueQuantity?.unit,
          date: e.resource?.effectiveDateTime?.split("T")[0],
        })),
        medications: (medications.entry || []).map((e: any) => ({
          id: e.resource?.id,
          name: e.resource?.medicationCodeableConcept?.coding?.[0]?.display
            || e.resource?.medicationCodeableConcept?.text || "Unknown",
          status: e.resource?.status || "unknown",
        })),
      };

      res.json(profile);
    } catch (error) {
      console.error("Demo patient fetch error:", error);
      res.status(500).json({ error: "Failed to fetch demo patient data", details: String(error) });
    }
  });

  // List available demo patients from SMART Sandbox
  app.get("/api/smart/demo-patients", async (req, res) => {
    try {
      const fhirBaseUrl = "https://launch.smarthealthit.org/v/r4/fhir";
      const https = await import("https");

      const fetchFHIR = (url: string): Promise<any> => {
        return new Promise((resolve, reject) => {
          https.get(url, { headers: { Accept: "application/fhir+json" } }, (response) => {
            let data = "";
            response.on("data", (chunk) => (data += chunk));
            response.on("end", () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(e);
              }
            });
          }).on("error", reject);
        });
      };

      const bundle = await fetchFHIR(`${fhirBaseUrl}/Patient?_count=10`);

      const patients = (bundle.entry || []).map((e: any) => ({
        id: e.resource?.id,
        name: e.resource?.name?.[0]
          ? `${e.resource.name[0].given?.join(" ") || ""} ${e.resource.name[0].family || ""}`.trim()
          : "Unknown",
        gender: e.resource?.gender,
        birthDate: e.resource?.birthDate,
      }));

      res.json({ patients });
    } catch (error) {
      console.error("Demo patients list error:", error);
      res.status(500).json({ error: "Failed to list demo patients" });
    }
  });

  // =========================================================================
  // Patient Share & Coordinator Inbox API Routes (MongoDB Storage)
  // =========================================================================

  // Patient: Submit interest in a trial (patient role only)
  app.post("/api/patient/share-profile", requireAuth, requireRole("patient"), async (req, res) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      const {
        ageRange,
        sex,
        diagnosisSummary,
        trialNctId,
        trialTitle,
        sharedFields,
        relevantLabs,
        activeMeds,
        locationCity,
        contactEmail,
      } = req.body;

      if (!trialNctId || !diagnosisSummary) {
        return res.status(400).json({ error: "Trial and diagnosis info required" });
      }

      const db = await getMongoDb();
      const leadId = await getNextSequence("patientLeads");

      const lead = {
        id: leadId,
        patientUserId: session?.user?.id || "unknown",
        ageRange: ageRange || "Unknown",
        sex: sex || "Unknown",
        diagnosisSummary,
        trialNctId,
        trialTitle: trialTitle || "Unknown Trial",
        sharedFields: sharedFields || { labs: false, meds: false, location: false, email: false },
        relevantLabs: sharedFields?.labs ? relevantLabs : undefined,
        activeMeds: sharedFields?.meds ? activeMeds : undefined,
        locationCity: sharedFields?.location ? locationCity : undefined,
        contactEmail: sharedFields?.email ? contactEmail : undefined,
        status: "new",
        createdAt: new Date(),
      };

      await db.collection("patientLeads").insertOne(lead);
      console.log("New patient lead created:", lead.id, "for trial:", trialNctId);

      res.json({ success: true, leadId: lead.id });
    } catch (error) {
      console.error("Patient share error:", error);
      res.status(500).json({ error: "Failed to submit interest" });
    }
  });

  // Coordinator: Get all leads (coordinator role only)
  app.get("/api/coordinator/leads", requireAuth, requireRole("coordinator"), async (req, res) => {
    try {
      const db = await getMongoDb();
      // Sort by newest first
      const leads = await db
        .collection("patientLeads")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      res.json({ leads });
    } catch (error) {
      console.error("Get leads error:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Coordinator: Update lead status (coordinator role only)
  app.patch("/api/coordinator/leads/:id/status", requireAuth, requireRole("coordinator"), async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      const { status, coordinatorNotes } = req.body;

      const db = await getMongoDb();
      const updateFields: Record<string, any> = {};

      if (status) {
        updateFields.status = status;
      }
      if (coordinatorNotes !== undefined) {
        updateFields.coordinatorNotes = coordinatorNotes;
      }

      const result = await db.collection("patientLeads").findOneAndUpdate(
        { id: leadId },
        { $set: updateFields },
        { returnDocument: "after" }
      );

      if (!result) {
        return res.status(404).json({ error: "Lead not found" });
      }

      console.log("Lead", leadId, "status updated to:", status);
      res.json({ success: true, lead: result });
    } catch (error) {
      console.error("Update lead error:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "TrialAtlas API" });
  });

  return httpServer;
}

