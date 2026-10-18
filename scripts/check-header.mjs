// Shared-header layout, navigation and effective zoom-width regression checks.
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
const url = process.env.APP_URL ?? "http://127.0.0.1:5175";
const output = ".cache/header-check";
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
async function geometry(page) {
  await page.waitForFunction(() => {
    const root = document.querySelector(".app-shell"),
      header = document.querySelector(".site-header"),
      notices = document.querySelector(".site-notices");
    return (
      root &&
      Math.abs(
        parseFloat(root.style.getPropertyValue("--site-header-height")) -
          header.getBoundingClientRect().height,
      ) < 1 &&
      Math.abs(
        parseFloat(root.style.getPropertyValue("--site-notices-height")) -
          notices.getBoundingClientRect().height,
      ) < 1
    );
  });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  return page.evaluate(() => {
    const header = document.querySelector(".site-header"),
      r = header.getBoundingClientRect();
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        getComputedStyle(el).visibility !== "hidden"
      );
    };
    const elements = [...header.querySelectorAll("a,button,time")]
      .filter(visible)
      .map((el) => ({
        name: el.getAttribute("aria-label") || el.textContent.trim(),
        r: el.getBoundingClientRect().toJSON(),
        clipped: el.scrollWidth > el.clientWidth + 1,
      }));
    const problems = [];
    for (const el of elements) {
      if (
        el.r.left < r.left - 1 ||
        el.r.right > r.right + 1 ||
        el.r.bottom > r.bottom + 1 ||
        el.clipped
      )
        problems.push("Clipped " + el.name);
    }
    for (let i = 0; i < elements.length; i++)
      for (let j = i + 1; j < elements.length; j++) {
        const a = elements[i],
          b = elements[j];
        if (
          a.r.left < b.r.right - 1 &&
          a.r.right > b.r.left + 1 &&
          a.r.top < b.r.bottom - 1 &&
          a.r.bottom > b.r.top + 1
        )
          problems.push("Overlap " + a.name + "/" + b.name);
      }
    const notices = document.querySelector(".site-notices"),
      n = notices.getBoundingClientRect(),
      intro = document.querySelector(".world-hud-left"),
      tools = document.querySelector(".world-top-tools");
    if (intro) {
      const bottom = Math.max(r.bottom, n.height ? n.bottom : 0);
      if (intro.getBoundingClientRect().top < bottom)
        problems.push("Header/notices cover world introduction");
      if (tools.getBoundingClientRect().top < bottom)
        problems.push("Header/notices cover world tools");
    }
    return {
      problems,
      header: r.toJSON(),
      labels: [...header.querySelectorAll("nav a")].map((a) =>
        a.getAttribute("aria-label"),
      ),
      visibleNav: visible(header.querySelector("nav")),
      visibleToggle: visible(header.querySelector(".site-menu-toggle")),
    };
  });
}
try {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(url + "/settings", { waitUntil: "networkidle0" });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "Explore the demo workspace")
      .click(),
  );
  await page.waitForFunction(() => localStorage.getItem("study-world.demo.v1"));
  await page.evaluate(() =>
    localStorage.setItem(
      "study-world.personal.v1",
      localStorage.getItem("study-world.demo.v1"),
    ),
  );
  const paths = [
    "/",
    "/today",
    "/revisions",
    "/tests",
    "/analytics",
    "/settings",
    "/subjects/maths",
  ];
  const widths = [
    320, 390, 430, 640, 760, 761, 768, 900, 1024, 1152, 1279, 1280, 1440, 1800,
  ];
  for (const path of paths) {
    await page.goto(url + path, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    for (const width of widths) {
      await page.setViewport({ width, height: width <= 760 ? 844 : 900 });
      await page.waitForFunction((w) => innerWidth === w, {}, width);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const g = await geometry(page);
      assert.deepEqual(g.problems, [], `${path} at ${width}px: ${g.problems}`);
      assert.deepEqual(g.labels, [
        "World",
        "Today",
        "Revisions",
        "Tests",
        "Analytics",
        "Settings",
      ]);
      assert.equal(g.visibleNav, width > 760);
      assert.equal(g.visibleToggle, width <= 760);
      if (width <= 760) {
        await page.click(".site-menu-toggle");
        assert.equal(
          await page.$eval(".site-menu-toggle", (b) =>
            b.getAttribute("aria-expanded"),
          ),
          "true",
        );
        assert.equal((await geometry(page)).visibleNav, true);
        const opened = await geometry(page);
        if (opened.problems.length) console.log(path, width, opened);
        assert.deepEqual(opened.problems, []);
        await page.keyboard.press("Escape");
        assert.equal(
          await page.$eval(".site-menu-toggle", (b) =>
            b.getAttribute("aria-expanded"),
          ),
          "false",
        );
        assert(
          await page.$eval(
            ".site-menu-toggle",
            (b) => b === document.activeElement,
          ),
        );
      }
    }
  }
  pass(
    "All seven page headers fit 14 viewport widths (320–1800px), including breakpoint edges and desktop zoom-equivalent widths",
  );
  pass(
    "Navigation labels/order and Paste action remain consistent; tablet uses a full labelled row, mobile a real accessible menu",
  );
  pass(
    "Mobile menu opens without clipping, supports Escape, and restores keyboard focus at all narrow widths",
  );
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(url + "/", { waitUntil: "networkidle0" });
  await page.click(".site-menu-toggle");
  await page.click('nav a[href="/today"]');
  await page.waitForSelector(".today-page");
  assert.equal(
    await page.$eval(".site-menu-toggle", (b) =>
      b.getAttribute("aria-expanded"),
    ),
    "false",
  );
  await page.click(".site-menu-toggle");
  await page.setViewport({ width: 1024, height: 900 });
  await page.waitForFunction(
    () =>
      document
        .querySelector(".site-menu-toggle")
        .getAttribute("aria-expanded") === "false",
  );
  await page.setViewport({ width: 390, height: 844 });
  assert.equal((await geometry(page)).visibleNav, false);
  await page.click(".site-menu-toggle");
  await page.evaluate(() =>
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    ),
  );
  assert.equal(
    await page.$eval(".site-menu-toggle", (b) =>
      b.getAttribute("aria-expanded"),
    ),
    "false",
  );
  await page.click(".site-paste-button");
  await page.waitForSelector("dialog[open]");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  pass(
    "Menu closes on navigation, outside interaction and widening; mobile Paste still opens the existing explicit-save workflow",
  );
  await page.goto(url + "/?island=maths&view=island", {
    waitUntil: "networkidle0",
  });
  await page.click(".site-menu-toggle");
  await page.keyboard.press("Escape");
  assert.equal(
    new URL(page.url()).searchParams.get("view"),
    "island",
    "Menu Escape must not also exit the 3D island",
  );
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewport({ width, height: 1000 });
    await page.goto(url + "/today", { waitUntil: "networkidle0" });
    await page.screenshot({ path: `${output}/today-${width}.png` });
    await page.goto(url + "/", { waitUntil: "networkidle0" });
    await page.waitForFunction(
      () =>
        document.querySelector(".world-canvas")?.dataset.cameraMoving ===
        "false",
      { timeout: 60000 },
    );
    await page.screenshot({ path: `${output}/world-${width}.png` });
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(url + "/settings", { waitUntil: "networkidle0" });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "Explore the demo workspace")
      .click(),
  );
  await page.waitForSelector(".site-demo-label");
  await page.evaluate(() => document.querySelector('nav a[href="/"]').click());
  await page.waitForSelector(".world-hud-left");
  await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.deepEqual((await geometry(page)).problems, []);
  await page.screenshot({
    path: `${output}/demo-world.png`,
  });
  pass(
    "The measured header/banner heights keep World controls clear, including the demo notice",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify({ checks, errors, widths, paths }, null, 2),
  );
  console.log(`${checks.length} shared-header checks passed`);
} finally {
  await browser.close();
}
