import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";

const influencerStatusValues = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "DECLINED",
  "CUSTOMER",
] as const;

const createInfluencerSchema = z.object({
  name: z.string().min(1),
  instagramHandle: z.string().optional(),
  instagramUserId: z.string().optional(),
  email: z.string().email().optional(),
  niche: z.string().optional(),
  followerCount: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

const updateInfluencerSchema = createInfluencerSchema.partial().extend({
  status: z.enum(influencerStatusValues).optional(),
});

export async function influencerRoutes(app: FastifyInstance) {
  app.get("/influencers", async (request) => {
    const query = z
      .object({ status: z.enum(influencerStatusValues).optional(), search: z.string().optional() })
      .parse(request.query);

    return prisma.influencer.findMany({
      where: {
        status: query.status,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { instagramHandle: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  });

  app.get("/influencers/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const influencer = await prisma.influencer.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!influencer) {
      return reply.code(404).send({ error: "not_found" });
    }

    return influencer;
  });

  app.post("/influencers", async (request, reply) => {
    const body = createInfluencerSchema.parse(request.body);
    const influencer = await prisma.influencer.create({ data: body });
    return reply.code(201).send(influencer);
  });

  app.patch("/influencers/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = updateInfluencerSchema.parse(request.body);

    const influencer = await prisma.influencer.update({
      where: { id },
      data: body,
    }).catch(() => null);

    if (!influencer) {
      return reply.code(404).send({ error: "not_found" });
    }

    return influencer;
  });
}
