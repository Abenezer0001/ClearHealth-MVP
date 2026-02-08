import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePreAuthRole } from "../pre-auth-role";

test("parsePreAuthRole accepts only patient or coordinator", () => {
  assert.equal(parsePreAuthRole("patient"), "patient");
  assert.equal(parsePreAuthRole("coordinator"), "coordinator");
  assert.equal(parsePreAuthRole("admin"), null);
  assert.equal(parsePreAuthRole(""), null);
  assert.equal(parsePreAuthRole(null), null);
});
