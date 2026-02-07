import {
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
import { getMongoDb, getNextSequence } from "./mongo";

type WithMongoId<T> = T & { _id?: string };

export interface IStorage {
  createAnalysis(data: InsertAnalysis): Promise<Analysis>;
  getAnalysis(id: number): Promise<Analysis | undefined>;
  getAnalysisWithDetails(id: number): Promise<AnalysisWithDetails | undefined>;
  getAllAnalyses(): Promise<Analysis[]>;
  updateAnalysis(id: number, data: Partial<Analysis>): Promise<Analysis | undefined>;
  createClaim(data: InsertClaim): Promise<Claim>;
  updateClaim(id: number, data: Partial<Claim>): Promise<Claim | undefined>;
  getClaimsByAnalysis(analysisId: number): Promise<Claim[]>;
  createCitation(data: InsertCitation): Promise<Citation>;
  getCitationsByClaim(claimId: number): Promise<Citation[]>;
  createGeneratedOutput(data: InsertGeneratedOutput): Promise<GeneratedOutput>;
  getOutputsByAnalysis(analysisId: number): Promise<GeneratedOutput[]>;
  createFeedback(data: InsertFeedback): Promise<Feedback>;
  getFeedbackByAnalysis(analysisId: number): Promise<Feedback[]>;
  createSourceDocument(data: InsertSourceDocument): Promise<SourceDocument>;
  getAllSourceDocuments(): Promise<SourceDocument[]>;
  createExampleInput(data: InsertExampleInput): Promise<ExampleInput>;
  getAllExampleInputs(): Promise<ExampleInput[]>;
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

function stripMongoId<T extends { _id?: unknown }>(doc: T): Omit<T, "_id"> {
  const { _id: _ignored, ...rest } = doc;
  return rest;
}

function sortByCreatedAtDesc<T extends { createdAt: Date }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export const storage: IStorage = {
  async createAnalysis(data: InsertAnalysis): Promise<Analysis> {
    const db = await getMongoDb();
    const id = await getNextSequence("analyses");
    const analysis: Analysis = {
      id,
      inputType: data.inputType,
      inputText: data.inputText,
      inputUrl: data.inputUrl ?? null,
      region: data.region ?? "WHO",
      tone: data.tone ?? "neutral",
      audience: data.audience ?? "general",
      platform: data.platform ?? "general",
      status: data.status ?? "pending",
      overallSeverity: data.overallSeverity ?? null,
      redFlagsDetected: data.redFlagsDetected ?? false,
      redFlags: data.redFlags ?? null,
      topics: data.topics ?? null,
      disclaimer: data.disclaimer ?? null,
      whatIsWrong: data.whatIsWrong ?? null,
      whatWeKnow: data.whatWeKnow ?? null,
      whatToDo: data.whatToDo ?? null,
      whenToSeekCare: data.whenToSeekCare ?? null,
      uncertaintyNotes: data.uncertaintyNotes ?? null,
      createdAt: new Date(),
      completedAt: data.completedAt ?? null,
    };
    await db.collection<WithMongoId<Analysis>>("analyses").insertOne(analysis);
    return analysis;
  },

  async getAnalysis(id: number): Promise<Analysis | undefined> {
    const db = await getMongoDb();
    const analysis = await db.collection<WithMongoId<Analysis>>("analyses").findOne({ id });
    return analysis ? stripMongoId(analysis) : undefined;
  },

  async getAnalysisWithDetails(id: number): Promise<AnalysisWithDetails | undefined> {
    const analysis = await this.getAnalysis(id);
    if (!analysis) return undefined;

    const claimsList = await this.getClaimsByAnalysis(id);
    const outputs = await this.getOutputsByAnalysis(id);
    const claimsWithCitations = await Promise.all(
      claimsList.map(async (claim) => ({
        ...claim,
        citations: await this.getCitationsByClaim(claim.id),
      })),
    );

    return {
      ...analysis,
      claims: claimsWithCitations,
      outputs,
    };
  },

  async getAllAnalyses(): Promise<Analysis[]> {
    const db = await getMongoDb();
    const analyses = await db.collection<WithMongoId<Analysis>>("analyses").find({}).toArray();
    return sortByCreatedAtDesc(analyses.map(stripMongoId));
  },

  async updateAnalysis(id: number, data: Partial<Analysis>): Promise<Analysis | undefined> {
    const db = await getMongoDb();
    await db.collection<WithMongoId<Analysis>>("analyses").updateOne({ id }, { $set: data });
    return this.getAnalysis(id);
  },

  async createClaim(data: InsertClaim): Promise<Claim> {
    const db = await getMongoDb();
    const id = await getNextSequence("claims");
    const claim: Claim = {
      id,
      analysisId: data.analysisId,
      claimText: data.claimText,
      claimType: data.claimType,
      topic: data.topic ?? null,
      targetPopulation: data.targetPopulation ?? "general",
      urgencyHint: data.urgencyHint ?? "none",
      potentialHarm: data.potentialHarm ?? "low",
      certaintyInText: data.certaintyInText ?? 50,
      stance: data.stance ?? null,
      stanceConfidence: data.stanceConfidence ?? null,
      stanceExplanation: data.stanceExplanation ?? null,
      severity: data.severity ?? null,
      riskReason: data.riskReason ?? null,
      createdAt: new Date(),
    };
    await db.collection<WithMongoId<Claim>>("claims").insertOne(claim);
    return claim;
  },

  async updateClaim(id: number, data: Partial<Claim>): Promise<Claim | undefined> {
    const db = await getMongoDb();
    await db.collection<WithMongoId<Claim>>("claims").updateOne({ id }, { $set: data });
    const claim = await db.collection<WithMongoId<Claim>>("claims").findOne({ id });
    return claim ? stripMongoId(claim) : undefined;
  },

  async getClaimsByAnalysis(analysisId: number): Promise<Claim[]> {
    const db = await getMongoDb();
    const items = await db.collection<WithMongoId<Claim>>("claims").find({ analysisId }).toArray();
    return items.map(stripMongoId);
  },

  async createCitation(data: InsertCitation): Promise<Citation> {
    const db = await getMongoDb();
    const id = await getNextSequence("citations");
    const citation: Citation = {
      id,
      claimId: data.claimId,
      sourceOrg: data.sourceOrg,
      sourceTitle: data.sourceTitle,
      sourceUrl: data.sourceUrl ?? null,
      snippet: data.snippet ?? null,
      relevance: data.relevance ?? 80,
      createdAt: new Date(),
    };
    await db.collection<WithMongoId<Citation>>("citations").insertOne(citation);
    return citation;
  },

  async getCitationsByClaim(claimId: number): Promise<Citation[]> {
    const db = await getMongoDb();
    const items = await db
      .collection<WithMongoId<Citation>>("citations")
      .find({ claimId })
      .toArray();
    return items.map(stripMongoId);
  },

  async createGeneratedOutput(data: InsertGeneratedOutput): Promise<GeneratedOutput> {
    const db = await getMongoDb();
    const id = await getNextSequence("generated_outputs");
    const output: GeneratedOutput = {
      id,
      analysisId: data.analysisId,
      format: data.format,
      length: data.length,
      content: data.content,
      createdAt: new Date(),
    };
    await db.collection<WithMongoId<GeneratedOutput>>("generated_outputs").insertOne(output);
    return output;
  },

  async getOutputsByAnalysis(analysisId: number): Promise<GeneratedOutput[]> {
    const db = await getMongoDb();
    const items = await db
      .collection<WithMongoId<GeneratedOutput>>("generated_outputs")
      .find({ analysisId })
      .toArray();
    return items.map(stripMongoId);
  },

  async createFeedback(data: InsertFeedback): Promise<Feedback> {
    const db = await getMongoDb();
    const id = await getNextSequence("feedbacks");
    const feedback: Feedback = {
      id,
      analysisId: data.analysisId,
      rating: data.rating,
      comment: data.comment ?? null,
      createdAt: new Date(),
    };
    await db.collection<WithMongoId<Feedback>>("feedbacks").insertOne(feedback);
    return feedback;
  },

  async getFeedbackByAnalysis(analysisId: number): Promise<Feedback[]> {
    const db = await getMongoDb();
    const items = await db.collection<WithMongoId<Feedback>>("feedbacks").find({ analysisId }).toArray();
    return items.map(stripMongoId);
  },

  async createSourceDocument(data: InsertSourceDocument): Promise<SourceDocument> {
    const db = await getMongoDb();
    const id = await getNextSequence("source_documents");
    const doc: SourceDocument = {
      id,
      title: data.title,
      organization: data.organization,
      url: data.url ?? null,
      content: data.content,
      category: data.category ?? null,
      createdAt: new Date(),
    };
    await db.collection<WithMongoId<SourceDocument>>("source_documents").insertOne(doc);
    return doc;
  },

  async getAllSourceDocuments(): Promise<SourceDocument[]> {
    const db = await getMongoDb();
    const items = await db.collection<WithMongoId<SourceDocument>>("source_documents").find({}).toArray();
    return items.map(stripMongoId);
  },

  async createExampleInput(data: InsertExampleInput): Promise<ExampleInput> {
    const db = await getMongoDb();
    const id = await getNextSequence("example_inputs");
    const example: ExampleInput = {
      id,
      title: data.title,
      content: data.content,
      category: data.category,
      expectedSeverity: data.expectedSeverity,
      createdAt: new Date(),
    };
    await db.collection<WithMongoId<ExampleInput>>("example_inputs").insertOne(example);
    return example;
  },

  async getAllExampleInputs(): Promise<ExampleInput[]> {
    const db = await getMongoDb();
    const items = await db.collection<WithMongoId<ExampleInput>>("example_inputs").find({}).toArray();
    return items.map(stripMongoId);
  },

  async getAdminStats() {
    const [allAnalyses, allFeedbacks] = await Promise.all([
      this.getAllAnalyses(),
      (async () => {
        const db = await getMongoDb();
        const items = await db.collection<WithMongoId<Feedback>>("feedbacks").find({}).toArray();
        return items.map(stripMongoId);
      })(),
    ]);

    const totalAnalyses = allAnalyses.length;
    const criticalCount = allAnalyses.filter((a) => a.overallSeverity === "critical").length;

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

    const severityCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    allAnalyses.forEach((a) => {
      if (a.overallSeverity && severityCounts[a.overallSeverity] !== undefined) {
        severityCounts[a.overallSeverity]++;
      }
    });
    const severityDistribution = Object.entries(severityCounts)
      .map(([severity, count]) => ({ severity, count }))
      .filter((s) => s.count > 0);

    const recentCritical = sortByCreatedAtDesc(
      allAnalyses.filter((a) => a.overallSeverity === "critical"),
    )
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        inputText: a.inputText,
        createdAt: a.createdAt,
        topics: a.topics,
      }));

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
