import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Analysis status enum
export const analysisStatusEnum = ["pending", "running", "done", "failed"] as const;
export type AnalysisStatus = typeof analysisStatusEnum[number];

// Severity enum
export const severityEnum = ["low", "medium", "high", "critical"] as const;
export type Severity = typeof severityEnum[number];

// Stance enum
export const stanceEnum = ["supported", "contradicted", "uncertain"] as const;
export type Stance = typeof stanceEnum[number];

// Output format enum
export const outputFormatEnum = ["social_reply", "handout", "clinician_note"] as const;
export type OutputFormat = typeof outputFormatEnum[number];

// Output length enum
export const outputLengthEnum = ["short", "medium", "long"] as const;
export type OutputLength = typeof outputLengthEnum[number];

// Users table (keep existing)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Analysis table - stores each misinformation analysis request
export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  inputType: text("input_type").notNull(), // "text" | "url"
  inputText: text("input_text").notNull(),
  inputUrl: text("input_url"),
  region: text("region").notNull().default("WHO"), // WHO | US | UK
  tone: text("tone").notNull().default("neutral"), // neutral | empathetic | direct
  audience: text("audience").notNull().default("general"), // general | patient | clinician
  platform: text("platform").notNull().default("general"), // general | social | email
  status: text("status").notNull().default("pending"),
  overallSeverity: text("overall_severity"),
  redFlagsDetected: boolean("red_flags_detected").default(false),
  redFlags: jsonb("red_flags").$type<string[]>(),
  topics: jsonb("topics").$type<string[]>(),
  disclaimer: text("disclaimer"),
  whatIsWrong: text("what_is_wrong"),
  whatWeKnow: text("what_we_know"),
  whatToDo: text("what_to_do"),
  whenToSeekCare: text("when_to_seek_care"),
  uncertaintyNotes: text("uncertainty_notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

// Claims table - stores extracted claims from analysis
export const claims = pgTable("claims", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull().references(() => analyses.id, { onDelete: "cascade" }),
  claimText: text("claim_text").notNull(),
  claimType: text("claim_type").notNull(), // factual | medical_advice | conspiracy | anecdote | other
  topic: text("topic"),
  targetPopulation: text("target_population").default("general"),
  urgencyHint: text("urgency_hint").default("none"), // none | low | medium | high
  potentialHarm: text("potential_harm").default("low"), // low | medium | high
  certaintyInText: integer("certainty_in_text").default(50), // 0-100
  stance: text("stance"), // supported | contradicted | uncertain
  stanceConfidence: integer("stance_confidence"), // 0-100
  stanceExplanation: text("stance_explanation"),
  severity: text("severity"), // low | medium | high | critical
  riskReason: text("risk_reason"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertClaimSchema = createInsertSchema(claims).omit({
  id: true,
  createdAt: true,
});

export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claims.$inferSelect;

// Citations table - stores evidence citations for claims
export const citations = pgTable("citations", {
  id: serial("id").primaryKey(),
  claimId: integer("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  sourceOrg: text("source_org").notNull(), // WHO | CDC | NHS | Journal
  sourceTitle: text("source_title").notNull(),
  sourceUrl: text("source_url"),
  snippet: text("snippet"),
  relevance: integer("relevance").default(80), // 0-100
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCitationSchema = createInsertSchema(citations).omit({
  id: true,
  createdAt: true,
});

export type InsertCitation = z.infer<typeof insertCitationSchema>;
export type Citation = typeof citations.$inferSelect;

// Generated outputs table - stores different format/length variations
export const generatedOutputs = pgTable("generated_outputs", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull().references(() => analyses.id, { onDelete: "cascade" }),
  format: text("format").notNull(), // social_reply | handout | clinician_note
  length: text("length").notNull(), // short | medium | long
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertGeneratedOutputSchema = createInsertSchema(generatedOutputs).omit({
  id: true,
  createdAt: true,
});

export type InsertGeneratedOutput = z.infer<typeof insertGeneratedOutputSchema>;
export type GeneratedOutput = typeof generatedOutputs.$inferSelect;

// Feedback table - stores user feedback on analyses
export const feedbacks = pgTable("feedbacks", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull().references(() => analyses.id, { onDelete: "cascade" }),
  rating: text("rating").notNull(), // helpful | not_helpful | missing_sources
  comment: text("comment"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({
  id: true,
  createdAt: true,
});

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbacks.$inferSelect;

// Source documents table - stores trusted source documents for RAG
export const sourceDocuments = pgTable("source_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  organization: text("organization").notNull(), // WHO | CDC | NHS | PubMed
  url: text("url"),
  content: text("content").notNull(),
  category: text("category"), // vaccines | antibiotics | chronic | nutrition | mental_health
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSourceDocumentSchema = createInsertSchema(sourceDocuments).omit({
  id: true,
  createdAt: true,
});

export type InsertSourceDocument = z.infer<typeof insertSourceDocumentSchema>;
export type SourceDocument = typeof sourceDocuments.$inferSelect;

// Example misinformation inputs for demo mode
export const exampleInputs = pgTable("example_inputs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  expectedSeverity: text("expected_severity").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertExampleInputSchema = createInsertSchema(exampleInputs).omit({
  id: true,
  createdAt: true,
});

export type InsertExampleInput = z.infer<typeof insertExampleInputSchema>;
export type ExampleInput = typeof exampleInputs.$inferSelect;

// Zod schemas for API validation
export const analyzeRequestSchema = z.object({
  inputType: z.enum(["text", "url"]),
  inputText: z.string().min(1, "Input text is required"),
  inputUrl: z.string().url().optional(),
  region: z.enum(["WHO", "US", "UK"]).default("WHO"),
  tone: z.enum(["neutral", "empathetic", "direct"]).default("neutral"),
  audience: z.enum(["general", "patient", "clinician"]).default("general"),
  platform: z.enum(["general", "social", "email"]).default("general"),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

export const feedbackRequestSchema = z.object({
  rating: z.enum(["helpful", "not_helpful", "missing_sources"]),
  comment: z.string().optional(),
});

export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

// Full analysis result with claims and citations
export type AnalysisWithDetails = Analysis & {
  claims: (Claim & { citations: Citation[] })[];
  outputs: GeneratedOutput[];
};

// ============================================================================
// User Roles & Patient Shares (Coordinator Inbox)
// ============================================================================

// User role enum
export const userRoleEnum = ["patient", "coordinator"] as const;
export type UserRole = typeof userRoleEnum[number];

// Lead status enum for coordinator workflow
export const leadStatusEnum = ["new", "contacted", "scheduled", "not_fit"] as const;
export type LeadStatus = typeof leadStatusEnum[number];

// Shared fields toggles (what the patient consented to share)
export const sharedFieldsSchema = z.object({
  labs: z.boolean().default(false),
  meds: z.boolean().default(false),
  location: z.boolean().default(false),
  email: z.boolean().default(false),
});
export type SharedFields = z.infer<typeof sharedFieldsSchema>;

// Patient share consent for trial interest
export const patientShares = pgTable("patient_shares", {
  id: serial("id").primaryKey(),
  patientUserId: varchar("patient_user_id").notNull(),

  // Default share (always included when they submit)
  ageRange: varchar("age_range", { length: 20 }),      // e.g., "30-35"
  sex: varchar("sex", { length: 20 }),                 // e.g., "Male"
  diagnosisSummary: text("diagnosis_summary"),         // e.g., "Type 2 Diabetes, Hypertension"

  // Trial they're interested in
  trialNctId: varchar("trial_nct_id", { length: 20 }).notNull(),
  trialTitle: text("trial_title"),

  // Optional fields (only if they toggled consent)
  sharedFields: jsonb("shared_fields").$type<SharedFields>(),
  relevantLabs: text("relevant_labs"),
  activeMeds: text("active_meds"),
  locationCity: varchar("location_city", { length: 100 }),
  contactEmail: varchar("contact_email", { length: 255 }),

  // Status workflow for coordinator
  status: varchar("status", { length: 20 }).default("new").$type<LeadStatus>(),
  coordinatorNotes: text("coordinator_notes"),

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertPatientShareSchema = createInsertSchema(patientShares).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPatientShare = z.infer<typeof insertPatientShareSchema>;
export type PatientShare = typeof patientShares.$inferSelect;
