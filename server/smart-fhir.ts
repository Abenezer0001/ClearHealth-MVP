/**
 * SMART on FHIR Service
 * Handles OAuth2 flow with PKCE and FHIR API calls for EHR data import
 */

import crypto from "crypto";
import https from "node:https";
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

// In-memory state storage (use Redis/DB in production)
const authStates = new Map<string, SMARTAuthState>();
const tokenStorage = new Map<string, { token: SMARTTokenResponse; expires: number }>();

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

    // Store state for callback verification
    authStates.set(state, {
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
    const authState = authStates.get(state);
    if (!authState) {
        throw new Error("Invalid or expired state parameter");
    }

    // Clean up state
    authStates.delete(state);

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

    // Store token for subsequent API calls
    const expiresIn = data.expires_in || 3600;
    tokenStorage.set(data.patient || "default", {
        token: data,
        expires: Date.now() + expiresIn * 1000,
    });

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

export function getStoredToken(patientId: string): SMARTTokenResponse | null {
    const stored = tokenStorage.get(patientId);
    if (!stored || stored.expires < Date.now()) {
        tokenStorage.delete(patientId);
        return null;
    }
    return stored.token;
}

export function clearStoredToken(patientId: string): void {
    tokenStorage.delete(patientId);
}
