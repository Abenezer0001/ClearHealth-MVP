/**
 * Trial Matching Types
 * Types for eligibility matching between patients and clinical trials
 */

import type { PatientProfile } from "./fhir-types";
import type { ClinicalTrial } from "./trials";

// ============================================================================
// Eligibility Criterion Types
// ============================================================================

export type CriterionStatus = "met" | "not_met" | "missing_data" | "unknown";
export type CriterionCategory = "age" | "sex" | "condition" | "medication" | "lab" | "inclusion" | "exclusion" | "other";
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * A single eligibility criterion with matching status
 */
export interface EligibilityCriterion {
    id: string;
    name: string;
    description?: string;
    category: CriterionCategory;
    status: CriterionStatus;
    patientValue?: string;
    requiredValue?: string;
    confidence: ConfidenceLevel;
    aiReasoning?: string; // AI's explanation for the match decision
}

/**
 * Result of semantic condition matching
 */
export interface ConditionMatchResult {
    trialCondition: string;
    patientCondition?: string;
    isMatch: boolean;
    confidence: ConfidenceLevel;
    reasoning?: string;
}

// ============================================================================
// Trial Match Result
// ============================================================================

/**
 * Complete match result for a trial against a patient profile
 */
export interface TrialMatchResult {
    nctId: string;
    briefTitle: string;
    trial?: ClinicalTrial;
    matchScore: number; // 0-100 percentage
    matchTier: "excellent" | "good" | "moderate" | "low" | "poor";
    totalCriteria: number;
    metCriteria: number;
    notMetCriteria: number;
    missingDataCriteria: number;
    unknownCriteria: number;
    criteria: EligibilityCriterion[];
    matchedConditions: ConditionMatchResult[];
    aiSummary?: string; // AI-generated summary of the match
}

/**
 * Request to match trials for a patient
 */
export interface TrialMatchRequest {
    patientId?: string; // If provided, fetches from stored token
    patientProfile?: PatientProfile; // Or provide directly
    trials?: ClinicalTrial[]; // Optional explicit trial set to score
    limit?: number; // Max trials to return
    minScore?: number; // Minimum match score (0-100)
}

/**
 * Response containing matched trials
 */
export interface TrialMatchResponse {
    matches: TrialMatchResult[];
    totalTrialsAnalyzed: number;
    patientConditions: string[];
    timestamp: string;
}

// ============================================================================
// Share Interest Types
// ============================================================================

/**
 * Fields patient can choose to share with coordinator
 */
export interface ShareableFields {
    labs: boolean;
    medications: boolean;
    location: boolean;
    email: boolean;
    phone: boolean;
    conditions: boolean;
    demographics: boolean;
}

/**
 * Request to share interest in a trial
 */
export interface ShareInterestRequest {
    trialNctId: string;
    trialTitle: string;
    matchScore?: number;
    sharedFields: ShareableFields;
    message?: string; // Optional message from patient
}

/**
 * Utility to get tier from match score
 */
export function getMatchTier(score: number): TrialMatchResult["matchTier"] {
    if (score >= 80) return "excellent";
    if (score >= 60) return "good";
    if (score >= 40) return "moderate";
    if (score >= 20) return "low";
    return "poor";
}
