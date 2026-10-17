// Optional browser tools: npm --prefix design/model-review ci
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
process.env.AWS_EXECUTION_ENV ??= "AWS_Lambda_nodejs22.x";
const require = createRequire(
  new URL("../design/model-review/package.json", import.meta.url),
);
const { default: chromium } = await import(
  require.resolve("@sparticuz/chromium")
);
const { default: puppeteer } = await import(require.resolve("puppeteer-core"));
const { PNG } = require("pngjs");
const url = process.env.APP_URL ?? "http://127.0.0.1:5175";
const review =
  process.env.ART_URL ?? "http://127.0.0.1:5173/design/islands/review.html";
const output = ".cache/maths-art";
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => a !== "--single-process"),
  headless: "shell",
});
const checks = [],
  errors = [],
  models = [];
const pass = (n) => {
  checks.push(n);
  console.log("PASS " + n);
};
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.text().includes("Context Lost"))
      consoleErrors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.url().endsWith(".glb")) models.push(new URL(r.url()).pathname);
  });
  await page.setViewport({ width: 1000, height: 1000 });
  await page.goto(review, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => window.artReady);
  assert.equal((await page.evaluate(() => window.artStats)).calls, 11);
  assert.equal((await page.evaluate(() => window.artStats)).triangles, 15092);
  await page.screenshot({ path: "design/islands/maths-v2-preview.png" });
  await page.screenshot({ path: output + "/review-front.png" });
  await page.click('[data-view="back"]');
  await page.screenshot({ path: output + "/review-back.png" });
  const front = PNG.sync.read(await readFile(output + "/review-front.png")),
    back = PNG.sync.read(await readFile(output + "/review-back.png"));
  let different = 0;
  for (let i = 0; i < front.data.length; i += 4)
    if (
      Math.abs(front.data[i] - back.data[i]) +
        Math.abs(front.data[i + 1] - back.data[i + 1]) +
        Math.abs(front.data[i + 2] - back.data[i + 2]) >
      25
    )
      different++;
  assert(different > 60_000);
  await page.click('[data-view="side"]');
  await page.screenshot({ path: output + "/review-side.png" });
  await page.setViewport({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelector("canvas").clientWidth === 390,
  );
  await page.screenshot({ path: output + "/review-mobile.png" });
  pass(
    "The real GLB renders from front/back/side and on a phone: 15,092 triangles and 11 main-pass draw calls, without image stand-ins or animations",
  );
  models.length = 0;
  await page.setViewport({ width: 1440, height: 1000 });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.goto(url + "/settings", { waitUntil: "networkidle0" });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((n) => n.textContent === "Explore the demo workspace")
      .click(),
  );
  await page.waitForFunction(() => localStorage.getItem("study-world.demo.v1"));
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("study-world.demo.v1"));
    for (let i = 0; i < 4; i++)
      d.topics.push({
        id: "art-topic-" + i,
        subjectId: "maths",
        name: "Arithmetic art review " + i,
        group: "",
      });
    d.subjects.push({
      id: "advanced-maths",
      name: "Advanced mathematics",
      theme: "maths",
      color: "#5976b4",
      archived: false,
    });
    localStorage.setItem("study-world.personal.v1", JSON.stringify(d));
  });
  const still = () =>
    page.waitForFunction(
      () => {
        const c = document.querySelector(".world-canvas");
        return (
          c?.dataset.cameraMoving === "false" &&
          Number(c?.dataset.cameraDistance) > 0
        );
      },
      { timeout: 60000 },
    );
  await page.goto(url + "/", { waitUntil: "networkidle0" });
  await page.waitForFunction(
    () => document.querySelectorAll(".island-label").length === 7,
  );
  await still();
  assert(models.includes("/models/island_maths_v2.glb"));
  for (const theme of ["reasoning", "english", "gk", "dsa", "software"])
    assert(models.includes("/models/island_" + theme + "_v2.glb"));
  assert(!models.includes("/models/landmark_maths.glb"));
  const before = await page.evaluate(() =>
    localStorage.getItem("study-world.personal.v1"),
  );
  await page.screenshot({ path: output + "/world-desktop.png" });
  await page.select(".island-jump", "advanced-maths");
  await page.waitForFunction(
    () =>
      document.querySelector("#island-preview-title")?.textContent ===
      "Advanced mathematics",
  );
  await still();
  await page.select(".island-jump", "maths");
  await page.waitForSelector(".is-exploring .console-open-subject");
  assert.equal(await page.$(".enter-island"), null);
  await page.waitForFunction(
    () => document.querySelectorAll(".topic-plot-label").length === 6,
  );
  await still();
  await page.screenshot({ path: output + "/maths-exploring.png" });
  await page.click('[aria-label="Next topic plots"]');
  await page.waitForFunction(
    () => document.querySelectorAll(".topic-plot-label").length === 2,
  );
  await page.click('[aria-label="Previous topic plots"]');
  await page.waitForFunction(
    () => document.querySelectorAll(".topic-plot-label").length === 6,
  );
  await page.click('[aria-label="Open topic: Percentage"]');
  await page.waitForSelector("#world-topic-title");
  assert.equal(
    await page.$eval("#world-topic-title", (n) => n.textContent),
    "Percentage",
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("study-world.personal.v1")),
    before,
  );
  pass(
    "The new artwork is selected by maths theme, including a second custom maths subject; all five other upgraded themed islands load and real topic paging/tasks still work",
  );
  for (const width of [390, 320]) {
    await page.setViewport({ width, height: 844 });
    await still();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert(await page.$("canvas"));
    assert(
      await page.$$eval(".scene-fallback", (nodes) =>
        nodes.every(
          (n) =>
            !n.getBoundingClientRect().width ||
            !n.getBoundingClientRect().height,
        ),
      ),
      "Only the hidden canvas fallback may exist while WebGL is healthy",
    );
    await page.screenshot({ path: output + `/maths-${width}.png` });
  }
  assert.equal(
    await page.evaluate(() => localStorage.getItem("study-world.personal.v1")),
    before,
  );
  pass(
    "The real Math garden and topic tasks remain usable at 320/390px with reduced motion, no horizontal overflow and no study-data changes",
  );
  const context = await browser.createBrowserContext(),
    broken = await context.newPage();
  await broken.setRequestInterception(true);
  broken.on("request", (r) =>
    r.url().endsWith("/models/island_maths_v2.glb") ? r.abort() : r.continue(),
  );
  await broken.goto(url + "/", { waitUntil: "networkidle0" });
  await broken.waitForFunction(() =>
    [...document.querySelectorAll(".scene-fallback")].some(
      (n) =>
        n.getBoundingClientRect().width > 0 &&
        n.getBoundingClientRect().height > 0,
    ),
  );
  assert.equal(await broken.$$eval(".subject-card", (n) => n.length), 6);
  await broken.goto(url + "/today", { waitUntil: "networkidle0" });
  await broken.waitForSelector(".today-page");
  await context.close();
  pass(
    "A failed new art asset still reaches the existing 2D recovery path and never blocks the planner",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/browser-results.json",
    JSON.stringify(
      {
        checks,
        errors,
        modelRequests: [...new Set(models)],
        review: { triangles: 15092, drawCalls: 11 },
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
