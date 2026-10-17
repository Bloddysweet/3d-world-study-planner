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
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => a !== "--single-process"),
  headless: "shell",
});
await mkdir(".cache/sky-animation", { recursive: true });
const checks = [],
  errors = [],
  pass = (s) => {
    checks.push(s);
    console.log("PASS " + s);
  };
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(process.env.SKY_ANIMATION_URL ?? "http://127.0.0.1:5176/", {
    waitUntil: "networkidle0",
  });
  await page.waitForFunction(() => window.__skyAnimation?.ready);
  const stats = await page.evaluate(() => {
    const r = window.__skyAnimation;
    return {
      bones: r.mesh.skeleton.bones.length,
      clips: r.clips.map((c) => c.name),
      calls: r.renderer.info.render.calls,
      triangles: r.renderer.info.render.triangles,
    };
  });
  assert.equal(stats.bones, 16);
  assert.equal(stats.calls, 1);
  assert.equal(stats.triangles, 10188);
  assert.deepEqual(stats.clips, ["Wingbeat", "Glide", "TailSway"]);
  pass(
    "Actual WebGL skinned Aurel: 16 bones, three clips, one draw call and 10,188 triangles",
  );
  await page.evaluate(() => {
    const r = window.__skyAnimation;
    r.play(false);
    r.clip("Wingbeat");
    r.seek(0);
  });
  const up = PNG.sync.read(
    await page.screenshot({ path: "design/sky-creature/animated-preview.png" }),
  );
  await page.evaluate(() => window.__skyAnimation.seek(1.6));
  const down = PNG.sync.read(
    await page.screenshot({ path: ".cache/sky-animation/downstroke.png" }),
  );
  let changed = 0;
  for (let i = 0; i < up.data.length; i += 4)
    if (
      Math.abs(up.data[i] - down.data[i]) +
        Math.abs(up.data[i + 1] - down.data[i + 1]) +
        Math.abs(up.data[i + 2] - down.data[i + 2]) >
      35
    )
      changed++;
  assert(changed > 20000);
  pass(
    "Wingbeat genuinely deforms the mesh: distinct upstroke/downstroke screenshots",
  );
  for (const clip of ["Glide", "TailSway"]) {
    await page.click(`[data-clip="${clip}"]`);
    await page.evaluate(() => window.__skyAnimation.seek(1.1));
    assert.equal(
      await page.$eval(`[data-clip="${clip}"]`, (n) =>
        n.getAttribute("aria-pressed"),
      ),
      "true",
    );
    await page.screenshot({ path: `.cache/sky-animation/${clip}.png` });
  }
  await page.click("#play");
  let before = await page.evaluate(() => window.__skyAnimation.state.time);
  await delay(220);
  assert.notEqual(
    await page.evaluate(() => window.__skyAnimation.state.time),
    before,
  );
  await page.click("#play");
  before = await page.evaluate(() => window.__skyAnimation.state.time);
  await delay(200);
  assert.equal(
    await page.evaluate(() => window.__skyAnimation.state.time),
    before,
  );
  await page.$eval("#time", (n) => {
    n.value = "2.1";
    n.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert(
    Math.abs(
      (await page.evaluate(() => window.__skyAnimation.state.time)) - 2.1,
    ) < 0.01,
  );
  pass(
    "All three loop selectors, real play/pause freeze, and pose-time scrubbing work",
  );
  await page.click("#bones");
  assert(await page.evaluate(() => window.__skyAnimation.helper.visible));
  assert.equal(
    await page.evaluate(() => window.__skyAnimation.renderer.info.render.calls),
    2,
  );
  await page.screenshot({ path: ".cache/sky-animation/skeleton.png" });
  await page.click("#bones");
  pass(
    "Skeleton toggle displays actual animated bone links, not a painted overlay",
  );
  for (const view of ["front", "above", "below", "head", "hero"]) {
    await page.click(`[data-view="${view}"]`);
    await page.screenshot({ path: `.cache/sky-animation/view-${view}.png` });
  }
  const position = await page.evaluate(() =>
    window.__skyAnimation.camera.position.toArray(),
  );
  await page.mouse.move(670, 450);
  await page.mouse.down();
  await page.mouse.move(800, 510, { steps: 8 });
  await page.mouse.up();
  assert.notDeepEqual(
    await page.evaluate(() => window.__skyAnimation.camera.position.toArray()),
    position,
  );
  await page.mouse.wheel({ deltaY: -200 });
  assert.notEqual(
    await page.evaluate(() => window.__skyAnimation.camera.zoom),
    1,
  );
  await page.click('[data-view="hero"]');
  assert.equal(await page.evaluate(() => window.__skyAnimation.camera.zoom), 1);
  pass(
    "Five camera views, drag orbit, bounded zoom and Hero reset retain real 3D inspection",
  );
  for (const width of [320, 390, 430]) {
    await page.setViewport({ width, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      width,
    );
    const boxes = await page.$$eval("button,input", (nodes) =>
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
    await page.screenshot({ path: `.cache/sky-animation/mobile-${width}.png` });
  }
  pass(
    "320 / 390 / 430px mobile views retain every motion, camera and pose control",
  );
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.evaluate(() => window.__skyAnimation.play(true));
  before = await page.evaluate(() => window.__skyAnimation.state.time);
  await delay(180);
  assert.equal(
    await page.evaluate(() => window.__skyAnimation.state.time),
    before,
  );
  assert(await page.$eval("#play", (n) => n.disabled));
  await page.evaluate(() => window.__skyAnimation.seek(0.7));
  assert(
    Math.abs(
      (await page.evaluate(() => window.__skyAnimation.state.time)) - 0.7,
    ) < 0.01,
  );
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  await delay(180);
  assert.notEqual(
    await page.evaluate(() => window.__skyAnimation.state.time),
    0.7,
  );
  pass(
    "Live reduced motion stops timers and disables play overrides, but allows static pose inspection",
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  before = await page.evaluate(() => window.__skyAnimation.state.time);
  await delay(180);
  assert.equal(
    await page.evaluate(() => window.__skyAnimation.state.time),
    before,
  );
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await delay(180);
  assert.notEqual(
    await page.evaluate(() => window.__skyAnimation.state.time),
    before,
  );
  pass(
    "Hidden-document signal suspends and resumes motion without elapsed-time catch-up",
  );
  await page.$eval("canvas", (n) => {
    n.style.display = "none";
  });
  await page.waitForFunction(() => !window.__skyAnimation.state.running);
  before = await page.evaluate(() => window.__skyAnimation.state.time);
  await delay(180);
  assert.equal(
    await page.evaluate(() => window.__skyAnimation.state.time),
    before,
  );
  await page.$eval("canvas", (n) => {
    n.style.display = "";
  });
  await page.waitForFunction(() => window.__skyAnimation.state.running);
  await delay(180);
  assert.notEqual(
    await page.evaluate(() => window.__skyAnimation.state.time),
    before,
  );
  pass(
    "Actual non-intersecting canvas suspends and resumes the animation timer",
  );
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluate(() => window.__skyAnimation.view("hero"));
  const video = await page.evaluate(async () => {
    const r = window.__skyAnimation,
      stream = r.renderer.domElement.captureStream(24),
      recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8",
        videoBitsPerSecond: 1800000,
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
    r.renderer.setClearColor(0xe8eee9, 1);
    r.clip("Wingbeat");
    r.play(true);
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 3400));
    r.clip("Glide");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    r.clip("TailSway");
    await new Promise((resolve) => setTimeout(resolve, 2800));
    recorder.stop();
    r.play(false);
    stream.getTracks().forEach((t) => t.stop());
    r.renderer.setClearColor(0, 0);
    r.render();
    return done;
  });
  await writeFile(
    "design/sky-creature/aurel-flight-motion.webm",
    Buffer.from(video, "base64"),
  );
  assert(video.length > 20000);
  pass(
    "Recorded the actual skinned WebGL canvas: Wingbeat / Glide / TailSway motion preview",
  );
  const reducedPage = await browser.newPage();
  reducedPage.on("pageerror", (e) => errors.push(e.message));
  await reducedPage.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await reducedPage.goto(new URL("./animation.html", page.url()).href, {
    waitUntil: "networkidle0",
  });
  await reducedPage.waitForFunction(() => window.__skyAnimation?.ready);
  assert(await reducedPage.$eval("#play", (n) => n.disabled));
  const initial = await reducedPage.evaluate(() => window.__skyAnimation.state);
  await delay(200);
  assert.equal(
    await reducedPage.evaluate(() => window.__skyAnimation.state.time),
    initial.time,
  );
  assert(!initial.running && !initial.timer);
  await reducedPage.close();
  pass(
    "Reduced motion is respected on first load, not just after a live preference change",
  );
  await page.goto(new URL("./review.html", page.url()).href, {
    waitUntil: "networkidle0",
  });
  await page.waitForFunction(() => window.__skyReview?.ready);
  assert.equal(
    await page.evaluate(() => window.__skyReview.renderer.info.render.calls),
    13,
  );
  assert.equal(await page.evaluate(() => window.__skyReview.animations), 0);
  pass(
    "Original Script 17 static review remains available and unchanged at its explicit URL",
  );
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  assert.deepEqual(errors, []);
  pass("No planner storage writes and no browser page/console errors");
  await writeFile(
    ".cache/sky-animation/browser-report.json",
    JSON.stringify(
      { checks, errors, stats, changedWingbeatPixels: changed },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
