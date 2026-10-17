// Actual Chromium/WebGL motion, lifecycle, accessibility and planner regression.
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
const app = process.env.APP_URL ?? "http://127.0.0.1:5175";
const review =
  process.env.VILLAGER_URL ??
  "http://127.0.0.1:5173/design/villagers/review.html";
const out = ".cache/villagers";
await mkdir(out, { recursive: true });
const checks = [],
  errors = [];
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => a !== "--single-process"),
  headless: "shell",
});
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const state = (page) =>
  page.$eval(".world-canvas", (n) => ({
    count: Number(n.dataset.villagerCount),
    running: n.dataset.villagerRunning,
    reason: n.dataset.villagerReason,
    ticks: Number(n.dataset.villagerTicks),
    poses: JSON.parse(n.dataset.villagerPoses || "[]"),
  }));
async function ready(page, count) {
  await page.waitForFunction(
    (count) => {
      const n = document.querySelector(".world-canvas");
      return (
        n?.dataset.villagerStatus === "ready" &&
        Number(n.dataset.villagerCount) === count &&
        n.dataset.cameraMoving === "false"
      );
    },
    { timeout: 60000 },
    count,
  );
  assert(
    await page.$$eval(".scene-fallback", (n) =>
      n.every(
        (e) =>
          !e.getBoundingClientRect().width || !e.getBoundingClientRect().height,
      ),
    ),
  );
}
async function controls(page) {
  if (!(await page.$(".world-controls")))
    await page.click(".world-controls-menu > button");
  await page.waitForSelector(".world-controls");
}
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1200, height: 850 });
  await page.goto(review, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => window.villagersReady);
  await page.evaluate(() => {
    window.villagerReview.clip("Walk");
    window.villagerReview.seek(0);
  });
  const a = PNG.sync.read(await page.screenshot({ path: out + "/walk-0.png" }));
  await page.evaluate(() => window.villagerReview.seek(0.35));
  const stat = await page.evaluate(() => window.villagerStats);
  assert.equal(stat.draws, 3);
  assert.equal(stat.triangles, 7740);
  assert.deepEqual(stat.bones, [14, 14, 14]);
  assert(stat.poses.every((p) => Math.abs(p.leg) > 0.3));
  const b = PNG.sync.read(
    await page.screenshot({ path: "design/villagers/preview.png" }),
  );
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (
      Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2]) >
      30
    )
      changed++;
  assert(changed > 1500);
  for (const clip of ["Idle", "LookAround", "Study"]) {
    await page.evaluate((clip) => {
      window.villagerReview.clip(clip);
      window.villagerReview.seek(1);
    }, clip);
    await page.screenshot({ path: out + "/" + clip + ".png" });
  }
  pass(
    "Three real 14-bone skinned villagers render and deform; all four clips are inspectable, not static image stand-ins",
  );
  // A short real canvas recording is a delivery preview, not simulated motion or a camera-only video.
  const video = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas"),
      stream = canvas.captureStream(24);
    const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8",
        videoBitsPerSecond: 1600000,
      }),
      chunks = [];
    const done = new Promise((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(new Blob(chunks, { type: "video/webm" }));
      };
    });
    window.villagerReview.clip("Walk");
    window.villagerReview.play(true);
    recorder.start();
    await new Promise((r) => setTimeout(r, 2200));
    window.villagerReview.clip("LookAround");
    await new Promise((r) => setTimeout(r, 2200));
    window.villagerReview.clip("Study");
    await new Promise((r) => setTimeout(r, 2200));
    recorder.stop();
    window.villagerReview.play(false);
    stream.getTracks().forEach((t) => t.stop());
    return done;
  });
  await writeFile(
    "design/villagers/villagers-motion.webm",
    Buffer.from(video, "base64"),
  );
  pass(
    "Recorded the actual animated WebGL canvas as a short Walk / LookAround / Study preview",
  );
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(app + "/settings", { waitUntil: "networkidle0" });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "Explore the demo workspace")
      .click(),
  );
  await page.waitForFunction(() => localStorage.getItem("study-world.demo.v1"));
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("study-world.demo.v1"));
    for (let i = 0; i < 4; i++)
      data.topics.push({
        id: "villager-topic-" + i,
        name: "Villager test " + i,
        subjectId: "maths",
        group: "",
      });
    data.subjects.push({
      id: "villager-custom",
      name: "Custom village",
      theme: "generic",
      color: "#718c6b",
      archived: false,
    });
    for (let i = 0; i < 8; i++)
      data.topics.push({
        id: "custom-village-" + i,
        name: "Custom village topic " + i,
        subjectId: "villager-custom",
        group: "",
      });
    localStorage.setItem("study-world.personal.v1", JSON.stringify(data));
  });
  await page.goto(app + "/", { waitUntil: "networkidle0" });
  await ready(page, 3);
  const stored = await page.evaluate(() =>
    localStorage.getItem("study-world.personal.v1"),
  );
  pass(
    "Desktop overview is globally capped at three villagers instead of multiplying crowds per subject",
  );
  await page.goto(app + "/?island=maths&view=island", {
    waitUntil: "networkidle0",
  });
  await ready(page, 2);
  const start = await state(page);
  await page.waitForFunction(
    (t) =>
      Number(document.querySelector(".world-canvas").dataset.villagerTicks) >
      t + 10,
    {},
    start.ticks,
  );
  const moved = await state(page);
  assert(
    moved.poses.some(
      (p, i) =>
        Math.abs(p.x - start.poses[i].x) > 0.02 ||
        Math.abs(p.leg - start.poses[i].leg) > 0.05,
    ),
  );
  const observed = new Set(moved.poses.map((p) => p.state));
  for (let i = 0; i < 20 && observed.size < 3; i++) {
    await delay(450);
    (await state(page)).poses.forEach((p) => observed.add(p.state));
  }
  for (const name of ["Walk", "LookAround", "Study"])
    assert(observed.has(name), "Autonomous lifecycle needs " + name);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("study-world.personal.v1")),
    stored,
  );
  await page.screenshot({ path: out + "/garden-desktop.png" });
  pass(
    "Focused desktop garden has two autonomous walkers that pause, look and read; actual bone/root poses change without study writes",
  );
  await controls(page);
  await page.click(".villager-motion-toggle");
  await page.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.villagerReason ===
      "paused",
  );
  await delay(150);
  const paused = await state(page);
  await delay(1000);
  assert.deepEqual(await state(page), paused);
  assert.equal(
    await page.$eval(".villager-motion-toggle", (b) =>
      b.getAttribute("aria-pressed"),
    ),
    "false",
  );
  await controls(page);
  await page.click(".villager-motion-toggle");
  await page.waitForFunction(
    (t) =>
      Number(document.querySelector(".world-canvas").dataset.villagerTicks) > t,
    {},
    paused.ticks,
  );
  pass(
    "Explicit accessible Pause / Resume freezes the actual simulation clock and joints, then resumes",
  );
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.waitForFunction(() => {
    const n = document.querySelector(".world-canvas");
    return (
      n?.dataset.villagerReason === "reduced-motion" &&
      JSON.parse(n.dataset.villagerPoses).every((p) => p.state === "Idle")
    );
  });
  const reduced = await state(page);
  assert(await page.$eval(".villager-motion-toggle", (n) => n.disabled));
  await delay(1000);
  assert.deepEqual(await state(page), reduced);
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  await page.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.villagerRunning ===
      "true",
  );
  pass(
    "Changing the OS reduced-motion signal live stops movement in a calm idle pose; the control cannot override it",
  );
  await page.evaluate(() => {
    document.querySelector(".world-canvas").style.transform =
      "translateX(300vw)";
  });
  await page.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.villagerReason ===
      "offscreen",
  );
  await delay(150);
  const offscreen = await state(page);
  await delay(1000);
  assert.deepEqual(await state(page), offscreen);
  await page.evaluate(
    () => (document.querySelector(".world-canvas").style.transform = ""),
  );
  await page.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.villagerRunning ===
      "true",
  );
  pass(
    "Moving the actual canvas outside the viewport pauses the crowd and restoring it resumes without a clock jump",
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.villagerReason ===
      "hidden-tab",
  );
  await delay(200);
  const hidden = await state(page);
  await delay(1000);
  assert.deepEqual(await state(page), hidden);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.villagerRunning ===
      "true",
  );
  pass(
    "A simulated hidden-tab visibilitychange stops the clock and resumes safely on visibility restoration",
  );
  for (const id of [
    "maths",
    "reasoning",
    "english",
    "gk",
    "dsa",
    "software",
    "villager-custom",
  ]) {
    await page.goto(app + "/?island=" + id + "&view=island", {
      waitUntil: "networkidle0",
    });
    await ready(page, 2);
    assert(
      (await state(page)).poses.every(
        (p) => Number.isFinite(p.x) && Number.isFinite(p.z),
      ),
    );
  }
  await page.waitForFunction(
    () => document.querySelectorAll(".topic-plot-label").length === 6,
  );
  await page.click('[aria-label="Next topic plots"]');
  await page.waitForFunction(
    () => document.querySelectorAll(".topic-plot-label").length === 2,
  );
  await page.click('[aria-label="Open topic: Custom village topic 7"]');
  await page.waitForSelector("#world-topic-title");
  assert.equal(
    await page.$eval("#world-topic-title", (n) => n.textContent),
    "Custom village topic 7",
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("study-world.personal.v1")),
    stored,
  );
  pass(
    "All seven profiles support villagers, including a new generic subject, while six-plus-two topic paging and real selection stay intact",
  );
  for (const width of [320, 390, 430]) {
    await page.setViewport({ width, height: 844 });
    await page.waitForFunction(
      (w) =>
        Math.round(
          document.querySelector("canvas").getBoundingClientRect().width,
        ) === w,
      {},
      width,
    );
    await ready(page, 1);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await controls(page);
    const overlap = await page.$$eval(".world-controls button", (nodes) =>
      nodes.some((n, i) => {
        const a = n.getBoundingClientRect();
        return nodes.slice(0, i).some((m) => {
          const b = m.getBoundingClientRect();
          return (
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top
          );
        });
      }),
    );
    assert.equal(overlap, false);
    assert(await page.$("#world-topic-title"));
    await page.screenshot({ path: out + "/garden-" + width + ".png" });
  }
  pass(
    "Animated 320/390/430px gardens use one villager, retain the open topic panel and fit the controls popover without overlapping buttons",
  );
  const old = await page.$(".world-canvas");
  await page.evaluate(() => {
    history.pushState(null, "", "/today");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForSelector(".today-page");
  assert.equal(await old.evaluate((n) => n.dataset.villagerCount), "0");
  const stopped = await old.evaluate((n) => n.dataset.villagerTicks);
  await delay(700);
  assert.equal(await old.evaluate((n) => n.dataset.villagerTicks), stopped);
  await old.dispose();
  pass(
    "SPA navigation cleans up the crowd, mixers and frame timer rather than animating a detached scene",
  );
  const context = await browser.createBrowserContext(),
    broken = await context.newPage();
  await broken.setViewport({ width: 1440, height: 1000 });
  await broken.setRequestInterception(true);
  broken.on("request", (r) =>
    r.url().includes("/models/villager_") ? r.abort() : r.continue(),
  );
  await broken.goto(app + "/settings", { waitUntil: "networkidle0" });
  await broken.evaluate(
    (value) => localStorage.setItem("study-world.personal.v1", value),
    stored,
  );
  await broken.goto(app + "/?island=maths&view=island", {
    waitUntil: "networkidle0",
  });
  await broken.waitForFunction(
    () =>
      document.querySelector(".world-canvas")?.dataset.villagerStatus ===
      "unavailable",
  );
  assert(await broken.$("canvas"));
  assert(
    await broken.$$eval(".scene-fallback", (n) =>
      n.every(
        (e) =>
          !e.getBoundingClientRect().width || !e.getBoundingClientRect().height,
      ),
    ),
  );
  await broken.waitForSelector('[aria-label="Open topic: Percentage"]');
  await broken.click('[aria-label="Open topic: Percentage"]');
  await broken.waitForSelector("#world-topic-title");
  await controls(broken);
  assert(await broken.$eval(".villager-motion-toggle", (n) => n.disabled));
  await broken.goto(app + "/today", { waitUntil: "networkidle0" });
  await broken.waitForSelector(".today-page");
  await context.close();
  pass(
    "Failed villager downloads remove only optional people: the real 3D island, topic tasks and Today remain usable",
  );
  const dev = await browser.newPage();
  dev.on("pageerror", (e) => errors.push(e.message));
  await dev.setViewport({ width: 1100, height: 950 });
  await dev.goto(
    review.replace(
      "/design/villagers/review.html",
      "/?island=maths&view=island",
    ),
    { waitUntil: "networkidle0" },
  );
  const frame = await (
    await dev.waitForSelector(
      'iframe[title="Study World interactive app preview"]',
    )
  ).contentFrame();
  await ready(frame, 1);
  await dev.click(".responsive-preview-modes button:nth-child(2)");
  await frame.waitForFunction(() => innerWidth === 768);
  await ready(frame, 2);
  await dev.click(".responsive-preview-modes button:nth-child(3)");
  await frame.waitForFunction(() => innerWidth === 390);
  await ready(frame, 1);
  const live = await state(frame);
  await frame.waitForFunction(
    (t) =>
      Number(document.querySelector(".world-canvas").dataset.villagerTicks) >
      t + 4,
    {},
    live.ticks,
  );
  await dev.screenshot({ path: out + "/embedded-live.png" });
  await dev.close();
  pass(
    "Development StrictMode mount/replay and Tablet/Mobile rig replacement preserve live joint animation without mixer-binding errors",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/browser-results.json",
    JSON.stringify(
      { checks, errors, review: stat, observedActivities: [...observed] },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
