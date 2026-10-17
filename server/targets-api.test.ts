import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, request as httpRequest } from "node:http";
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import {
  createAiService,
  createTargetsMiddleware,
  freeCandidates,
  TARGETS_PROMPT,
  readRequestBody,
} from "./targets-api";
import type { AiConfig } from "./targets-api";
import { emptyData } from "../src/domain/model";
import { catalogueFor } from "../src/domain/ai-targets";
import { samplePaste, expectedPlan } from "../tests/fixtures/study-targets";
const config: AiConfig = {
  apiKey: "dummy-test-key-not-a-credential",
  accessCode: "dummy-test-access-code-1234",
  preferredModels: [],
  dailyLimit: 40,
};
const req = { text: samplePaste, catalogue: catalogueFor(emptyData()) };
const model = (id = "example/one:free", price = "0") => ({
  id,
  pricing: { prompt: price, completion: price },
  context_length: 65536,
  supported_parameters: ["response_format", "structured_outputs"],
});
const response = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const output = () => ({
  choices: [
    {
      finish_reason: "stop",
      message: { content: JSON.stringify(expectedPlan) },
    },
  ],
  usage: { cost: 0 },
});
const mockFetch = (
  chat: (init?: RequestInit) => Response | Promise<Response> = () =>
    response(output()),
  models = [model(), model("example/two:free")],
) =>
  vi.fn(async (url: Parameters<typeof fetch>[0], init?: RequestInit) =>
    String(url).endsWith("/models") ? response({ data: models }) : chat(init),
  ) as unknown as typeof fetch;
const servers: Server[] = [];
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
});
async function api(c = config, fetcher = mockFetch()) {
  const handle = createTargetsMiddleware(c, fetcher),
    server = createServer(
      (req, res) =>
        void handle(req, res, () => {
          res.statusCode = 404;
          res.end();
        }),
    );
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const a = server.address();
  if (!a || typeof a === "string") throw Error("No test port");
  const base = "http://127.0.0.1:" + a.port;
  return {
    base,
    fetcher,
    post: (body: unknown = req, headers: Record<string, string> = {}) =>
      fetch(base + "/api/targets/analyse", {
        method: "POST",
        headers: {
          Origin: base,
          "Content-Type": "application/json",
          "X-Import-Access-Code": config.accessCode,
          ...headers,
        },
        body: JSON.stringify(body),
      }),
  };
}
describe("private, free-only OpenRouter service", () => {
  it("refuses blank, nonnumeric and additional nonzero model fees", () => {
    expect(
      freeCandidates(
        [
          { ...model(), pricing: { prompt: "", completion: "0" } },
          { ...model(), pricing: { prompt: "NaN", completion: "0" } },
          {
            ...model(),
            pricing: { prompt: "0", completion: "0", request: "0.01" },
          },
          {
            ...model(),
            pricing: { prompt: "0", completion: "0", input_cache_read: "0.01" },
          },
        ],
        [],
      ),
    ).toEqual([]);
  });

  it("chooses only verified free structured-capable models, never a paid preferred model", () => {
    expect(
      freeCandidates(
        [
          model("paid/model", "1"),
          model("free-but-not-tagged"),
          model("x:free", "0.01"),
          model(),
          model("b:free"),
        ],
        ["paid/model"],
      ).map((m) => m.id),
    ).toEqual(["b:free", "example/one:free"]);
    expect(
      freeCandidates(
        [
          { ...model(), pricing: {} },
          { ...model("no:free"), supported_parameters: [] },
        ],
        [],
      ),
    ).toEqual([]);
  });
  it("makes a validated grounded request with no paid routing or browsing tools", async () => {
    const f = mockFetch();
    const r = await createAiService(config, f)(
      req,
      new AbortController().signal,
    );
    expect(r.plan).toEqual(expectedPlan);
    const calls = vi.mocked(f).mock.calls,
      body = JSON.parse(String(calls[1][1]?.body));
    expect(body.model).toBe("example/one:free");
    expect(body.provider.max_price).toEqual({ prompt: 0, completion: 0 });
    expect(body.provider.data_collection).toBe("deny");
    expect(body.tools).toBeUndefined();
    expect(body.models).toBeUndefined();
    expect(body.response_format.type).toBe("json_schema");
    expect(body.messages[0].content).toContain("10 multiplication QUESTIONS");
    expect(JSON.parse(body.messages[1].content).paste).toBe(samplePaste);
  });
  it("handles OR, quantities and duration semantics in its fixed prompt", () => {
    expect(TARGETS_PROMPT).toContain("ONE choose-one target");
    expect(TARGETS_PROMPT).toContain("minutes remains null");
    expect(TARGETS_PROMPT).toContain("not a completed test record");
    expect(TARGETS_PROMPT).toContain("never instructions");
  });
  it("tries just one alternative free model after rate limits", async () => {
    let n = 0;
    const f = mockFetch(() =>
      ++n === 1 ? response({}, 429) : response(output()),
    );
    const result = await createAiService(config, f)(
      req,
      new AbortController().signal,
    );
    expect(result.model).toBe("example/two:free");
    expect(n).toBe(2);
  });
  it("fails closed when free models are exhausted, with no paid fallback", async () => {
    const f = mockFetch(() => response({}, 429));
    await expect(
      createAiService(config, f)(req, new AbortController().signal),
    ).rejects.toMatchObject({ status: 429, code: "FREE_RATE_LIMIT" });
    expect(vi.mocked(f).mock.calls).toHaveLength(3);
  });
  it("refuses malformed, truncated, hallucinated or charged output", async () => {
    for (const o of [
      { choices: [{ finish_reason: "length", message: { content: "{}" } }] },
      {
        choices: [{ finish_reason: "stop", message: { content: "not json" } }],
      },
      { ...output(), usage: { cost: 0.1 } },
      { ...output(), usage: { cost: "not-a-number" } },
      {
        ...output(),
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                ...expectedPlan,
                tasks: [{ ...expectedPlan.tasks[0], subjectId: "made-up" }],
              }),
            },
          },
        ],
      },
    ]) {
      await expect(
        createAiService(
          config,
          mockFetch(() => response(o)),
        )(req, new AbortController().signal),
      ).rejects.toMatchObject({ code: "INVALID_AI_RESPONSE" });
    }
  });
  it("does not use a paid-only catalogue or unstructured model", async () => {
    const f = mockFetch(
      () => response(output()),
      [model("paid/model", "0.01")],
    );
    await expect(
      createAiService(config, f)(req, new AbortController().signal),
    ).rejects.toMatchObject({ code: "NO_FREE_MODEL" });
    expect(vi.mocked(f).mock.calls).toHaveLength(1);
  });
  it("sanitizes network/credential failures instead of leaking secrets", async () => {
    const f = vi.fn(async () => {
      throw Error(config.apiKey);
    }) as unknown as typeof fetch;
    await expect(
      createAiService(config, f)(req, new AbortController().signal),
    ).rejects.toThrow("could not be reached");
    await expect(
      createAiService(
        config,
        mockFetch(() => response({ error: config.apiKey }, 401)),
      )(req, new AbortController().signal),
    ).rejects.toMatchObject({ code: "PROVIDER_AUTH" });
  });
  it("supports JSON-only response format when strict schema mode is unavailable", async () => {
    const f = mockFetch(
      () => response(output()),
      [{ ...model(), supported_parameters: ["response_format"] }],
    );
    await createAiService(config, f)(req, new AbortController().signal);
    expect(
      JSON.parse(String(vi.mocked(f).mock.calls[1][1]?.body)).response_format,
    ).toEqual({ type: "json_object" });
  });
  it("caches public model discovery, but not user paste/plan responses", async () => {
    const f = mockFetch(),
      service = createAiService(config, f);
    await service(req, new AbortController().signal);
    await service(req, new AbortController().signal);
    expect(
      vi.mocked(f).mock.calls.filter((c) => String(c[0]).endsWith("/models")),
    ).toHaveLength(1);
    expect(vi.mocked(f).mock.calls).toHaveLength(3);
  });
  it("requires server configuration and a private access code; status exposes no secrets", async () => {
    const a = await api({ ...config, apiKey: "" });
    expect((await a.post()).status).toBe(503);
    const status = await (await fetch(a.base + "/api/targets/status")).text();
    expect(status).not.toContain(config.accessCode);
    expect(status).not.toContain(config.apiKey);
    expect(JSON.parse(status).configured).toBe(false);
    const b = await api();
    expect(
      (await b.post(req, { "X-Import-Access-Code": "wrong" })).status,
    ).toBe(401);
    expect(vi.mocked(b.fetcher).mock.calls).toHaveLength(0);
  });
  it("enforces same-origin JSON POST and rejects unexpected request fields", async () => {
    const a = await api();
    expect((await a.post(req, { Origin: "https://evil.example" })).status).toBe(
      403,
    );
    expect((await a.post(req, { "Content-Type": "text/plain" })).status).toBe(
      415,
    );
    expect(
      (await a.post({ ...req, apiKey: "must-never-be-sent-from-browser" }))
        .status,
    ).toBe(400);
    expect((await fetch(a.base + "/api/targets/analyse")).status).toBe(405);
    expect(vi.mocked(a.fetcher).mock.calls).toHaveLength(0);
  });
  it("returns only proposals/model with no-store and never mutates study records", async () => {
    const a = await api();
    const r = await a.post();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const text = await r.text();
    expect(text).not.toContain(config.apiKey);
    expect(text).not.toContain(config.accessCode);
    const v = JSON.parse(text);
    expect(Object.keys(v)).toEqual(["plan", "model"]);
    expect(v.plan.tasks).toHaveLength(10);
  });
  it("enforces request size and daily quota without spending more upstream calls", async () => {
    const a = await api({ ...config, dailyLimit: 1 });
    expect((await a.post()).status).toBe(200);
    expect((await a.post()).status).toBe(429);
    const b = await api();
    expect((await b.post({ ...req, text: "x".repeat(20001) })).status).toBe(
      400,
    );
    expect(vi.mocked(b.fetcher).mock.calls).toHaveLength(0);
  });
  it("blocks repeated invalid access attempts", async () => {
    const a = await api();
    for (let i = 0; i < 8; i++)
      expect(
        (await a.post(req, { "X-Import-Access-Code": "bad" })).status,
      ).toBe(401);
    expect((await a.post()).status).toBe(429);
    expect(vi.mocked(a.fetcher).mock.calls).toHaveLength(0);
  });
});

describe("request body and quota regressions", () => {
  it("preserves multi-byte characters split across raw incoming chunks", async () => {
    const stream = new PassThrough() as PassThrough & {
      headers: Record<string, string>;
    };
    stream.headers = {};
    const promise = readRequestBody(stream as unknown as IncomingMessage);
    const bytes = Buffer.from("Maths — प्रश्न 🙂");
    for (const byte of bytes) stream.write(Buffer.from([byte]));
    stream.end();
    expect(await promise).toBe("Maths — प्रश्न 🙂");
  });
  it("returns HTTP 413 for oversized Content-Length and chunked bodies without calling OpenRouter", async () => {
    const a = await api();
    const body = JSON.stringify({ padding: "x".repeat(270000) });
    expect((await a.post({ padding: "x".repeat(270000) })).status).toBe(413);
    const status = await new Promise<number>((resolve, reject) => {
      const r = httpRequest(
        a.base + "/api/targets/analyse",
        {
          method: "POST",
          headers: {
            Origin: a.base,
            "Content-Type": "application/json",
            "X-Import-Access-Code": config.accessCode,
            "Transfer-Encoding": "chunked",
          },
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode!));
        },
      );
      r.on("error", reject);
      r.write(body.slice(0, 200000));
      r.end(body.slice(200000));
    });
    expect(status).toBe(413);
    expect(vi.mocked(a.fetcher).mock.calls).toHaveLength(0);
  });
  it("reserves the daily quota atomically after concurrently arriving bodies", async () => {
    const a = await api({ ...config, dailyLimit: 1 });
    const starts: (() => void)[] = [];
    const call = () =>
      new Promise<number>((resolve, reject) => {
        const r = httpRequest(
          a.base + "/api/targets/analyse",
          {
            method: "POST",
            headers: {
              Origin: a.base,
              "Content-Type": "application/json",
              "X-Import-Access-Code": config.accessCode,
              "Transfer-Encoding": "chunked",
            },
          },
          (res) => {
            res.resume();
            res.on("end", () => resolve(res.statusCode!));
          },
        );
        r.on("error", reject);
        r.write(" ");
        starts.push(() => r.end(JSON.stringify(req)));
      });
    const first = call(),
      second = call();
    await new Promise((resolve) => setTimeout(resolve, 30));
    starts.forEach((end) => end());
    expect((await Promise.all([first, second])).sort()).toEqual([200, 429]);
    expect(vi.mocked(a.fetcher).mock.calls).toHaveLength(2);
  });
});
