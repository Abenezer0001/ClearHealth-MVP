export type PreAuthRole = "patient" | "coordinator";
export type AuthEntryIntent = "login" | "register";

const PRE_AUTH_ROLE_KEY = "trialatlas.preAuthRole";

export function parsePreAuthRole(value: string | null): PreAuthRole | null {
  if (value === "patient" || value === "coordinator") {
    return value;
  }
  return null;
}

export function getPreAuthRole(): PreAuthRole | null {
  if (typeof window === "undefined") return null;
  return parsePreAuthRole(window.localStorage.getItem(PRE_AUTH_ROLE_KEY));
}

export function setPreAuthRole(role: PreAuthRole): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRE_AUTH_ROLE_KEY, role);
}

export function clearPreAuthRole(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PRE_AUTH_ROLE_KEY);
}

export function resolveAuthEntryPath(intent: AuthEntryIntent, role: PreAuthRole | null): string {
  if (!role) {
    return `/role-selection?intent=${intent}`;
  }
  return intent === "register" ? "/login?mode=signup" : "/login?mode=signin";
}
