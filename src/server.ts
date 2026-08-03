import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { requireBearerAuth } from "./auth.js";
import { influencerRoutes } from "./routes/influencers.js";
import { messageRoutes } from "./routes/messages.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { researchRoutes } from "./routes/research.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true }));

// Webhooks werden extern (von Resend) aufgerufen und nutzen ihr eigenes Secret statt Bearer-Auth
await app.register(webhookRoutes);

await app.register(async (protectedApp) => {
  protectedApp.addHook("preHandler", requireBearerAuth);
  await protectedApp.register(influencerRoutes);
  await protectedApp.register(messageRoutes);
  await protectedApp.register(researchRoutes);
});

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
