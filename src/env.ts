import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_BEARER_TOKEN: z.string().min(8),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().min(1),
  RESEND_INBOUND_SECRET: z.string().min(8),
  ANTHROPIC_API_KEY: z.string().min(1),
  INSTAGRAM_ACCESS_TOKEN: z.string().min(1),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().min(1),
  PORT: z.coerce.number().default(3000),
});

export const env = envSchema.parse(process.env);
