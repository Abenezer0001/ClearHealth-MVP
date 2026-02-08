import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePreAuthRole, resolveAuthEntryPath } from "../pre-auth-role";

test("parsePreAuthRole accepts only patient or coordinator", () => {
  assert.equal(parsePreAuthRole("patient"), "patient");
  assert.equal(parsePreAuthRole("coordinator"), "coordinator");
  assert.equal(parsePreAuthRole("admin"), null);
  assert.equal(parsePreAuthRole(""), null);
  assert.equal(parsePreAuthRole(null), null);
});

test("resolveAuthEntryPath routes to role selection when role is missing", () => {
  assert.equal(resolveAuthEntryPath("login", null), "/role-selection?intent=login");
  assert.equal(resolveAuthEntryPath("register", null), "/role-selection?intent=register");
});

test("resolveAuthEntryPath routes directly to login when role already selected", () => {
  assert.equal(resolveAuthEntryPath("login", "patient"), "/login?mode=signin");
  assert.equal(resolveAuthEntryPath("register", "coordinator"), "/login?mode=signup");
});
