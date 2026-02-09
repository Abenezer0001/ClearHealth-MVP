import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { searchTrials, getTrialByNctId } from "./clinical-trials";
import { matchTrialsForPatient, calculateTrialMatch } from "./trial-matching";
import { trialSearchParamsSchema, type ClinicalTrial } from "@shared/trials";
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

function isMeaningfulText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();
  return normalized !== "unknown" && normalized !== "unknown patient" && normalized !== "not specified" && normalized !== "not shared";
}

function normalizeDiagnosisSummary(value: unknown): string {
  if (typeof value !== "string") return "";
  const parts = value
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => {
      const normalized = part.toLowerCase();
      return Boolean(part) && normalized !== "unknown" && normalized !== "not specified" && normalized !== "not shared";
    });

  return Array.from(new Set(parts)).join(", ");
}

function normalizeLeadSharedFields(sharedFields: any) {
  const medications = Boolean(sharedFields?.medications ?? sharedFields?.meds);
  return {
    labs: Boolean(sharedFields?.labs),
    medications,
    // Keep legacy key for compatibility with older client code.
    meds: medications,
    location: Boolean(sharedFields?.location),
    email: Boolean(sharedFields?.email),
    conditions: Boolean(sharedFields?.conditions),
    demographics: Boolean(sharedFields?.demographics),
    phone: Boolean(sharedFields?.phone),
  };
}

function normalizeLabItems(items: unknown): Array<{ name: string; value?: string; unit?: string; effectiveDate?: string }> {
  if (!Array.isArray(items)) return [];

  const normalized: Array<{ name: string; value?: string; unit?: string; effectiveDate?: string }> = [];

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const source = raw as Record<string, unknown>;
    const name = typeof source.name === "string" ? source.name.trim() : "";
    if (!name) continue;

    const value = typeof source.value === "string" ? source.value.trim() : undefined;
    const unit = typeof source.unit === "string" ? source.unit.trim() : undefined;
    const effectiveDate = typeof source.effectiveDate === "string" ? source.effectiveDate.trim() : undefined;

    normalized.push({
      name,
      ...(value ? { value } : {}),
      ...(unit ? { unit } : {}),
      ...(effectiveDate ? { effectiveDate } : {}),
    });
  }

  return normalized;
}

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

        const db = await getMongoDb();
        const userCollection = db.collection("user");
        const dbUser = await findUserBySessionId(userCollection, session.user.id);
        const userRole = dbUser?.role;
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
      const { patientId, limit = 20, minScore = 0, trials } = req.body as TrialMatchRequest;

      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      const userId = session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const connection = await getTokenForUser(userId);
      if (!connection) {
        return res.status(401).json({ error: "No connected health record. Please reconnect your SMART on FHIR account." });
      }

      if (patientId && patientId !== connection.patientId) {
        return res.status(403).json({ error: "Patient ID does not match your connected health record." });
      }

      const pid = connection.patientId;

      // Fetch patient profile
      const profile = await fetchPatientData(
        connection.fhirBaseUrl,
        connection.token.access_token,
        pid
      );

      const patientConditions = profile.conditions
        .filter(c => c.clinicalStatus?.toLowerCase() === "active")
        .map(c => c.display)
        .slice(0, 5);

      let uniqueTrials: ClinicalTrial[];
      if (Array.isArray(trials) && trials.length > 0) {
        const byNctId = new Map<string, ClinicalTrial>();
        for (const trial of trials) {
          if (trial?.nctId && !byNctId.has(trial.nctId)) {
            byNctId.set(trial.nctId, trial);
          }
        }
        uniqueTrials = Array.from(byNctId.values());
      } else {
        // Search for trials related to patient conditions
        const searchPromises = patientConditions.map(condition =>
          searchTrials({ condition, pageSize: 10 })
        );

        // Also search for common trial types
        searchPromises.push(searchTrials({ pageSize: 20 }));

        const searchResults = await Promise.all(searchPromises);

        // Deduplicate trials by NCT ID
        const trialsMap = new Map<string, ClinicalTrial>();
        for (const result of searchResults) {
          for (const trial of result.studies) {
            if (!trialsMap.has(trial.nctId)) {
              trialsMap.set(trial.nctId, trial);
            }
          }
        }
        uniqueTrials = Array.from(trialsMap.values());
      }

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
      const rawNctId = req.params.nctId;
      const nctId = Array.isArray(rawNctId) ? rawNctId[0] : rawNctId;
      const { patientId } = req.body;

      if (!nctId) {
        return res.status(400).json({ error: "Trial ID is required" });
      }

      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      const userId = session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const connection = await getTokenForUser(userId);
      if (!connection) {
        return res.status(401).json({ error: "No connected health record. Please reconnect your SMART on FHIR account." });
      }

      if (patientId && patientId !== connection.patientId) {
        return res.status(403).json({ error: "Patient ID does not match your connected health record." });
      }

      const trial = await getTrialByNctId(nctId);
      if (!trial) {
        return res.status(404).json({ error: "Trial not found" });
      }

      const profile = await fetchPatientData(
        connection.fhirBaseUrl,
        connection.token.access_token,
        connection.patientId
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
        patientName,
        ageRange,
        sex,
        diagnosisSummary,
        trialNctId,
        trialTitle,
        sharedFields,
        relevantLabs,
        relevantLabItems,
        activeMeds,
        locationCity,
        contactEmail,
      } = req.body;

      if (!trialNctId) {
        return res.status(400).json({ error: "Trial info is required" });
      }

      const db = await getMongoDb();
      const leadId = await getNextSequence("patientLeads");

      const normalizedSharedFields = normalizeLeadSharedFields(sharedFields);

      let finalPatientName = isMeaningfulText(patientName) ? String(patientName).trim() : (session?.user?.name || "Unknown Patient");
      let finalAgeRange = isMeaningfulText(ageRange) ? String(ageRange).trim() : "Unknown";
      let finalSex = isMeaningfulText(sex) ? String(sex).trim() : "Unknown";
      let finalDiagnosis = normalizeDiagnosisSummary(diagnosisSummary);
      let finalLocationCity = isMeaningfulText(locationCity) ? String(locationCity).trim() : undefined;
      let finalActiveMeds = isMeaningfulText(activeMeds) ? String(activeMeds).trim() : undefined;
      let finalRelevantLabs = isMeaningfulText(relevantLabs) ? String(relevantLabs).trim() : undefined;
      let finalRelevantLabItems = normalizeLabItems(relevantLabItems);
      let leadSource: "smart_fhir" | "manual" = "manual";

      const userId = session?.user?.id;
      if (userId) {
        const connection = await getTokenForUser(userId);
        if (connection) {
          try {
            const profile = await fetchPatientData(
              connection.fhirBaseUrl,
              connection.token.access_token,
              connection.patientId
            );

            leadSource = "smart_fhir";

            finalPatientName = profile.demographics.name || finalPatientName;
            finalSex = profile.demographics.gender || finalSex;

            if (typeof profile.demographics.age === "number") {
              const min = Math.max(0, profile.demographics.age - 5);
              const max = profile.demographics.age + 5;
              finalAgeRange = `${min}-${max}`;
            }

            const activeConditions = profile.conditions
              .filter((c) => c.clinicalStatus?.toLowerCase() === "active")
              .map((c) => c.display)
              .filter(Boolean);
            const allConditions = profile.conditions
              .map((c) => c.display)
              .filter(Boolean);
            const diagnosisPool = activeConditions.length > 0 ? activeConditions : allConditions;
            if (diagnosisPool.length > 0) {
              finalDiagnosis = normalizeDiagnosisSummary(diagnosisPool.join(", "));
            }

            if (!finalLocationCity) {
              finalLocationCity = profile.demographics.address?.city;
            }

            if (!finalActiveMeds) {
              const meds = profile.medications
                .map((m) => m.display)
                .filter(Boolean);
              if (meds.length > 0) {
                finalActiveMeds = meds.join(", ");
              }
            }

            if (!finalRelevantLabs) {
              const labs = profile.labResults
                .map((l) => {
                  const value = l.valueString ?? (l.value !== undefined ? `${l.value}${l.unit ? ` ${l.unit}` : ""}` : "");
                  return `${l.display}${value ? ` (${value})` : ""}`;
                })
                .filter(Boolean);
              if (labs.length > 0) {
                finalRelevantLabs = labs.join("; ");
              }
            }
            if (finalRelevantLabItems.length === 0) {
              finalRelevantLabItems = profile.labResults.map((lab) => {
                const value = lab.valueString ?? (lab.value !== undefined ? String(lab.value) : undefined);
                return {
                  name: lab.display,
                  value,
                  unit: lab.unit,
                  effectiveDate: lab.effectiveDate,
                };
              }).filter((lab) => isMeaningfulText(lab.name));
            }
          } catch (profileError) {
            console.error("Failed to enrich lead from SMART profile:", profileError);
          }
        }
      }

      if (!isMeaningfulText(finalDiagnosis)) {
        finalDiagnosis = "Not specified";
      }

      if (!normalizedSharedFields.demographics) {
        finalAgeRange = "Not shared";
        finalSex = "Not shared";
      }
      if (!normalizedSharedFields.conditions) {
        finalDiagnosis = "Not shared";
      } else if (!isMeaningfulText(finalDiagnosis)) {
        finalDiagnosis = "No condition data available in medical record";
      }
      if (normalizedSharedFields.labs && !isMeaningfulText(finalRelevantLabs)) {
        finalRelevantLabs = "No lab results available in medical record";
      }
      if (normalizedSharedFields.labs && finalRelevantLabItems.length === 0 && isMeaningfulText(finalRelevantLabs)) {
        finalRelevantLabItems = String(finalRelevantLabs)
          .split(";")
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => {
            const splitIndex = part.indexOf(":");
            if (splitIndex === -1) return { name: part };
            return {
              name: part.slice(0, splitIndex).trim(),
              value: part.slice(splitIndex + 1).trim(),
            };
          });
      }
      if (normalizedSharedFields.medications && !isMeaningfulText(finalActiveMeds)) {
        finalActiveMeds = "No medication data available in medical record";
      }
      if (normalizedSharedFields.location && !isMeaningfulText(finalLocationCity)) {
        finalLocationCity = "No location data available in medical record";
      }

      const lead = {
        id: leadId,
        patientUserId: session?.user?.id || "unknown",
        patientName: finalPatientName,
        patientEmail: session?.user?.email || contactEmail || "Unknown",
        ageRange: finalAgeRange,
        sex: finalSex,
        diagnosisSummary: finalDiagnosis,
        trialNctId,
        trialTitle: trialTitle || "Unknown Trial",
        sharedFields: normalizedSharedFields,
        relevantLabs: normalizedSharedFields.labs ? finalRelevantLabs : undefined,
        relevantLabItems: normalizedSharedFields.labs ? finalRelevantLabItems : undefined,
        activeMeds: normalizedSharedFields.medications ? finalActiveMeds : undefined,
        locationCity: normalizedSharedFields.location ? finalLocationCity : undefined,
        contactEmail: normalizedSharedFields.email ? (session?.user?.email || contactEmail || undefined) : undefined,
        status: "new",
        source: leadSource,
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
      const userCollection = db.collection("user");
      // Sort by newest first
      const leads = await db
        .collection("patientLeads")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      const hydratedLeads = await Promise.all(
        leads.map(async (lead) => {
          const normalizedSharedFields = normalizeLeadSharedFields(lead.sharedFields);
          const hasMeaningfulName = isMeaningfulText(lead.patientName);
          const hasMeaningfulEmail = isMeaningfulText(lead.patientEmail);
          if (hasMeaningfulName && hasMeaningfulEmail) {
            return {
              ...lead,
              sharedFields: normalizedSharedFields,
              diagnosisSummary: normalizeDiagnosisSummary(lead.diagnosisSummary) || String(lead.diagnosisSummary || "Not specified"),
            };
          }

          if (!lead.patientUserId) {
            return {
              ...lead,
              sharedFields: normalizedSharedFields,
              diagnosisSummary: normalizeDiagnosisSummary(lead.diagnosisSummary) || String(lead.diagnosisSummary || "Not specified"),
            };
          }

          const dbUser = await findUserBySessionId(userCollection, String(lead.patientUserId));
          if (!dbUser) {
            return {
              ...lead,
              sharedFields: normalizedSharedFields,
              diagnosisSummary: normalizeDiagnosisSummary(lead.diagnosisSummary) || String(lead.diagnosisSummary || "Not specified"),
            };
          }

          return {
            ...lead,
            sharedFields: normalizedSharedFields,
            patientName: hasMeaningfulName ? lead.patientName : (dbUser.name || "Unknown Patient"),
            patientEmail: hasMeaningfulEmail ? lead.patientEmail : (dbUser.email || lead.contactEmail || "Unknown"),
            diagnosisSummary: normalizeDiagnosisSummary(lead.diagnosisSummary) || String(lead.diagnosisSummary || "Not specified"),
          };
        })
      );

      res.json({ leads: hydratedLeads });
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

  // Admin: Insights summary (coordinator role only)
  app.get("/api/admin/insights", requireAuth, requireRole("coordinator"), async (_req, res) => {
    try {
      const db = await getMongoDb();
      const userCollection = db.collection("user");
      const leads = await db
        .collection("patientLeads")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      const statusCounts = {
        new: 0,
        contacted: 0,
        scheduled: 0,
        not_fit: 0,
      };
      const patientIds = new Set<string>();
      const trialIds = new Set<string>();
      const diagnosisCounts = new Map<string, number>();

      for (const lead of leads) {
        const status = String(lead.status || "new") as keyof typeof statusCounts;
        if (status in statusCounts) {
          statusCounts[status] += 1;
        }

        const pid = String(lead.patientUserId || lead.patientEmail || "");
        if (pid) patientIds.add(pid);

        const trialId = String(lead.trialNctId || "");
        if (trialId) trialIds.add(trialId);

        const diagnosisSummary = String(lead.diagnosisSummary || "");
        const parts = diagnosisSummary
          .split(/[;,]/)
          .map((p) => p.trim())
          .filter((p) => p && p.toLowerCase() !== "not specified" && p.toLowerCase() !== "unknown" && p.toLowerCase() !== "not shared");

        for (const diagnosis of parts) {
          diagnosisCounts.set(diagnosis, (diagnosisCounts.get(diagnosis) || 0) + 1);
        }
      }

      const totalLeads = leads.length;
      const engaged = statusCounts.contacted + statusCounts.scheduled;
      const engagementRate = totalLeads > 0 ? Math.round((engaged / totalLeads) * 100) : 0;
      const topDiagnoses = Array.from(diagnosisCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([diagnosis, count]) => ({ diagnosis, count }));

      const recentLeads = await Promise.all(
        leads.slice(0, 10).map(async (lead) => {
          const hasMeaningfulName = isMeaningfulText(lead.patientName);
          const hasMeaningfulEmail = isMeaningfulText(lead.patientEmail);
          let patientName = hasMeaningfulName ? lead.patientName : "Unknown Patient";
          let patientEmail = hasMeaningfulEmail ? lead.patientEmail : (lead.contactEmail || "Unknown");

          if ((!hasMeaningfulName || !hasMeaningfulEmail) && lead.patientUserId) {
            const dbUser = await findUserBySessionId(userCollection, String(lead.patientUserId));
            if (dbUser) {
              patientName = hasMeaningfulName ? lead.patientName : (dbUser.name || patientName);
              patientEmail = hasMeaningfulEmail ? lead.patientEmail : (dbUser.email || patientEmail);
            }
          }

          return {
            id: lead.id,
            createdAt: lead.createdAt,
            patientName,
            patientEmail,
            diagnosisSummary: normalizeDiagnosisSummary(lead.diagnosisSummary) || "Not specified",
            trialTitle: lead.trialTitle || "Unknown Trial",
            trialNctId: lead.trialNctId || "N/A",
            status: lead.status || "new",
          };
        })
      );

      res.json({
        summary: {
          totalLeads,
          uniquePatients: patientIds.size,
          uniqueTrials: trialIds.size,
          engaged,
          engagementRate,
        },
        statusCounts,
        topDiagnoses,
        recentLeads,
      });
    } catch (error) {
      console.error("Admin insights error:", error);
      res.status(500).json({ error: "Failed to fetch admin insights" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "TrialAtlas API" });
  });

  return httpServer;
}
