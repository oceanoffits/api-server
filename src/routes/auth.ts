import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";

const loginSchema = z.object({ password: z.string().min(1) });

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // längen müssen für timingSafeEqual übereinstimmen; ungleiche länge ist ohnehin kein match,
  // ein pauschales false hier verrät keine information über die tatsächliche passwortlänge
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function authRoutes(app: FastifyInstance) {
  // öffentlicher login (kein Bearer nötig): tauscht das kurze, leicht zu merkende
  // App-Passwort gegen den eigentlichen API_BEARER_TOKEN. So braucht das web-ui nur
  // noch EIN passwort statt manuell server-url + langen token zu pflegen.
  app.post("/auth/login", async (request, reply) => {
    const { password } = loginSchema.parse(request.body);

    if (!env.APP_LOGIN_PASSWORD) {
      return reply.code(503).send({ error: "login_not_configured" });
    }

    if (!safeEqual(password, env.APP_LOGIN_PASSWORD)) {
      return reply.code(401).send({ error: "invalid_password" });
    }

    return { token: env.API_BEARER_TOKEN };
  });
}
