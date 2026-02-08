import { z } from "zod";

// ============================================================================
// ClinicalTrials.gov API v2 Types
// ============================================================================

// Trial status values from API
export const trialStatusEnum = [
    "NOT_YET_RECRUITING",
    "RECRUITING",
    "ENROLLING_BY_INVITATION",
    "ACTIVE_NOT_RECRUITING",
    "SUSPENDED",
    "TERMINATED",
    "COMPLETED",
    "WITHDRAWN",
    "UNKNOWN",
] as const;
export type TrialStatus = (typeof trialStatusEnum)[number];

// Trial phase values
export const trialPhaseEnum = [
    "EARLY_PHASE1",
    "PHASE1",
    "PHASE2",
    "PHASE3",
    "PHASE4",
    "NA",
] as const;
export type TrialPhase = (typeof trialPhaseEnum)[number];

// Contact information
export interface TrialContact {
    name?: string;
    role?: string;
    phone?: string;
    email?: string;
}

// Location with facility and contact info
export interface TrialLocation {
    facility?: string;
    city?: string;
    state?: string;
    country?: string;
    status?: string;
    contacts?: TrialContact[];
}

// Eligibility criteria
export interface TrialEligibility {
    criteria?: string;
    healthyVolunteers?: boolean;
    sex?: string;
    minimumAge?: string;
    maximumAge?: string;
    stdAges?: string[];
}

// Main clinical trial interface (simplified from API response)
export interface ClinicalTrial {
    nctId: string;
    briefTitle: string;
    officialTitle?: string;
    briefSummary?: string;
    detailedDescription?: string;
    overallStatus: TrialStatus;
    phases?: TrialPhase[];
    studyType?: string;
    conditions?: string[];
    interventions?: {
        type?: string;
        name?: string;
        description?: string;
    }[];
    eligibility?: TrialEligibility;
    locations?: TrialLocation[];
    centralContacts?: TrialContact[];
    sponsor?: {
        name?: string;
        class?: string;
    };
    startDate?: string;
    completionDate?: string;
    enrollmentCount?: number;
    lastUpdateDate?: string;
}

// Search parameters
export const trialSearchParamsSchema = z.object({
    condition: z.string().optional(),
    location: z.string().optional(),
    status: z.string().optional(),
    phase: z.string().optional(),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    pageToken: z.string().optional(),
});

export type TrialSearchParams = z.infer<typeof trialSearchParamsSchema>;

// API response wrapper
export interface TrialSearchResponse {
    studies: ClinicalTrial[];
    totalCount: number;
    nextPageToken?: string;
}
