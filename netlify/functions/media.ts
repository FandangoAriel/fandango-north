import type { Handler } from "@netlify/functions";
import { handleGetMedia, json } from "../../shared/handlers";

export const handler: Handler = async (event) => {
  try {
    const fromPath = event.path.split("/").filter(Boolean).pop();
    const id = event.queryStringParameters?.id || (fromPath && fromPath !== "media" ? fromPath : "");
    return await handleGetMedia(id ?? null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    return json(500, { error: message });
  }
};
