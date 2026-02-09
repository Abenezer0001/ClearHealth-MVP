import { test } from "node:test";
import assert from "node:assert/strict";
import type { EligibilityCriterion } from "@shared/trial-matching";
import { computeMatchScore } from "../trial-matching";

function criterion(
  id: string,
  status: EligibilityCriterion["status"],
  confidence: EligibilityCriterion["confidence"],
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

test("computeMatchScore caps at 25 for high-confidence core disqualifier", () => {
  const criteria: EligibilityCriterion[] = [
    criterion("age", "met", "high", "age"),
    criterion("sex", "met", "high", "sex"),
    criterion("healthy", "met", "medium", "other"),
    criterion("condition", "not_met", "high", "condition"),
  ];

  const result = computeMatchScore(criteria);
  assert.equal(result.hardDisqualifier, true);
  assert.ok(result.rawScore > 25);
  assert.equal(result.finalScore, 25);
});

test("computeMatchScore downweights unknown and missing data", () => {
  const criteria: EligibilityCriterion[] = [
    criterion("known_met", "met", "high", "other"),
    criterion("missing", "missing_data", "high", "other"),
    criterion("unknown", "unknown", "medium", "other"),
    criterion("known_not_met", "not_met", "medium", "other"),
  ];

  const result = computeMatchScore(criteria);
  assert.equal(result.hardDisqualifier, false);
  assert.ok(result.finalScore < 60);
  assert.ok(result.finalScore > 10);
});

test("computeMatchScore gives less credit to low-confidence met criteria", () => {
  const highConfidenceMet: EligibilityCriterion[] = [
    criterion("met", "met", "high", "other"),
    criterion("not_met", "not_met", "high", "other"),
  ];
  const lowConfidenceMet: EligibilityCriterion[] = [
    criterion("met", "met", "low", "other"),
    criterion("not_met", "not_met", "high", "other"),
  ];

  const highResult = computeMatchScore(highConfidenceMet);
  const lowResult = computeMatchScore(lowConfidenceMet);

  assert.ok(lowResult.finalScore < highResult.finalScore);
});
