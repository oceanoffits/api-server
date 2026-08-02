import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./env.js";

export function requireBearerAuth(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token || token !== env.API_BEARER_TOKEN) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }

  done();
}
