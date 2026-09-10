import type { Handler } from "@netlify/functions";
import { handleReport, json } from "../../shared/handlers";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });
    const payload = JSON.parse(event.body || "{}") as {
      farmId?: string;
      items?: { id: string; actual: number; name?: string }[];
    };
    return await handleReport(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    return json(message === "farm_not_found" ? 404 : 500, { error: message });
  }
};
