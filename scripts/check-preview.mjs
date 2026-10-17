// Development-only responsive preview controls. npm --prefix design/model-review ci
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
const url = process.env.APP_URL ?? "http://127.0.0.1:5173";
const output = ".cache/preview-check";
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => a !== "--single-process"),
  headless: "shell",
});
const checks = [],
  errors = [];
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1100, height: 950 });
  await page.goto(url + "/settings", { waitUntil: "networkidle0" });
  const handle = await page.waitForSelector(
    'iframe[title="Study World interactive app preview"]',
  );
  const app = await handle.contentFrame();
  await app.waitForSelector(".settings-dashboard");
  assert.equal(page.frames().length, 2);
  assert.equal(await app.$(".responsive-preview"), null);
  assert.equal(await app.evaluate(() => innerWidth), 390);
  pass(
    "Mobile starts at a real 390px iframe viewport with one app and no nested preview toolbar",
  );
  const before = await app.evaluate(() =>
    localStorage.getItem("study-world.personal.v1"),
  );
  await app.evaluate(() => {
    window.__previewContinuity = "mounted";
    const input = [...document.querySelectorAll("label.field")]
      .find(
        (l) =>
          l.querySelector(":scope>span")?.textContent ===
          "Daily study budget (minutes)",
      )
      .querySelector("input");
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(input, "123");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  async function mode(name, width) {
    await page.click(
      `.responsive-preview-modes button:nth-child(${{ Desktop: 1, Tablet: 2, Mobile: 3 }[name]})`,
    );
    if (width) await app.waitForFunction((w) => innerWidth === w, {}, width);
    assert.equal(
      await app.evaluate(() => window.__previewContinuity),
      "mounted",
    );
  }
  await mode("Tablet", 768);
  await mode("Desktop");
  assert((await app.evaluate(() => innerWidth)) > 1000);
  await mode("Mobile", 390);
  assert.equal(
    await app.evaluate(
      () =>
        [...document.querySelectorAll("label.field")]
          .find(
            (l) =>
              l.querySelector(":scope>span")?.textContent ===
              "Daily study budget (minutes)",
          )
          .querySelector("input").value,
    ),
    "123",
  );
  assert.equal(
    await app.evaluate(() => localStorage.getItem("study-world.personal.v1")),
    before,
  );
  pass(
    "Desktop / Tablet / Mobile resize the same app without reloading, losing preference drafts or writing study data",
  );
  for (const width of [320, 390, 430]) {
    await page.select('[aria-label="Mobile preview width"]', String(width));
    await app.waitForFunction((w) => innerWidth === w, {}, width);
    assert(await app.evaluate(() => matchMedia("(max-width:540px)").matches));
    assert(
      await app.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.click('[aria-label="Rotate preview"]');
  await app.waitForFunction(() => innerWidth === 844 && innerHeight === 430);
  await page.click('[aria-label="Rotate preview"]');
  await app.waitForFunction(() => innerWidth === 430 && innerHeight === 844);
  await page.click('[aria-label="Show actual preview size"]');
  assert.equal(
    await page.$eval("iframe", (f) =>
      Math.round(f.getBoundingClientRect().width),
    ),
    430,
  );
  await page.click('[aria-label="Show actual preview size"]');
  pass(
    "320/390/430px presets, portrait/landscape and actual-size/Fit views use genuine media-query dimensions",
  );
  await page.setViewport({ width: 320, height: 640 });
  await page.waitForFunction(
    () => document.querySelector("iframe").getBoundingClientRect().width < 300,
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.equal(await app.evaluate(() => innerWidth), 430);
  await page.screenshot({ path: output + "/narrow-container.png" });
  await page.setViewport({ width: 1100, height: 950 });
  await mode("Mobile", 430);
  await page.select('[aria-label="Mobile preview width"]', "390");
  await app.waitForFunction(() => innerWidth === 390);
  await app.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "Explore the demo workspace")
      .click(),
  );
  await app.waitForSelector(".demo-banner");
  await app.evaluate(() => document.querySelector('nav a[href="/"]').click());
  await app.waitForSelector(".world-canvas canvas");
  await app.waitForFunction(
    () =>
      document.querySelector(".world-canvas")?.dataset.cameraMoving ===
        "false" && document.querySelectorAll(".island-label").length === 6,
    { timeout: 60000 },
  );
  assert.equal(
    await app.$eval("canvas", (c) =>
      Math.round(c.getBoundingClientRect().width),
    ),
    390,
  );
  await mode("Tablet", 768);
  await mode("Mobile", 390);
  assert(await app.$(".demo-banner"));
  await app.waitForFunction(
    () =>
      document.querySelector(".world-canvas")?.dataset.cameraMoving === "false",
    { timeout: 60000 },
  );
  await page.screenshot({ path: output + "/mobile-world.png" });
  pass(
    "The 3D world stays live and correctly sized inside the phone frame; demo/personal isolation survives device changes",
  );
  await app.evaluate(() =>
    document.querySelector('nav a[href="/today"]').click(),
  );
  await app.waitForSelector(".task-main");
  await app.click(".task-main");
  await app.waitForSelector("dialog[open]");
  await mode("Tablet", 768);
  await mode("Mobile", 390);
  assert(await app.$("dialog[open]"));
  assert(
    await app.$eval(
      "dialog",
      (d) => d.getBoundingClientRect().width <= innerWidth,
    ),
  );
  await page.screenshot({ path: output + "/mobile-drawer.png" });
  assert.equal(
    await app.evaluate(() => localStorage.getItem("study-world.personal.v1")),
    before,
  );
  assert.deepEqual(errors, []);
  pass(
    "Native task drawers remain open and responsive while switching devices; no personal-data changes or browser exceptions",
  );
  await writeFile(
    output + "/results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
