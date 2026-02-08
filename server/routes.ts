import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { searchTrials, getTrialByNctId } from "./clinical-trials";
import { matchTrialsForPatient, calculateTrialMatch } from "./trial-matching";
import { trialSearchParamsSchema } from "@shared/trials";
import type { TrialMatchRequest, TrialMatchResponse } from "@shared/trial-matching";
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
  storeTokenForUser,
  getTokenForUser,
  clearTokenForUser,
  hasValidConnection,
} from "./smart-fhir";
import { getMongoDb, getNextSequence } from "./mongo";
import { findUserBySessionId } from "./user-record-lookup";

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

  // Get current user with role from database (bypasses session cache)
  app.get("/api/user/me", requireAuth, async (req, res) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session?.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const db = await getMongoDb();
      const userCollection = db.collection("user");
      const dbUser = await findUserBySessionId(userCollection, session.user.id);

      // Avoid HTTP conditional cache responses for role-sensitive routing.
      res.set("Cache-Control", "no-store, max-age=0");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");

      res.json({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: dbUser?.role || null,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

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

      const db = await getMongoDb();
      const userCollection = db.collection("user");
      const dbUser = await findUserBySessionId(userCollection, session.user.id);

      if (!dbUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (dbUser?.role) {
        if (dbUser.role === role) {
          return res.json({ success: true, role, alreadySet: true });
        }
        return res.status(409).json({ error: `Role already set to '${dbUser.role}'` });
      }

      // Update role in database
      const updateResult = await userCollection.updateOne(
        { _id: dbUser._id },
        { $set: { role } }
      );

      if (updateResult.matchedCount === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log("User", session.user.id, "role set to:", role, "- matched:", updateResult.matchedCount, "modified:", updateResult.modifiedCount);

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
  // AI-Powered Trial Matching
  // =========================================================================

  // Match trials for connected patient
  app.post("/api/trials/match", requireAuth, async (req, res) => {
    try {
      const { patientId, limit = 20, minScore = 0 } = req.body as TrialMatchRequest;

      // Get patient ID from request or from stored SMART connection
      const pid = patientId || req.body.patientId;
      if (!pid) {
        return res.status(400).json({ error: "Patient ID required. Connect your health record first." });
      }

      // Get stored token and fetch patient data
      const token = getStoredToken(pid);
      if (!token) {
        return res.status(401).json({ error: "No valid session for this patient. Please reconnect your health record." });
      }

      // Fetch patient profile
      const profile = await fetchPatientData(
        token.iss || "https://launch.smarthealthit.org/v/r4/sim/WzIsIiIsIiIsIkFVVE8iLDAsMCwwLCIiLCIiLCIiLCIiLCIiLCIiLCIiLDAsMSwiIl0/fhir",
        token.access_token,
        pid
      );

      // Get patient conditions for targeted trial search
      const patientConditions = profile.conditions
        .filter(c => c.clinicalStatus?.toLowerCase() === "active")
        .map(c => c.display)
        .slice(0, 5);

      // Search for trials related to patient conditions
      const searchPromises = patientConditions.map(condition =>
        searchTrials({ condition, pageSize: 10 })
      );

      // Also search for common trial types
      searchPromises.push(searchTrials({ pageSize: 20 }));

      const searchResults = await Promise.all(searchPromises);

      // Deduplicate trials by NCT ID
      const trialsMap = new Map();
      for (const result of searchResults) {
        for (const trial of result.studies) {
          if (!trialsMap.has(trial.nctId)) {
            trialsMap.set(trial.nctId, trial);
          }
        }
      }
      const uniqueTrials = Array.from(trialsMap.values());

      console.log(`[Trial Match] Found ${uniqueTrials.length} unique trials for ${patientConditions.length} conditions`);

      // Run AI matching
      const matches = await matchTrialsForPatient(uniqueTrials, profile, {
        minScore: minScore as number,
        limit: limit as number,
      });

      const response: TrialMatchResponse = {
        matches,
        totalTrialsAnalyzed: uniqueTrials.length,
        patientConditions,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      console.error("Trial matching error:", error);
      res.status(500).json({ error: "Failed to match trials" });
    }
  });

  // Get match score for a single trial
  app.post("/api/trials/:nctId/match", requireAuth, async (req, res) => {
    try {
      const { nctId } = req.params;
      const { patientId } = req.body;

      if (!patientId) {
        return res.status(400).json({ error: "Patient ID required" });
      }

      const token = getStoredToken(patientId);
      if (!token) {
        return res.status(401).json({ error: "No valid session. Please reconnect health record." });
      }

      const trial = await getTrialByNctId(nctId);
      if (!trial) {
        return res.status(404).json({ error: "Trial not found" });
      }

      const profile = await fetchPatientData(
        token.iss || "https://launch.smarthealthit.org/v/r4/fhir",
        token.access_token,
        patientId
      );

      const matchResult = await calculateTrialMatch(trial, profile);
      res.json(matchResult);
    } catch (error) {
      console.error("Single trial match error:", error);
      res.status(500).json({ error: "Failed to calculate match" });
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

      // Get user ID from session
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      const userId = session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { token, fhirBaseUrl } = await exchangeCodeForToken(code, state);

      // Store token in database linked to user ID for persistence across sessions
      const expiresIn = token.expires_in || 3600;
      const patientId = token.patient || "default";
      await storeTokenForUser(userId, patientId, token, fhirBaseUrl, expiresIn);

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

  // Check if user has a valid SMART connection
  app.get("/api/smart/connection-status", requireAuth, async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      const userId = session?.user?.id;
      if (!userId) {
        return res.json({ connected: false });
      }

      const connection = await getTokenForUser(userId);
      if (!connection) {
        return res.json({ connected: false });
      }

      res.json({
        connected: true,
        patientId: connection.patientId,
      });
    } catch (error) {
      console.error("Connection status error:", error);
      res.json({ connected: false });
    }
  });

  // Fetch patient data using stored token (now uses DB-backed storage)
  app.get("/api/smart/patient-data/:patientId", requireAuth, async (req, res) => {
    try {
      const { patientId } = req.params;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      const userId = session?.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // First try to get token from database (persistent)
      let token = null;
      let fhirBaseUrl = "https://launch.smarthealthit.org/v/r4/fhir";

      const dbConnection = await getTokenForUser(userId);
      if (dbConnection) {
        token = dbConnection.token;
        fhirBaseUrl = dbConnection.fhirBaseUrl;
      } else {
        // Fallback to in-memory cache for backward compatibility
        token = getStoredToken(patientId);
      }

      if (!token) {
        return res.status(401).json({ error: "No valid token found. Please reconnect your health record." });
      }

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

  // Disconnect (clear stored token - now uses DB storage)
  app.post("/api/smart/disconnect", requireAuth, async (req, res) => {
    try {
      const { patientId } = req.body;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      const userId = session?.user?.id;

      // Clear from database if we have userId
      if (userId) {
        await clearTokenForUser(userId);
      }

      // Also clear from in-memory cache for backward compatibility
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
