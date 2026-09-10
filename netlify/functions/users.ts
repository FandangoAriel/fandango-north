import type { Handler } from "@netlify/functions";
import { handleUsers, json } from "../../shared/handlers";

export const handler: Handler = async () => {
  try {
    return await handleUsers();
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "error" });
  }
};
