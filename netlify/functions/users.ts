import type { Handler } from "@netlify/functions";
import { handleUsers, json } from "../../shared/handlers";

export const handler: Handler = async (event) => {
  try {
    const method = event.httpMethod === "POST" ? "POST" : "GET";
    const payload = method === "POST" ? JSON.parse(event.body || "{}") : undefined;
    return await handleUsers(method, payload);
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "error" });
  }
};
