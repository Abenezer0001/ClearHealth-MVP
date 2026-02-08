/**
 * SMART on FHIR Service
 * Handles OAuth2 flow with PKCE and FHIR API calls for EHR data import
 */

import crypto from "crypto";
import https from "node:https";
import { getMongoDb } from "./mongo";
import type {
    SMARTConfiguration,
    SMARTTokenResponse,
    SMARTAuthState,
    FHIRPatient,
    FHIRCondition,
    FHIRObservation,
    FHIRMedicationRequest,
    FHIRBundle,
    PatientProfile,
    PatientDemographics,
    PatientCondition,
    PatientLabResult,
    PatientMedication,
} from "@shared/fhir-types";

// ============================================================================
// Configuration
// ============================================================================

interface SMARTProvider {
    name: string;
    fhirBaseUrl: string;
    displayName: string;
}

/**
 * SMART Launcher can require a /sim/.../fhir URL for standalone launch behavior.
 * Keep this overrideable so local/dev environments can plug in their own launcher URL.
 */
const DEFAULT_SMART_SANDBOX_FHIR_BASE_URL =
    process.env.SMART_SANDBOX_FHIR_BASE_URL
    || "https://launch.smarthealthit.org/v/r4/sim/WzIsIiIsIiIsIkFVVE8iLDAsMCwwLCIiLCIiLCIiLCIiLCIiLCIiLCIiLDAsMSwiIl0/fhir";

const SMART_PROVIDERS: Record<string, SMARTProvider> = {
    "smart-sandbox": {
        name: "smart-sandbox",
        fhirBaseUrl: DEFAULT_SMART_SANDBOX_FHIR_BASE_URL,
        displayName: "SMART Health IT Sandbox",
    },
};

// Scopes for standalone patient access (no EHR launch context)
const SMART_SCOPES = [
    // Standalone apps should request launch context explicitly.
    "launch/patient",
    "openid",
    "fhirUser",
    "patient/Patient.read",
    "patient/Condition.read",
    "patient/Observation.read",
    "patient/MedicationRequest.read",
].join(" ");

// Client ID for the sandbox (can be any string in loose mode)
const CLIENT_ID = "trial-atlas-hackathon";

// In-memory cache for faster token access (backed by MongoDB)
const authStates = new Map<string, SMARTAuthState>();
const tokenCache = new Map<string, { token: SMARTTokenResponse; expires: number; fhirBaseUrl: string }>();

console.log("[SMART-FHIR] Module loaded/reloaded - token cache initialized (empty, DB will be queried)");

// ============================================================================
// MongoDB Token Persistence
// ============================================================================

interface StoredSmartConnection {
    userId: string;
    patientId: string;
    token: SMARTTokenResponse;
    fhirBaseUrl: string;
    expires: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Store SMART token in MongoDB, linked to user ID
 */
export async function storeTokenForUser(
    userId: string,
    patientId: string,
    token: SMARTTokenResponse,
    fhirBaseUrl: string,
    expiresInSeconds: number
): Promise<void> {
    const db = await getMongoDb();
    const expires = new Date(Date.now() + expiresInSeconds * 1000);

    await db.collection("smartConnections").updateOne(
        { userId },
        {
            $set: {
                userId,
                patientId,
                token,
                fhirBaseUrl,
                expires,
                updatedAt: new Date(),
            },
            $setOnInsert: {
                createdAt: new Date(),
            },
        },
        { upsert: true }
    );

    // Update cache
    tokenCache.set(userId, { token, expires: expires.getTime(), fhirBaseUrl });
    console.log(`[SMART-FHIR] Token stored for user ${userId}, patient ${patientId}`);
}

/**
 * Get SMART token from MongoDB for a user
 */
export async function getTokenForUser(userId: string): Promise<{ token: SMARTTokenResponse; fhirBaseUrl: string; patientId: string } | null> {
    // Check cache first
    const cached = tokenCache.get(userId);
    if (cached && cached.expires > Date.now()) {
        console.log(`[SMART-FHIR] Token found in cache for user ${userId}`);
        // We need patientId too, so we'll fetch from DB anyway if not in full cache
    }

    const db = await getMongoDb();
    const stored = await db.collection<StoredSmartConnection>("smartConnections").findOne({ userId });

    if (!stored) {
        console.log(`[SMART-FHIR] No stored connection found for user ${userId}`);
        return null;
    }

    if (stored.expires < new Date()) {
        console.log(`[SMART-FHIR] Stored token expired for user ${userId}`);
        // Don't delete - user can reconnect, but mark as expired
        return null;
    }

    // Update cache
    tokenCache.set(userId, { token: stored.token, expires: stored.expires.getTime(), fhirBaseUrl: stored.fhirBaseUrl });

    console.log(`[SMART-FHIR] Token found in DB for user ${userId}, patient ${stored.patientId}`);
    return {
        token: stored.token,
        fhirBaseUrl: stored.fhirBaseUrl,
        patientId: stored.patientId,
    };
}

/**
 * Clear SMART connection for a user (disconnect)
 */
export async function clearTokenForUser(userId: string): Promise<void> {
    const db = await getMongoDb();
    await db.collection("smartConnections").deleteOne({ userId });
    tokenCache.delete(userId);
    console.log(`[SMART-FHIR] Token cleared for user ${userId}`);
}

/**
 * Check if user has a valid SMART connection
 */
export async function hasValidConnection(userId: string): Promise<boolean> {
    const connection = await getTokenForUser(userId);
    return connection !== null;
}

// ============================================================================
// MongoDB Auth State Persistence (for OAuth flow survival)
// ============================================================================

interface StoredAuthState extends SMARTAuthState {
    createdAt: Date;
    expiresAt: Date;
}

/**
 * Store auth state in MongoDB for OAuth flow (survives HMR/restarts)
 */
async function storeAuthState(state: string, authState: SMARTAuthState): Promise<void> {
    const db = await getMongoDb();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes TTL

    await db.collection("smartAuthStates").updateOne(
        { state },
        {
            $set: {
                state,
                ...authState,
                createdAt: now,
                expiresAt,
            },
        },
        { upsert: true }
    );

    // Also keep in memory cache for speed
    authStates.set(state, authState);
    console.log(`[SMART-FHIR] Auth state stored in DB for state: ${state.substring(0, 8)}...`);
}

/**
 * Get auth state from MongoDB (with fallback to memory cache)
 */
async function getAuthState(state: string): Promise<SMARTAuthState | null> {
    // Try memory cache first
    const cached = authStates.get(state);
    if (cached) {
        console.log(`[SMART-FHIR] Auth state found in cache for state: ${state.substring(0, 8)}...`);
        return cached;
    }

    // Fallback to database
    const db = await getMongoDb();
    const stored = await db.collection<StoredAuthState>("smartAuthStates").findOne({ state });

    if (!stored) {
        console.log(`[SMART-FHIR] Auth state NOT FOUND for state: ${state.substring(0, 8)}...`);
        return null;
    }

    if (stored.expiresAt < new Date()) {
        console.log(`[SMART-FHIR] Auth state EXPIRED for state: ${state.substring(0, 8)}...`);
        await db.collection("smartAuthStates").deleteOne({ state });
        return null;
    }

    console.log(`[SMART-FHIR] Auth state found in DB for state: ${state.substring(0, 8)}...`);

    // Restore to cache
    const authState: SMARTAuthState = {
        fhirBaseUrl: stored.fhirBaseUrl,
        redirectUri: stored.redirectUri,
        codeVerifier: stored.codeVerifier,
    };
    authStates.set(state, authState);

    return authState;
}

/**
 * Delete auth state after use
 */
async function deleteAuthState(state: string): Promise<void> {
    authStates.delete(state);
    const db = await getMongoDb();
    await db.collection("smartAuthStates").deleteOne({ state });
}


const REQUEST_TIMEOUT_MS = 15000;

// ============================================================================
// HTTP Helper for HTTPS requests
// ============================================================================

interface HttpResponse<T> {
    status: number;
    data: T;
}

async function httpGet<T>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            {
                family: 4,
                timeout: REQUEST_TIMEOUT_MS,
                headers: {
                    Accept: "application/json",
                    ...headers,
                },
            },
            (res) => {
                const status = res.statusCode ?? 0;
                let body = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => (body += chunk));
                res.on("end", () => {
                    if (!body.trim()) {
                        resolve({ status, data: {} as T });
                        return;
                    }
                    try {
                        resolve({ status, data: JSON.parse(body) as T });
                    } catch {
                        reject(new Error(`Invalid JSON response (status ${status})`));
                    }
                });
            }
        );
        req.on("timeout", () => req.destroy(new Error("Request timeout")));
        req.on("error", reject);
    });
}

async function httpPost<T>(
    url: string,
    body: string,
    contentType = "application/x-www-form-urlencoded"
): Promise<HttpResponse<T>> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: "POST",
            family: 4,
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
                "Content-Type": contentType,
                "Content-Length": Buffer.byteLength(body),
                Accept: "application/json",
            },
        };

        const req = https.request(options, (res) => {
            const status = res.statusCode ?? 0;
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                if (!data.trim()) {
                    resolve({ status, data: {} as T });
                    return;
                }
                try {
                    resolve({ status, data: JSON.parse(data) as T });
                } catch {
                    reject(new Error(`Invalid JSON response (status ${status}): ${data}`));
                }
            });
        });

        req.on("timeout", () => req.destroy(new Error("Request timeout")));
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

// ============================================================================
// PKCE Helpers
// ============================================================================

function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
    return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
    return crypto.randomBytes(16).toString("hex");
}

// ============================================================================
// SMART on FHIR Functions
// ============================================================================

/**
 * Fetch the SMART configuration from the FHIR server
 */
export async function getSmartConfiguration(fhirBaseUrl: string): Promise<SMARTConfiguration> {
    const configUrl = `${fhirBaseUrl}/.well-known/smart-configuration`;
    const { status, data } = await httpGet<SMARTConfiguration>(configUrl);

    if (status !== 200) {
        throw new Error(`Failed to fetch SMART configuration: ${status}`);
    }

    return data;
}

/**
 * Build the authorization URL for the SMART OAuth2 flow
 */
export async function buildAuthorizationUrl(
    providerId: string,
    redirectUri: string
): Promise<{ authorizationUrl: string; state: string }> {
    const provider = SMART_PROVIDERS[providerId];
    if (!provider) {
        throw new Error(`Unknown provider: ${providerId}`);
    }

    // Fetch SMART configuration
    const config = await getSmartConfiguration(provider.fhirBaseUrl);

    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store state for callback verification (in DB for persistence across HMR/restarts)
    await storeAuthState(state, {
        state,
        codeVerifier,
        redirectUri,
        fhirBaseUrl: provider.fhirBaseUrl,
    });

    // Build authorization URL
    const authUrl = new URL(config.authorization_endpoint);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", SMART_SCOPES);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("aud", provider.fhirBaseUrl);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return {
        authorizationUrl: authUrl.toString(),
        state,
    };
}

/**
 * Exchange the authorization code for an access token
 */
export async function exchangeCodeForToken(
    code: string,
    state: string
): Promise<{ token: SMARTTokenResponse; fhirBaseUrl: string }> {
    // Get auth state from database (survives HMR/restarts)
    const authState = await getAuthState(state);
    if (!authState) {
        throw new Error("Invalid or expired state parameter");
    }

    // Clean up state from DB
    await deleteAuthState(state);

    // Fetch SMART configuration to get token endpoint
    const config = await getSmartConfiguration(authState.fhirBaseUrl);

    // Build token request
    const params = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: authState.redirectUri,
        client_id: CLIENT_ID,
        code_verifier: authState.codeVerifier,
    });

    const { status, data } = await httpPost<SMARTTokenResponse>(
        config.token_endpoint,
        params.toString()
    );

    if (status !== 200) {
        throw new Error(`Token exchange failed: ${status}`);
    }

    // Store token in cache for subsequent API calls (actual DB persist happens in route with userId)
    const expiresIn = data.expires_in || 3600;
    const patientKey = data.patient || "default";
    console.log(`[SMART-FHIR] Storing token in cache for patient: ${patientKey}, expires in: ${expiresIn}s`);
    tokenCache.set(patientKey, {
        token: data,
        expires: Date.now() + expiresIn * 1000,
        fhirBaseUrl: authState.fhirBaseUrl,
    });
    console.log(`[SMART-FHIR] Token cache now has ${tokenCache.size} entries`);

    return {
        token: data,
        fhirBaseUrl: authState.fhirBaseUrl,
    };
}

/**
 * Fetch patient data from the FHIR server
 */
export async function fetchPatientData(
    fhirBaseUrl: string,
    accessToken: string,
    patientId: string
): Promise<PatientProfile> {
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Fetch Patient resource
    const { data: patient } = await httpGet<FHIRPatient>(
        `${fhirBaseUrl}/Patient/${patientId}`,
        authHeader
    );

    // Fetch Conditions (diagnoses)
    const { data: conditionsBundle } = await httpGet<FHIRBundle<FHIRCondition>>(
        `${fhirBaseUrl}/Condition?patient=${patientId}&_count=100`,
        authHeader
    );

    // Fetch Observations (labs)
    const { data: observationsBundle } = await httpGet<FHIRBundle<FHIRObservation>>(
        `${fhirBaseUrl}/Observation?patient=${patientId}&category=laboratory&_count=50`,
        authHeader
    );

    // Fetch MedicationRequests
    const { data: medicationsBundle } = await httpGet<FHIRBundle<FHIRMedicationRequest>>(
        `${fhirBaseUrl}/MedicationRequest?patient=${patientId}&_count=50`,
        authHeader
    );

    // Normalize the data
    return normalizePatientProfile(
        patient,
        conditionsBundle.entry?.map((e) => e.resource!).filter(Boolean) || [],
        observationsBundle.entry?.map((e) => e.resource!).filter(Boolean) || [],
        medicationsBundle.entry?.map((e) => e.resource!).filter(Boolean) || []
    );
}

// ============================================================================
// Data Normalization
// ============================================================================

function normalizePatientProfile(
    patient: FHIRPatient,
    conditions: FHIRCondition[],
    observations: FHIRObservation[],
    medications: FHIRMedicationRequest[]
): PatientProfile {
    return {
        demographics: normalizePatientDemographics(patient),
        conditions: conditions.map(normalizeCondition).filter((c) => c.display),
        labResults: observations.map(normalizeObservation).filter((o) => o.display),
        medications: medications.map(normalizeMedication).filter((m) => m.display),
        lastUpdated: new Date().toISOString(),
        dataSource: "SMART Health IT Sandbox",
    };
}

function normalizePatientDemographics(patient: FHIRPatient): PatientDemographics {
    const name = patient.name?.[0];
    const givenName = name?.given?.join(" ") || "";
    const familyName = name?.family || "";
    const fullName = name?.text || `${givenName} ${familyName}`.trim() || "Unknown";

    const address = patient.address?.[0];

    let age: number | undefined;
    if (patient.birthDate) {
        const birth = new Date(patient.birthDate);
        const today = new Date();
        age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
    }

    return {
        id: patient.id || "unknown",
        name: fullName,
        gender: patient.gender,
        birthDate: patient.birthDate,
        age,
        address: address
            ? {
                city: address.city,
                state: address.state,
                country: address.country,
            }
            : undefined,
    };
}

function normalizeCondition(condition: FHIRCondition): PatientCondition {
    const coding = condition.code?.coding?.[0];
    return {
        code: coding?.code || "",
        display: condition.code?.text || coding?.display || "",
        system: coding?.system,
        clinicalStatus: condition.clinicalStatus?.coding?.[0]?.code,
        onsetDate: condition.onsetDateTime,
        recordedDate: condition.recordedDate,
    };
}

function normalizeObservation(observation: FHIRObservation): PatientLabResult {
    const coding = observation.code?.coding?.[0];
    const value = observation.valueQuantity;
    const interpretation = observation.interpretation?.[0]?.coding?.[0]?.code;

    let referenceRange: string | undefined;
    const range = observation.referenceRange?.[0];
    if (range) {
        if (range.text) {
            referenceRange = range.text;
        } else if (range.low && range.high) {
            referenceRange = `${range.low.value} - ${range.high.value} ${range.low.unit || ""}`.trim();
        }
    }

    return {
        code: coding?.code || "",
        display: observation.code?.text || coding?.display || "",
        value: value?.value,
        unit: value?.unit,
        valueString: observation.valueString,
        effectiveDate: observation.effectiveDateTime,
        interpretation,
        referenceRange,
    };
}

function normalizeMedication(medication: FHIRMedicationRequest): PatientMedication {
    const coding = medication.medicationCodeableConcept?.coding?.[0];
    const dosage = medication.dosageInstruction?.[0]?.text;

    return {
        code: coding?.code || "",
        display: medication.medicationCodeableConcept?.text || coding?.display || "",
        status: medication.status,
        authoredOn: medication.authoredOn,
        dosageInstruction: dosage,
    };
}

// ============================================================================
// Exports for routes
// ============================================================================

export function getAvailableProviders() {
    return Object.values(SMART_PROVIDERS).map((p) => ({
        id: p.name,
        name: p.displayName,
    }));
}

/**
 * DEPRECATED: Use getTokenForUser() instead for persistent storage
 * This function checks in-memory cache only (fallback for older code paths)
 */
export function getStoredToken(patientId: string): SMARTTokenResponse | null {
    console.log(`[SMART-FHIR] Looking for token in cache with key: ${patientId}`);
    console.log(`[SMART-FHIR] Token cache has ${tokenCache.size} entries: [${Array.from(tokenCache.keys()).join(", ")}]`);
    const stored = tokenCache.get(patientId);
    if (!stored) {
        console.log(`[SMART-FHIR] Token NOT FOUND in cache for: ${patientId}`);
        return null;
    }
    if (stored.expires < Date.now()) {
        console.log(`[SMART-FHIR] Token EXPIRED for: ${patientId}`);
        tokenCache.delete(patientId);
        return null;
    }
    console.log(`[SMART-FHIR] Token FOUND in cache for: ${patientId}`);
    return stored.token;
}

/**
 * DEPRECATED: Use clearTokenForUser() instead
 */
export function clearStoredToken(patientId: string): void {
    tokenCache.delete(patientId);
}
