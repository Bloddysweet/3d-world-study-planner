// Real Chromium/WebGL regression and reproducible renders; no image generation.
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const app = process.env.APP_URL ?? "http://127.0.0.1:5175";
const review =
  process.env.ART_URL ?? "http://127.0.0.1:5173/design/islands/review.html";
const manifest = JSON.parse(
  await readFile("public/models/island-art-v2.json", "utf8"),
);
const out = ".cache/island-art";
await mkdir(out, { recursive: true });
const checks = [],
  errors = [],
  requests = [],
  stats = [];
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => a !== "--single-process"),
  headless: "shell",
});
const healthy = async (page) => {
  await page.waitForFunction(
    () => {
      const c = document.querySelector(".world-canvas");
      return (
        c?.dataset.cameraMoving === "false" &&
        Number(c?.dataset.cameraDistance) > 0
      );
    },
    { timeout: 60000 },
  );
  assert(await page.$("canvas"));
  assert(
    await page.$$eval(".scene-fallback", (nodes) =>
      nodes.every(
        (n) =>
          !n.getBoundingClientRect().width || !n.getBoundingClientRect().height,
      ),
    ),
  );
};
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().endsWith(".glb")) requests.push(new URL(r.url()).pathname);
  });
  await page.setViewport({ width: 1000, height: 1000 });
  for (const { theme, metadata: meta } of manifest.islands) {
    await page.goto(review + "?theme=" + theme, { waitUntil: "networkidle0" });
    await page.waitForFunction(
      (theme) => window.artReady && window.artTheme === theme,
      {},
      theme,
    );
    const stat = await page.evaluate(() => window.artStats);
    assert.equal(stat.calls, meta.meshes);
    assert.equal(stat.triangles, meta.triangles);
    stats.push({ theme, ...stat });
    await page.addStyleTag({
      content: "header,nav,#status{display:none!important}",
    });
    const front = await page.screenshot({
      path: `design/islands/${theme}-v2-render.png`,
    });
    // Controls remain in the DOM; invoke real click handlers without un-hiding overlays.
    await page.$eval('[data-view="back"]', (n) => n.click());
    const back = await page.screenshot({ path: `${out}/${theme}-back.png` });
    const a = PNG.sync.read(front),
      b = PNG.sync.read(back);
    let changed = 0;
    for (let i = 0; i < a.data.length; i += 4)
      if (
        Math.abs(a.data[i] - b.data[i]) +
          Math.abs(a.data[i + 1] - b.data[i + 1]) +
          Math.abs(a.data[i + 2] - b.data[i + 2]) >
        25
      )
        changed++;
    assert(changed > 60000, theme + " needs actual 360-degree geometry");
    await page.$eval('[data-view="side"]', (n) => n.click());
    await page.screenshot({ path: `${out}/${theme}-side.png` });
    pass(
      `${theme}: real front/back/side renders match GLB triangles and batched draw counts`,
    );
  }
  // Exercise the shared viewer's dynamic selector and geometry disposal, not just URL reloads.
  await page.goto(review, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => window.artReady);
  for (const { theme } of manifest.islands) {
    await page.select("#art-theme", theme);
    await page.waitForFunction(
      (theme) => window.artReady && window.artTheme === theme,
      {},
      theme,
    );
  }
  assert((await page.evaluate(() => window.artStats.geometries)) <= 11);
  pass(
    "All seven review selector choices load and old model geometries are disposed",
  );
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(app + "/settings", { waitUntil: "networkidle0" });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "Explore the demo workspace")
      .click(),
  );
  await page.waitForFunction(() => localStorage.getItem("study-world.demo.v1"));
  await page.evaluate(
    (themes) => {
      const data = JSON.parse(localStorage.getItem("study-world.demo.v1"));
      for (const theme of themes) {
        const id = "art-" + theme;
        data.subjects.push({
          id,
          name: "Art " + theme,
          color: "#718c6b",
          theme,
          archived: false,
        });
        for (let i = 0; i < 8; i++)
          data.topics.push({
            id: id + "-" + i,
            subjectId: id,
            name: theme + " topic " + i,
            group: "",
          });
      }
      localStorage.setItem("study-world.personal.v1", JSON.stringify(data));
    },
    manifest.islands.map((e) => e.theme),
  );
  await page.goto(app + "/", { waitUntil: "networkidle0" });
  await healthy(page);
  await page.waitForFunction(
    () => document.querySelectorAll(".island-label").length === 12,
  );
  await page.click('[aria-label="Next island group"]');
  await page.waitForFunction(
    () => document.querySelectorAll(".island-label").length === 1,
  );
  await healthy(page);
  assert(requests.includes("/models/island_generic_v2.glb"));
  assert(!requests.some((r) => /landmark_|island_base_/.test(r)));
  await page.screenshot({ path: out + "/custom-subject-world.png" });
  const before = await page.evaluate(() =>
    localStorage.getItem("study-world.personal.v1"),
  );
  pass(
    "Thirteen subjects use paged themed models, including generic custom artwork, without old landmark/base requests",
  );
  for (const { theme } of manifest.islands) {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(app + "/?island=art-" + theme + "&view=island", {
      waitUntil: "networkidle0",
    });
    await page.waitForFunction(
      () => document.querySelectorAll(".topic-plot-label").length === 6,
    );
    await healthy(page);
    await page.click('[aria-label="Next topic plots"]');
    await page.waitForFunction(
      () => document.querySelectorAll(".topic-plot-label").length === 2,
    );
    // New paged HTML labels mount before R3F projects their screen coordinates.
    // A count alone can still expose an unpositioned label underneath the header.
    await page.waitForFunction(
      (name) => {
        const n = document.querySelector(`[aria-label="Open topic: ${name}"]`);
        return (
          n?.style.transform.startsWith("translate3d") &&
          getComputedStyle(n).visibility === "visible"
        );
      },
      {},
      theme + " topic 7",
    );
    await page.click(`[aria-label="Open topic: ${theme} topic 7"]`);
    await page.waitForFunction(
      (name) =>
        document.querySelector("#world-topic-title")?.textContent === name,
      {},
      theme + " topic 7",
    );
    await page.screenshot({ path: out + "/" + theme + "-garden-desktop.png" });
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("study-world.personal.v1"),
      ),
      before,
    );
    pass(
      `${theme}: a custom-themed subject keeps six-plus-two paging, real topic selection and unchanged study data`,
    );
    for (const width of [320, 390, 430]) {
      await page.setViewport({ width, height: 844 });
      await page.waitForFunction(
        (width) =>
          Math.round(
            document.querySelector("canvas")?.getBoundingClientRect().width,
          ) === width,
        {},
        width,
      );
      await healthy(page);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      assert.equal(
        await page.$eval("canvas", (c) =>
          Math.round(c.getBoundingClientRect().width),
        ),
        width,
      );
      assert(await page.$("#world-topic-title"));
      await page.screenshot({ path: `${out}/${theme}-garden-${width}.png` });
    }
    pass(
      `${theme}: live garden and topic panel fit 320/390/430px with reduced motion`,
    );
  }
  assert.equal(
    await page.evaluate(() => localStorage.getItem("study-world.personal.v1")),
    before,
  );
  // Block a non-Maths profile explicitly so the new paths are actually fault-tested.
  const context = await browser.createBrowserContext(),
    broken = await context.newPage();
  await broken.setRequestInterception(true);
  broken.on("request", (r) =>
    r.url().endsWith("/models/island_gk_v2.glb") ? r.abort() : r.continue(),
  );
  await broken.goto(app + "/", { waitUntil: "networkidle0" });
  await broken.waitForFunction(() =>
    [...document.querySelectorAll(".scene-fallback")].some(
      (n) =>
        n.getBoundingClientRect().width > 0 &&
        n.getBoundingClientRect().height > 0,
    ),
  );
  assert.equal(await broken.$$eval(".subject-card", (n) => n.length), 6);
  await broken.goto(app + "/today", { waitUntil: "networkidle0" });
  await broken.waitForSelector(".today-page");
  await context.close();
  pass(
    "A failed non-Maths themed GLB reaches visible 2D recovery while Today remains usable",
  );
  assert.deepEqual(errors, []);
  await page.setViewport({ width: 1600, height: 1130 });
  await page.goto(review.replace("review.html", "all-themes.html"), {
    waitUntil: "networkidle0",
  });
  await page.screenshot({
    path: "design/islands/all-themes-overview.png",
    fullPage: true,
  });
  await writeFile(
    out + "/browser-results.json",
    JSON.stringify(
      { checks, errors, requests: [...new Set(requests)], stats },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
