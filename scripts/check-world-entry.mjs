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
await mkdir(".cache/world-entry", { recursive: true });
await mkdir("design/world-enhancements", { recursive: true });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1100, height: 950 });
  await page.goto("http://127.0.0.1:5173/settings", {
    waitUntil: "networkidle0",
  });
  const frame = await (await page.waitForSelector("iframe")).contentFrame();
  await frame.waitForSelector(".settings-dashboard");
  // Fixture setup only in this disposable browser; never the user's workspace.
  await frame.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((n) => n.textContent === "Explore the demo workspace")
      .click(),
  );
  await frame.waitForFunction(() =>
    localStorage.getItem("study-world.demo.v1"),
  );
  await frame.evaluate(() => document.querySelector('a[href="/"]').click());
  const ready = async () => {
    await frame.evaluate(() => delete window.__entryStable);
    await frame.waitForFunction(
      () => {
        const n = document.querySelector(".world-canvas");
        if (
          n?.dataset.skyStatus !== "ready" ||
          n.dataset.cameraMoving !== "false"
        )
          return false;
        const key =
          Number(n.dataset.cameraDistance).toFixed(4) +
          "|" +
          Number(n.dataset.cameraAzimuth).toFixed(4) +
          "|" +
          innerWidth +
          "|" +
          innerHeight;
        const old = window.__entryStable ?? { key: "", frames: 0 };
        window.__entryStable = {
          key,
          frames: old.key === key ? old.frames + 1 : 0,
        };
        return window.__entryStable.frames >= 5;
      },
      { timeout: 60000 },
    );
  };
  const box = async (selector) => {
    const r = await frame.$eval(selector, (n) => {
      const r = n.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        vw: innerWidth,
        vh: innerHeight,
      };
    });
    const f = await page.$eval("iframe", (n) => {
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    return {
      x: f.x + ((r.x + r.w / 2) * f.w) / r.vw,
      y: f.y + ((r.y + r.h / 2) * f.h) / r.vh,
    };
  };
  const click = async (selector) => {
    const p = await box(selector);
    await page.mouse.click(p.x, p.y);
  };
  const verifyToolbar = async () => {
    const layout = await frame.evaluate(() => {
      const rect = (selector) =>
        document.querySelector(selector).getBoundingClientRect().toJSON();
      return {
        journey: rect(".journey-menu > button"),
        create: rect(".world-top-tools > button"),
        heading: rect(".world-overline"),
        copy: document.querySelector(".world-introduction").textContent,
        width: innerWidth,
      };
    });
    assert(
      !/little effort|extraordinary world|curiosity has a place/i.test(
        layout.copy,
      ),
    );
    assert(
      Math.abs(layout.journey.top - layout.create.top) <= 1,
      JSON.stringify(layout),
    );
    assert(
      layout.heading.bottom + 11 <= layout.journey.top,
      JSON.stringify(layout),
    );
    assert(
      layout.journey.right + 8 <= layout.create.left,
      JSON.stringify(layout),
    );
    assert(
      layout.journey.left >= 0 && layout.create.right <= layout.width,
      JSON.stringify(layout),
    );
  };
  await ready();
  await page.click(".responsive-preview-modes button:nth-child(1)");
  await ready();
  await delay(700);
  await verifyToolbar();
  await page.screenshot({
    path: "design/world-enhancements/world-clean-overview-desktop.png",
  });
  await click(".journey-menu > button");
  await frame.waitForSelector(".journey-popover");
  assert(await frame.$(".journey-overload"), "Use a genuinely overloaded plan");
  const verify = async (name) => {
    await verifyToolbar();
    await frame.waitForFunction(
      () => {
        const r = document
          .querySelector(".journey-popover")
          ?.getBoundingClientRect();
        return r && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1;
      },
      { timeout: 15000 },
    );
    await delay(150);
    const fit = await frame.$eval(".journey-popover", (n) => {
      const r = n.getBoundingClientRect(),
        h = n.querySelector("header").getBoundingClientRect(),
        body = n.querySelector(".world-popover-body");
      const limits = [
        ...document.querySelectorAll(".world-bottom-left,.world-controls-menu"),
      ]
        .map((x) => x.getBoundingClientRect())
        .filter((x) => x.height && x.top < innerHeight && x.top > 150);
      const bottom = Math.min(innerHeight, ...limits.map((x) => x.top));
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: innerWidth,
        height: innerHeight,
        limit: bottom,
        header: h.toJSON(),
        scrollable: body.scrollHeight > body.clientHeight,
        bodyOverflow: document.body.style.overflow,
        headerBottom: Math.max(
          ...[...document.querySelectorAll(".site-header,.site-notices")].map(
            (x) => x.getBoundingClientRect().bottom,
          ),
        ),
      };
    });
    assert(fit.left >= 0 && fit.right <= fit.width + 1, JSON.stringify(fit));
    assert(
      fit.top >= fit.headerBottom - 1 && fit.bottom <= fit.limit + 1,
      `${name}: ${JSON.stringify(fit)}`,
    );
    assert(fit.header.bottom <= fit.height && fit.bodyOverflow !== "hidden");
    await frame.$eval(".journey-popover .world-popover-body", (n) => {
      n.scrollTop = n.scrollHeight;
    });
    const reachable = await frame.$eval(
      ".journey-popover .journey-start",
      (n) => {
        const r = n.getBoundingClientRect(),
          p = n.closest(".world-popover").getBoundingClientRect();
        return r.top >= p.top && r.bottom <= p.bottom + 1;
      },
    );
    assert(reachable, "Continue action is reachable by internal scrolling");
    await writeFile(
      `.cache/world-entry/${name}.json`,
      JSON.stringify(fit, null, 2),
    );
    return fit;
  };
  await verify("desktop-demo");
  // Keep the SAME panel open while resizing: no close/reopen or state reset.
  await page.setViewport({ width: 1100, height: 600 });
  await frame.waitForFunction(() => innerHeight < 500);
  await verify("short-desktop-demo");
  await page.setViewport({ width: 1100, height: 460 });
  await frame.waitForFunction(() => innerHeight < 400);
  const short = await verify("very-short-desktop-demo");
  assert(short.scrollable);
  await page.screenshot({
    path: "design/world-enhancements/journey-short-fitted.png",
  });
  await page.setViewport({ width: 1100, height: 950 });
  await page.click(".responsive-preview-modes button:nth-child(2)");
  await frame.waitForFunction(() => innerWidth === 768);
  if (!(await frame.$(".journey-popover")))
    await click(".journey-menu > button");
  await verify("tablet-demo");
  await page.click(".responsive-preview-modes button:nth-child(3)");
  await frame.waitForFunction(() => innerWidth === 390);
  for (const width of [320, 390, 430]) {
    await page.select('[aria-label="Mobile preview width"]', String(width));
    await frame.waitForFunction((w) => innerWidth === w, {}, width);
    if (!(await frame.$(".journey-popover")))
      await click(".journey-menu > button");
    await verify(`phone-${width}-demo`);
  }
  await page.screenshot({
    path: "design/world-enhancements/journey-demo-fitted.png",
  });
  await frame.focus('.journey-popover [aria-label="Close Today’s journey"]');
  await page.keyboard.press("Escape");
  await frame.waitForSelector(".journey-popover", { hidden: true });
  pass(
    "Live overloaded Journey fits desktop, short/very-short viewports, tablet and 320/390/430 phones; header and footer tools stay clear, body scrolls and Continue remains reachable",
  );
  await ready();
  await verifyToolbar();
  await page.screenshot({
    path: "design/world-enhancements/world-clean-overview-mobile.png",
  });
  pass(
    "Introductory slogan is removed; compact World heading and aligned Journey/New subject row fit desktop, tablet and 320/390/430 phones",
  );
  // Atlas selection must immediately enter, with no intermediate screen/button.
  await click(".world-atlas summary");
  await click('[aria-label="Find island: English & Vocabulary"]');
  await frame.waitForFunction(
    () => new URLSearchParams(location.search).get("view") === "island",
  );
  await frame.waitForSelector(".is-exploring .console-open-subject");
  await ready();
  assert.equal(await frame.$(".enter-island"), null);
  assert.equal(await frame.$eval(".world-atlas", (n) => n.open), false);
  const cta = await frame.$eval(".console-open-subject", (n) => ({
    height: n.getBoundingClientRect().height,
    text: n.textContent,
    href: n.getAttribute("href"),
  }));
  assert(cta.height >= 40 && cta.href === "/subjects/english");
  await page.screenshot({
    path: "design/world-enhancements/island-direct-open.png",
  });
  await click(".journey-menu > button");
  await frame.waitForSelector(".journey-popover");
  await page.keyboard.press("Escape");
  assert.equal(
    await frame.$eval(".world-experience", (n) =>
      n.classList.contains("is-exploring"),
    ),
    true,
    "Escape closes Journey before leaving the island",
  );
  await click(".console-back");
  await frame.waitForFunction(
    () => !new URLSearchParams(location.search).has("island"),
  );
  await ready();
  pass(
    "Atlas immediately enters the garden, prominent Open subject button is visible, All islands returns to the world and popover Escape does not exit the garden",
  );
  await page.click(".responsive-preview-modes button:nth-child(1)");
  await ready();
  await frame.waitForFunction(() =>
    [...document.querySelectorAll(".island-label")].some(
      (n) =>
        n.getAttribute("aria-label") === "Select island: SSC Mathematics" &&
        n.style.visibility !== "hidden",
    ),
  );
  await click('[aria-label="Select island: SSC Mathematics"]');
  await frame.waitForSelector(".topic-plot-label");
  await ready();
  assert.equal(await frame.$(".enter-island"), null);
  await verifyToolbar();
  assert(
    await frame.evaluate(
      () =>
        document.querySelector(".island-console").getBoundingClientRect().top >=
        document.querySelector(".world-top-tools").getBoundingClientRect()
          .bottom +
          12,
    ),
    "Desktop subject panel clears the aligned top toolbar",
  );
  await frame.waitForFunction(
    () => {
      const n = [...document.querySelectorAll(".topic-plot-label")].find(
        (n) => {
          if (getComputedStyle(n).visibility !== "visible") return false;
          const r = n.getBoundingClientRect();
          return (
            document
              .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
              ?.closest(".topic-plot-label") === n
          );
        },
      );
      if (!n) return false;
      n.dataset.qaSelectable = "true";
      return true;
    },
    { timeout: 30000 },
  );
  await click('[data-qa-selectable="true"]');
  await frame.waitForSelector("#world-topic-title");
  assert.match(
    await frame.$eval(".console-open-subject", (n) => n.getAttribute("href")),
    /\?topic=/,
  );
  await click(".console-open-subject");
  await frame.waitForSelector(".subject-banner");
  assert(new URL(await frame.url()).pathname.startsWith("/subjects/"));
  pass(
    "Clicking a world island label directly opens its topic plots; topic selection and the prominent topic-aware Open subject button navigate to the real editor",
  );
  await frame.goto("http://127.0.0.1:5173/?island=software", {
    waitUntil: "networkidle0",
  });
  await ready();
  assert(
    await frame.$(".is-exploring .console-open-subject"),
    "Legacy island-only deep link enters directly",
  );
  await click(".world-controls-menu > button");
  await frame.waitForSelector(".controls-popover");
  const controls = await frame.$eval(".controls-popover", (n) => {
    const r = n.getBoundingClientRect();
    return (
      r.left >= 0 &&
      r.right <= innerWidth + 1 &&
      r.top >= 0 &&
      r.bottom <= innerHeight
    );
  });
  assert(controls);
  await click('[aria-label="Close World controls"]');
  pass(
    "Existing island-only deep links open directly and the viewport-fitted Controls menu remains usable",
  );
  assert.deepEqual(errors, []);
  pass("No browser page errors");
  await writeFile(
    ".cache/world-entry/report.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
