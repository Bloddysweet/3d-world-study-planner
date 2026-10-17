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
  errors = [],
  delay = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
await mkdir(".cache/world-enhancements", { recursive: true });
await mkdir("design/world-enhancements", { recursive: true });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1100, height: 950 });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle0" });
  const frame = await (await page.waitForSelector("iframe")).contentFrame();
  // Chromium automation reports unscaled child-frame bounds. Convert real
  // iframe CSS pixels to outer-screen pixels for genuine pointer interaction.
  const box = async (selector) => {
    const r = await frame.$eval(selector, (n) => {
      const r = n.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        w: innerWidth,
        h: innerHeight,
      };
    });
    const f = await page.$eval("iframe", (n) => {
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    return {
      x: f.x + (r.x * f.w) / r.w,
      y: f.y + (r.y * f.h) / r.h,
      width: (r.width * f.w) / r.w,
      height: (r.height * f.h) / r.h,
    };
  };
  const click = async (selector) => {
    const r = await box(selector);
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  };
  const ready = () =>
    frame.waitForFunction(
      () =>
        document.querySelector(".world-canvas")?.dataset.skyStatus ===
          "ready" &&
        document.querySelector(".world-canvas").dataset.cameraMoving ===
          "false",
      { timeout: 60000 },
    );
  await ready();
  const original = await frame.evaluate(() =>
    localStorage.getItem("study-world.personal.v1"),
  );
  assert.equal(await frame.$('[aria-label="Jump to subject island"]'), null);
  assert.equal(await frame.$(".world-controls"), null);
  assert.equal(await frame.$(".sky-motion-toggle"), null);
  assert.equal(await frame.$(".world-flat-switch"), null);
  pass(
    "Closed controls leave only one Controls button; duplicate island picker and persistent playback-style bar are removed",
  );
  for (const [mode, width] of [
    [3, 390],
    [2, 768],
    [1, null],
  ]) {
    await page.click(`.responsive-preview-modes button:nth-child(${mode})`);
    if (width) await frame.waitForFunction((w) => innerWidth === w, {}, width);
    await ready();
    await delay(700);
    await click(".journey-menu > button");
    await frame.waitForSelector('.journey-popover[role="dialog"]');
    const compact = await frame.$eval(
      '.journey-popover[role="dialog"]',
      (n) => {
        const r = n.getBoundingClientRect();
        return {
          height: r.height,
          width: r.width,
          x: r.x,
          right: r.right,
          bottom: r.bottom,
          viewport: [innerWidth, innerHeight],
          bodyOverflow: document.body.style.overflow,
          modal: !!document.querySelector("dialog[open]"),
        };
      },
    );
    assert(compact.height < compact.viewport[1] * 0.6, JSON.stringify(compact));
    assert(compact.x >= 0 && compact.right <= compact.viewport[0]);
    assert(!compact.modal && compact.bodyOverflow !== "hidden");

    await page.keyboard.press("Escape");
    assert.equal(await frame.$('.journey-popover[role="dialog"]'), null);
    await click(".world-controls-menu > button");
    await frame.waitForSelector('.controls-popover[role="dialog"]');
    const controls = await frame.$eval(
      '.controls-popover[role="dialog"]',
      (n) => {
        const r = n.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          w: innerWidth,
          h: innerHeight,
        };
      },
    );
    assert(
      controls.left >= 0 &&
        controls.right <= controls.w &&
        controls.top >= 0 &&
        controls.bottom <= controls.h,
      JSON.stringify(controls),
    );
    for (const label of [
      "Zoom in on world",
      "Zoom out of world",
      "Rotate view left",
      "Rotate view right",
      "Reset world camera",
      "Animate villagers",
      "Animate sky creature",
    ])
      assert(await frame.$(`[aria-label="${label}"]`));

    if (!(await frame.$('[aria-label="Animate sky creature"]')))
      await click(".world-controls-menu > button");
    await click('[aria-label="Animate sky creature"]');
    await frame.waitForFunction(
      () =>
        document.querySelector(".world-canvas").dataset.skyReason === "paused",
    );
    if (!(await frame.$('[aria-label="Animate sky creature"]')))
      await click(".world-controls-menu > button");
    await click('[aria-label="Animate sky creature"]');
    await click('[aria-label="Close World controls"]');
    assert.equal(await frame.$(".world-controls"), null);
    assert.equal(
      await frame.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
  }
  pass(
    "Mobile/tablet/desktop Journey is compact and non-modal; Controls contains working independent flight pause and all seven actions, stays in bounds, closes by X/Escape",
  );
  // Actual pointer drags, not just stationary flight. Record every real R3F frame.
  for (const mode of [1, 2, 3]) {
    await page.click(`.responsive-preview-modes button:nth-child(${mode})`);
    await ready();
    await delay(800);
    await frame.evaluate(async () => {
      const url = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((u) => u.includes("@react-three_fiber.js"));
      const { _roots } = await import(url),
        store = _roots.get(document.querySelector("canvas")).store;
      const actor = store
        .getState()
        .scene.getObjectByName("Aurel_Sky_Companion");
      window.__orbitSamples = [];
      window.__stopOrbit = store.getState().internal.subscribe(
        {
          current: (state, delta) => {
            let mesh;
            actor.traverse((o) => {
              if (o.isSkinnedMesh) mesh = o;
            });
            const screen = actor.position.clone().project(state.camera);
            window.__orbitSamples.push({
              alpha: mesh.material.opacity,
              visible: actor.visible,
              delta,
              x: screen.x,
              y: screen.y,
              azimuth: state.controls.getAzimuthalAngle(),
            });
          },
        },
        0,
        store,
      );
    });
    const r = await box("canvas");
    for (let sweep = 0; sweep < 3; sweep++) {
      await page.mouse.move(r.x + r.width * 0.42, r.y + r.height * 0.43);
      await page.mouse.down();
      for (let i = 1; i <= 16; i++) {
        await page.mouse.move(
          r.x + r.width * (0.42 + i * 0.022),
          r.y + r.height * (0.43 + Math.sin(i * 0.3) * 0.07),
        );
        await delay(40);
      }
      await page.mouse.up();
      await delay(200);
    }
    await delay(800);
    const samples = await frame.evaluate(() => {
      window.__stopOrbit();
      return window.__orbitSamples;
    });
    await writeFile(
      `.cache/world-enhancements/orbit-${mode}.json`,
      JSON.stringify(samples, null, 2),
    );
    assert(samples.length > 10);
    assert(
      Math.max(...samples.map((s) => s.azimuth)) -
        Math.min(...samples.map((s) => s.azimuth)) >
        0.3,
      "Real drag must actually rotate the world",
    );
    const jumps = samples
      .slice(1)
      .map((s, i) => Math.abs(s.alpha - samples[i].alpha));
    assert(
      Math.max(...jumps) < 0.5,
      `No hard opacity cuts while dragging: ${Math.max(...jumps)}`,
    );
    assert(samples.some((s) => s.alpha > 0.5));
    console.log(
      `Orbit mode ${mode}: ${samples.length} rendered frame samples, maximum alpha step ${Math.max(...jumps).toFixed(3)}`,
    );
  }
  pass(
    "Actual held mouse drags rotate the scene in desktop/tablet/mobile without binary dragon opacity cuts",
  );
  assert.equal(
    await frame.evaluate(() => localStorage.getItem("study-world.personal.v1")),
    original,
    "World tools and orbit do not change study data",
  );
  await click(".world-atlas summary");
  await click('[aria-label="Find island: SSC Mathematics"]');
  await frame.waitForSelector(".island-console");
  await ready();
  assert.equal(await frame.$eval(".world-atlas", (n) => n.open), false);
  assert.equal(await frame.$(".enter-island"), null);
  await frame.waitForFunction(() => !document.querySelector(".enter-island"));
  await ready();
  pass(
    "The sole Island atlas still selects subjects, closes after selection and enters the live topic garden",
  );
  await click(".world-controls-menu > button");
  await click(".world-controls-view");
  await frame.waitForSelector(".flat-atlas");
  assert.equal(await frame.$("canvas"), null, "2D view must not retain WebGL");
  const data = JSON.parse(
    await frame.evaluate(() => localStorage.getItem("study-world.personal.v1")),
  );
  assert.equal(
    await frame.$$eval(".flat-island", (nodes) => nodes.length),
    data.subjects.filter((s) => !s.archived).length,
  );
  assert(await frame.$(".flat-island-detail"));
  assert.match(
    await frame.$eval(".flat-island-detail h2", (n) => n.textContent),
    /Mathematics/,
  );
  for (const width of [320, 390, 430]) {
    await page.select('[aria-label="Mobile preview width"]', String(width));
    await frame.waitForFunction((w) => innerWidth === w, {}, width);
    assert(
      await frame.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  await page.screenshot({ path: "design/world-enhancements/2d-mobile.png" });
  await click(".flat-island-detail > .text-link");
  await page.click(".responsive-preview-modes button:nth-child(1)");
  await page.screenshot({ path: "design/world-enhancements/2d-desktop.png" });
  await click(".flat-island");
  await frame.waitForSelector(".flat-island-detail a.primary");
  const checkpoint = await frame.evaluate(() =>
    localStorage.getItem("study-world.personal.v1"),
  );
  await frame.evaluate(() => {
    const key = "study-world.personal.v1",
      d = JSON.parse(localStorage.getItem(key));
    for (let i = 0; i < 8; i++)
      d.subjects.push({
        id: `qa-flat-${i}`,
        name: `Additional island ${i}`,
        theme: "generic",
        color: "#698e88",
        archived: false,
      });
    d.topics.push({
      id: "qa-map-topic",
      subjectId: d.subjects[0].id,
      name: "A real topic link",
      group: "",
    });
    localStorage.setItem(key, JSON.stringify(d));
  });
  await frame.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle0" });
  await frame.waitForSelector(".flat-island");
  assert.equal(await frame.$$eval(".flat-island", (n) => n.length), 14);
  await click(".flat-island");
  await frame.waitForSelector(".flat-island-detail li a");
  await click(".flat-island-detail li a");
  await frame.waitForSelector(".subject-banner");
  assert.equal(
    await frame.evaluate(() =>
      new URLSearchParams(location.search).get("topic"),
    ),
    "qa-map-topic",
  );
  // These additions are confined to this disposable browser, then restored.
  await frame.evaluate(
    (value) => localStorage.setItem("study-world.personal.v1", value),
    checkpoint,
  );
  await frame.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle0" });
  await frame.waitForSelector(".flat-world-actions");
  pass(
    "2D map supports fourteen dynamic subjects and real deep-linked subject/topic navigation",
  );
  await click(".flat-world-actions > button:first-child");
  await ready();
  pass(
    "Lightweight 2D atlas renders all actual subjects, preserves selection from 3D, offers subject/topic links, handles 320/390/430 layouts and returns to 3D",
  );
  await page.screenshot({
    path: "design/world-enhancements/world-desktop.png",
  });
  assert.deepEqual(errors, []);
  pass("No browser page errors");
  await writeFile(
    ".cache/world-enhancements/report.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} catch (error) {
  console.error("World checks failed", error, "Browser errors", errors);
  throw error;
} finally {
  await browser.close();
}
