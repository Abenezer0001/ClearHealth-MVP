import { createAuthClient } from "better-auth/react";

const baseURL = import.meta.env.VITE_SERVER_URL || window.location.origin;

export const authClient = createAuthClient({
  baseURL,
});
