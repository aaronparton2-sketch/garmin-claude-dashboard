import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { pathToFileURL } from "node:url";
import path from "node:path";

/**
 * Dev-only shim so `npm run dev` serves the same /api/* routes Vercel runs in
 * production (api/data.js, api/chat.js, api/login.js). Without it the browser
 * would have no data locally. The handlers are plain (req, res) functions, so
 * this only has to fake the few Vercel helpers they use.
 */
function apiDev(env: Record<string, string>): Plugin {
  return {
    name: "api-dev",
    configureServer(server) {
      Object.assign(process.env, env);
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/api/")) return next();
        const name = url.slice(5).split("?")[0].replace(/[^a-z_]/g, "");
        let mod: { default: (q: unknown, s: unknown) => Promise<void> };
        try {
          mod = await import(pathToFileURL(path.resolve("api", `${name}.js`)).href + `?t=${Date.now()}`);
        } catch {
          res.statusCode = 404;
          res.end("no such api route");
          return;
        }
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const raw = Buffer.concat(chunks).toString("utf8");
        let body: unknown = raw;
        try { body = raw ? JSON.parse(raw) : {}; } catch { /* leave as string */ }
        const shim = {
          statusCode: 200,
          status(code: number) { this.statusCode = code; return this; },
          setHeader(k: string, v: string) { res.setHeader(k, v); },
          json(obj: unknown) {
            res.statusCode = this.statusCode;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(obj));
          },
        };
        await mod.default(Object.assign(req, { body }), shim);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), apiDev(env)],
  };
});
