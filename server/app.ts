import express from "express";
import { extname, resolve } from "node:path";
import { createTargetsMiddleware } from "./targets-api";
import type { AiConfig } from "./targets-api";

/** One same-origin production service: private API + built public assets only. */
export function createProductionApp(
  config: AiConfig,
  distDir = resolve("dist"),
  fetcher: typeof fetch = fetch,
) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.get("/healthz", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true });
  });
  const targets = createTargetsMiddleware(config, fetcher);
  // Do not install express.json(): the API authenticates before its bounded reader.
  app.use((req, res, next) => {
    void targets(req, res, next).catch(next);
  });
  app.use("/api", (_req, res) => {
    res
      .status(404)
      .set("Cache-Control", "no-store")
      .json({ error: "Unknown API endpoint." });
  });
  app.use(
    express.static(distDir, {
      dotfiles: "deny",
      redirect: false,
      index: false,
      setHeaders(res, file) {
        // Only Vite's fingerprinted assets are immutable. Models retain revalidation.
        res.setHeader(
          "Cache-Control",
          file.startsWith(resolve(distDir, "assets") + "/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        );
      },
    }),
  );
  app.use((req, res, next) => {
    // History fallback is only for app navigation, not missing assets/secrets/APIs.
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      req.accepts("html") &&
      !extname(req.path) &&
      !req.path.split("/").some((segment) => segment.startsWith("."))
    ) {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(resolve(distDir, "index.html"), (error) => {
        if (error) next(error);
      });
      return;
    }
    res.status(404).type("text/plain").send("Not found");
  });
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? Number(error.status)
          : 500;
      res
        .status(status === 403 || status === 404 ? status : 500)
        .set("Cache-Control", "no-store")
        .json({ error: "The request could not be served." });
    },
  );
  return app;
}

export function listenPort(
  env: NodeJS.ProcessEnv = process.env,
  fallback = 3001,
) {
  const value = env.PORT ?? env.AI_API_PORT ?? String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)
    throw Error("PORT/AI_API_PORT must be a valid TCP port.");
  return Number(value);
}
