import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";

export interface ResearchSuggestion {
  name: string;
  instagramHandle: string | null;
  estimatedFollowers: number | null;
  matchReason: string;
  pitchAngle: string;
}

export async function researchInfluencerCandidates(params: {
  niche: string;
  campaignGoal?: string;
  count?: number;
}): Promise<ResearchSuggestion[]> {
  const { niche, campaignGoal, count = 5 } = params;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Du bist Recherche-Assistent für "Ocean Office" und hilfst dabei, passende Instagram-Influencer für eine Kooperations-Kampagne zu finden.

Nische: ${niche}
${campaignGoal ? `Kampagnen-Ziel / Kontext: ${campaignGoal}` : ""}

Schlage ${count} Instagram-Influencer bzw. Creator-Profile vor, die inhaltlich sehr gut zu dieser Nische passen würden. Nutze dein Wissen über bekannte Accounts und typische Creator-Profile in diesem Bereich.

Antworte NUR mit einem JSON-Array der Länge ${count}, jedes Element exakt in dieser Form:
{"name": "...", "instagramHandle": "... (ohne @, oder null falls unbekannt)", "estimatedFollowers": Zahl oder null, "matchReason": "kurzer Grund, warum das Profil zur Nische passt", "pitchAngle": "konkreter Vorschlag für den Kooperations-Ansatz bei diesem Profil"}

Keine Erklärung außerhalb des JSON, kein Markdown, nur das reine JSON-Array.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude hat keinen Text zurückgegeben");
  }

  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude-Antwort wurde wegen max_tokens abgeschnitten");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error(`Claude hat kein valides JSON zurückgegeben: ${textBlock.text}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Claude-Antwort war kein JSON-Array");
  }

  return parsed as ResearchSuggestion[];
}
