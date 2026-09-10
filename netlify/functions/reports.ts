import type { Handler } from "@netlify/functions";
import { handleListReports, json } from "../../shared/handlers";

export const handler: Handler = async (event) => {
  try {
    return await handleListReports(event.queryStringParameters?.farm ?? null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    return json(message === "farm_not_found" ? 404 : 500, { error: message });
  }
};
