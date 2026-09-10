import { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {
  handleGetLoad,
  handleInventory,
  handleReport,
  handleSaveLoad,
  handleUsers,
  json,
} from "./shared/handlers";

function send(res: ServerResponse, result: { statusCode: number; headers: Record<string, string>; body: string }) {
  res.statusCode = result.statusCode;
  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value);
  }
  res.end(result.body);
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function apiPlugin(): Plugin {
  return {
    name: "farm-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.headers.upgrade?.toLowerCase() === "websocket") {
          next();
          return;
        }
        let url: URL | null = null;
        try {
          url = req.url ? new URL(req.url, "http://127.0.0.1") : null;
        } catch {
          next();
          return;
        }
        if (!url?.pathname.startsWith("/api/")) {
          next();
          return;
        }
        try {
          if (url.pathname === "/api/users") {
            send(res, await handleUsers());
            return;
          }
          if (url.pathname === "/api/inventory") {
            send(res, await handleInventory(url.searchParams.get("farm")));
            return;
          }
          if (url.pathname === "/api/report" && req.method === "POST") {
            const payload = JSON.parse((await readBody(req)) || "{}");
            send(res, await handleReport(payload));
            return;
          }
          if (url.pathname === "/api/load" && req.method === "GET") {
            send(res, await handleGetLoad(url.searchParams.get("farm")));
            return;
          }
          if (url.pathname === "/api/load" && req.method === "POST") {
            const payload = JSON.parse((await readBody(req)) || "{}");
            send(res, await handleSaveLoad(payload));
            return;
          }
          send(res, json(404, { error: "not_found" }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "error";
          send(res, json(message === "farm_not_found" ? 404 : 500, { error: message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin()],
  resolve: {
    alias: {
      "@shared": new URL("./shared", import.meta.url).pathname,
    },
  },
  server: {
    host: "0.0.0.0",
    port: 43187,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      host: "127.0.0.1",
      clientPort: 43187,
    },
  },
});
