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
const base = "http://127.0.0.1:5173",
  checks = [],
  errors = [],
  delay = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(".cache/dragon-pair", { recursive: true });
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
const state = (frame) =>
  frame.$eval(".world-canvas", (n) => ({
    ...n.dataset,
    skyPose: n.dataset.skyPose && JSON.parse(n.dataset.skyPose),
    wildPose: n.dataset.wildPose && JSON.parse(n.dataset.wildPose),
  }));
try {
  const page = await browser.newPage();
  const requested = [];
  page.on("request", (r) => requested.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1200, height: 950 });
  await page.goto(base + "/design/dragon-pair/review.html", {
    waitUntil: "networkidle0",
  });
  await page.waitForSelector('body[data-ready="true"]');
  await page.evaluate(() => {
    window.freezeDragon = true;
    window.dragonReview.mixers.forEach((m) => m.setTime(0.5));
  });
  await delay(200);
  await page.screenshot({
    path: "design/dragon-pair/dragon-pair-model-preview.png",
  });
  pass("Original Auren GLB loads and animates in the actual 3D model review");
  await page.goto(base + "/settings", { waitUntil: "networkidle0" });
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
  const click = async (selector) => {
    const r = await frame.$eval(selector, (n) => {
      const r = n.getBoundingClientRect();
      return {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        vw: innerWidth,
        vh: innerHeight,
      };
    });
    const f = await page.$eval("iframe", (n) => {
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    await page.mouse.click(f.x + (r.x * f.w) / r.vw, f.y + (r.y * f.h) / r.vh);
  };
  await frame.waitForSelector(".demo-banner");
  const ready = async () => {
    await frame.evaluate(() => delete window.__duoStable);
    await frame.waitForFunction(
      async () => {
        const url = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .find((u) => u.includes("@react-three_fiber.js"));
        if (!url) return false;
        const { _roots } = await import(url),
          store = _roots.get(document.querySelector("canvas"))?.store;
        const d = document.querySelector(".world-canvas")?.dataset;
        if (
          store?.getState().size.width !== innerWidth ||
          d?.skyStatus !== "ready" ||
          d.wildStatus !== "ready" ||
          d.cameraMoving !== "false"
        ) {
          delete window.__duoStable;
          return false;
        }
        window.__duoStable ??= performance.now();
        return performance.now() - window.__duoStable > 400;
      },
      { timeout: 60000 },
    );
  };
  await ready();
  await page.click(".responsive-preview-modes button:nth-child(1)");
  await frame.waitForFunction(() => innerWidth > 1000);
  await ready();
  await frame.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.wildVisible === "true",
    { timeout: 30000 },
  );
  await frame.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .find((u) => u.includes("@react-three_fiber.js"));
    const { _roots } = await import(url);
    const scene = _roots
      .get(document.querySelector("canvas"))
      .store.getState().scene;
    const a = scene.getObjectByName("Aurel_Sky_Companion"),
      w = scene.getObjectByName("Auren_Male_Companion");
    const skins = [];
    scene.traverse((o) => {
      if (o.isSkinnedMesh && [a, w].some((g) => g?.getObjectById(o.id)))
        skins.push(o);
    });
    window.__wildActual = {
      names: [a?.name, w?.name],
      skins: skins.length,
      bones: skins.map((s) => s.skeleton.bones.length),
    };
  });
  assert.deepEqual(await frame.evaluate(() => window.__wildActual), {
    names: ["Aurel_Sky_Companion", "Auren_Male_Companion"],
    skins: 2,
    bones: [16, 16],
  });
  assert.equal(await frame.$('[aria-label="Animate wild dragon"]'), null);
  const first = await state(frame);
  await frame.waitForFunction(
    (t) =>
      JSON.parse(document.querySelector(".world-canvas").dataset.wildPose)
        .time >
      t + 0.6,
    {},
    first.wildPose.time,
  );
  const second = await state(frame);
  assert.notDeepEqual(second.wildPose.position, first.wildPose.position);
  assert.notEqual(second.wildPose.wing, first.wildPose.wing);
  assert.equal(second.skyCount, "1");
  assert.equal(second.wildCount, "1");
  await page.screenshot({
    path: "design/dragon-pair/world-two-dragons-desktop.png",
  });
  pass(
    "World has two distinct real skinned dragons; Auren route and wing joints change while Aurel remains intact",
  );
  const inspect = async (name) => {
    try {
      await frame.waitForFunction(
        () => {
          const d = document.querySelector(".world-canvas").dataset;
          return (
            d.wildVisible === "true" &&
            Number(d.wildOpacity) > 0.7 &&
            d.wildSafe === "true"
          );
        },
        { timeout: 15000 },
      );
    } catch (e) {
      const diagnostic = {
        layout: name,
        url: frame.url(),
        state: await state(frame),
      };
      await writeFile(
        ".cache/dragon-pair/failure.json",
        JSON.stringify(diagnostic, null, 2),
      );
      await page.screenshot({ path: ".cache/dragon-pair/failure.png" });
      throw new Error(JSON.stringify(diagnostic), { cause: e });
    }
    const s = await state(frame);
    await writeFile(
      ".cache/dragon-pair/" + name + ".json",
      JSON.stringify(s, null, 2),
    );
    const a = s.skyPose.bounds,
      w = s.wildPose.bounds;
    assert(
      w &&
        w.left >= 0 &&
        w.right <= (await frame.evaluate(() => innerWidth)) &&
        w.top >= 0 &&
        w.bottom <= (await frame.evaluate(() => innerHeight)),
      JSON.stringify(s),
    );
    if (s.skyVisible === "true")
      assert(
        w.right < a.left ||
          w.left > a.right ||
          w.bottom < a.top ||
          w.top > a.bottom,
        "Dragon footprints must not overlap",
      );
  };
  await inspect("desktop");
  await page.click(".responsive-preview-modes button:nth-child(2)");
  await frame.waitForFunction(() => innerWidth === 768);
  await ready();
  await inspect("tablet");
  await page.click(".responsive-preview-modes button:nth-child(3)");
  await frame.waitForFunction(() => innerWidth === 390);
  await ready();
  for (const width of [320, 390, 430]) {
    await page.select('[aria-label="Mobile preview width"]', String(width));
    await frame.waitForFunction((w) => innerWidth === w, {}, width);
    await ready();
    await inspect("phone-" + width);
  }
  await page.screenshot({
    path: "design/dragon-pair/world-two-dragons-mobile.png",
  });
  pass(
    "Second dragon stays visible, in bounds and separated from Aurel across desktop, tablet and 320/390/430 phones",
  );
  await frame.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .find((u) => u.includes("@react-three_fiber.js"));
    const { _roots } = await import(url),
      store = _roots.get(document.querySelector("canvas")).store;
    const actors = ["Aurel_Sky_Companion", "Auren_Male_Companion"].map((name) =>
      store.getState().scene.getObjectByName(name),
    );
    window.__duoOrbit = [];
    window.__stopDuoOrbit = store.getState().internal.subscribe(
      {
        current: () => {
          window.__duoOrbit.push(
            actors.map((g) => {
              let mesh;
              g.traverse((o) => {
                if (o.isSkinnedMesh) mesh = o;
              });
              return mesh.material.opacity;
            }),
          );
        },
      },
      0,
      store,
    );
  });
  const bounds = await page.$eval("iframe", (n) => {
    const r = n.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.move(bounds.x + bounds.w * 0.25, bounds.y + bounds.h * 0.48);
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.w * 0.72,
    bounds.y + bounds.h * 0.51,
    { steps: 18 },
  );
  await delay(450);
  await page.mouse.move(
    bounds.x + bounds.w * 0.35,
    bounds.y + bounds.h * 0.45,
    { steps: 18 },
  );
  await delay(450);
  await page.mouse.up();
  const orbit = await frame.evaluate(() => {
    window.__stopDuoOrbit();
    return window.__duoOrbit;
  });
  assert(orbit.length >= 8);
  for (let i = 1; i < orbit.length; i++)
    for (let j = 0; j < 2; j++)
      assert(
        Math.abs(orbit[i][j] - orbit[i - 1][j]) <= 0.46,
        "Orbit obstruction fades must not hard-cut either dragon",
      );
  await writeFile(".cache/dragon-pair/orbit.json", JSON.stringify(orbit));
  pass(
    "Actual held pointer orbit preserves gentle opacity transitions for both dragons",
  );
  const learningBefore = await frame.evaluate(() => [
    localStorage.getItem("study-world.personal.v1"),
    localStorage.getItem("study-world.demo.v1"),
  ]);
  await click(".world-controls-menu > button");
  await frame.waitForSelector('[aria-label="Animate male dragon"]');
  await click('[aria-label="Animate male dragon"]');
  await frame.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.wildReason === "paused",
  );
  const paused = await state(frame);
  await delay(1200);
  const after = await state(frame);
  assert.equal(paused.wildPose.time, after.wildPose.time);
  assert(after.skyPose.time > paused.skyPose.time);
  await click('[aria-label="Animate male dragon"]');
  await frame.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.wildRunning === "true",
  );
  await click('[aria-label="Animate sky creature"]');
  await frame.waitForFunction(
    () =>
      document.querySelector(".world-canvas").dataset.skyReason === "paused",
  );
  const ap = await state(frame);
  await delay(1200);
  const aw = await state(frame);
  assert.equal(ap.skyPose.time, aw.skyPose.time);
  assert(aw.wildPose.time > ap.wildPose.time);
  await click('[aria-label="Animate sky creature"]');
  pass("Separate Controls toggles pause each dragon without pausing the other");
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await frame.waitForFunction(() => {
    const d = document.querySelector(".world-canvas").dataset;
    return (
      d.skyReason === "reduced-motion" && d.wildReason === "reduced-motion"
    );
  });
  const reduced = await state(frame);
  await delay(1000);
  const still = await state(frame);
  assert.equal(reduced.wildPose.time, still.wildPose.time);
  assert.equal(reduced.skyPose.time, still.skyPose.time);
  assert(
    await frame.$eval('[aria-label="Animate male dragon"]', (n) => n.disabled),
  );
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  await ready();
  assert.deepEqual(
    await frame.evaluate(() => [
      localStorage.getItem("study-world.personal.v1"),
      localStorage.getItem("study-world.demo.v1"),
    ]),
    learningBefore,
  );
  pass(
    "Live reduced-motion freezes both route clocks, disables motion overrides and decorative controls do not write study data",
  );
  await click('[aria-label="Close World controls"]');
  await click(".world-atlas summary");
  await click('[aria-label="Find island: English & Vocabulary"]');
  await frame.waitForSelector(".is-exploring .console-open-subject");
  await ready();
  await click(".console-open-subject");
  await frame.waitForSelector(".subject-banner");
  assert(new URL(frame.url()).pathname.startsWith("/subjects/"));
  pass(
    "Direct island entry and real subject navigation still work with two dragons",
  );
  const isolatedFailure = await browser.createBrowserContext();
  const failed = await isolatedFailure.newPage();
  failed.on("pageerror", (e) => errors.push(e.message));
  await failed.setViewport({ width: 1100, height: 950 });
  await failed.setRequestInterception(true);
  failed.on("request", (r) =>
    r.url().endsWith("/auren_male_companion_v1.glb") ? r.abort() : r.continue(),
  );
  await failed.goto(base + "/settings", { waitUntil: "networkidle0" });
  const ff = await (await failed.waitForSelector("iframe")).contentFrame();
  await ff.waitForSelector(".settings-dashboard");
  await ff.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((n) => n.textContent === "Explore the demo workspace")
      .click(),
  );
  await ff.waitForFunction(() => localStorage.getItem("study-world.demo.v1"));
  await ff.evaluate(() => document.querySelector('a[href="/"]').click());
  await ff.waitForSelector(".demo-banner");
  await ff.waitForFunction(
    () => {
      const d = document.querySelector(".world-canvas")?.dataset;
      return d?.wildStatus === "unavailable" && d.skyStatus === "ready";
    },
    { timeout: 60000 },
  );
  await ff.waitForSelector(".island-label", { timeout: 60000 });
  assert(
    await ff.evaluate(() => {
      const canvas = document.querySelector("canvas");
      return (
        !!canvas &&
        !canvas.getContext("webgl2")?.isContextLost() &&
        [...document.querySelectorAll(".scene-fallback")].every(
          (n) => n.closest("canvas") || !n.getBoundingClientRect().width,
        )
      );
    }),
    "Only the unpainted native canvas fallback may remain in the DOM",
  );
  pass(
    "Failed optional male model leaves Aurel, islands and study tools available",
  );
  assert(
    !requested.some((url) => url.includes("cinder_wild_dragon")),
    "Retired black dragon must not be downloaded",
  );
  assert(requested.some((url) => url.includes("auren_male_companion_v1.glb")));
  assert.deepEqual(errors, []);
  pass("No browser page errors");
  await writeFile(
    ".cache/dragon-pair/report.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
