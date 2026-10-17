// UI contract tests use explicit mocked API responses; never a real key/model.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { samplePaste, expectedPlan } from "../tests/fixtures/study-targets.ts";
process.env.AWS_EXECUTION_ENV ??= "AWS_Lambda_nodejs22.x";
const require = createRequire(
  new URL("../design/model-review/package.json", import.meta.url),
);
const { default: chromium } = await import(
  require.resolve("@sparticuz/chromium")
);
const { default: puppeteer } = await import(require.resolve("puppeteer-core"));
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => a !== "--single-process"),
  headless: "shell",
});
await mkdir(".cache/ai-import", { recursive: true });
await mkdir("design/ai-import", { recursive: true });
const checks = [],
  errors = [];
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
let behaviour = "success",
  configured = true,
  requests = [];
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.setRequestInterception(true);
page.on("request", async (r) => {
  const path = new URL(r.url()).pathname;
  if (path === "/api/targets/status")
    return r.respond({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured, requiresAccessCode: true }),
    });
  if (path === "/api/targets/analyse") {
    requests.push({
      body: JSON.parse(r.postData()),
      code: r.headers()["x-import-access-code"],
    });
    if (behaviour === "error")
      return r.respond({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Free models are rate-limited. Your paste is unchanged.",
        }),
      });
    if (behaviour === "invalid")
      return r.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ model: "test/model:free", plan: { tasks: [] } }),
      });
    if (behaviour === "new")
      return r.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          model: "test/model:free",
          plan: {
            ...expectedPlan,
            tasks: [
              {
                ...expectedPlan.tasks[0],
                subjectId: null,
                subjectName: "My custom exam subject",
                group: "Practice",
              },
            ],
          },
        }),
      });
    if (behaviour === "slow") {
      setTimeout(() => {
        if (!r.isInterceptResolutionHandled())
          void r
            .respond({
              status: 429,
              contentType: "application/json",
              body: "{}",
            })
            .catch(() => {});
      }, 3000);
      return;
    }
    return r.respond({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ model: "test/model:free", plan: expectedPlan }),
    });
  }
  return r.continue();
});
try {
  await page.setViewport({ width: 1200, height: 950 });
  await page.goto("http://127.0.0.1:5173/today", { waitUntil: "networkidle0" });
  const frame = await (await page.waitForSelector("iframe")).contentFrame();
  await frame.waitForSelector(".site-paste-button");
  const fill = async (selector, value) =>
    frame.$eval(
      selector,
      (n, v) => {
        const proto =
          n.tagName === "TEXTAREA"
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(n, v);
        n.dispatchEvent(new Event("input", { bubbles: true }));
        n.dispatchEvent(new Event("change", { bubbles: true }));
      },
      String(value),
    );
  const click = async (selector) => {
    await frame.$eval(selector, (n) => n.scrollIntoView({ block: "center" }));
    const a = await frame.$eval(selector, (n) => {
      const r = n.getBoundingClientRect();
      return {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        vw: innerWidth,
        vh: innerHeight,
      };
    });
    const b = await page.$eval("iframe", (n) => {
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    await page.mouse.click(b.x + (a.x * b.w) / a.vw, b.y + (a.y * b.h) / a.vh);
  };
  const byText = async (text) => {
    const key = await frame.evaluate((text) => {
      const n = [...document.querySelectorAll("dialog[open] button")].find(
        (n) => n.textContent.trim() === text,
      );
      if (!n) throw Error("Missing button " + text);
      n.dataset.qaClick = "true";
      return '[data-qa-click="true"]';
    }, text);
    await click(key);
    await frame.evaluate(() =>
      document
        .querySelector("[data-qa-click]")
        ?.removeAttribute("data-qa-click"),
    );
  };
  const saved = () =>
    frame.evaluate(() =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")),
    );
  const open = async () => {
    await click(".site-paste-button");
    await frame.waitForSelector(".ai-import-modal");
    await frame.waitForFunction(
      () =>
        document.querySelector(".ai-import-modal .ai-setup") ||
        document.querySelector('.ai-import-modal input[type="password"]'),
    );
  };
  const input = async () => {
    await fill(".paste-box", samplePaste);
    await fill(
      '.ai-import-modal input[type="password"]',
      "browser-test-access-code-1234",
    );
    await click(".ai-import-modal .ai-consent input");
  };
  const estimates = async () => {
    for (const n of await frame.$$('[aria-label$=" minutes"]')) {
      const selector = await n.evaluate(
        (n) => '[aria-label="' + n.getAttribute("aria-label") + '"]',
      );
      await fill(selector, "30");
    }
  };
  const ack = () =>
    click(".paste-review-content > .ai-consent:last-of-type input");
  const waitReviewed = () => frame.waitForSelector(".ai-proposal");
  await frame.waitForFunction(() =>
    localStorage.getItem("study-world.personal.v1"),
  );
  const baseline = await saved();
  configured = false;
  await open();
  await frame.waitForSelector(".ai-setup");
  assert(await frame.$eval(".modal-footer .primary", (n) => n.disabled));
  await fill(".paste-box", samplePaste);
  await byText("Use the local manual reader instead (no AI)");
  assert.equal(await frame.$eval(".paste-box", (n) => n.value), samplePaste);
  await click('[aria-label="Close dialog"]');
  assert.equal(requests.length, 0);
  pass(
    "Unconfigured setup is honest, manual fallback retains the exact paste, and no AI request is made",
  );
  configured = true;
  await open();
  await input();
  assert.deepEqual(await saved(), baseline);
  await byText("Analyse targets with AI");
  await waitReviewed();
  assert.equal(await frame.$$eval(".ai-proposal", (n) => n.length), 10);
  assert.deepEqual(await saved(), baseline);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.text, samplePaste);
  assert.deepEqual(Object.keys(requests[0].body).sort(), ["catalogue", "text"]);
  assert(!("tasks" in requests[0].body.catalogue));
  assert.equal(requests[0].body.catalogue.subjects.length, 6);
  assert.equal(requests[0].code, "browser-test-access-code-1234");
  assert.equal(
    await frame.$eval('[aria-label="Target 1 minutes"]', (n) => n.value),
    "",
  );
  assert.equal(
    await frame.$eval('[aria-label="Target 3 minutes"]', (n) => n.value),
    "",
  );
  assert.equal(
    await frame.$eval('[aria-label="Target 9 range"]', (n) => n.value),
    "1-50",
  );
  assert.equal(
    await frame.$eval('[aria-label="Target 10 alternative"]', (n) => n.value),
    "",
  );
  assert(await frame.$eval(".modal-footer .primary", (n) => n.disabled));
  pass(
    "Mocked AI plan shows ten editable targets with exact source, 10 questions, null video/time estimates, OWS ranges and unresolved OR; no premature writes",
  );
  await page.click(".responsive-preview-modes button:nth-child(1)");
  await frame.waitForFunction(() => innerWidth > 1000);
  await page.screenshot({ path: "design/ai-import/review-desktop.png" });
  for (const width of [320, 390, 430]) {
    if (width === 320) {
      await page.click(".responsive-preview-modes button:nth-child(3)");
    }
    await page.select('[aria-label="Mobile preview width"]', String(width));
    await frame.waitForFunction((w) => innerWidth === w, {}, width);
    const bounds = await frame.$eval("dialog[open]", (n) => {
      const r = n.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        w: innerWidth,
        h: innerHeight,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert(
      bounds.left >= -1 &&
        bounds.right <= bounds.w + 1 &&
        bounds.top >= -1 &&
        bounds.bottom <= bounds.h + 1 &&
        !bounds.overflow,
      JSON.stringify(bounds),
    );
    await click('[aria-label="Target 10 minutes"]');
  }
  await page.screenshot({ path: "design/ai-import/review-mobile.png" });
  pass(
    "Same open review fits desktop and 320/390/430 embedded phones; all estimates remain reachable by native scrolling",
  );
  await estimates();
  await frame.select('[aria-label="Target 10 alternative"]', "1");
  await ack();
  await byText("Confirm & add targets");
  await frame.waitForSelector("dialog[open]", { hidden: true });
  await frame.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).tasks
        .length === 10,
  );
  const committed = await saved();
  assert.equal(committed.tasks.length, 10);
  assert.equal(committed.tests.length, 0);
  assert.equal(committed.revisions.length, 0);
  assert(committed.tasks[0].notes.includes("10 questions"));
  assert(committed.tasks[2].notes.includes("first 3 hours"));
  assert(committed.tasks[9].title === "Practise reading comprehension");
  assert(committed.tasks[9].notes.includes("English Madhyam"));
  assert(!JSON.stringify(committed).includes("browser-test-access-code"));
  pass(
    "Only explicit confirmation saves ten real tasks atomically; selected reading option/resources persist without completion, test records, revision dates or stored access code",
  );
  await open();
  await input();
  await byText("Analyse targets with AI");
  await waitReviewed();
  assert(
    (await frame.$$eval(
      ".ai-warning",
      (n) => n.filter((n) => n.textContent.includes("duplicate")).length,
    )) > 0,
  );
  await estimates();
  await frame.select('[aria-label="Target 10 alternative"]', "1");
  await ack();
  assert(await frame.$eval(".modal-footer .primary", (n) => n.disabled));
  await click('[aria-label="Close dialog"]');
  assert.equal((await saved()).tasks.length, 10);
  pass(
    "Repeated imports flag existing unfinished duplicates and block confirmation without explicit duplicate approval",
  );
  for (const mode of ["error", "invalid", "slow"]) {
    behaviour = mode;
    await open();
    await input();
    await byText("Analyse targets with AI");
    if (mode === "slow") await byText("Cancel analysis");
    else await frame.waitForSelector(".form-error");
    await frame.waitForFunction(
      () => !document.querySelector(".paste-box").disabled,
    );
    assert.equal(await frame.$eval(".paste-box", (n) => n.value), samplePaste);
    assert.deepEqual(await saved(), committed);
    await click('[aria-label="Close dialog"]');
  }
  pass(
    "Rate limits, malformed responses and cancellation preserve the exact paste and do not alter saved study data",
  );
  behaviour = "new";
  await open();
  await input();
  await byText("Analyse targets with AI");
  await waitReviewed();
  await estimates();
  await ack();
  assert(await frame.$eval(".modal-footer .primary", (n) => n.disabled));
  const createBox = await frame.evaluate(() => {
    const label = [...document.querySelectorAll(".ai-consent")].find((n) =>
      n.textContent.includes("Also create these new subjects"),
    );
    label.querySelector("input").dataset.qaCreate = "true";
    return "[data-qa-create]";
  });
  await click(createBox);
  await byText("Confirm & add targets");
  await frame.waitForSelector("dialog[open]", { hidden: true });
  await frame.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).subjects
        .length === 7,
  );
  assert.equal((await saved()).tasks.length, 11);
  pass(
    "Proposed custom subjects require separate permission and are created only on confirmation",
  );
  assert.deepEqual(errors, []);
  pass(
    "No browser page errors (all provider responses explicitly mocked; no live OpenRouter claim)",
  );
  await writeFile(
    ".cache/ai-import/browser-report.json",
    JSON.stringify(
      {
        checks,
        errors,
        provider: "Mocked only; real API key/network not available",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
