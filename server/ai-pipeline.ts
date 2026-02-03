import OpenAI from "openai";
import { storage } from "./storage";
import type { Analysis, InsertClaim, InsertCitation, InsertGeneratedOutput } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Emergency/red flag keywords
const RED_FLAG_KEYWORDS = [
  "chest pain", "heart attack", "stroke", "can't breathe", "suicidal",
  "overdose", "severe bleeding", "pregnancy bleeding", "seizure",
  "anaphylaxis", "severe allergic", "unconscious", "paralysis",
  "crushing chest", "sudden numbness", "slurred speech"
];

// Dosage pattern filter
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

// Get trusted sources context (simplified for hackathon - in production would use vector search)
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

export async function runAnalysisPipeline(analysisId: number): Promise<void> {
  const analysis = await storage.getAnalysis(analysisId);
  if (!analysis) throw new Error("Analysis not found");

  try {
    // Update status to running
    await storage.updateAnalysis(analysisId, { status: "running" });

    // Check for red flags first
    const redFlags = checkRedFlags(analysis.inputText);
    const hasRedFlags = redFlags.length > 0;

    // Step 1: Extract Claims
    const claimsResponse = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are a health misinformation analyst. Extract atomic health claims from the text.
Return JSON with this structure:
{
  "language": "en",
  "topics": ["vaccines", "antibiotics", etc],
  "claims": [
    {
      "claim_text": "the exact claim",
      "claim_type": "factual|medical_advice|conspiracy|anecdote|other",
      "topic": "main topic",
      "target_population": "general|pregnancy|child|elderly|chronic_condition",
      "urgency_hint": "none|low|medium|high",
      "potential_harm": "low|medium|high",
      "certainty_in_text": 0.0-1.0
    }
  ]
}
Rules:
- Split combined claims into atomic ones
- Keep claims close to original wording
- Do not introduce new facts`
        },
        {
          role: "user",
          content: analysis.inputText
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    let claimsData;
    try {
      claimsData = JSON.parse(claimsResponse.choices[0]?.message?.content || "{}");
    } catch {
      claimsData = { claims: [], topics: [] };
    }

    const topics = claimsData.topics || [];

    // Store claims
    const storedClaims: { id: number; claim_text: string }[] = [];
    for (const claim of claimsData.claims || []) {
      const storedClaim = await storage.createClaim({
        analysisId,
        claimText: claim.claim_text,
        claimType: claim.claim_type || "other",
        topic: claim.topic,
        targetPopulation: claim.target_population || "general",
        urgencyHint: claim.urgency_hint || "none",
        potentialHarm: claim.potential_harm || "low",
        certaintyInText: Math.round((claim.certainty_in_text || 0.5) * 100),
      });
      storedClaims.push({ id: storedClaim.id, claim_text: claim.claim_text });
    }

    // Step 2: Risk Scoring + Evidence
    const sourcesContext = await getTrustedSourcesContext();
    
    const riskResponse = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are a health misinformation analyst with access to trusted sources.
Analyze each claim and determine:
1. Risk level (low/medium/high/critical)
2. Whether it's supported, contradicted, or uncertain based on evidence
3. Provide citations from trusted sources

Trusted Sources:
${sourcesContext}

Return JSON:
{
  "overall_severity": "low|medium|high|critical",
  "per_claim": [
    {
      "claim_text": "...",
      "severity": "low|medium|high|critical",
      "risk_reason": "why this is risky",
      "stance": "supported|contradicted|uncertain",
      "stance_confidence": 0.0-1.0,
      "stance_explanation": "explanation based on evidence",
      "citations": [
        {
          "source_org": "WHO|CDC|NHS|Journal",
          "source_title": "title of source",
          "source_url": "url if available",
          "snippet": "relevant quote (max 40 words)",
          "relevance": 0.0-1.0
        }
      ]
    }
  ]
}

Rules:
- If evidence is insufficient, stance should be "uncertain"
- Critical severity if: advice could cause serious harm, emergency symptoms, medication interference
- High severity if: could delay proper treatment, affects vulnerable groups
- Medium severity if: misleading but unlikely to cause direct harm
- Low severity if: minor inaccuracies with minimal health impact`
        },
        {
          role: "user",
          content: `Analyze these claims:\n${storedClaims.map(c => `- ${c.claim_text}`).join("\n")}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    let riskData;
    try {
      riskData = JSON.parse(riskResponse.choices[0]?.message?.content || "{}");
    } catch {
      riskData = { overall_severity: "medium", per_claim: [] };
    }

    // Override to critical if red flags detected
    const overallSeverity = hasRedFlags ? "critical" : (riskData.overall_severity || "medium");

    // Update claims with risk data and citations
    for (const claimData of riskData.per_claim || []) {
      // Find matching claim by text similarity
      const storedClaim = storedClaims.find(c => {
        const claimTextLower = c.claim_text.toLowerCase();
        const riskClaimLower = (claimData.claim_text || "").toLowerCase();
        return claimTextLower.includes(riskClaimLower.substring(0, 30)) || 
               riskClaimLower.includes(claimTextLower.substring(0, 30));
      });
      
      if (storedClaim) {
        // Update existing claim with stance/severity (not create new one)
        await storage.updateClaim(storedClaim.id, {
          stance: claimData.stance,
          stanceConfidence: Math.round((claimData.stance_confidence || 0.5) * 100),
          stanceExplanation: claimData.stance_explanation,
          severity: claimData.severity,
          riskReason: claimData.risk_reason,
        });

        // Store citations linked to the existing claim
        for (const citation of claimData.citations || []) {
          await storage.createCitation({
            claimId: storedClaim.id,
            sourceOrg: citation.source_org,
            sourceTitle: citation.source_title,
            sourceUrl: citation.source_url,
            snippet: citation.snippet,
            relevance: Math.round((citation.relevance || 0.8) * 100),
          });
        }
      }
    }

    // Step 3: Generate Counter-Messages
    const counterResponse = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are a health communication expert. Generate counter-messages for health misinformation.
Settings: Region=${analysis.region}, Tone=${analysis.tone}, Audience=${analysis.audience}, Platform=${analysis.platform}

Return JSON:
{
  "disclaimer": "Educational content only - consult healthcare provider",
  "what_is_wrong": "What's inaccurate or missing in the claims",
  "what_we_know": "What current evidence shows",
  "what_to_do": "Safe general guidance (NO dosing!)",
  "when_to_seek_care": "Red flags requiring medical attention",
  "uncertainty_notes": "What we're still uncertain about",
  "outputs": [
    {
      "format": "social_reply|handout|clinician_note",
      "length": "short|medium|long",
      "content": "the formatted response"
    }
  ]
}

Generate 9 outputs (3 formats x 3 lengths).

Critical Rules:
- NEVER provide medication dosages or specific treatment instructions
- NEVER diagnose conditions
- Always recommend consulting healthcare providers
- If critical/emergency: focus on immediate safety, not debate
- Include [1], [2] etc for citations in content`
        },
        {
          role: "user",
          content: `Original text: ${analysis.inputText}

Claims analysis:
${JSON.stringify(riskData.per_claim, null, 2)}

${hasRedFlags ? `CRITICAL: Red flags detected: ${redFlags.join(", ")}. Prioritize safety messaging.` : ""}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    let counterData;
    try {
      counterData = JSON.parse(counterResponse.choices[0]?.message?.content || "{}");
    } catch {
      counterData = {
        disclaimer: "This is for educational purposes only. Consult a healthcare provider.",
        what_is_wrong: "Unable to analyze.",
        what_we_know: "Please consult trusted health sources.",
        what_to_do: "Speak with a healthcare provider.",
        when_to_seek_care: "If you have health concerns, contact a medical professional.",
        outputs: []
      };
    }

    // Filter dosage instructions from outputs
    const filteredOutputs = (counterData.outputs || []).map((o: any) => ({
      ...o,
      content: filterDosageInstructions(o.content || "")
    }));

    // Store generated outputs
    for (const output of filteredOutputs) {
      await storage.createGeneratedOutput({
        analysisId,
        format: output.format,
        length: output.length,
        content: output.content,
      });
    }

    // Update analysis with final results
    await storage.updateAnalysis(analysisId, {
      status: "done",
      overallSeverity,
      redFlagsDetected: hasRedFlags,
      redFlags: hasRedFlags ? redFlags : [],
      topics,
      disclaimer: counterData.disclaimer || "Educational use only.",
      whatIsWrong: filterDosageInstructions(counterData.what_is_wrong || ""),
      whatWeKnow: filterDosageInstructions(counterData.what_we_know || ""),
      whatToDo: filterDosageInstructions(counterData.what_to_do || ""),
      whenToSeekCare: counterData.when_to_seek_care || "",
      uncertaintyNotes: counterData.uncertainty_notes || "",
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
