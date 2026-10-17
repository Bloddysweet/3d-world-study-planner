// Optional browser dependencies: npm --prefix design/model-review ci
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
process.env.AWS_EXECUTION_ENV ??= "AWS_Lambda_nodejs22.x";
const require = createRequire(
  new URL("../design/model-review/package.json", import.meta.url),
);
const { default: chromium } = await import(
  require.resolve("@sparticuz/chromium")
);
const { default: puppeteer } = await import(require.resolve("puppeteer-core"));
const url = process.env.APP_URL ?? "http://127.0.0.1:5173";
const output = resolve(".cache/world-check");
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => a !== "--single-process"),
  headless: "shell",
});
const checks = [],
  errors = [],
  requests = [];
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
async function click(page, text, selector = "button") {
  await page.waitForFunction(
    (text, selector) =>
      [...document.querySelectorAll(selector)].some(
        (el) => el.textContent.trim() === text && el.getClientRects().length,
      ),
    {},
    text,
    selector,
  );
  const handle = await page.evaluateHandle(
    (text, selector) =>
      [...document.querySelectorAll(selector)].find(
        (el) => el.textContent.trim() === text && el.getClientRects().length,
      ),
    text,
    selector,
  );
  await handle.asElement().click();
  await handle.dispose();
}
const stored = (page) =>
  page.evaluate(() => localStorage.getItem("study-world.personal.v1"));
async function cameraStill(page) {
  await page.evaluate(() => delete window.__worldStable);
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector(".world-canvas");
      if (
        !canvas?.dataset.cameraDistance ||
        canvas.dataset.cameraMoving === "true"
      )
        return false;
      const state = (window.__worldStable ??= { previous: "", frames: 0 });
      const value =
        Number(canvas.dataset.cameraAzimuth).toFixed(5) +
        "|" +
        Number(canvas.dataset.cameraDistance).toFixed(5);
      state.frames = value === state.previous ? state.frames + 1 : 0;
      state.previous = value;
      return state.frames >= 6;
    },
    { polling: "raf", timeout: 30000 },
  );
}
const camera = (page) =>
  page.$eval(".world-canvas", (el) => ({
    distance: Number(el.dataset.cameraDistance),
    angle: Number(el.dataset.cameraAzimuth),
  }));
async function ensureControls(page) {
  if (!(await page.$(".world-controls")))
    await page.click(".world-controls-menu > button");
  await page.waitForSelector(".world-controls");
}
async function selectIsland(page, id) {
  await page.click(".world-atlas summary");
  const handle = await page.evaluateHandle(
    (id) =>
      [...document.querySelectorAll(".atlas-item")]
        .find(
          (n) =>
            n.querySelector("a")?.getAttribute("href") === `/subjects/${id}`,
        )
        ?.querySelector("button"),
    id,
  );
  await handle.asElement().click();
  await handle.dispose();
}
async function command(page, selector, axis) {
  await ensureControls(page);
  const before = await camera(page);
  await page.click(selector);
  await page.waitForFunction(
    (before, axis) => {
      const el = document.querySelector(".world-canvas");
      const value = Number(
        axis === "angle"
          ? el?.dataset.cameraAzimuth
          : el?.dataset.cameraDistance,
      );
      return (
        Math.abs(value - before[axis]) > 0.1 &&
        el.dataset.cameraMoving === "false"
      );
    },
    { timeout: 30000 },
    before,
    axis,
  );
  await cameraStill(page);
  return camera(page);
}
async function shot(page, name) {
  await cameraStill(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () =>
      Number(getComputedStyle(document.querySelector(".page")).opacity) > 0.999,
  );
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
async function noLabelOverlap(page) {
  const labels = await page.$$eval(".island-label", (els) =>
    els
      .filter((el) => getComputedStyle(el).visibility === "visible")
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          name: el.textContent,
        };
      }),
  );
  for (let a = 0; a < labels.length; a++)
    for (let b = a + 1; b < labels.length; b++) {
      const x = labels[a],
        y = labels[b];
      assert(
        !(
          x.x < y.x + y.w &&
          x.x + x.w > y.x &&
          x.y < y.y + y.h &&
          x.y + x.h > y.y
        ),
        `Overlapping labels: ${x.name}, ${y.name}`,
      );
    }
}
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) =>
    requests.push({ url: request.url(), error: request.failure()?.errorText }),
  );
  await page.goto(url + "/settings", { waitUntil: "networkidle0" });
  await click(page, "Explore the demo workspace");
  await page.waitForFunction(() => localStorage.getItem("study-world.demo.v1"));
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("study-world.demo.v1"));
    for (let n = 1; n <= 4; n++)
      data.topics.push({
        id: `garden-topic-${n}`,
        subjectId: "maths",
        name: `New arithmetic topic ${n}`,
        group: "New chapter",
      });
    for (let n = 1; n <= 8; n++)
      data.subjects.push({
        id: `world-subject-${n}`,
        name: `Extra island ${n}`,
        theme: "generic",
        color: "#718c6b",
        archived: false,
      });
    localStorage.setItem("study-world.personal.v1", JSON.stringify(data));
  });
  await page.goto(url + "/", { waitUntil: "networkidle0" });
  await page.waitForFunction(
    () => document.querySelectorAll(".island-label").length === 12,
  );
  await cameraStill(page);
  const initial = await stored(page);
  const bounds = await page.$eval("canvas", (el) =>
    el.getBoundingClientRect().toJSON(),
  );
  assert.equal(bounds.width, 1440);
  assert.equal(bounds.height, 1000);
  assert.equal(bounds.x, 0);
  assert.equal(bounds.y, 0);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollHeight > innerHeight,
    ),
    false,
  );
  pass(
    "The 3D canvas fills the viewport, with floating UI rather than a scene card",
  );
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  const beforeTurn = await camera(page);
  let previous = beforeTurn.angle,
    total = 0;
  for (let n = 0; n < 9; n++) {
    const result = await command(
      page,
      'button[aria-label="Rotate view right"]',
      "angle",
    );
    let delta = result.angle - previous;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    assert(delta > 0.6);
    total += delta;
    previous = result.angle;
  }
  assert(total > Math.PI * 2);
  assert.equal(await stored(page), initial);
  pass(
    "Horizontal rotation passes a complete 360-degree turn without an azimuth clamp",
  );
  await ensureControls(page);
  await page.click('button[aria-label="Reset world camera"]');
  await cameraStill(page);
  const startDistance = (await camera(page)).distance;
  for (let n = 0; n < 4; n++)
    await command(page, 'button[aria-label="Zoom in on world"]', "distance");
  assert((await camera(page)).distance < startDistance / 2.5);
  await ensureControls(page);
  await page.click('button[aria-label="Reset world camera"]');
  await cameraStill(page);
  const beforeWheel = (await camera(page)).distance;
  await page.mouse.move(750, 600);
  await page.mouse.wheel({ deltaY: -450 });
  await page.waitForFunction(
    (distance) =>
      Number(document.querySelector(".world-canvas").dataset.cameraDistance) <
      distance * 0.99,
    {},
    beforeWheel,
  );
  await cameraStill(page);
  const oldAngle = (await camera(page)).angle;
  await page.mouse.move(730, 580);
  await page.mouse.down();
  await page.mouse.move(950, 620, { steps: 12 });
  await page.mouse.up();
  await cameraStill(page);
  assert(Math.abs((await camera(page)).angle - oldAngle) > 0.1);
  assert(!new URL(page.url()).searchParams.has("island"));
  const beforePan = await page.$eval(
    ".island-label",
    (el) => el.style.transform,
  );
  await page.mouse.move(730, 580);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(850, 580, { steps: 10 });
  await page.mouse.up({ button: "right" });
  await cameraStill(page);
  assert.notEqual(
    await page.$eval(".island-label", (el) => el.style.transform),
    beforePan,
  );
  await ensureControls(page);
  await page.click('button[aria-label="Reset world camera"]');
  await cameraStill(page);
  pass(
    "Bounded zoom still supports close exploration; wheel zoom, drag orbit and right-drag pan all work",
  );
  const edgeDistance = (await camera(page)).distance;
  await page.mouse.move(1400, 500);
  await page.mouse.wheel({ deltaY: 600 });
  assert.equal(
    await page.$eval("canvas", (canvas) => {
      const r = canvas.getBoundingClientRect();
      const e = new WheelEvent("wheel", {
        clientX: r.left + r.width * 0.95,
        clientY: r.top + r.height * 0.5,
        deltaY: 500,
        cancelable: true,
        bubbles: true,
      });
      canvas.dispatchEvent(e);
      return e.defaultPrevented;
    }),
    false,
  );
  await cameraStill(page);
  assert(Math.abs((await camera(page)).distance - edgeDistance) < 0.01);
  for (const direction of [1, -1]) {
    await page.$eval(
      "canvas",
      (canvas, direction) => {
        const r = canvas.getBoundingClientRect();
        for (let i = 0; i < 200; i++)
          canvas.dispatchEvent(
            new WheelEvent("wheel", {
              clientX: r.left + r.width * 0.5,
              clientY: r.top + r.height * 0.5,
              deltaY: direction * 200,
              bubbles: true,
              cancelable: true,
            }),
          );
      },
      direction,
    );
    await page.waitForFunction(
      (direction) => {
        const d = document.querySelector(".world-canvas").dataset;
        return (
          Math.abs(
            Number(d.cameraDistance) -
              Number(direction > 0 ? d.cameraMaxDistance : d.cameraMinDistance),
          ) < 0.02
        );
      },
      { timeout: 30000 },
      direction,
    );
    await cameraStill(page);
    await shot(page, direction > 0 ? "bounded-zoom-out" : "bounded-zoom-in");
  }
  await ensureControls(page);
  await page.click('button[aria-label="Reset world camera"]');
  await cameraStill(page);
  pass(
    "Wheel zoom only consumes the centre; extreme wheel input stops at responsive minimum and maximum distances",
  );
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  await selectIsland(page, "world-subject-8");
  await cameraStill(page);
  assert.equal(
    await page.$eval("#island-preview-title", (el) => el.textContent),
    "Extra island 8",
  );
  assert(
    (await page.$eval(".world-pagination", (el) => el.textContent)).includes(
      "13–14",
    ),
  );
  await click(page, "New subject");
  await page.waitForSelector("dialog[open]");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  assert.equal(
    new URL(page.url()).searchParams.get("island"),
    "world-subject-8",
  );
  await page.keyboard.press("Escape");
  await cameraStill(page);
  await selectIsland(page, "maths");
  await cameraStill(page);
  await page.focus("#island-preview-title");
  await page.keyboard.press("Tab");
  assert(
    (await page.evaluate(() => document.activeElement.textContent)).includes(
      "Percentage",
    ),
  );
  await page.keyboard.press("Enter");
  await page.waitForSelector(".world-topic-tasks .task-main");
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(new URL(page.url()).searchParams.get("view"), "island");
  await page.waitForFunction(
    () => document.activeElement?.id === "world-topic-title",
  );
  assert.equal(await stored(page), initial);
  await page.click('button[aria-label="Close topic tasks"]');
  await page.waitForFunction(
    () => document.querySelectorAll(".topic-plot-label").length === 6,
  );
  await noLabelOverlap(page);
  pass(
    "Subject jump and keyboard navigation enter an island and open real tasks inside the world",
  );
  const statuses = await page.$$eval(".topic-plot-label", (els) =>
    els.map((el) => el.className),
  );
  for (const status of [
    "in_revision",
    "strong",
    "weak",
    "ready_for_test",
    "not_started",
  ])
    assert(statuses.some((name) => name.includes("plot-" + status)));
  await page.click('button[aria-label="Open topic: Time & Work"]');
  await page.waitForSelector("#world-topic-title");
  assert.equal(
    await page.$eval("#world-topic-title", (el) => el.textContent),
    "Time & Work",
  );
  assert.equal(new URL(page.url()).pathname, "/");
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".world-topic-tasks");
  await cameraStill(page);
  assert.equal(
    await page.$eval("#world-topic-title", (el) => el.textContent),
    "Time & Work",
  );
  await page.click('button[aria-label="Close topic tasks"]');
  await page.click('button[aria-label="Next topic plots"]');
  await page.waitForFunction(
    () => document.querySelectorAll(".topic-plot-label").length === 2,
  );
  await page.click('button[aria-label="Open topic: New arithmetic topic 4"]');
  await page.waitForFunction(
    () =>
      document.querySelector("#world-topic-title")?.textContent ===
      "New arithmetic topic 4",
  );
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("#world-topic-title");
  await cameraStill(page);
  assert(
    (await page.$eval(".topic-pagination", (el) => el.textContent)).includes(
      "7–8",
    ),
  );
  await page.click('button[aria-label="Close topic tasks"]');
  await page.click('button[aria-label="Previous topic plots"]');
  await page.waitForFunction(
    () => document.querySelectorAll(".topic-plot-label").length === 6,
  );
  assert.equal(await stored(page), initial);
  pass(
    "All five evidence states, topic plots, deep links and six-plot paging remain connected to real data",
  );
  for (const width of [390, 320]) {
    await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
    await cameraStill(page);
    await noLabelOverlap(page);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(
      await page.$eval("canvas", (el) =>
        Math.round(el.getBoundingClientRect().width),
      ),
      width,
    );
    await shot(page, `island-${width}`);
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await cameraStill(page);
  const beforePinch = (await camera(page)).distance;
  const session = await page.createCDPSession();
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 150, y: 295, id: 1 },
      { x: 230, y: 295, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 100, y: 295, id: 1 },
      { x: 280, y: 295, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForFunction(
    (distance) =>
      Number(document.querySelector(".world-canvas").dataset.cameraDistance) <
      distance * 0.85,
    {},
    beforePinch,
  );
  await cameraStill(page);
  await session.detach();
  await ensureControls(page);
  await page.click('button[aria-label="Reset world camera"]');
  await cameraStill(page);
  assert(!new URL(page.url()).searchParams.has("island"));
  assert.equal(await stored(page), initial);
  await shot(page, "world-mobile");
  pass(
    "320px/390px layouts fit the screen; emulated two-finger pinch zooms the actual 3D camera",
  );
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await cameraStill(page);
  await shot(page, "world-desktop");
  await selectIsland(page, "maths");
  await cameraStill(page);
  await shot(page, "selected-desktop");
  assert.equal(await page.$(".enter-island"), null);
  await page.waitForSelector(".topic-plot-label");
  await shot(page, "island-desktop");
  await ensureControls(page);
  await click(page, "Switch to 2D atlas");
  await page.waitForSelector(".flat-atlas");
  await page.click(".flat-island-detail a.primary");
  await page.waitForSelector(".subject-banner");
  await page.type("#topic-search", "Percentage");
  await page.waitForFunction(
    () => document.querySelectorAll(".topic-card").length === 1,
  );
  await page.click('button[aria-label="Edit topic: Percentage"]');
  await page.waitForSelector("dialog[open]");
  await click(page, "Cancel");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  pass(
    "Explicit 2D fallback retains direct subject navigation, topic search and editing",
  );
  const reducedContext = await browser.createBrowserContext(),
    reduced = await reducedContext.newPage();
  await reduced.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await reduced.goto(url + "/", { waitUntil: "networkidle0" });
  await reduced.waitForSelector(".island-label");
  await cameraStill(reduced);
  await selectIsland(reduced, "maths");
  await cameraStill(reduced);
  await ensureControls(reduced);
  await reduced.click('button[aria-label="Reset world camera"]');
  await cameraStill(reduced);
  assert(!new URL(reduced.url()).searchParams.has("island"));
  await reducedContext.close();
  pass(
    "Reduced-motion users keep functional selection, orbit controls and reset",
  );
  for (const fault of ["webgl", "model"]) {
    const context = await browser.createBrowserContext(),
      faultPage = await context.newPage();
    if (fault === "webgl")
      await faultPage.evaluateOnNewDocument(() => {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return /webgl/.test(type) ? null : get.call(this, type, ...args);
        };
      });
    else {
      await faultPage.setRequestInterception(true);
      faultPage.on("request", (request) =>
        request.url().endsWith("/models/island_maths_v2.glb")
          ? request.abort()
          : request.continue(),
      );
    }
    await faultPage.goto(url + "/settings", { waitUntil: "networkidle0" });
    await faultPage.evaluate(
      (data) => localStorage.setItem("study-world.personal.v1", data),
      initial,
    );
    await faultPage.goto(url + "/?island=maths&view=island", {
      waitUntil: "networkidle0",
    });
    await faultPage.waitForFunction(() =>
      [...document.querySelectorAll(".scene-fallback")].some(
        (n) =>
          n.getBoundingClientRect().width > 0 &&
          n.getBoundingClientRect().height > 0,
      ),
    );
    await click(faultPage, "Use the 2D view");
    await faultPage.waitForSelector(".flat-atlas");
    assert.equal(
      await faultPage.$$eval(".subject-card", (els) => els.length),
      14,
    );
    await context.close();
  }
  pass(
    "WebGL/model failures are contained even when entering a deep-linked island",
  );
  const scrollContext = await browser.createBrowserContext(),
    scrollPage = await scrollContext.newPage();
  await scrollPage.setViewport({ width: 1440, height: 800 });
  await scrollPage.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await scrollPage.goto(url + "/settings", { waitUntil: "networkidle0" });
  await scrollPage.evaluate(
    (data) => localStorage.setItem("study-world.personal.v1", data),
    initial,
  );
  await scrollPage.goto(url + "/subjects/maths", { waitUntil: "networkidle0" });
  await cameraStill(scrollPage);
  const scrollDistance = (await camera(scrollPage)).distance;
  const edge = await scrollPage.$eval("canvas", (c) => {
    const r = c.getBoundingClientRect();
    return { x: r.left + 8, y: r.top + r.height * 0.45 };
  });
  await scrollPage.mouse.move(edge.x, edge.y);
  await scrollPage.mouse.wheel({ deltaY: 350 });
  await scrollPage.waitForFunction(() => scrollY > 40, { timeout: 10000 });
  assert(Math.abs((await camera(scrollPage)).distance - scrollDistance) < 0.01);
  await scrollPage.screenshot({ path: `${output}/subject-normal-scroll.png` });
  await scrollPage.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
  });
  await scrollPage.goto(url + "/subjects/maths", { waitUntil: "networkidle0" });
  await cameraStill(scrollPage);
  const mobileDistance = (await camera(scrollPage)).distance;
  assert(
    await scrollPage.evaluate(() => matchMedia("(pointer:coarse)").matches),
  );
  const touchEdge = await scrollPage.$eval("canvas", (c) => {
    const r = c.getBoundingClientRect();
    return { x: r.left + 8, y: r.top + r.height * 0.5 };
  });
  const touchSession = await scrollPage.createCDPSession();
  await touchSession.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchEdge.x, y: touchEdge.y, id: 1 }],
  });
  for (const offset of [100, 220])
    await touchSession.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: touchEdge.x, y: touchEdge.y - offset, id: 1 }],
    });
  await touchSession.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await scrollPage.waitForFunction(() => scrollY > 40, { timeout: 10000 });
  assert(Math.abs((await camera(scrollPage)).distance - mobileDistance) < 0.01);
  await touchSession.detach();
  pass(
    "Native mobile edge swipes scroll the subject page while the centre retains 3D pinch controls",
  );
  await scrollContext.close();
  pass(
    "Wheel input near a subject scene edge scrolls the actual document without zooming or mutating study data",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      { passed: checks.length, checks, errors, failedRequests: requests },
      null,
      2,
    ),
  );
  console.log(
    `${checks.length} immersive world checks passed. Evidence: ${output}`,
  );
} finally {
  await browser.close();
}
