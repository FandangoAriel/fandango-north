import type { Handler } from "@netlify/functions";
import { handleGetLoad, handleSaveLoad, json } from "../../shared/handlers";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      return await handleGetLoad(event.queryStringParameters?.farm ?? null);
    }
    if (event.httpMethod === "POST") {
      const payload = JSON.parse(event.body || "{}");
      return await handleSaveLoad(payload);
    }
    return json(405, { error: "method_not_allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    return json(message === "farm_not_found" ? 404 : 500, { error: message });
  }
};
