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
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => a !== "--single-process"),
  headless: "shell",
});
const app = process.env.APP_URL ?? "http://127.0.0.1:5175",
  checks = [],
  errors = [];
await mkdir(".cache/sky-flight", { recursive: true });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
const state = (page) =>
  page.$eval(".world-canvas", (n) => ({
    status: n.dataset.skyStatus,
    count: Number(n.dataset.skyCount),
    visible: n.dataset.skyVisible === "true",
    safe: n.dataset.skySafe !== "false",
    running: n.dataset.skyRunning === "true",
    reason: n.dataset.skyReason,
    ticks: Number(n.dataset.skyTicks),
    pose: JSON.parse(n.dataset.skyPose ?? "null"),
  }));
async function controls(page) {
  if (!(await page.$(".world-controls")))
    await page.click(".world-controls-menu > button");
  await page.waitForSelector(".world-controls");
}
async function ready(page) {
  await page.waitForFunction(
    () =>
      document.querySelector(".world-canvas")?.dataset.skyStatus === "ready" &&
      document.querySelector(".world-canvas").dataset.cameraMoving === "false",
    { timeout: 60000 },
  );
}
async function demo(page) {
  await page.goto(app + "/settings", { waitUntil: "networkidle0" });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "Explore the demo workspace")
      .click(),
  );
}
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await demo(page);
  const stored = await page.evaluate(() =>
    localStorage.getItem("study-world.personal.v1"),
  );
  await page.goto(app + "/", { waitUntil: "networkidle0" });
  await ready(page);
  await page.waitForFunction(
    () => document.querySelector(".world-canvas").dataset.skyVisible === "true",
  );
  let initial = await state(page);
  assert.equal(initial.count, 1);
  assert(initial.running);
  await page.screenshot({
    path: "design/sky-creature/world-flight-preview.png",
  });
  await page.waitForFunction(
    (t) =>
      JSON.parse(document.querySelector(".world-canvas").dataset.skyPose).time >
      t + 0.5,
    {},
    initial.pose.time,
  );
  let moved = await state(page);
  assert.notDeepEqual(moved.pose.position, initial.pose.position);
  assert.notEqual(moved.pose.wing, initial.pose.wing);
  pass(
    "One real skinned Aurel flies in the live overview; route and wing joints both change",
  );
  await controls(page);
  await page.click('[aria-label="Animate sky creature"]');
  await page.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.skyReason === "paused",
  );
  let paused = await state(page);
  await delay(350);
  assert.deepEqual((await state(page)).pose, paused.pose);
  assert.equal(
    await page.$eval(".world-canvas", (n) => n.dataset.villagerRunning),
    "true",
  );
  await controls(page);
  await page.click('[aria-label="Animate sky creature"]');
  await page.waitForFunction(
    (t) =>
      JSON.parse(document.querySelector(".world-canvas").dataset.skyPose).time >
      t + 0.2,
    {},
    paused.pose.time,
  );
  await page.click('[aria-label="Animate villagers"]');
  assert((await state(page)).running);
  await page.click('[aria-label="Animate villagers"]');
  pass(
    "Independent Sky pause freezes flight and wing pose without pausing villagers or writing preferences",
  );
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector(".world-canvas").dataset.skyPose)
        .glide > 0.6,
    { timeout: 60000 },
  );
  assert.equal((await state(page)).pose.clip, "Glide");
  pass("Live mixer crossfades from wingbeats into a calm glide");
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.skyReason ===
      "reduced-motion",
  );
  paused = await state(page);
  await delay(250);
  assert.deepEqual((await state(page)).pose, paused.pose);
  assert(
    await page.$eval('[aria-label="Animate sky creature"]', (n) => n.disabled),
  );
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  await page.click('[aria-label="Close World controls"]');
  await page.waitForFunction(
    () => document.querySelector(".world-canvas").dataset.skyRunning === "true",
  );
  pass(
    "Live reduced-motion preference stops route and skeleton with no play override",
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.skyReason ===
      "hidden-tab",
  );
  paused = await state(page);
  await delay(220);
  assert.equal((await state(page)).pose.time, paused.pose.time);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(
    () => document.querySelector(".world-canvas").dataset.skyRunning === "true",
  );
  await page.$eval(".world-canvas", (n) => {
    n.style.transform = "translateX(300vw)";
  });
  await page.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.skyReason === "offscreen",
  );
  paused = await state(page);
  await delay(220);
  assert.equal((await state(page)).pose.time, paused.pose.time);
  await page.$eval(".world-canvas", (n) => {
    n.style.transform = "";
  });
  await page.waitForFunction(
    () => document.querySelector(".world-canvas").dataset.skyRunning === "true",
  );
  pass(
    "Hidden-document signal and actual offscreen canvas stop clocks, then resume without catch-up",
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("study-world.personal.v1")),
    stored,
  );
  // Seed only the test browser's personal data, never the running user's browser.
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("study-world.demo.v1"));
    for (
      let i = d.topics.filter((t) => t.subjectId === "maths").length;
      i < 8;
      i++
    )
      d.topics.push({
        id: "sky-topic-" + i,
        name: "Sky test topic " + i,
        subjectId: "maths",
        group: "",
      });
    d.subjects.push({
      id: "sky-custom",
      name: "Sky custom",
      theme: "generic",
      color: "#648f91",
      archived: false,
    });
    localStorage.setItem("study-world.personal.v1", JSON.stringify(d));
  });
  await page.goto(app + "/?island=maths&view=island", {
    waitUntil: "networkidle0",
  });
  await ready(page);
  await page.waitForFunction(
    () => document.querySelectorAll(".topic-plot-label").length === 6,
  );
  await page.click('[aria-label="Next topic plots"]');
  await page.waitForFunction(
    () => document.querySelectorAll(".topic-plot-label").length === 2,
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".topic-plot-label")].every(
      (n) =>
        n.style.transform.includes("translate3d") &&
        n.style.visibility !== "hidden",
    ),
  );
  await page.click(".topic-plot-label");
  await page.waitForSelector("#world-topic-title");
  assert.match(
    await page.$eval("#world-topic-title", (n) => n.textContent),
    /Sky test topic/,
  );
  for (let i = 0; i < 8; i++) {
    const p = await state(page);
    if (p.visible && p.safe) {
      const b = p.pose.bounds;
      const conflicts = await page.$$eval(
        ".topic-plot-label,.world-hud-left,.world-top-tools,.island-console,.sky-motion-toggle,.site-header",
        (nodes, b) => {
          const c = document.querySelector("canvas").getBoundingClientRect();
          return nodes.some((n) => {
            const r = n.getBoundingClientRect();
            return (
              r.width &&
              r.height &&
              b.left < r.right - c.left &&
              b.right > r.left - c.left &&
              b.top < r.bottom - c.top &&
              b.bottom > r.top - c.top
            );
          });
        },
        b,
      );
      assert(
        !conflicts,
        "Visible sky footprint must not overlap interactive UI",
      );
    }
    await delay(180);
  }
  pass(
    "Six-plus-two topic paging, actual pointer selection, task panel and conservative UI/plot clearance remain intact",
  );
  for (const width of [320, 390, 430]) {
    await page.setViewport({ width, height: 844 });
    await ready(page);
    assert.equal((await state(page)).count, 1);
    await page.waitForFunction(
      () =>
        document.querySelector(".world-canvas").dataset.skyVisible === "true",
      { timeout: 20000 },
    );
    await controls(page);
    const panel = await page.$eval('.controls-popover[role="dialog"]', (n) => {
      const r = n.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        w: innerWidth,
        h: innerHeight,
      };
    });
    assert(
      panel.left >= 0 &&
        panel.right <= panel.w &&
        panel.top >= 0 &&
        panel.bottom <= panel.h,
    );
    await page.click('[aria-label="Close World controls"]');
    assert(await page.$("#world-topic-title"));
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({ path: `.cache/sky-flight/mobile-${width}.png` });
  }
  pass(
    "One creature at 320/390/430px; expandable Controls fits on screen while preserving the topic panel",
  );
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto(app + "/?island=sky-custom&view=island", {
    waitUntil: "networkidle0",
  });
  await ready(page);
  assert.equal((await state(page)).count, 1);
  const old = await page.$(".world-canvas");
  await page.click('a[href="/today"]');
  await page.waitForSelector(".today-page");
  assert.equal(await old.evaluate((n) => n.isConnected), false);
  await old.dispose();
  pass(
    "Dynamic custom subject works; SPA navigation removes the sky scene and its simulation",
  );
  const manyContext = await browser.createBrowserContext();
  const many = await manyContext.newPage();
  many.on("pageerror", (e) => errors.push(e.message));
  await many.goto(app + "/settings", { waitUntil: "networkidle0" });
  await many.evaluate(() => {
    const key = "study-world.personal.v1",
      d = JSON.parse(localStorage.getItem(key));
    for (let i = 0; i < 8; i++)
      d.subjects.push({
        id: "flight-extra-" + i,
        name: "Flight extra " + i,
        theme: "generic",
        color: "#648f91",
        archived: false,
      });
    localStorage.setItem(key, JSON.stringify(d));
  });
  await many.goto(app + "/", { waitUntil: "networkidle0" });
  for (const width of [800, 320]) {
    await many.setViewport({ width, height: 844 });
    await many.waitForFunction(
      () => document.querySelectorAll(".island-label").length === 12,
    );
    await ready(many);
    assert.equal(
      await many.$eval(".world-controls-menu > button", (n) => {
        const a = n.getBoundingClientRect(),
          b = document
            .querySelector(".world-pagination")
            .getBoundingClientRect();
        return (
          a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top
        );
      }),
      false,
    );
    await many.click('[aria-label="Next island group"]');
    await many.waitForFunction(
      () => document.querySelectorAll(".island-label").length === 2,
    );
    await many.click('[aria-label="Previous island group"]');
    await many.waitForFunction(
      () => document.querySelectorAll(".island-label").length === 12,
    );
  }
  await manyContext.close();
  pass(
    "Fourteen-subject Next/Previous paging remains clickable at 800px and 320px; Sky pause does not cover group controls",
  );
  const broken = await browser.newPage();
  await broken.setRequestInterception(true);
  broken.on("request", (r) =>
    r.url().endsWith("/models/aurel_sky_drake_rigged_v1.glb")
      ? r.abort()
      : r.continue(),
  );
  await demo(broken);
  await broken.goto(app + "/?island=maths&view=island", {
    waitUntil: "networkidle0",
  });
  await broken.waitForFunction(
    () =>
      document.querySelector(".world-canvas")?.dataset.skyStatus ===
      "unavailable",
  );
  await controls(broken);
  assert(
    await broken.$eval(
      '[aria-label="Animate sky creature"]',
      (n) => n.disabled,
    ),
  );
  await broken.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.cameraMoving === "false",
  );
  assert.equal(
    await broken.$$eval(".scene-fallback", (n) =>
      n.some((e) => e.getBoundingClientRect().width > 0),
    ),
    false,
  );
  assert(await broken.$("canvas"));
  await broken.goto(app + "/today", { waitUntil: "networkidle0" });
  await broken.waitForSelector(".today-page");
  await broken.close();
  pass(
    "Creature download failure disables only sky art; real 3D island and Today still work",
  );
  // Regression: test the actual default embedded overview, not only focused
  // gardens or actor-count datasets. Closed details can have a layout rectangle
  // while painting nothing, and clouds can occlude an incorrectly placed mesh.
  const overviewContext = await browser.createBrowserContext();
  const overview = await overviewContext.newPage();
  overview.on("pageerror", (e) => errors.push(e.message));
  await overview.setViewport({ width: 1100, height: 950 });
  await overview.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle0" });
  const mobile = await (
    await overview.waitForSelector("iframe")
  ).contentFrame();
  await ready(mobile);
  assert.equal(await mobile.evaluate(() => innerWidth), 390);
  assert.equal(await mobile.$eval(".world-atlas", (n) => n.open), false);
  for (const width of [390, 320, 430]) {
    if (width !== 390)
      await overview.select(".responsive-preview-width select", String(width));
    await mobile.waitForFunction((w) => innerWidth === w, {}, width);
    await ready(mobile);
    await mobile.waitForFunction(
      () =>
        document.querySelector(".world-canvas").dataset.skyVisible === "true",
    );
    let visible = 0;
    const samples = width === 390 ? 16 : 6;
    for (let i = 0; i < samples; i++) {
      if ((await state(mobile)).visible) visible++;
      await delay(500);
    }
    assert(
      visible >= samples * 0.75,
      `Default ${width}px overview must show Aurel reliably, not permanently hide it`,
    );
  }
  await overview.select(".responsive-preview-width select", "390");
  await ready(mobile);
  await mobile.waitForFunction(
    () => document.querySelector(".world-canvas").dataset.skyVisible === "true",
  );
  const beforePose = (await state(mobile)).pose;
  const canvas = await mobile.$("canvas");
  const before = PNG.sync.read(await canvas.screenshot());
  await delay(850);
  const afterPose = (await state(mobile)).pose;
  assert((await state(mobile)).visible);
  const after = PNG.sync.read(await canvas.screenshot());
  const dimensions = await mobile.$eval("canvas", (n) => ({
    width: n.clientWidth,
    height: n.clientHeight,
  }));
  const a = beforePose.bounds,
    b = afterPose.bounds;
  const left = Math.max(
    0,
    Math.floor((Math.min(a.left, b.left) * before.width) / dimensions.width),
  );
  const right = Math.min(
    before.width,
    Math.ceil((Math.max(a.right, b.right) * before.width) / dimensions.width),
  );
  const top = Math.max(
    0,
    Math.floor((Math.min(a.top, b.top) * before.height) / dimensions.height),
  );
  const bottom = Math.min(
    before.height,
    Math.ceil(
      (Math.max(a.bottom, b.bottom) * before.height) / dimensions.height,
    ),
  );
  let changed = 0;
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) {
      const i = (y * before.width + x) * 4;
      if (
        Math.abs(before.data[i] - after.data[i]) +
          Math.abs(before.data[i + 1] - after.data[i + 1]) +
          Math.abs(before.data[i + 2] - after.data[i + 2]) >
        35
      )
        changed++;
    }
  assert(
    changed > 100,
    `Expected actual visible moving dragon pixels below the islands, got ${changed}`,
  );
  await overview.screenshot({
    path: "design/sky-creature/world-flight-mobile.png",
  });
  await mobile.click(".world-atlas summary");
  await mobile.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.skyVisible === "false",
  );
  await mobile.click(".world-atlas summary");
  await mobile.waitForFunction(
    () => document.querySelector(".world-canvas").dataset.skyVisible === "true",
  );
  await overviewContext.close();
  pass(
    `Default embedded 320/390/430 overview reliably shows Aurel; ${changed} real animated pixels, closed atlas ignored and open atlas protected`,
  );
  const dev = await browser.newPage();
  dev.on("pageerror", (e) => errors.push(e.message));
  await dev.setViewport({ width: 1100, height: 950 });
  await dev.goto("http://127.0.0.1:5173/?island=maths&view=island", {
    waitUntil: "networkidle0",
  });
  const frame = await (
    await dev.waitForSelector(
      'iframe[title="Study World interactive app preview"]',
    )
  ).contentFrame();
  await ready(frame);
  for (const child of [2, 3, 2, 3]) {
    await dev.click(`.responsive-preview-modes button:nth-child(${child})`);
    await frame.waitForFunction(
      (w) => innerWidth === w,
      {},
      child === 2 ? 768 : 390,
    );
    await ready(frame);
    assert.equal((await state(frame)).count, 1);
  }
  const t = (await state(frame)).pose.time;
  await frame.waitForFunction(
    (t) =>
      JSON.parse(document.querySelector(".world-canvas").dataset.skyPose).time >
      t + 0.2,
    {},
    t,
  );
  await dev.screenshot({ path: ".cache/sky-flight/embedded.png" });
  await dev.close();
  pass(
    "StrictMode and repeated Tablet/Mobile changes retain one live skeleton with no binding errors",
  );
  assert.deepEqual(errors, []);
  const manifest = JSON.parse(
    await readFile("design/sky-creature/animation-manifest.json", "utf8"),
  );
  assert.equal(
    (await readFile("public/models/aurel_sky_drake_rigged_v1.glb")).length,
    manifest.bytes,
  );
  // The dedicated first half never changes personal state; later seeding is test-only.
  assert(stored !== undefined);
  pass(
    "No browser page errors; published model matches the approved rig budget",
  );
  await writeFile(
    ".cache/sky-flight/browser-report.json",
    JSON.stringify({ checks, errors }, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
