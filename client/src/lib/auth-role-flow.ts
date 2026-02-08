import type { PreAuthRole } from "./pre-auth-role";

export type EnsureRoleResult =
  | { status: "matched"; role: PreAuthRole }
  | { status: "assigned"; role: PreAuthRole }
  | { status: "mismatch"; role: PreAuthRole };

type UserRole = PreAuthRole | null;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUserRole(options?: { retries?: number; retryDelayMs?: number }): Promise<UserRole> {
  const retries = options?.retries ?? 0;
  const retryDelayMs = options?.retryDelayMs ?? 150;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch("/api/user/me", {
      credentials: "include",
      cache: "no-store",
    });

    if (response.ok) {
      const data = (await response.json()) as { role?: UserRole };
      return data.role ?? null;
    }

    if (response.status === 401 && attempt < retries) {
      await sleep(retryDelayMs * (attempt + 1));
      continue;
    }

    throw new Error(`Failed to fetch user role (${response.status})`);
  }

  throw new Error("Failed to fetch user role");
}

async function assignUserRole(role: PreAuthRole): Promise<void> {
  const response = await fetch("/api/user/role", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 400 && data.error === "Role already set") {
      return;
    }
    if (response.status === 409 && data.error?.startsWith("Role already set to")) {
      return;
    }
    throw new Error(data.error || "Failed to assign role");
  }
}

export async function ensureRoleForSignedInUser(selectedRole: PreAuthRole): Promise<EnsureRoleResult> {
  const role = await fetchUserRole({ retries: 6, retryDelayMs: 125 });

  if (!role) {
    await assignUserRole(selectedRole);
    const refreshedRole = await fetchUserRole({ retries: 6, retryDelayMs: 125 });
    if (!refreshedRole) {
      throw new Error("Role was not persisted");
    }
    if (refreshedRole !== selectedRole) {
      return { status: "mismatch", role: refreshedRole };
    }
    return { status: "assigned", role: selectedRole };
  }

  if (role !== selectedRole) {
    return { status: "mismatch", role };
  }

  return { status: "matched", role };
}
