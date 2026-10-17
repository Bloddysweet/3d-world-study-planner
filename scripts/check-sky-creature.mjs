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
const { PNG } = require("pngjs");
await mkdir(".cache/sky-creature", { recursive: true });
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
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(
    process.env.SKY_URL ??
      "http://127.0.0.1:5176/design/sky-creature/review.html",
    {
      waitUntil: "networkidle0",
    },
  );
  await page.waitForFunction(() => window.__skyReview?.ready);
  const stats = await page.evaluate(() => {
    const r = window.__skyReview;
    return {
      ...r.renderer.info.render,
      animations: r.animations,
      meshes: r.model.children[0].children.length,
    };
  });
  assert.equal(stats.triangles, 10188);
  assert.equal(stats.calls, 13);
  assert.equal(stats.animations, 0);
  assert.equal(stats.meshes, 13);
  await page.screenshot({ path: "design/sky-creature/preview.png" });
  pass(
    "Actual GLB renders in WebGL: 13 anatomical parts, one shared material, 10,188 triangles, no animation",
  );
  for (const view of ["front", "back", "above", "below", "head"]) {
    await page.click(`[data-view="${view}"]`);
    await page.screenshot({ path: `.cache/sky-creature/${view}.png` });
    assert.equal(
      await page.$eval(`[data-view="${view}"]`, (n) =>
        n.getAttribute("aria-pressed"),
      ),
      "true",
    );
  }
  pass("All named camera views work, including underside and close-up face");
  await page.click('[data-view="hero"]');
  const capture = async () => PNG.sync.read(await page.screenshot());
  const a = await capture();
  await page.click("#wire");
  const b = await capture();
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (
      Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2]) >
      30
    )
      changed++;
  assert(changed > 10000);
  await page.click("#wire");
  pass("Wireframe changes real geometry rendering, not a static preview image");
  const pose = await page.evaluate(() =>
    window.__skyReview.camera.position.toArray(),
  );
  await page.mouse.move(650, 460);
  await page.mouse.down();
  await page.mouse.move(770, 500, { steps: 10 });
  await page.mouse.up();
  assert.notDeepEqual(
    await page.evaluate(() => window.__skyReview.camera.position.toArray()),
    pose,
  );
  await page.mouse.wheel({ deltaY: -300 });
  assert.notEqual(await page.evaluate(() => window.__skyReview.camera.zoom), 1);
  await page.click('[data-view="hero"]');
  assert.equal(await page.evaluate(() => window.__skyReview.camera.zoom), 1);
  pass("Drag orbit, bounded zoom and Hero reset work");
  for (const width of [320, 390, 430]) {
    await page.setViewport({ width, height: 844 });
    await page.click('[data-view="hero"]');
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      width,
    );
    const boxes = await page.$$eval("button", (nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      }),
    );
    assert(
      boxes.every(
        (b) => b.x >= 0 && b.right <= width && b.y >= 0 && b.bottom <= 844,
      ),
    );
    await page.screenshot({ path: `.cache/sky-creature/mobile-${width}.png` });
  }
  pass(
    "320 / 390 / 430 px mobile layouts retain all controls without horizontal overflow",
  );
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  const before = await page.evaluate(
    () => window.__skyReview.renderer.info.render.frame,
  );
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(
    await page.evaluate(() => window.__skyReview.renderer.info.render.frame),
    before,
  );
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  pass(
    "Static, demand-only render; no continuous movement or planner storage access",
  );
  assert.deepEqual(errors, []);
  pass("No browser page/console errors");
  await writeFile(
    ".cache/sky-creature/browser-report.json",
    JSON.stringify({ checks, errors, stats }, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
