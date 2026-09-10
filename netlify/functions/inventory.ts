import type { Handler } from "@netlify/functions";
import { handleInventory, json } from "../../shared/handlers";

export const handler: Handler = async (event) => {
  try {
    const farm = event.queryStringParameters?.farm ?? null;
    return await handleInventory(farm);
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    return json(message === "farm_not_found" ? 404 : 500, { error: message });
  }
};
