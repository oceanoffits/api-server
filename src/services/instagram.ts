import { env } from "../env.js";

interface InstagramDMPayload {
  recipientUserId: string;
  messageText: string;
}

interface InstagramApiResponse {
  message_id?: string;
  error?: {
    message: string;
    code: number;
  };
}

export async function sendInstagramDM(payload: InstagramDMPayload): Promise<string> {
  // instagram graph api: /{business-account-id}/messages
  // dokumentation: https://developers.facebook.com/docs/instagram-graph-api/reference/ig-media/comments

  if (!payload.recipientUserId) {
    throw new Error("instagram: recipientUserId is required (store instagram user id on influencer)");
  }

  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    throw new Error(
      "instagram: INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID nicht konfiguriert"
    );
  }

  const url = `https://graph.instagram.com/v21.0/${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: {
        id: payload.recipientUserId,
      },
      message: {
        text: payload.messageText,
      },
      access_token: env.INSTAGRAM_ACCESS_TOKEN,
    }),
  });

  const data = (await response.json()) as InstagramApiResponse;

  if (!response.ok || data.error) {
    const errMsg = data.error?.message || "unknown error";
    throw new Error(`instagram send failed: ${errMsg}`);
  }

  if (!data.message_id) {
    throw new Error("instagram: no message_id in response");
  }

  return data.message_id;
}
