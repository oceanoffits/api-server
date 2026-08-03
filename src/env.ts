import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_BEARER_TOKEN: z.string().min(8),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().min(1),
  RESEND_INBOUND_SECRET: z.string().min(8),
  ANTHROPIC_API_KEY: z.string().min(1),
  // optional: instagram dm versand läuft erst, wenn diese gesetzt sind (siehe services/instagram.ts)
  INSTAGRAM_ACCESS_TOKEN: z.string().min(1).optional(),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().min(1).optional(),
  PORT: z.coerce.number().default(3000),
});

export const env = envSchema.parse(process.env);
