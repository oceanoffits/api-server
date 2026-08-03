import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { researchInfluencerCandidates } from "../services/research.js";

const researchSchema = z.object({
  niche: z.string().min(1),
  campaignGoal: z.string().optional(),
  count: z.number().int().min(1).max(10).optional(),
});

export async function researchRoutes(app: FastifyInstance) {
  // KI-Recherche: schlägt zu einer Nische passende Influencer für eine Kampagne vor
  app.post("/research", async (request, reply) => {
    const body = researchSchema.parse(request.body);

    try {
      const suggestions = await researchInfluencerCandidates(body);

      // archivieren, damit die recherche auch dann nachvollziehbar bleibt,
      // wenn daraus angelegte influencer später gelöscht oder vergessen werden
      await prisma.researchResult.create({
        data: {
          niche: body.niche,
          campaignGoal: body.campaignGoal ?? null,
          suggestions: suggestions as unknown as Prisma.InputJsonValue,
        },
      });

      return { niche: body.niche, campaignGoal: body.campaignGoal ?? null, suggestions };
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: "research_failed" });
    }
  });

  // archiv aller bisherigen recherche-läufe
  app.get("/research/history", async () => {
    return prisma.researchResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });
}
