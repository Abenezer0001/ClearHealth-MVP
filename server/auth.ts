import "./env";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const isProduction = process.env.NODE_ENV === "production";

function getMongoUri(): string {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error("DATABASE_URL is required");
  }
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error("DATABASE_URL must be a MongoDB URI (mongodb:// or mongodb+srv://)");
  }
  return uri;
}

const authMongoClient = new MongoClient(getMongoUri());
void authMongoClient.connect().catch((error) => {
  console.error("Failed to connect auth Mongo client:", error);
});
const authDatabase = authMongoClient.db();

const trustedOrigins = Array.from(
  new Set([
    process.env.CORS_ORIGIN,
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
  ].filter(Boolean) as string[]),
);

export const auth = betterAuth({
  database: mongodbAdapter(authDatabase),
  baseURL: process.env.BETTER_AUTH_BASE_URL,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: null,
        input: false, // prevent user setting via signup
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET ?? "clearhealth-mvp-dev-secret-change-me",
  advanced: {
    defaultCookieAttributes: isProduction
      ? {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      }
      : {
        sameSite: "lax",
        secure: false,
        httpOnly: true,
      },
  },
});

