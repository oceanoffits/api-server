import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { env } from "../env.js";

// Resend "Inbound Email" Webhook-Payload (vereinfacht auf die Felder, die wir brauchen)
const inboundPayloadSchema = z.object({
  from: z.string(),
  subject: z.string().optional(),
  text: z.string().optional(),
});

function extractEmailAddress(from: string): string {
  const match = from.match(/<(.+)>/);
  return (match ? match[1] : from).trim().toLowerCase();
}

export async function webhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/resend-inbound", async (request, reply) => {
    const { secret } = z.object({ secret: z.string().optional() }).parse(request.query);
    if (secret !== env.RESEND_INBOUND_SECRET) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const payload = inboundPayloadSchema.parse(request.body);
    const fromEmail = extractEmailAddress(payload.from);

    const influencer = await prisma.influencer.findFirst({
      where: { email: { equals: fromEmail, mode: "insensitive" } },
    });

    if (!influencer) {
      request.log.warn(`Inbound email von unbekanntem Absender: ${fromEmail}`);
      return reply.code(202).send({ matched: false });
    }

    await prisma.message.create({
      data: {
        influencerId: influencer.id,
        channel: "EMAIL",
        direction: "INBOUND",
        subject: payload.subject,
        body: payload.text ?? "",
        status: "REPLIED",
      },
    });

    await prisma.influencer.update({
      where: { id: influencer.id },
      data: { status: "REPLIED" },
    });

    return reply.code(200).send({ matched: true });
  });
}
