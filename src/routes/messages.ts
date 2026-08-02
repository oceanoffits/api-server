import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { draftOutreachMessage } from "../services/anthropic.js";
import { sendEmail } from "../services/resend.js";

const channelSchema = z.enum(["EMAIL", "INSTAGRAM"]);

const messageStatusSchema = z.enum(["DRAFT", "PENDING_APPROVAL", "SENT", "FAILED", "REPLIED"]);

export async function messageRoutes(app: FastifyInstance) {
  // Nachrichten übergreifend auflisten (z.B. für die Instagram-Queue in der App)
  app.get("/messages", async (request) => {
    const query = z
      .object({ channel: channelSchema.optional(), status: messageStatusSchema.optional() })
      .parse(request.query);

    return prisma.message.findMany({
      where: { channel: query.channel, status: query.status },
      include: { influencer: true },
      orderBy: { createdAt: "desc" },
    });
  });

  // KI-Entwurf für einen Influencer generieren
  app.post("/influencers/:id/draft", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { channel, templateId } = z
      .object({ channel: channelSchema, templateId: z.string().optional() })
      .parse(request.body);

    const influencer = await prisma.influencer.findUnique({ where: { id } });
    if (!influencer) {
      return reply.code(404).send({ error: "influencer_not_found" });
    }

    if (channel === "EMAIL" && !influencer.email) {
      return reply.code(400).send({ error: "influencer_has_no_email" });
    }
    if (channel === "INSTAGRAM" && !influencer.instagramHandle) {
      return reply.code(400).send({ error: "influencer_has_no_instagram_handle" });
    }

    const template = templateId
      ? await prisma.template.findUnique({ where: { id: templateId } })
      : null;

    const draft = await draftOutreachMessage({
      influencer,
      channel,
      templateBody: template?.bodyTemplate,
    });

    const message = await prisma.message.create({
      data: {
        influencerId: id,
        channel,
        direction: "OUTBOUND",
        subject: draft.subject,
        body: draft.body,
        status: "DRAFT",
      },
    });

    return reply.code(201).send(message);
  });

  // Editierten Entwurf speichern, bevor er versendet wird
  app.patch("/messages/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({ subject: z.string().optional(), body: z.string().optional() })
      .parse(request.body);

    const message = await prisma.message
      .update({ where: { id }, data: body })
      .catch(() => null);

    if (!message) {
      return reply.code(404).send({ error: "not_found" });
    }
    return message;
  });

  // E-Mail tatsächlich versenden (Instagram wird manuell versendet, siehe mark-sent)
  app.post("/messages/:id/send", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const message = await prisma.message.findUnique({
      where: { id },
      include: { influencer: true },
    });

    if (!message) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (message.channel !== "EMAIL") {
      return reply.code(400).send({ error: "only_email_can_be_sent_via_api" });
    }
    if (!message.influencer.email) {
      return reply.code(400).send({ error: "influencer_has_no_email" });
    }

    try {
      const result = await sendEmail({
        to: message.influencer.email,
        subject: message.subject ?? "Kooperation mit Ocean Office",
        body: message.body,
      });

      const updated = await prisma.message.update({
        where: { id },
        data: { status: "SENT", sentAt: new Date(), externalId: result?.id },
      });

      await prisma.influencer.update({
        where: { id: message.influencerId },
        data: { status: "CONTACTED" },
      });

      return updated;
    } catch (err) {
      await prisma.message.update({ where: { id }, data: { status: "FAILED" } });
      request.log.error(err);
      return reply.code(502).send({ error: "email_send_failed" });
    }
  });

  // Instagram (oder E-Mail) manuell als gesendet markieren
  app.post("/messages/:id/mark-sent", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const message = await prisma.message
      .update({ where: { id }, data: { status: "SENT", sentAt: new Date() } })
      .catch(() => null);

    if (!message) {
      return reply.code(404).send({ error: "not_found" });
    }

    await prisma.influencer.update({
      where: { id: message.influencerId },
      data: { status: "CONTACTED" },
    });

    return message;
  });

  // Antwort manuell erfassen (z.B. Instagram-DM-Antwort, die wir nicht automatisiert auslesen)
  app.post("/messages/:id/mark-replied", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { replyBody } = z.object({ replyBody: z.string().optional() }).parse(request.body ?? {});

    const original = await prisma.message.findUnique({ where: { id } });
    if (!original) {
      return reply.code(404).send({ error: "not_found" });
    }

    await prisma.message.update({ where: { id }, data: { status: "REPLIED" } });

    if (replyBody) {
      await prisma.message.create({
        data: {
          influencerId: original.influencerId,
          channel: original.channel,
          direction: "INBOUND",
          body: replyBody,
          status: "REPLIED",
        },
      });
    }

    const influencer = await prisma.influencer.update({
      where: { id: original.influencerId },
      data: { status: "REPLIED" },
    });

    return influencer;
  });
}
