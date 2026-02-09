import { test } from "node:test";
import assert from "node:assert/strict";
import { benchmarkCases, runTrialScoringBenchmark } from "../trial-scoring-benchmark";

test("benchmark shows improved accuracy for current scorer", () => {
  const summary = runTrialScoringBenchmark(benchmarkCases);

  assert.ok(summary.current.accuracy > summary.legacy.accuracy);
});

test("condition mismatch case is classified as unlikely by current scorer", () => {
  const summary = runTrialScoringBenchmark(benchmarkCases);
  const target = summary.perCase.find((item) => item.id === "condition_mismatch_with_other_passes");

  assert.ok(target);
  assert.equal(target?.expected, "unlikely");
  assert.equal(target?.currentLabel, "unlikely");
});
