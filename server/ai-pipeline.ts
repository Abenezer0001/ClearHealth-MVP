import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { storage } from "./storage";
import type { Analysis } from "@shared/schema";

const openai = createOpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const RED_FLAG_KEYWORDS = [
  "chest pain", "heart attack", "stroke", "can't breathe", "suicidal",
  "overdose", "severe bleeding", "pregnancy bleeding", "seizure",
  "anaphylaxis", "severe allergic", "unconscious", "paralysis",
  "crushing chest", "sudden numbness", "slurred speech"
];

const DOSAGE_PATTERNS = [
  /\d+\s*(mg|ml|mcg|iu|tablets?|capsules?|pills?|doses?)\s*(per|\/|\s)?\s*(day|daily|hour|hourly)/gi,
  /take\s+\d+\s*(mg|ml|tablet|capsule|pill)/gi,
  /\d+\s*x\s*\d+\s*(mg|ml)/gi,
];

function checkRedFlags(text: string): string[] {
  const lowerText = text.toLowerCase();
  return RED_FLAG_KEYWORDS.filter(keyword => lowerText.includes(keyword.toLowerCase()));
}

function filterDosageInstructions(text: string): string {
  let filtered = text;
  DOSAGE_PATTERNS.forEach(pattern => {
    filtered = filtered.replace(pattern, "[dosage information removed for safety]");
  });
  return filtered;
}

async function getTrustedSourcesContext(): Promise<string> {
  const sources = await storage.getAllSourceDocuments();
  if (sources.length === 0) {
    return `Trusted Health Sources Reference:
- WHO: Vaccines are safe and effective. Antibiotics do not work against viruses.
- CDC: Flu is caused by viruses. Antibiotics only treat bacterial infections.
- NHS: Common colds and flu cannot be cured with antibiotics.
- Medical consensus: Type 1 diabetes requires insulin management. No diet can cure it.
- Evidence: MMR vaccine does not cause autism - this has been extensively studied.`;
  }
  return sources.map(s => `[${s.organization}] ${s.title}: ${s.content}`).join("\n\n");
}

const ClaimsExtractionSchema = z.object({
  language: z.string(),
  topics: z.array(z.string()),
  claims: z.array(z.object({
    claim_text: z.string(),
    claim_type: z.enum(["factual", "medical_advice", "conspiracy", "anecdote", "other"]),
    topic: z.string(),
    target_population: z.enum(["general", "pregnancy", "child", "elderly", "chronic_condition"]),
    urgency_hint: z.enum(["none", "low", "medium", "high"]),
    potential_harm: z.enum(["low", "medium", "high"]),
    certainty_in_text: z.number().min(0).max(1),
  })),
});

const RiskAssessmentSchema = z.object({
  overall_severity: z.enum(["low", "medium", "high", "critical"]),
  per_claim: z.array(z.object({
    claim_text: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    risk_reason: z.string(),
    stance: z.enum(["supported", "contradicted", "uncertain", "partially_supported"]),
    stance_confidence: z.number().min(0).max(1),
    stance_explanation: z.string(),
    citations: z.array(z.object({
      source_org: z.string(),
      source_title: z.string(),
      source_url: z.string(),
      snippet: z.string(),
      relevance: z.number().min(0).max(1),
    })),
  })),
});

const CounterMessageSchema = z.object({
  disclaimer: z.string(),
  what_is_wrong: z.string(),
  what_we_know: z.string(),
  what_to_do: z.string(),
  when_to_seek_care: z.string(),
  uncertainty_notes: z.string(),
  outputs: z.array(z.object({
    format: z.enum(["social_reply", "patient_handout", "clinician_note"]),
    length: z.enum(["brief", "medium", "detailed"]),
    content: z.string(),
  })),
});

export async function runAnalysisPipeline(analysisId: number): Promise<void> {
  const analysis = await storage.getAnalysis(analysisId);
  if (!analysis) throw new Error("Analysis not found");

  try {
    await storage.updateAnalysis(analysisId, { status: "running" });

    const redFlags = checkRedFlags(analysis.inputText);
    const hasRedFlags = redFlags.length > 0;

    const { object: claimsData } = await generateObject({
      model: openai("gpt-5-mini"),
      schema: ClaimsExtractionSchema,
      system: `You are a health misinformation analyst. Extract atomic health claims from the text.
Rules:
- Split combined claims into atomic ones
- Keep claims close to original wording
- Do not introduce new facts`,
      prompt: analysis.inputText,
    });

    const topics = claimsData.topics || [];

    const storedClaims: { id: number; claim_text: string }[] = [];
    for (const claim of claimsData.claims) {
      const storedClaim = await storage.createClaim({
        analysisId,
        claimText: claim.claim_text,
        claimType: claim.claim_type,
        topic: claim.topic,
        targetPopulation: claim.target_population,
        urgencyHint: claim.urgency_hint,
        potentialHarm: claim.potential_harm,
        certaintyInText: Math.round(claim.certainty_in_text * 100),
      });
      storedClaims.push({ id: storedClaim.id, claim_text: claim.claim_text });
    }

    const sourcesContext = await getTrustedSourcesContext();
    
    const { object: riskData } = await generateObject({
      model: openai("gpt-5-mini"),
      schema: RiskAssessmentSchema,
      system: `You are a health misinformation analyst with access to trusted sources.
Analyze each claim and determine:
1. Risk level (low/medium/high/critical)
2. Whether it's supported, contradicted, or uncertain based on evidence
3. Provide citations from trusted sources

Trusted Sources:
${sourcesContext}

Rules:
- If evidence is insufficient, stance should be "uncertain"
- Critical severity if: advice could cause serious harm, emergency symptoms, medication interference
- High severity if: could delay proper treatment, affects vulnerable groups
- Medium severity if: misleading but unlikely to cause direct harm
- Low severity if: minor inaccuracies with minimal health impact`,
      prompt: `Analyze these claims:\n${storedClaims.map(c => `- ${c.claim_text}`).join("\n")}`,
    });

    const overallSeverity = hasRedFlags ? "critical" : riskData.overall_severity;

    for (const claimData of riskData.per_claim) {
      const storedClaim = storedClaims.find(c => {
        const claimTextLower = c.claim_text.toLowerCase();
        const riskClaimLower = claimData.claim_text.toLowerCase();
        return claimTextLower.includes(riskClaimLower.substring(0, 30)) || 
               riskClaimLower.includes(claimTextLower.substring(0, 30));
      });
      
      if (storedClaim) {
        await storage.updateClaim(storedClaim.id, {
          stance: claimData.stance,
          stanceConfidence: Math.round(claimData.stance_confidence * 100),
          stanceExplanation: claimData.stance_explanation,
          severity: claimData.severity,
          riskReason: claimData.risk_reason,
        });

        for (const citation of claimData.citations) {
          await storage.createCitation({
            claimId: storedClaim.id,
            sourceOrg: citation.source_org,
            sourceTitle: citation.source_title,
            sourceUrl: citation.source_url || "",
            snippet: citation.snippet,
            relevance: Math.round(citation.relevance * 100),
          });
        }
      }
    }

    const { object: counterData } = await generateObject({
      model: openai("gpt-5-mini"),
      schema: CounterMessageSchema,
      system: `You are a health communication expert. Generate counter-messages for health misinformation.
Settings: Region=${analysis.region}, Tone=${analysis.tone}, Audience=${analysis.audience}, Platform=${analysis.platform}

Generate 9 outputs (3 formats x 3 lengths): social_reply, patient_handout, clinician_note in brief, medium, detailed lengths.

Critical Rules:
- NEVER provide medication dosages or specific treatment instructions
- NEVER diagnose conditions
- Always recommend consulting healthcare providers
- If critical/emergency: focus on immediate safety, not debate
- Include [1], [2] etc for citations in content`,
      prompt: `Original text: ${analysis.inputText}

Claims analysis:
${JSON.stringify(riskData.per_claim, null, 2)}

${hasRedFlags ? `CRITICAL: Red flags detected: ${redFlags.join(", ")}. Prioritize safety messaging.` : ""}`,
    });

    const filteredOutputs = counterData.outputs.map(o => ({
      ...o,
      content: filterDosageInstructions(o.content)
    }));

    for (const output of filteredOutputs) {
      await storage.createGeneratedOutput({
        analysisId,
        format: output.format,
        length: output.length,
        content: output.content,
      });
    }

    await storage.updateAnalysis(analysisId, {
      status: "done",
      overallSeverity,
      redFlagsDetected: hasRedFlags,
      redFlags: hasRedFlags ? redFlags : [],
      topics,
      disclaimer: counterData.disclaimer,
      whatIsWrong: filterDosageInstructions(counterData.what_is_wrong),
      whatWeKnow: filterDosageInstructions(counterData.what_we_know),
      whatToDo: filterDosageInstructions(counterData.what_to_do),
      whenToSeekCare: counterData.when_to_seek_care,
      uncertaintyNotes: counterData.uncertainty_notes,
      completedAt: new Date(),
    });

  } catch (error) {
    console.error("Analysis pipeline error:", error);
    await storage.updateAnalysis(analysisId, {
      status: "failed",
      completedAt: new Date(),
    });
    throw error;
  }
}
