# Trial Scoring Benchmark Harness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reproducible local benchmark that compares legacy scoring vs current scoring on curated eligibility scenarios and reports accuracy deltas.

**Architecture:** Create a small benchmark module with curated cases, a legacy-scoring replica, and evaluation helpers. Add tests that enforce expected benchmark behavior and prevent regressions where disqualified cases score too high. Keep production scoring unchanged.

**Tech Stack:** TypeScript, Node test runner (`node:test`), existing server scoring function (`computeMatchScore`).

---

### Task 1: Add failing benchmark tests

**Files:**
- Create: `server/__tests__/trial-scoring-benchmark.test.ts`
- Test: `server/__tests__/trial-scoring-benchmark.test.ts`

**Step 1: Write the failing test**

- Add tests that import a not-yet-created benchmark module and assert:
- Current scorer accuracy is higher than legacy scorer accuracy.
- A known edge case (`condition_mismatch_with_other_passes`) is classified as `unlikely` by current scorer.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test server/__tests__/trial-scoring-benchmark.test.ts`  
Expected: FAIL due to missing module/export.

### Task 2: Implement benchmark harness

**Files:**
- Create: `server/trial-scoring-benchmark.ts`

**Step 1: Write minimal implementation**

- Add:
- `BenchmarkCase` type.
- Curated `benchmarkCases` array (covering clear eligible, clear ineligible, and uncertain cases).
- `computeLegacyScore` function replicating pre-change scoring behavior.
- `classifyScore` helper.
- `runTrialScoringBenchmark` helper returning per-method accuracy and per-case predictions.

**Step 2: Run tests to verify they pass**

Run: `node --import tsx --test server/__tests__/trial-scoring-benchmark.test.ts`  
Expected: PASS.

### Task 3: Verify scoring tests and benchmark suite together

**Files:**
- Reuse: `server/__tests__/trial-matching-score.test.ts`
- Reuse: `server/__tests__/trial-scoring-benchmark.test.ts`

**Step 1: Run combined test command**

Run: `node --import tsx --test server/__tests__/trial-matching-score.test.ts server/__tests__/trial-scoring-benchmark.test.ts`  
Expected: PASS.

**Step 2: Run benchmark output command**

Run: `node --import tsx -e "import('./server/trial-scoring-benchmark.ts').then(m => console.log(JSON.stringify(m.runTrialScoringBenchmark(), null, 2)))"`  
Expected: JSON summary showing current scorer accuracy and legacy scorer accuracy.

