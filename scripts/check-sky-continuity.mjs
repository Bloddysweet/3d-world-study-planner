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
const errors = [],
  checks = [],
  delay = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(".cache/sky-continuity", { recursive: true });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle0" });
  const frame = await (await page.waitForSelector("iframe")).contentFrame();
  for (const spec of [
    { name: "desktop-overview", mode: 1, seconds: 144 },
    { name: "tablet-overview", mode: 2, seconds: 144 },
    { name: "tablet-landscape", mode: 2, rotate: true, seconds: 48 },
    {
      name: "desktop-narrow",
      mode: 1,
      viewport: { width: 1100, height: 950 },
      seconds: 48,
    },
    { name: "desktop-focused", mode: 1, focused: true, seconds: 48 },
    { name: "tablet-focused", mode: 2, focused: true, seconds: 48 },
  ]) {
    if (spec.viewport) await page.setViewport(spec.viewport);
    await page.click(
      `.responsive-preview-modes button:nth-child(${spec.mode})`,
    );
    if (spec.rotate) await page.click('[aria-label="Rotate preview"]');
    if (spec.focused)
      await frame.goto("http://127.0.0.1:5173/?island=maths&view=island", {
        waitUntil: "networkidle0",
      });
    await frame.waitForFunction(
      () =>
        document.querySelector(".world-canvas")?.dataset.skyStatus ===
          "ready" &&
        document.querySelector(".world-canvas").dataset.cameraMoving ===
          "false",
      { timeout: 60000 },
    );
    await delay(1500);
    // Drive the real useFrame subscribers through full flight/wing cycles. This
    // is a deterministic continuity test, NOT a real-time performance benchmark.
    // Software WebGL renders checkpoints; every 100ms simulated pose is checked
    // using the ACTUAL scene object's visibility, not a throttled dataset.
    const result = await frame.evaluate(async (seconds) => {
      const url = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((u) => u.includes("@react-three_fiber.js"));
      const { _roots } = await import(url);
      const store = _roots.get(document.querySelector("canvas")).store;
      let state = store.getState();
      const actor = state.scene.getObjectByName("Aurel_Sky_Companion");
      const render = state.gl.render;
      let frames = 0,
        hidden = 0,
        transitions = 0,
        previous = actor.visible;
      const samples = [];
      state.setFrameloop("never");
      state.gl.render = function (...args) {
        if (++frames % 40 === 0) return render.apply(this, args);
      };
      try {
        for (let i = 1; i <= seconds * 10; i++) {
          state = store.getState();
          state.advance(state.clock.elapsedTime + 0.1, false);
          if (!actor.visible) hidden++;
          if (previous !== actor.visible) transitions++;
          previous = actor.visible;
          samples.push({
            time: i / 10,
            visible: actor.visible,
            position: actor.position.toArray(),
          });
          if (i % 40 === 0) await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        state.gl.render = render;
        state.setFrameloop("demand");
        state.invalidate();
      }
      return { samples, hidden, transitions, frames };
    }, spec.seconds);
    await writeFile(
      `.cache/sky-continuity/${spec.name}.json`,
      JSON.stringify(result, null, 2),
    );
    await page.screenshot({ path: `.cache/sky-continuity/${spec.name}.png` });
    console.log(
      `${spec.name}: ${result.samples.length} actual scene samples, ${result.hidden} hidden, ${result.transitions} visibility transitions`,
    );
    assert(
      new Set(
        result.samples.map((s) =>
          s.position.map((v) => v.toFixed(4)).join(","),
        ),
      ).size > 100,
      "The real route must advance, not pass by remaining frozen",
    );
    assert.equal(
      result.hidden,
      0,
      `${spec.name} must not disappear during ordinary flight`,
    );
    assert.equal(
      result.transitions,
      0,
      `${spec.name} must not pop with wing movement`,
    );
    if (spec.name === "desktop-overview" || spec.name === "tablet-overview")
      await page.screenshot({
        path: `design/sky-creature/world-flight-${spec.name}.png`,
      });
    checks.push({
      name: spec.name,
      samples: result.samples.length,
      hidden: result.hidden,
      transitions: result.transitions,
      seconds: spec.seconds,
    });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    ".cache/sky-continuity/report.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
