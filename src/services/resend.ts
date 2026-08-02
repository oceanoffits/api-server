import { Resend } from "resend";
import { env } from "../env.js";

export const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmail(params: { to: string; subject: string; body: string }) {
  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    text: params.body,
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }

  return data;
}
