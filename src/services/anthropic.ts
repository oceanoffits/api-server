import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import type { Influencer } from "@prisma/client";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";

export async function draftOutreachMessage(params: {
  influencer: Influencer;
  channel: "EMAIL" | "INSTAGRAM";
  templateBody?: string;
}): Promise<{ subject?: string; body: string }> {
  const { influencer, channel, templateBody } = params;

  const context = [
    `Name: ${influencer.name}`,
    influencer.niche ? `Nische: ${influencer.niche}` : null,
    influencer.followerCount ? `Follower: ${influencer.followerCount}` : null,
    influencer.instagramHandle ? `Instagram: @${influencer.instagramHandle}` : null,
    influencer.notes ? `Notizen: ${influencer.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const channelHint =
    channel === "EMAIL"
      ? "Schreibe eine kurze, professionelle Akquise-E-Mail (max. 150 Wörter) inkl. Betreffzeile."
      : "Schreibe eine kurze, lockere Instagram-DM (max. 60 Wörter), keine Betreffzeile, direkt ansprechbar.";

  const templateHint = templateBody
    ? `Orientiere dich an dieser Vorlage, personalisiere sie aber:\n${templateBody}`
    : "";

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Du schreibst Akquise-Nachrichten für "Ocean Office" an Fitness-/Lifestyle-Influencer für eine Kooperation.
${channelHint}
${templateHint}

Influencer-Infos:
${context}

Antworte NUR mit einem JSON-Objekt der Form ${channel === "EMAIL" ? '{"subject": "...", "body": "..."}' : '{"body": "..."}'}, ohne weitere Erklärung.`,
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

  let parsed: { subject?: string; body: string };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error(`Claude hat kein valides JSON zurückgegeben: ${textBlock.text}`);
  }
  return { subject: parsed.subject, body: parsed.body };
}
