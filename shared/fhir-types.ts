// FHIR R4 Resource Types for SMART on FHIR integration
// Based on https://hl7.org/fhir/R4/

// ============================================================================
// Core FHIR Types
// ============================================================================

export interface FHIRResource {
    resourceType: string;
    id?: string;
    meta?: {
        versionId?: string;
        lastUpdated?: string;
    };
}

export interface FHIRReference {
    reference?: string;
    display?: string;
}

export interface FHIRCodeableConcept {
    coding?: FHIRCoding[];
    text?: string;
}

export interface FHIRCoding {
    system?: string;
    code?: string;
    display?: string;
}

export interface FHIRQuantity {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
}

export interface FHIRPeriod {
    start?: string;
    end?: string;
}

export interface FHIRHumanName {
    use?: string;
    text?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
}

export interface FHIRAddress {
    use?: string;
    type?: string;
    text?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
}

// ============================================================================
// Patient Resource
// ============================================================================

export interface FHIRPatient extends FHIRResource {
    resourceType: "Patient";
    identifier?: { system?: string; value?: string }[];
    active?: boolean;
    name?: FHIRHumanName[];
    telecom?: { system?: string; value?: string; use?: string }[];
    gender?: "male" | "female" | "other" | "unknown";
    birthDate?: string;
    deceasedBoolean?: boolean;
    deceasedDateTime?: string;
    address?: FHIRAddress[];
    maritalStatus?: FHIRCodeableConcept;
}

// ============================================================================
// Condition Resource (Diagnoses)
// ============================================================================

export interface FHIRCondition extends FHIRResource {
    resourceType: "Condition";
    clinicalStatus?: FHIRCodeableConcept;
    verificationStatus?: FHIRCodeableConcept;
    category?: FHIRCodeableConcept[];
    severity?: FHIRCodeableConcept;
    code?: FHIRCodeableConcept;
    bodySite?: FHIRCodeableConcept[];
    subject: FHIRReference;
    encounter?: FHIRReference;
    onsetDateTime?: string;
    onsetAge?: FHIRQuantity;
    onsetPeriod?: FHIRPeriod;
    onsetString?: string;
    abatementDateTime?: string;
    recordedDate?: string;
    recorder?: FHIRReference;
    asserter?: FHIRReference;
    note?: { text?: string }[];
}

// ============================================================================
// Observation Resource (Labs, Vitals)
// ============================================================================

export interface FHIRObservation extends FHIRResource {
    resourceType: "Observation";
    status: "registered" | "preliminary" | "final" | "amended" | "corrected" | "cancelled" | "entered-in-error" | "unknown";
    category?: FHIRCodeableConcept[];
    code: FHIRCodeableConcept;
    subject?: FHIRReference;
    encounter?: FHIRReference;
    effectiveDateTime?: string;
    effectivePeriod?: FHIRPeriod;
    issued?: string;
    performer?: FHIRReference[];
    valueQuantity?: FHIRQuantity;
    valueCodeableConcept?: FHIRCodeableConcept;
    valueString?: string;
    valueBoolean?: boolean;
    valueInteger?: number;
    interpretation?: FHIRCodeableConcept[];
    note?: { text?: string }[];
    referenceRange?: {
        low?: FHIRQuantity;
        high?: FHIRQuantity;
        type?: FHIRCodeableConcept;
        text?: string;
    }[];
    component?: {
        code: FHIRCodeableConcept;
        valueQuantity?: FHIRQuantity;
        valueCodeableConcept?: FHIRCodeableConcept;
        valueString?: string;
        interpretation?: FHIRCodeableConcept[];
        referenceRange?: { low?: FHIRQuantity; high?: FHIRQuantity; text?: string }[];
    }[];
}

// ============================================================================
// MedicationRequest Resource
// ============================================================================

export interface FHIRMedicationRequest extends FHIRResource {
    resourceType: "MedicationRequest";
    status: "active" | "on-hold" | "cancelled" | "completed" | "entered-in-error" | "stopped" | "draft" | "unknown";
    intent: "proposal" | "plan" | "order" | "original-order" | "reflex-order" | "filler-order" | "instance-order" | "option";
    medicationCodeableConcept?: FHIRCodeableConcept;
    medicationReference?: FHIRReference;
    subject: FHIRReference;
    encounter?: FHIRReference;
    authoredOn?: string;
    requester?: FHIRReference;
    dosageInstruction?: {
        text?: string;
        timing?: { code?: FHIRCodeableConcept };
        route?: FHIRCodeableConcept;
        doseAndRate?: {
            doseQuantity?: FHIRQuantity;
        }[];
    }[];
    note?: { text?: string }[];
}

// ============================================================================
// Bundle Resource (for search results)
// ============================================================================

export interface FHIRBundle<T extends FHIRResource = FHIRResource> extends FHIRResource {
    resourceType: "Bundle";
    type: "searchset" | "batch" | "transaction" | "collection" | "document" | "message" | "history";
    total?: number;
    link?: { relation: string; url: string }[];
    entry?: {
        fullUrl?: string;
        resource?: T;
        search?: { mode?: string; score?: number };
    }[];
}

// ============================================================================
// SMART on FHIR OAuth Types
// ============================================================================

export interface SMARTConfiguration {
    authorization_endpoint: string;
    token_endpoint: string;
    token_endpoint_auth_methods_supported?: string[];
    registration_endpoint?: string;
    scopes_supported?: string[];
    response_types_supported?: string[];
    capabilities?: string[];
}

export interface SMARTTokenResponse {
    access_token: string;
    token_type: string;
    expires_in?: number;
    scope?: string;
    refresh_token?: string;
    patient?: string; // Patient ID from context
    id_token?: string;
}

export interface SMARTAuthState {
    state: string;
    codeVerifier: string;
    redirectUri: string;
    fhirBaseUrl: string;
}

// ============================================================================
// Normalized Patient Profile (for trial matching)
// ============================================================================

export interface PatientDemographics {
    id: string;
    name: string;
    gender?: string;
    birthDate?: string;
    age?: number;
    address?: {
        city?: string;
        state?: string;
        country?: string;
    };
}

export interface PatientCondition {
    code: string;
    display: string;
    system?: string;
    clinicalStatus?: string;
    onsetDate?: string;
    recordedDate?: string;
}

export interface PatientLabResult {
    code: string;
    display: string;
    value?: number;
    unit?: string;
    valueString?: string;
    effectiveDate?: string;
    interpretation?: string;
    referenceRange?: string;
}

export interface PatientMedication {
    code: string;
    display: string;
    status?: string;
    authoredOn?: string;
    dosageInstruction?: string;
}

export interface PatientProfile {
    demographics: PatientDemographics;
    conditions: PatientCondition[];
    labResults: PatientLabResult[];
    medications: PatientMedication[];
    lastUpdated: string;
    dataSource: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface SmartAuthorizeRequest {
    provider: "smart-sandbox"; // Can add more providers later
}

export interface SmartAuthorizeResponse {
    authorizationUrl: string;
    state: string;
}

export interface SmartCallbackRequest {
    code: string;
    state: string;
}

export interface SmartPatientDataResponse {
    profile: PatientProfile;
    rawResourceCount: {
        conditions: number;
        observations: number;
        medications: number;
    };
}
