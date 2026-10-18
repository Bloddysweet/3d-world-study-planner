// Focused interaction regression, not a physical-phone FPS certification.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
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
const checks = [],
  errors = [];
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(".cache/mobile-world", { recursive: true });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({
    width: 1100,
    height: 1000,
    deviceScaleFactor: 3,
    hasTouch: true,
  });
  const cdp = await page.createCDPSession();
  await page.goto("http://127.0.0.1:5173/settings", {
    waitUntil: "networkidle0",
  });
  const frame = await (await page.waitForSelector("iframe")).contentFrame();
  await frame.waitForSelector(".settings-dashboard");
  await frame.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((n) => n.textContent === "Explore the demo workspace")
      .click(),
  );
  await frame.waitForFunction(() =>
    localStorage.getItem("study-world.demo.v1"),
  );
  await frame.evaluate(() => document.querySelector('a[href="/"]').click());
  const ready = () =>
    frame.waitForFunction(
      () => {
        const n = document.querySelector(".world-canvas");
        return (
          n?.dataset.cameraInteracting === "false" &&
          n.dataset.skyStatus === "ready" &&
          n.dataset.wildStatus === "ready" &&
          document.querySelector(".island-label")
        );
      },
      { timeout: 60000 },
    );
  await ready();
  await frame.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .find((u) => u.includes("@react-three_fiber.js"));
    const { _roots } = await import(url);
    window.__mobileStore = _roots.get(document.querySelector("canvas")).store;
  });
  await frame.evaluate(() => {
    window.__labelMeasureReads = 0;
    for (const prop of ["offsetWidth", "offsetHeight"]) {
      const original = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        prop,
      );
      Object.defineProperty(HTMLElement.prototype, prop, {
        ...original,
        get() {
          if (this.classList.contains("island-label"))
            window.__labelMeasureReads++;
          return original.get.call(this);
        },
      });
    }
  });
  const state = () => frame.$eval(".world-canvas", (n) => ({ ...n.dataset }));
  const storage = () =>
    frame.evaluate(() =>
      JSON.stringify([
        localStorage.getItem("study-world.personal.v1"),
        localStorage.getItem("study-world.demo.v1"),
      ]),
    );
  const baseline = await storage();
  const locationBefore = await frame.evaluate(
    () => location.pathname + location.search,
  );
  const point = async (selector) => {
    const p = await frame.evaluate((selector) => {
      const node = document.querySelector(selector),
        r = node.getBoundingClientRect();
      if (selector === ".world-canvas canvas") {
        for (const fx of [0.5, 0.4, 0.6])
          for (const fy of [0.55, 0.65, 0.45]) {
            const x = r.x + r.width * fx,
              y = r.y + r.height * fy;
            if (document.elementFromPoint(x, y)?.tagName === "CANVAS")
              return { x, y, w: innerWidth, h: innerHeight };
          }
        throw Error("No unobstructed central canvas touch target");
      }
      return {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        w: innerWidth,
        h: innerHeight,
      };
    }, selector);
    const r = await page.$eval("iframe", (n) => {
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    return { x: r.x + (p.x * r.w) / p.w, y: r.y + (p.y * r.h) / p.h };
  };
  const touch = async (type, p) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints:
        type === "touchEnd" || type === "touchCancel"
          ? []
          : [{ x: p.x, y: p.y, id: 1, radiusX: 5, radiusY: 5, force: 1 }],
    });
  const begin = async () => {
    const p = await point(".world-canvas canvas");
    await touch("touchStart", p);
    return p;
  };
  const watchLabels = () =>
    frame.evaluate(() => {
      window.__labelMutations = 0;
      window.__labelMeasureReads = 0;
      window.__labelObserver?.disconnect();
      window.__labelObserver = new MutationObserver((m) => {
        window.__labelMutations += m.filter(
          (r) => r.attributeName === "style",
        ).length;
      });
      document.querySelectorAll(".island-label").forEach((n) =>
        window.__labelObserver.observe(n, {
          attributes: true,
          attributeFilter: ["style"],
        }),
      );
    });
  assert.equal((await state()).renderProfile, "mobile");
  const ratio = await frame.$eval(
    ".world-canvas canvas",
    (n) => n.width / n.clientWidth,
  );
  assert(
    ratio <= 1.05,
    "Phone DPR must cap at one even on a 3x display: " + ratio,
  );
  pass("Phone rendering caps pixel density at 1 on a simulated 3x screen");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  for (const width of [390, 320, 430]) {
    await page.select('[aria-label="Mobile preview width"]', String(width));
    await frame.waitForFunction((w) => innerWidth === w, {}, width);
    await ready();
    const before = await state();
    const p = await begin();
    await frame.waitForFunction(
      () =>
        document.querySelector(".world-canvas").dataset.skyReason ===
        "camera-interaction",
    );
    await watchLabels();
    const paused = await state();
    for (let i = 1; i <= 8; i++) {
      await touch("touchMove", { x: p.x + 3 * i, y: p.y });
      await delay(25);
    }
    await delay(200);
    const held = await state();
    assert.equal(
      await frame.evaluate(
        () => window.__mobileStore.getState().raycaster.layers.mask,
      ),
      0,
      "Do not raycast detailed meshes on every drag event",
    );
    assert.equal(held.cameraInteracting, "true");
    assert.equal(held.wildReason, "camera-interaction");
    assert.equal(held.skyTicks, paused.skyTicks);
    assert.equal(held.wildTicks, paused.wildTicks);
    assert.notEqual(
      held.cameraAzimuth,
      before.cameraAzimuth,
      "Real touch must still orbit the world",
    );
    assert(
      (await frame.evaluate(() => window.__labelMutations)) > 0,
      "Visible captions must follow the moving camera",
    );
    const captions = await frame.evaluate(() => ({
      measures: window.__labelMeasureReads,
      count: document.querySelectorAll(".island-label").length,
      visible: [...document.querySelectorAll(".island-label")].filter(
        (n) => getComputedStyle(n).visibility === "visible",
      ).length,
      opacity: +getComputedStyle(document.querySelector(".island-label-layer"))
        .opacity,
      maxHeight: Math.max(
        ...[...document.querySelectorAll(".island-label")].map(
          (n) => n.getBoundingClientRect().height,
        ),
      ),
    }));
    assert(
      captions.measures <= captions.count * 2,
      "Dimensions must be cached, not measured every camera frame: " +
        captions.measures,
    );
    assert(
      captions.visible > 0 && captions.opacity === 1,
      "Do not hide captions during rotation",
    );
    assert(
      captions.maxHeight <= 30,
      "Phone captions should stay compact: " + captions.maxHeight,
    );
    assert(await frame.$eval(".island-label-layer", (n) => n.inert));
    await touch(width === 320 ? "touchCancel" : "touchEnd");
    await ready();
    assert.equal(
      await frame.evaluate(
        () => window.__mobileStore.getState().raycaster.layers.mask,
      ),
      1,
      "Mesh picking must restore after release/cancel",
    );
    await frame.waitForFunction(
      () =>
        +getComputedStyle(document.querySelector(".island-label-layer"))
          .opacity === 1,
    );
    assert.equal(
      await frame.$eval(".island-label-layer", (n) => n.inert),
      false,
    );
    assert.equal(
      await frame.$eval(
        ".island-label-layer",
        (n) => +getComputedStyle(n).opacity,
      ),
      1,
    );
    assert.equal(
      await frame.evaluate(() => location.pathname + location.search),
      locationBefore,
      "Drag must not select an island",
    );
    await watchLabels();
    await delay(500);
    assert.equal(
      await frame.evaluate(() => window.__labelMutations),
      0,
      "Decorative frames must not relayout stationary labels",
    );
  }
  pass(
    "Real touch orbit at 320/390/430 with 4x CPU slowdown: camera moves, compact captions remain visible with cached dimensions, both flyers pause; release/cancel restores interaction without selecting an island",
  );
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const beforeResume = await state();
  await delay(900);
  const afterResume = await state();
  assert(+afterResume.skyTicks > +beforeResume.skyTicks);
  assert(+afterResume.wildTicks > +beforeResume.wildTicks);
  pass(
    "Both dragons resume their own clocks after settling; idle decorative frames cause no caption style churn",
  );
  await page.click('.responsive-preview-rotate[aria-label="Rotate preview"]');
  await frame.waitForFunction(
    () =>
      innerWidth > innerHeight &&
      document.querySelector(".world-canvas").dataset.renderProfile ===
        "mobile",
  );
  assert.equal(
    await frame.evaluate(() =>
      window.__mobileStore.getState().gl.getPixelRatio(),
    ),
    1,
  );
  await page.click('.responsive-preview-rotate[aria-label="Rotate preview"]');
  await frame.waitForFunction(() => innerWidth === 430 && innerHeight === 844);
  await ready();
  pass(
    "Coarse-pointer landscape phone keeps the lightweight profile without a remount",
  );
  await page.click(".responsive-preview-modes button:nth-child(2)");
  await frame.waitForFunction(
    () =>
      innerWidth === 768 &&
      document.querySelector(".world-canvas").dataset.renderProfile ===
        "standard",
  );
  await ready();
  assert.equal((await state()).renderProfile, "standard");
  await page.click(".responsive-preview-modes button:nth-child(1)");
  await frame.waitForFunction(
    () =>
      innerWidth > 1000 &&
      document.querySelector(".world-canvas").dataset.renderProfile ===
        "standard",
  );
  await ready();
  assert.equal((await state()).renderProfile, "standard");
  const p = await begin();
  await touch("touchMove", { x: p.x + 25, y: p.y });
  await delay(250);
  const desktop = await state();
  assert.notEqual(desktop.skyReason, "camera-interaction");
  assert.equal(await frame.$eval(".island-label-layer", (n) => n.inert), false);
  await touch("touchEnd");
  await ready();
  pass(
    "Tablet/desktop retain their standard profile, visible captions and independent decorative motion during orbit",
  );
  await page.click(".responsive-preview-modes button:nth-child(3)");
  await frame.waitForFunction(
    () =>
      innerWidth === 430 &&
      document.querySelector(".world-canvas").dataset.renderProfile ===
        "mobile",
  );
  await ready();
  await mkdir(".cache/mobile-world/screenshots", { recursive: true });
  await page.setViewport({
    width: 1100,
    height: 1000,
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await ready();
  await delay(300);
  await page.screenshot({
    path: ".cache/mobile-world/screenshots/compact-labels-mobile.png",
  });
  await page.click(".responsive-preview-modes button:nth-child(1)");
  await frame.waitForFunction(() => innerWidth > 1000);
  await ready();
  await delay(300);
  await page.screenshot({
    path: ".cache/mobile-world/screenshots/compact-labels-desktop.png",
  });
  await page.click(".responsive-preview-modes button:nth-child(3)");
  await frame.waitForFunction(() => innerWidth === 430);
  await ready();
  const selector = await frame.evaluate(() => {
    const label = [...document.querySelectorAll(".island-label")].find(
      (n) => getComputedStyle(n).visibility === "visible",
    );
    label.dataset.mobileTap = "true";
    return "[data-mobile-tap]";
  });
  const tap = await point(selector);
  await touch("touchStart", tap);
  await touch("touchEnd");
  await frame.waitForSelector(".island-console .console-open-subject");
  pass(
    "Real touch selection still opens the subject garden after all gestures and profile changes",
  );
  assert.equal(
    await storage(),
    baseline,
    "Presentation must not modify personal/demo learning data",
  );
  assert.deepEqual(errors, []);
  pass("No learning-state writes and no browser page errors");
  await writeFile(
    ".cache/mobile-world/report.json",
    JSON.stringify(
      {
        checks,
        errors,
        limits:
          "Chromium touch/CPU emulation; not measured on a physical phone",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
