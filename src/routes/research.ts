import type { FastifyInstance } from "fastify";
import { z } from "zod";
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
      return { niche: body.niche, campaignGoal: body.campaignGoal ?? null, suggestions };
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: "research_failed" });
    }
  });
}
