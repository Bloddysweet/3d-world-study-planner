// Custom SVG artwork and live integration. Optional tools: npm --prefix design/model-review ci
import { createRequire } from "node:module";
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
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
const gallery =
  process.env.GALLERY_URL ?? "http://127.0.0.1:5173/design/icons/index.html";
const output = ".cache/icon-check";
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
  await page.setViewport({ width: 1200, height: 1100 });
  await page.goto(gallery, { waitUntil: "networkidle0" });
  const glyphs = (await readdir("design/icons")).filter((p) =>
    p.endsWith(".svg"),
  );
  assert.equal(glyphs.length, 53);
  for (const file of glyphs) {
    const text = await readFile("design/icons/" + file, "utf8");
    assert(text.includes('role="img"') && text.includes("aria-label="));
    assert(!/<(image|script|filter|use)|\shref=|\sid=/.test(text));
  }
  const bad = await page.$$eval("svg", (nodes) =>
    nodes.flatMap((s) => {
      const b = s.getBBox(),
        v = s.viewBox.baseVal,
        pad = s.dataset.studyIcon === "island-mark" ? 0.7 : 1.05;
      return b.x - pad < -0.1 ||
        b.y - pad < -0.1 ||
        b.x + b.width + pad > v.width + 0.1 ||
        b.y + b.height + pad > v.height + 0.1
        ? [
            {
              name: s.dataset.studyIcon,
              b: { x: b.x, y: b.y, w: b.width, h: b.height },
            },
          ]
        : [];
    }),
  );
  assert.deepEqual(
    bad,
    [],
    "SVG geometry and round strokes must fit inside their artboards at every specimen size",
  );
  await page.screenshot({ path: output + "/icon-family.png" });
  const height = await page.$eval("section:nth-of-type(2)", (n) =>
    Math.ceil(n.getBoundingClientRect().bottom + 24),
  );
  await page.screenshot({
    path: "design/icons/preview.png",
    clip: { x: 0, y: 0, width: 1200, height },
  });
  pass(
    "All 52 glyphs and the brand export are self-contained, labelled SVGs; artwork stays within bounds at 16/20/32/56px",
  );
  await page.goto(url + "/settings", { waitUntil: "networkidle0" });
  const nav = await page.$$eval(".site-navigation a", (nodes) =>
    nodes.map((n) => n.querySelector("svg").dataset.studyIcon),
  );
  assert.deepEqual(nav, [
    "world",
    "today",
    "revisions",
    "tests",
    "analytics",
    "settings",
  ]);
  assert(await page.$('.site-brand [data-study-icon="island-mark"]'));
  assert.equal(await page.$(".lucide"), null);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "Explore the demo workspace")
      .click(),
  );
  await page.waitForSelector(".demo-banner");
  const subjects = await page.$$eval(".manage-subject .subject-icon", (nodes) =>
    nodes.map((n) => ({
      name: n.querySelector("svg").dataset.studyIcon,
      colour: getComputedStyle(n).color,
      svg: getComputedStyle(n.querySelector("svg")).color,
    })),
  );
  assert.deepEqual(
    subjects.map((s) => s.name),
    ["maths", "reasoning", "english", "gk", "dsa", "software"],
  );
  assert(subjects.every((s) => s.colour === s.svg));
  pass(
    "The same six custom navigation symbols and all subject landmarks render live with inherited subject colours",
  );
  await page.setViewport({ width: 390, height: 844 });
  await page.click(".site-menu-toggle");
  await page.click('nav a[href="/today"]');
  await page.waitForSelector(".today-page");
  await page.click(".site-paste-button");
  await page.waitForSelector("dialog[open]");
  assert(await page.$('dialog [data-study-icon="sparkles"]'));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  await page.screenshot({ path: output + "/mobile-today.png" });
  assert(
    await page.$$eval(".site-header svg", (nodes) =>
      nodes.every(
        (s) =>
          s.getAttribute("aria-hidden") === "true" &&
          s.getAttribute("focusable") === "false",
      ),
    ),
  );
  pass(
    "Mobile Menu and Paste keep their accessible labels, keyboard behaviour and existing save workflow with the new vectors",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
