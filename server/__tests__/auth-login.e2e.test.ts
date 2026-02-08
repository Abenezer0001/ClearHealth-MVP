import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const BASE_URL = "http://127.0.0.1:5099";
let serverProcess: ChildProcessWithoutNullStreams | null = null;

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Server did not become ready in time");
}

async function ensureServerRunning(): Promise<void> {
  if (serverProcess) return;
  serverProcess = spawn("node", ["--import", "tsx", "server/index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "development",
      DISABLE_VITE_MIDDLEWARE: "true",
      PORT: "5099",
    },
    stdio: "ignore",
  });
  await waitForServer(BASE_URL);
}

after(() => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }
});

test("auth routes are exposed under /api/auth", async () => {
  await ensureServerRunning();
  const response = await fetch(`${BASE_URL}/api/auth/get-session`, {
    headers: { Accept: "application/json" },
  });
  assert.notEqual(response.status, 404);
});

test("trials search requires authentication", async () => {
  await ensureServerRunning();
  const response = await fetch(`${BASE_URL}/api/trials/search?condition=diabetes&pageSize=1`);
  assert.equal(response.status, 401);
});
