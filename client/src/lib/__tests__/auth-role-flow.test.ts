import { after, test } from "node:test";
import assert from "node:assert/strict";
import { ensureRoleForSignedInUser } from "../auth-role-flow";

const originalFetch = globalThis.fetch;

after(() => {
  globalThis.fetch = originalFetch;
});

test("ensureRoleForSignedInUser tolerates role-already-set race and proceeds", async () => {
  let meCalls = 0;

  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url === "/api/user/me") {
      meCalls += 1;
      const role = meCalls === 1 ? null : "patient";
      return new Response(JSON.stringify({ role }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url === "/api/user/role" && init?.method === "PATCH") {
      return new Response(JSON.stringify({ error: "Role already set" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await ensureRoleForSignedInUser("patient");
  assert.deepEqual(result, { status: "assigned", role: "patient" });
});

test("ensureRoleForSignedInUser returns mismatch when existing role differs", async () => {
  globalThis.fetch = (async (input: string | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url !== "/api/user/me") {
      throw new Error(`Unexpected request: ${url}`);
    }
    return new Response(JSON.stringify({ role: "coordinator" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const result = await ensureRoleForSignedInUser("patient");
  assert.deepEqual(result, { status: "mismatch", role: "coordinator" });
});

test("ensureRoleForSignedInUser retries transient unauthorized role fetches", async () => {
  let meCalls = 0;

  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url === "/api/user/me") {
      meCalls += 1;
      if (meCalls === 1) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ role: "patient" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url === "/api/user/role" && init?.method === "PATCH") {
      return new Response(JSON.stringify({ success: true, role: "patient" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await ensureRoleForSignedInUser("patient");
  assert.deepEqual(result, { status: "matched", role: "patient" });
  assert.ok(meCalls >= 2);
});
