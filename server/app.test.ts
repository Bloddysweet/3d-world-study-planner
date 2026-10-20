import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProductionApp, listenPort } from "./app";
const servers: Server[] = [],
  dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve) => {
          s.close(() => resolve());
          s.closeAllConnections();
        }),
    ),
  );
  await Promise.all(
    dirs.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
async function app() {
  const dir = await mkdtemp(join(tmpdir(), "study-world-test-"));
  dirs.push(dir);
  const dist = join(dir, "dist");
  await mkdir(join(dist, "assets"), { recursive: true });
  await mkdir(join(dist, "models"));
  await writeFile(
    join(dist, "index.html"),
    "<!doctype html><h1>Study World</h1>",
  );
  await writeFile(join(dist, "assets", "app-hashed.js"), 'console.log("app")');
  await writeFile(
    join(dist, "models", "dragon.glb"),
    Buffer.from([0, 1, 2, 3]),
  );
  await writeFile(
    join(dir, ".env.local"),
    "DO_NOT_SERVE_THIS_PRIVATE_TEST_VALUE",
  );
  const server = createServer(
    createProductionApp(
      { apiKey: "", accessCode: "", preferredModels: [], dailyLimit: 1 },
      dist,
    ),
  );
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const a = server.address();
  if (!a || typeof a === "string") throw Error("Missing port");
  return "http://127.0.0.1:" + a.port;
}
describe("production same-origin hosting", () => {
  it("serves root and deep-link navigation with revalidated HTML", async () => {
    const base = await app();
    for (const path of ["/", "/today", "/subjects/maths", "/settings"]) {
      const r = await fetch(base + path, { headers: { Accept: "text/html" } });
      expect(r.status).toBe(200);
      expect(await r.text()).toContain("Study World");
      expect(r.headers.get("cache-control")).toBe("no-cache");
    }
    const head = await fetch(base + "/today", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });
  it("serves assets with correct MIME/cache and binary range support", async () => {
    const base = await app();
    const js = await fetch(base + "/assets/app-hashed.js");
    expect(js.headers.get("content-type")).toMatch(/javascript/);
    expect(js.headers.get("cache-control")).toContain("immutable");
    const model = await fetch(base + "/models/dragon.glb", {
      headers: { Range: "bytes=1-2" },
    });
    expect(model.status).toBe(206);
    expect([...new Uint8Array(await model.arrayBuffer())]).toEqual([1, 2]);
    expect(model.headers.get("cache-control")).toBe("no-cache");
  });
  it("never falls back to HTML for APIs, missing assets, secrets or POSTs", async () => {
    const base = await app();
    for (const path of [
      "/api/unknown",
      "/assets/missing.js",
      "/server/.env.local",
      "/.git/config",
      "/%2e%2e/.env.local",
    ]) {
      const r = await fetch(base + path, { headers: { Accept: "text/html" } });
      expect([403, 404]).toContain(r.status);
      const body = await r.text();
      expect(body).not.toContain("Study World");
      expect(body).not.toContain("DO_NOT_SERVE");
    }
    expect((await fetch(base + "/today", { method: "POST" })).status).toBe(404);
  });
  it("serves private API status and a lightweight health check without secrets", async () => {
    const base = await app();
    const status = await fetch(base + "/api/targets/status");
    expect(await status.json()).toEqual({
      configured: false,
      requiresAccessCode: true,
      missing: [
        "OPENROUTER_API_KEY",
        "AI_IMPORT_ACCESS_CODE (16+ characters)",
      ],
    });
    expect(status.headers.get("cache-control")).toBe("no-store");
    const health = await fetch(base + "/healthz");
    expect(await health.json()).toEqual({ ok: true });
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect(health.headers.get("x-powered-by")).toBeNull();
  });
  it("uses Render PORT first, with valid local defaults and invalid-port rejection", () => {
    expect(listenPort({ PORT: "10000", AI_API_PORT: "3001" })).toBe(10000);
    expect(listenPort({ AI_API_PORT: "3002" })).toBe(3002);
    expect(listenPort({})).toBe(3001);
    for (const PORT of ["0", "65536", "abc", "3001x", "-1", ""])
      expect(() => listenPort({ PORT })).toThrow();
  });
});
