import type { Handler } from "@netlify/functions";
import { handleGetMedia, json } from "../../shared/handlers";

export const handler: Handler = async (event) => {
  try {
    const rawPath = event.rawUrl || event.path || "";
    const fromPath = rawPath.split("?")[0]?.split("/").filter(Boolean).pop();
    const id = event.queryStringParameters?.id || (fromPath && fromPath !== "media" ? fromPath : "");
    const rawRange = event.headers.range || event.headers.Range;
    const range = Array.isArray(rawRange) ? rawRange[0] : rawRange;
    return await handleGetMedia(id ?? null, range);
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    return json(500, { error: message });
  }
};
