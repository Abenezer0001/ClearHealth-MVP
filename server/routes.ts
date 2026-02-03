import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeRequestSchema, feedbackRequestSchema } from "@shared/schema";
import { runAnalysisPipeline } from "./ai-pipeline";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Analyze endpoint - create analysis and start pipeline
  app.post("/api/analyze", async (req, res) => {
    try {
      const data = analyzeRequestSchema.parse(req.body);
      
      // Create analysis record
      const analysis = await storage.createAnalysis({
        inputType: data.inputType,
        inputText: data.inputText,
        inputUrl: data.inputUrl,
        region: data.region,
        tone: data.tone,
        audience: data.audience,
        platform: data.platform,
        status: "pending",
      });

      // Start pipeline asynchronously
      runAnalysisPipeline(analysis.id).catch((error) => {
        console.error("Pipeline error:", error);
      });

      res.json({ id: analysis.id });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ error: validationError.message });
      } else {
        console.error("Analyze error:", error);
        res.status(500).json({ error: "Failed to start analysis" });
      }
    }
  });

  // Get single analysis with details
  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid analysis ID" });
      }

      const analysis = await storage.getAnalysisWithDetails(id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      res.json(analysis);
    } catch (error) {
      console.error("Get analysis error:", error);
      res.status(500).json({ error: "Failed to fetch analysis" });
    }
  });

  // Get all analyses (history)
  app.get("/api/analyses", async (req, res) => {
    try {
      const analyses = await storage.getAllAnalyses();
      res.json(analyses);
    } catch (error) {
      console.error("Get analyses error:", error);
      res.status(500).json({ error: "Failed to fetch analyses" });
    }
  });

  // Submit feedback
  app.post("/api/analysis/:id/feedback", async (req, res) => {
    try {
      const analysisId = parseInt(req.params.id);
      if (isNaN(analysisId)) {
        return res.status(400).json({ error: "Invalid analysis ID" });
      }

      const data = feedbackRequestSchema.parse(req.body);
      
      const feedback = await storage.createFeedback({
        analysisId,
        rating: data.rating,
        comment: data.comment,
      });

      res.json(feedback);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ error: validationError.message });
      } else {
        console.error("Feedback error:", error);
        res.status(500).json({ error: "Failed to submit feedback" });
      }
    }
  });

  // Admin stats
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  // Get example inputs
  app.get("/api/examples", async (req, res) => {
    try {
      const examples = await storage.getAllExampleInputs();
      res.json(examples);
    } catch (error) {
      console.error("Get examples error:", error);
      res.status(500).json({ error: "Failed to fetch examples" });
    }
  });

  return httpServer;
}
