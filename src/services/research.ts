import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";
const SUBMIT_TOOL_NAME = "submit_suggestions";

export interface ResearchSuggestion {
  name: string;
  instagramHandle: string | null;
  estimatedFollowers: number | null;
  matchReason: string;
  pitchAngle: string;
  sources: string[];
}

interface RawSuggestion {
  name: string;
  instagramHandle?: string;
  estimatedFollowers?: number;
  matchReason: string;
  pitchAngle: string;
  sources?: string[];
}

const submitTool: Anthropic.Tool = {
  name: SUBMIT_TOOL_NAME,
  description:
    "Übermittelt die finale Liste recherchierter Influencer-Vorschläge. Muss als letzter Schritt aufgerufen werden, nachdem jeder Kandidat per web_search verifiziert wurde. Kein Text danach.",
  input_schema: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name des Profils / der Person" },
            instagramHandle: {
              type: "string",
              description: "Instagram-Handle ohne @. Weglassen falls nicht verifiziert.",
            },
            estimatedFollowers: {
              type: "integer",
              description: "Ungefähre Follower-Zahl laut Recherche. Weglassen falls unbekannt.",
            },
            matchReason: { type: "string", description: "Kurzer Grund, warum das Profil zur Nische passt" },
            pitchAngle: {
              type: "string",
              description: "Konkreter Vorschlag für den Kooperations-Ansatz bei diesem Profil",
            },
            sources: {
              type: "array",
              items: { type: "string" },
              description: "URLs, die Handle/Existenz/Follower-Zahl des Accounts belegen",
            },
          },
          required: ["name", "matchReason", "pitchAngle", "sources"],
        },
      },
    },
    required: ["suggestions"],
  },
};

export async function researchInfluencerCandidates(params: {
  niche: string;
  campaignGoal?: string;
  count?: number;
}): Promise<ResearchSuggestion[]> {
  const { niche, campaignGoal, count = 5 } = params;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Du bist Recherche-Assistent für "Ocean Office" und hilfst dabei, passende Instagram-Influencer für eine Kooperations-Kampagne zu finden.

Nische: ${niche}
${campaignGoal ? `Kampagnen-Ziel / Kontext: ${campaignGoal}` : ""}

Nutze das web_search Tool, um echte, aktuell aktive Instagram-Profile in dieser Nische zu finden und zu verifizieren (Handle korrekt, Account existiert, ungefähre Follower-Zahl). Verlasse dich NICHT auf reines Vorwissen ohne Suche — recherchiere jeden Kandidaten, bevor du ihn vorschlägst.

Schlage ${count} Instagram-Influencer bzw. Creator-Profile vor, die inhaltlich sehr gut zu dieser Nische passen würden.

Wenn du mit der Recherche fertig bist, rufe AUSSCHLIESSLICH das Tool "${SUBMIT_TOOL_NAME}" mit genau ${count} Vorschlägen auf, um die Ergebnisse zu übermitteln. Schreibe keinen abschließenden Text — die Übermittlung erfolgt ausschließlich über den Tool-Call.`,
    },
  ];

  let response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }, submitTool],
    messages,
  });

  // server-seitige tool-loop (web_search) kann nach 10 iterationen pausieren,
  // bevor submit_suggestions aufgerufen wurde - einfach fortsetzen lassen
  let continuations = 0;
  while (response.stop_reason === "pause_turn" && continuations < 3) {
    messages.push({ role: "assistant", content: response.content });
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }, submitTool],
      messages,
    });
    continuations += 1;
  }

  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude-Antwort wurde wegen max_tokens abgeschnitten");
  }

  const toolUseBlock = response.content.find(
    (block) => block.type === "tool_use" && block.name === SUBMIT_TOOL_NAME,
  );
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error(`Claude hat ${SUBMIT_TOOL_NAME} nicht aufgerufen (stop_reason: ${response.stop_reason})`);
  }

  const input = toolUseBlock.input as { suggestions?: RawSuggestion[] };
  if (!Array.isArray(input.suggestions)) {
    throw new Error("submit_suggestions wurde ohne suggestions-Array aufgerufen");
  }

  return input.suggestions.map((s) => ({
    name: s.name,
    instagramHandle: s.instagramHandle ?? null,
    estimatedFollowers: s.estimatedFollowers ?? null,
    matchReason: s.matchReason,
    pitchAngle: s.pitchAngle,
    sources: s.sources ?? [],
  }));
}
