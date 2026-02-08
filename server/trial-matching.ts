/**
 * AI-Powered Trial Matching Service
 * Uses structured matching for basic criteria + AI for semantic condition matching
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import type { PatientProfile, PatientCondition } from "@shared/fhir-types";
import type { ClinicalTrial, TrialEligibility } from "@shared/trials";
import type {
    EligibilityCriterion,
    TrialMatchResult,
    ConditionMatchResult,
    CriterionStatus,
    ConfidenceLevel,
    getMatchTier,
} from "@shared/trial-matching";
import { getMatchTier as getTier } from "@shared/trial-matching";

// ============================================================================
// Configuration
// ============================================================================

const AI_MODEL = google("gemini-2.0-flash");

// Cache for trial analysis (criteria don't change per patient)
const trialCriteriaCache = new Map<string, EligibilityCriterion[]>();

// ============================================================================
// Age Parsing and Matching
// ============================================================================

/**
 * Parse age string like "18 Years" or "6 Months" to years
 */
export function parseAgeString(ageStr?: string): number | null {
    if (!ageStr) return null;

    const match = ageStr.match(/(\d+)\s*(year|month|week|day)/i);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case "year":
        case "years":
            return value;
        case "month":
        case "months":
            return value / 12;
        case "week":
        case "weeks":
            return value / 52;
        case "day":
        case "days":
            return value / 365;
        default:
            return value; // Assume years
    }
}

/**
 * Match patient age against trial requirements
 */
export function matchAge(
    patientAge: number | undefined,
    minAge?: string,
    maxAge?: string
): EligibilityCriterion {
    const minYears = parseAgeString(minAge);
    const maxYears = parseAgeString(maxAge);

    const criterion: EligibilityCriterion = {
        id: "age",
        name: "Age Requirement",
        category: "age",
        status: "unknown",
        confidence: "high",
        requiredValue: minAge && maxAge
            ? `${minAge} - ${maxAge}`
            : minAge
                ? `≥ ${minAge}`
                : maxAge
                    ? `≤ ${maxAge}`
                    : "Any age",
    };

    if (patientAge === undefined) {
        criterion.status = "missing_data";
        criterion.patientValue = "Age not available";
        return criterion;
    }

    criterion.patientValue = `${patientAge} years`;

    if (minYears === null && maxYears === null) {
        criterion.status = "met";
        criterion.description = "No age restrictions";
        return criterion;
    }

    const meetsMin = minYears === null || patientAge >= minYears;
    const meetsMax = maxYears === null || patientAge <= maxYears;

    if (meetsMin && meetsMax) {
        criterion.status = "met";
        criterion.description = "Age within required range";
    } else {
        criterion.status = "not_met";
        criterion.description = !meetsMin
            ? `Patient is younger than minimum age (${minAge})`
            : `Patient is older than maximum age (${maxAge})`;
    }

    return criterion;
}

// ============================================================================
// Sex Matching
// ============================================================================

/**
 * Match patient sex against trial requirements
 */
export function matchSex(
    patientSex: string | undefined,
    requiredSex?: string
): EligibilityCriterion {
    const criterion: EligibilityCriterion = {
        id: "sex",
        name: "Sex Requirement",
        category: "sex",
        status: "unknown",
        confidence: "high",
        requiredValue: requiredSex || "All",
    };

    if (!patientSex) {
        criterion.status = "missing_data";
        criterion.patientValue = "Sex not specified";
        return criterion;
    }

    criterion.patientValue = patientSex;

    // "All" or undefined means no restriction
    if (!requiredSex || requiredSex.toLowerCase() === "all") {
        criterion.status = "met";
        criterion.description = "No sex restrictions";
        return criterion;
    }

    // Normalize for comparison
    const patientNorm = patientSex.toLowerCase();
    const requiredNorm = requiredSex.toLowerCase();

    if (patientNorm === requiredNorm ||
        (patientNorm === "m" && requiredNorm === "male") ||
        (patientNorm === "f" && requiredNorm === "female") ||
        (patientNorm === "male" && requiredNorm === "m") ||
        (patientNorm === "female" && requiredNorm === "f")) {
        criterion.status = "met";
    } else {
        criterion.status = "not_met";
        criterion.description = `Trial requires ${requiredSex} participants`;
    }

    return criterion;
}

// ============================================================================
// Healthy Volunteers Check
// ============================================================================

/**
 * Check if patient qualifies based on healthy volunteers requirement
 */
export function matchHealthyVolunteers(
    patientConditions: PatientCondition[],
    healthyVolunteers?: boolean
): EligibilityCriterion {
    const criterion: EligibilityCriterion = {
        id: "healthy_volunteers",
        name: "Healthy Volunteers",
        category: "other",
        status: "unknown",
        confidence: "medium",
        requiredValue: healthyVolunteers === true
            ? "Accepts healthy volunteers"
            : healthyVolunteers === false
                ? "No healthy volunteers"
                : "Not specified",
    };

    // If trial accepts healthy volunteers, anyone can join
    if (healthyVolunteers === true || healthyVolunteers === undefined) {
        criterion.status = "met";
        criterion.description = "Trial accepts participants with or without conditions";
        return criterion;
    }

    // Otherwise, patient should have conditions
    const activeConditions = patientConditions.filter(
        c => c.clinicalStatus?.toLowerCase() === "active"
    );

    criterion.patientValue = `${activeConditions.length} active conditions`;

    if (activeConditions.length > 0) {
        criterion.status = "met";
        criterion.description = "Patient has medical conditions as required";
    } else {
        criterion.status = "not_met";
        criterion.description = "Trial requires participants with medical conditions";
    }

    return criterion;
}

// ============================================================================
// AI-Powered Semantic Condition Matching
// ============================================================================

/**
 * Use AI to semantically match patient conditions to trial conditions
 */
export async function semanticMatchConditions(
    patientConditions: PatientCondition[],
    trialConditions: string[]
): Promise<ConditionMatchResult[]> {
    if (!trialConditions.length || !patientConditions.length) {
        return trialConditions.map(tc => ({
            trialCondition: tc,
            isMatch: false,
            confidence: "low" as ConfidenceLevel,
            reasoning: "No patient conditions to compare",
        }));
    }

    const patientConditionNames = patientConditions
        .filter(c => c.clinicalStatus?.toLowerCase() === "active")
        .map(c => c.display)
        .join(", ");

    const prompt = `You are a medical matching assistant. Match patient conditions to clinical trial conditions.

PATIENT CONDITIONS:
${patientConditionNames}

TRIAL CONDITIONS (what the trial is studying):
${trialConditions.join(", ")}

For each trial condition, determine if any of the patient's conditions match or are related.
Consider:
- Exact matches (e.g., "Hypertension" = "High Blood Pressure")
- Related conditions (e.g., "Type 2 Diabetes" relates to "Diabetes Mellitus")
- Subtypes (e.g., "Essential Hypertension" is a type of "Hypertension")

Respond in JSON format:
{
  "matches": [
    {
      "trialCondition": "condition name from trial",
      "patientCondition": "matching patient condition or null",
      "isMatch": true/false,
      "confidence": "high/medium/low",
      "reasoning": "brief explanation"
    }
  ]
}

IMPORTANT: Return ONLY valid JSON, no markdown, no explanations outside JSON.`;

    try {
        const { text } = await generateText({
            model: AI_MODEL,
            prompt,
        });

        // Parse the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("AI response not valid JSON:", text);
            return fallbackConditionMatch(patientConditions, trialConditions);
        }

        const result = JSON.parse(jsonMatch[0]);
        return result.matches as ConditionMatchResult[];
    } catch (error) {
        console.error("AI condition matching error:", error);
        return fallbackConditionMatch(patientConditions, trialConditions);
    }
}

/**
 * Fallback keyword matching when AI is unavailable
 */
function fallbackConditionMatch(
    patientConditions: PatientCondition[],
    trialConditions: string[]
): ConditionMatchResult[] {
    const patientNames = patientConditions
        .map(c => c.display.toLowerCase());

    return trialConditions.map(tc => {
        const tcLower = tc.toLowerCase();
        const match = patientNames.find(pc =>
            pc.includes(tcLower) || tcLower.includes(pc)
        );

        return {
            trialCondition: tc,
            patientCondition: match,
            isMatch: !!match,
            confidence: match ? "medium" as ConfidenceLevel : "low" as ConfidenceLevel,
            reasoning: match
                ? "Keyword match found"
                : "No matching condition found",
        };
    });
}

// ============================================================================
// AI-Powered Eligibility Criteria Analysis
// ============================================================================

/**
 * Analyze freeform eligibility criteria against patient profile
 */
export async function analyzeEligibilityCriteria(
    criteriaText: string | undefined,
    patientProfile: PatientProfile
): Promise<EligibilityCriterion[]> {
    if (!criteriaText || criteriaText.length < 10) {
        return [];
    }

    // Build patient summary for AI
    const patientSummary = {
        age: patientProfile.demographics.age,
        sex: patientProfile.demographics.gender,
        conditions: patientProfile.conditions.map(c => c.display).slice(0, 10),
        medications: patientProfile.medications.map(m => m.display).slice(0, 10),
        labResults: patientProfile.labResults.slice(0, 5).map(l =>
            `${l.display}: ${l.value ?? l.valueString ?? 'N/A'} ${l.unit ?? ''}`
        ),
    };

    const prompt = `You are a medical eligibility screening assistant. Analyze trial eligibility criteria against a patient profile.

PATIENT PROFILE:
${JSON.stringify(patientSummary, null, 2)}

ELIGIBILITY CRITERIA TEXT:
${criteriaText.substring(0, 2000)}

Extract the key eligibility criteria and determine for each if the patient meets it.

Respond in JSON format:
{
  "criteria": [
    {
      "id": "unique_id",
      "name": "Short criterion name",
      "description": "What this criterion requires",
      "category": "inclusion|exclusion|other",
      "status": "met|not_met|missing_data|unknown",
      "patientValue": "Relevant patient data or null",
      "requiredValue": "What the trial requires",
      "confidence": "high|medium|low",
      "aiReasoning": "Brief explanation of why this status was assigned"
    }
  ]
}

Guidelines:
- Extract no more than 8 key criteria
- "met" = patient clearly qualifies
- "not_met" = patient clearly disqualified
- "missing_data" = we don't have the data to determine
- "unknown" = criteria is ambiguous or requires clinical judgment
- Exclusion criteria: if patient has what's excluded, status = "not_met"

IMPORTANT: Return ONLY valid JSON, no markdown.`;

    try {
        const { text } = await generateText({
            model: AI_MODEL,
            prompt,
        });

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("AI eligibility analysis - invalid JSON:", text);
            return [];
        }

        const result = JSON.parse(jsonMatch[0]);
        return (result.criteria || []).map((c: any, i: number) => ({
            id: c.id || `criteria_${i}`,
            name: c.name || "Unknown Criterion",
            description: c.description,
            category: c.category || "other",
            status: c.status || "unknown",
            patientValue: c.patientValue,
            requiredValue: c.requiredValue,
            confidence: c.confidence || "low",
            aiReasoning: c.aiReasoning,
        })) as EligibilityCriterion[];
    } catch (error) {
        console.error("AI eligibility analysis error:", error);
        return [];
    }
}

// ============================================================================
// Main Match Calculator
// ============================================================================

/**
 * Calculate complete match result for a trial against a patient
 */
export async function calculateTrialMatch(
    trial: ClinicalTrial,
    patientProfile: PatientProfile
): Promise<TrialMatchResult> {
    const criteria: EligibilityCriterion[] = [];
    const eligibility = trial.eligibility || {};

    // 1. Structured matching (fast, high confidence)
    criteria.push(matchAge(
        patientProfile.demographics.age,
        eligibility.minimumAge,
        eligibility.maximumAge
    ));

    criteria.push(matchSex(
        patientProfile.demographics.gender,
        eligibility.sex
    ));

    criteria.push(matchHealthyVolunteers(
        patientProfile.conditions,
        eligibility.healthyVolunteers
    ));

    // 2. AI semantic condition matching
    const conditionMatches = await semanticMatchConditions(
        patientProfile.conditions,
        trial.conditions || []
    );

    // Add condition match as a criterion
    const hasConditionMatch = conditionMatches.some(m => m.isMatch);
    criteria.push({
        id: "condition_match",
        name: "Relevant Condition",
        category: "condition",
        status: hasConditionMatch ? "met" : "not_met",
        confidence: hasConditionMatch ? "high" : "medium",
        patientValue: patientProfile.conditions.slice(0, 3).map(c => c.display).join(", "),
        requiredValue: trial.conditions?.slice(0, 3).join(", ") || "Not specified",
        aiReasoning: conditionMatches.find(m => m.isMatch)?.reasoning,
    });

    // 3. AI analysis of freeform eligibility criteria
    const aiCriteria = await analyzeEligibilityCriteria(
        eligibility.criteria,
        patientProfile
    );
    criteria.push(...aiCriteria);

    // Calculate scores
    const metCriteria = criteria.filter(c => c.status === "met").length;
    const notMetCriteria = criteria.filter(c => c.status === "not_met").length;
    const missingDataCriteria = criteria.filter(c => c.status === "missing_data").length;
    const unknownCriteria = criteria.filter(c => c.status === "unknown").length;
    const totalCriteria = criteria.length;

    // Score calculation:
    // - "met" = 100%
    // - "not_met" = 0%
    // - "missing_data" = 50% (benefit of doubt)
    // - "unknown" = 50%
    const score = totalCriteria > 0
        ? Math.round(
            ((metCriteria * 100) +
                (missingDataCriteria * 50) +
                (unknownCriteria * 50)) / totalCriteria
        )
        : 0;

    // Hard disqualifier: if any "not_met" with high confidence, cap score
    const hardDisqualifier = criteria.find(
        c => c.status === "not_met" && c.confidence === "high"
    );
    const finalScore = hardDisqualifier ? Math.min(score, 30) : score;

    return {
        nctId: trial.nctId,
        briefTitle: trial.briefTitle,
        trial,
        matchScore: finalScore,
        matchTier: getTier(finalScore),
        totalCriteria,
        metCriteria,
        notMetCriteria,
        missingDataCriteria,
        unknownCriteria,
        criteria,
        matchedConditions: conditionMatches,
    };
}

/**
 * Match multiple trials and sort by best match
 */
export async function matchTrialsForPatient(
    trials: ClinicalTrial[],
    patientProfile: PatientProfile,
    options?: { minScore?: number; limit?: number }
): Promise<TrialMatchResult[]> {
    const { minScore = 0, limit = 20 } = options || {};

    // Process trials in parallel with concurrency limit
    const results = await Promise.all(
        trials.slice(0, 50).map(trial => calculateTrialMatch(trial, patientProfile))
    );

    // Filter and sort
    return results
        .filter(r => r.matchScore >= minScore)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit);
}
