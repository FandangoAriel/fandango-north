import type { Handler } from "@netlify/functions";
import { handleUploadMedia, json } from "../../shared/handlers";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });
    const payload = JSON.parse(event.body || "{}");
    return await handleUploadMedia(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    return json(500, { error: message });
  }
};
