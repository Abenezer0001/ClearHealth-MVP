import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  analyses,
  claims,
  citations,
  generatedOutputs,
  feedbacks,
  sourceDocuments,
  exampleInputs,
  type Analysis,
  type InsertAnalysis,
  type Claim,
  type InsertClaim,
  type Citation,
  type InsertCitation,
  type GeneratedOutput,
  type InsertGeneratedOutput,
  type Feedback,
  type InsertFeedback,
  type SourceDocument,
  type InsertSourceDocument,
  type ExampleInput,
  type InsertExampleInput,
  type AnalysisWithDetails,
} from "@shared/schema";

export interface IStorage {
  // Analyses
  createAnalysis(data: InsertAnalysis): Promise<Analysis>;
  getAnalysis(id: number): Promise<Analysis | undefined>;
  getAnalysisWithDetails(id: number): Promise<AnalysisWithDetails | undefined>;
  getAllAnalyses(): Promise<Analysis[]>;
  updateAnalysis(id: number, data: Partial<Analysis>): Promise<Analysis | undefined>;

  // Claims
  createClaim(data: InsertClaim): Promise<Claim>;
  updateClaim(id: number, data: Partial<Claim>): Promise<Claim | undefined>;
  getClaimsByAnalysis(analysisId: number): Promise<Claim[]>;

  // Citations
  createCitation(data: InsertCitation): Promise<Citation>;
  getCitationsByClaim(claimId: number): Promise<Citation[]>;

  // Generated Outputs
  createGeneratedOutput(data: InsertGeneratedOutput): Promise<GeneratedOutput>;
  getOutputsByAnalysis(analysisId: number): Promise<GeneratedOutput[]>;

  // Feedback
  createFeedback(data: InsertFeedback): Promise<Feedback>;
  getFeedbackByAnalysis(analysisId: number): Promise<Feedback[]>;

  // Source Documents
  createSourceDocument(data: InsertSourceDocument): Promise<SourceDocument>;
  getAllSourceDocuments(): Promise<SourceDocument[]>;

  // Example Inputs
  createExampleInput(data: InsertExampleInput): Promise<ExampleInput>;
  getAllExampleInputs(): Promise<ExampleInput[]>;

  // Admin Stats
  getAdminStats(): Promise<{
    totalAnalyses: number;
    criticalCount: number;
    topTopics: { topic: string; count: number }[];
    severityDistribution: { severity: string; count: number }[];
    recentCritical: {
      id: number;
      inputText: string;
      createdAt: Date;
      topics: string[] | null;
    }[];
    feedbackSummary: {
      helpful: number;
      notHelpful: number;
      missingSources: number;
    };
  }>;
}

export const storage: IStorage = {
  // Analyses
  async createAnalysis(data: InsertAnalysis): Promise<Analysis> {
    const [analysis] = await db.insert(analyses).values(data).returning();
    return analysis;
  },

  async getAnalysis(id: number): Promise<Analysis | undefined> {
    const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id));
    return analysis;
  },

  async getAnalysisWithDetails(id: number): Promise<AnalysisWithDetails | undefined> {
    const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id));
    if (!analysis) return undefined;

    const claimsList = await db.select().from(claims).where(eq(claims.analysisId, id));
    const outputs = await db.select().from(generatedOutputs).where(eq(generatedOutputs.analysisId, id));

    const claimsWithCitations = await Promise.all(
      claimsList.map(async (claim) => {
        const citationsList = await db.select().from(citations).where(eq(citations.claimId, claim.id));
        return { ...claim, citations: citationsList };
      })
    );

    return {
      ...analysis,
      claims: claimsWithCitations,
      outputs,
    };
  },

  async getAllAnalyses(): Promise<Analysis[]> {
    return db.select().from(analyses).orderBy(desc(analyses.createdAt));
  },

  async updateAnalysis(id: number, data: Partial<Analysis>): Promise<Analysis | undefined> {
    const [updated] = await db.update(analyses).set(data).where(eq(analyses.id, id)).returning();
    return updated;
  },

  // Claims
  async createClaim(data: InsertClaim): Promise<Claim> {
    const [claim] = await db.insert(claims).values(data).returning();
    return claim;
  },

  async updateClaim(id: number, data: Partial<Claim>): Promise<Claim | undefined> {
    const [updated] = await db.update(claims).set(data).where(eq(claims.id, id)).returning();
    return updated;
  },

  async getClaimsByAnalysis(analysisId: number): Promise<Claim[]> {
    return db.select().from(claims).where(eq(claims.analysisId, analysisId));
  },

  // Citations
  async createCitation(data: InsertCitation): Promise<Citation> {
    const [citation] = await db.insert(citations).values(data).returning();
    return citation;
  },

  async getCitationsByClaim(claimId: number): Promise<Citation[]> {
    return db.select().from(citations).where(eq(citations.claimId, claimId));
  },

  // Generated Outputs
  async createGeneratedOutput(data: InsertGeneratedOutput): Promise<GeneratedOutput> {
    const [output] = await db.insert(generatedOutputs).values(data).returning();
    return output;
  },

  async getOutputsByAnalysis(analysisId: number): Promise<GeneratedOutput[]> {
    return db.select().from(generatedOutputs).where(eq(generatedOutputs.analysisId, analysisId));
  },

  // Feedback
  async createFeedback(data: InsertFeedback): Promise<Feedback> {
    const [feedback] = await db.insert(feedbacks).values(data).returning();
    return feedback;
  },

  async getFeedbackByAnalysis(analysisId: number): Promise<Feedback[]> {
    return db.select().from(feedbacks).where(eq(feedbacks.analysisId, analysisId));
  },

  // Source Documents
  async createSourceDocument(data: InsertSourceDocument): Promise<SourceDocument> {
    const [doc] = await db.insert(sourceDocuments).values(data).returning();
    return doc;
  },

  async getAllSourceDocuments(): Promise<SourceDocument[]> {
    return db.select().from(sourceDocuments);
  },

  // Example Inputs
  async createExampleInput(data: InsertExampleInput): Promise<ExampleInput> {
    const [example] = await db.insert(exampleInputs).values(data).returning();
    return example;
  },

  async getAllExampleInputs(): Promise<ExampleInput[]> {
    return db.select().from(exampleInputs);
  },

  // Admin Stats
  async getAdminStats() {
    const allAnalyses = await db.select().from(analyses);
    const allFeedbacks = await db.select().from(feedbacks);

    const totalAnalyses = allAnalyses.length;
    const criticalCount = allAnalyses.filter((a) => a.overallSeverity === "critical").length;

    // Topic frequency
    const topicCounts: Record<string, number> = {};
    allAnalyses.forEach((a) => {
      (a.topics || []).forEach((topic) => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
    });
    const topTopics = Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Severity distribution
    const severityCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    allAnalyses.forEach((a) => {
      if (a.overallSeverity && severityCounts[a.overallSeverity] !== undefined) {
        severityCounts[a.overallSeverity]++;
      }
    });
    const severityDistribution = Object.entries(severityCounts)
      .map(([severity, count]) => ({ severity, count }))
      .filter((s) => s.count > 0);

    // Recent critical
    const recentCritical = allAnalyses
      .filter((a) => a.overallSeverity === "critical")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        inputText: a.inputText,
        createdAt: a.createdAt,
        topics: a.topics,
      }));

    // Feedback summary
    const feedbackSummary = {
      helpful: allFeedbacks.filter((f) => f.rating === "helpful").length,
      notHelpful: allFeedbacks.filter((f) => f.rating === "not_helpful").length,
      missingSources: allFeedbacks.filter((f) => f.rating === "missing_sources").length,
    };

    return {
      totalAnalyses,
      criticalCount,
      topTopics,
      severityDistribution,
      recentCritical,
      feedbackSummary,
    };
  },
};
