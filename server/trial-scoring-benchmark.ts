import type { ConfidenceLevel, CriterionStatus, EligibilityCriterion } from "@shared/trial-matching";
import { computeMatchScore } from "./trial-matching";

export type BenchmarkLabel = "likely" | "possible" | "unlikely";

export interface BenchmarkCase {
  id: string;
  description: string;
  expected: BenchmarkLabel;
  criteria: EligibilityCriterion[];
}

interface MethodSummary {
  correct: number;
  total: number;
  accuracy: number;
}

interface CasePrediction {
  id: string;
  expected: BenchmarkLabel;
  legacyLabel: BenchmarkLabel;
  legacyScore: number;
  currentLabel: BenchmarkLabel;
  currentScore: number;
}

export interface BenchmarkSummary {
  legacy: MethodSummary;
  current: MethodSummary;
  perCase: CasePrediction[];
}

function criterion(
  id: string,
  status: CriterionStatus,
  confidence: ConfidenceLevel,
  category: EligibilityCriterion["category"] = "other",
): EligibilityCriterion {
  return {
    id,
    name: id,
    category,
    status,
    confidence,
  };
}

export const benchmarkCases: BenchmarkCase[] = [
  {
    id: "strong_clear_match",
    description: "All structured checks met with high confidence",
    expected: "likely",
    criteria: [
      criterion("age", "met", "high", "age"),
      criterion("sex", "met", "high", "sex"),
      criterion("condition", "met", "high", "condition"),
      criterion("healthy", "met", "medium", "other"),
    ],
  },
  {
    id: "partial_match_with_unknown_core",
    description: "One strong inclusion plus unknown core criterion should not be likely",
    expected: "possible",
    criteria: [
      criterion("age", "met", "high", "age"),
      criterion("condition_detail", "unknown", "high", "condition"),
    ],
  },
  {
    id: "all_uncertain_data",
    description: "Only missing/unknown data should rank unlikely",
    expected: "unlikely",
    criteria: [
      criterion("age", "missing_data", "high", "age"),
      criterion("condition", "unknown", "high", "condition"),
      criterion("lab", "unknown", "medium", "lab"),
    ],
  },
  {
    id: "age_disqualifier",
    description: "High-confidence core disqualifier should force unlikely",
    expected: "unlikely",
    criteria: [
      criterion("age", "not_met", "high", "age"),
      criterion("sex", "met", "high", "sex"),
      criterion("condition", "met", "high", "condition"),
      criterion("healthy", "met", "medium", "other"),
    ],
  },
  {
    id: "condition_mismatch_with_other_passes",
    description: "Condition mismatch despite other criteria met should be unlikely",
    expected: "unlikely",
    criteria: [
      criterion("age", "met", "high", "age"),
      criterion("sex", "met", "high", "sex"),
      criterion("healthy", "met", "medium", "other"),
      criterion("condition", "not_met", "high", "condition"),
    ],
  },
  {
    id: "mixed_but_supportive",
    description: "Two met plus some uncertainty can still be possible",
    expected: "possible",
    criteria: [
      criterion("age", "met", "high", "age"),
      criterion("condition", "met", "medium", "condition"),
      criterion("lab", "unknown", "medium", "lab"),
    ],
  },
  {
    id: "one_met_with_missing",
    description: "One met with missing evidence should be possible, not likely",
    expected: "possible",
    criteria: [
      criterion("condition", "met", "high", "condition"),
      criterion("lab", "missing_data", "medium", "lab"),
      criterion("exclusion_detail", "unknown", "medium", "exclusion"),
    ],
  },
  {
    id: "all_missing",
    description: "No concrete matched evidence should stay unlikely",
    expected: "unlikely",
    criteria: [
      criterion("age", "missing_data", "high", "age"),
      criterion("condition", "missing_data", "medium", "condition"),
    ],
  },
];

export function classifyScore(score: number): BenchmarkLabel {
  if (score >= 70) return "likely";
  if (score >= 40) return "possible";
  return "unlikely";
}

export function computeLegacyScore(criteria: EligibilityCriterion[]): number {
  const metCriteria = criteria.filter((c) => c.status === "met").length;
  const missingDataCriteria = criteria.filter((c) => c.status === "missing_data").length;
  const unknownCriteria = criteria.filter((c) => c.status === "unknown").length;
  const totalCriteria = criteria.length;

  const rawScore =
    totalCriteria > 0
      ? Math.round(
          ((metCriteria * 100) +
            (missingDataCriteria * 50) +
            (unknownCriteria * 50)) / totalCriteria,
        )
      : 0;

  const hasHighConfidenceNotMet = criteria.some(
    (c) => c.status === "not_met" && c.confidence === "high",
  );
  return hasHighConfidenceNotMet ? Math.min(rawScore, 30) : rawScore;
}

export function runTrialScoringBenchmark(
  cases: BenchmarkCase[] = benchmarkCases,
): BenchmarkSummary {
  let legacyCorrect = 0;
  let currentCorrect = 0;

  const perCase: CasePrediction[] = cases.map((benchmarkCase) => {
    const legacyScore = computeLegacyScore(benchmarkCase.criteria);
    const currentScore = computeMatchScore(benchmarkCase.criteria).finalScore;

    const legacyLabel = classifyScore(legacyScore);
    const currentLabel = classifyScore(currentScore);

    if (legacyLabel === benchmarkCase.expected) legacyCorrect += 1;
    if (currentLabel === benchmarkCase.expected) currentCorrect += 1;

    return {
      id: benchmarkCase.id,
      expected: benchmarkCase.expected,
      legacyLabel,
      legacyScore,
      currentLabel,
      currentScore,
    };
  });

  const total = cases.length;
  return {
    legacy: {
      correct: legacyCorrect,
      total,
      accuracy: total > 0 ? legacyCorrect / total : 0,
    },
    current: {
      correct: currentCorrect,
      total,
      accuracy: total > 0 ? currentCorrect / total : 0,
    },
    perCase,
  };
}
