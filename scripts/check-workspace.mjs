// Bounded review cards and the on-demand World journey drawer.
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
const output = ".cache/workspace-check";
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => a !== "--single-process"),
  headless: "shell",
});
const checks = [],
  errors = [];
const pass = (n) => {
  checks.push(n);
  console.log("PASS " + n);
};
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  const go = async (p) => {
    if (!page.url().startsWith(url))
      return page.goto(url + p, { waitUntil: "networkidle0" });
    await page.evaluate((path) => {
      history.pushState({}, "", path);
      dispatchEvent(new PopStateEvent("popstate"));
    }, p);
    await page.waitForSelector(
      p === "/revisions"
        ? ".revisions-page"
        : p === "/settings"
          ? ".settings-page"
          : ".world-experience",
    );
    await page.evaluate(() => new Promise(requestAnimationFrame));
  };
  await go("/settings");
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((n) => n.textContent === "Explore the demo workspace")
      .click(),
  );
  await page.waitForSelector(".demo-banner");
  const original = await page.evaluate(() => ({
    demo: localStorage.getItem("study-world.demo.v1"),
    personal: localStorage.getItem("study-world.personal.v1"),
  }));
  await go("/revisions");
  const expectedTotal = Number(
    await page.$eval(".revision-summary strong", (n) => n.textContent),
  );
  for (const width of [1440, 1108, 900, 768, 640, 390, 320]) {
    await page.setViewport({ width, height: 900 });
    await go("/revisions");
    await page.select('[aria-label="Filter revisions by subject"]', "all");
    await page.waitForFunction(
      (total) =>
        Number(
          document.querySelector(".revision-summary strong").textContent,
        ) === total &&
        document.querySelector('[aria-label="Previous revision page"]')
          .disabled,
      {},
      expectedTotal,
    );
    const total = Number(
      await page.$eval(".revision-summary strong", (n) => n.textContent),
    );
    const seen = [];
    for (let i = 0; i < 30; i++) {
      const cards = await page.$$eval(
        ".revision-card-grid .revision-row",
        (nodes) =>
          nodes.map((n) => ({
            text: n.querySelector(".revision-main").textContent,
            box: n.getBoundingClientRect().toJSON(),
            title: n
              .querySelector(".revision-main")
              .getBoundingClientRect()
              .toJSON(),
            actions: [...n.querySelectorAll("button")].map((b) =>
              b.getBoundingClientRect().toJSON(),
            ),
          })),
      );
      assert(cards.length <= (width <= 640 ? 2 : 4));
      assert(
        cards.every(
          (n) =>
            n.title.width >= 150 &&
            n.box.width >= 230 &&
            n.actions.every(
              (a) => a.left >= n.box.left && a.right <= n.box.right + 1,
            ),
        ),
      );
      seen.push(...cards.map((c) => c.text));
      if (i === 0) {
        if (width >= 768) assert.equal(cards[0].box.top, cards[1].box.top);
        if (width === 1108 || width === 390) {
          await page.evaluate(() =>
            window.scrollTo({ top: 0, behavior: "instant" }),
          );
          await page.evaluate(() => new Promise(requestAnimationFrame));
          await page.screenshot({
            path: `${output}/revisions-${width}.png`,
            fullPage: true,
          });
        }
      }
      if (
        await page.$eval('[aria-label="Next revision page"]', (n) => n.disabled)
      )
        break;
      const previous = await page.$eval(
        '.revision-pagination [role="status"]',
        (n) => n.textContent,
      );
      await page.click('[aria-label="Next revision page"]');
      await page.waitForFunction(
        (t) =>
          document.querySelector('.revision-pagination [role="status"]')
            .textContent !== t,
        {},
        previous,
      );
    }
    assert.equal(seen.length, total);
    assert.equal(new Set(seen).size, total);
    const filter = await page.$eval(
      '[aria-label="Filter revisions by subject"]',
      (n) => n.options[1].value,
    );
    await page.select('[aria-label="Filter revisions by subject"]', filter);
    await page.waitForFunction(
      () =>
        document.querySelector('[aria-label="Previous revision page"]')
          .disabled,
    );
    assert(
      await page.$$eval(
        ".revision-card-grid .revision-row",
        (nodes) => nodes.length <= 4,
      ),
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  pass(
    "Reviews use two-column cards on desktop/tablet and at most two cards per phone page; every due review remains reachable at 320–1440px",
  );
  await page.select('[aria-label="Filter revisions by subject"]', "all");
  for (const tab of ["Upcoming", "History"]) {
    await page.evaluate(
      (text) =>
        [...document.querySelectorAll(".tabs button")]
          .find((n) => n.textContent === text)
          .click(),
      tab,
    );
    await page.waitForFunction(
      () =>
        !document.querySelector('[aria-label="Previous revision page"]') ||
        document.querySelector('[aria-label="Previous revision page"]')
          .disabled,
    );
    assert(
      await page.$$eval(
        ".revision-card-grid > :is(.history-row,.revision-row)",
        (n) => n.length <= 2,
      ),
    );
    if (tab === "History") {
      const expected = Number(
        await page.$eval(
          ".revision-summary > div:nth-child(3) strong",
          (n) => n.textContent,
        ),
      );
      let count = 0;
      for (let i = 0; i < 50; i++) {
        count += await page.$$eval(
          ".revision-card-grid > .history-row",
          (n) => n.length,
        );
        if (
          await page.$eval(
            '[aria-label="Next revision page"]',
            (n) => n.disabled,
          )
        )
          break;
        const text = await page.$eval(
          '.revision-pagination [role="status"]',
          (n) => n.textContent,
        );
        await page.click('[aria-label="Next revision page"]');
        await page.waitForFunction(
          (t) =>
            document.querySelector('.revision-pagination [role="status"]')
              .textContent !== t,
          {},
          text,
        );
      }
      assert.equal(count, expected);
    }
  }
  assert(
    await page.$eval(".month-calendar", (n) => !n.open),
    "Phone calendar should start compact",
  );
  await page.click(".month-calendar > summary");
  await page.waitForFunction(
    () => document.querySelector(".month-calendar").open,
  );
  await page.evaluate(() =>
    document.querySelector(".calendar-due").closest("button").click(),
  );
  await page.waitForSelector(".group-heading");
  assert(
    await page.$eval(
      '[aria-label="Previous revision page"]',
      (n) => n.disabled,
    ),
  );
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((n) => n.textContent === "Clear date filter")
      .click(),
  );
  await page.evaluate(() => document.querySelector(".tabs button").click());
  await page.waitForFunction(() =>
    document
      .querySelector(".tabs button.active")
      ?.textContent.startsWith("Due now"),
  );
  pass(
    "Subject/date/tab changes reset paging, every history record stays reachable, and the phone calendar/guide can expand on demand",
  );
  // Open a real review and defer dialog from the paged cards without saving.
  await page.setViewport({ width: 390, height: 844 });
  await go("/revisions");
  await page.click(".revision-card-grid .revision-row .btn");
  await page.waitForSelector("dialog[open]");
  assert(await page.$(".rating-grid button:disabled"));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  await page.click(".revision-card-grid .defer-btn");
  await page.waitForSelector("dialog[open]");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  pass(
    "Review/recall and Move still open their explicit-save dialogs from the new cards",
  );
  for (const [width, height] of [
    [1108, 628],
    [1440, 600],
    [768, 600],
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewport({ width, height });
    await go("/");
    assert.equal(await page.$(".journey-panel"), null);
    await page.waitForSelector(".journey-toggle");
    await page.click(".journey-toggle");
    await page.waitForSelector("dialog.journey-drawer[open]");
    const box = await page.$eval("dialog[open]", (n) =>
      n.getBoundingClientRect().toJSON(),
    );
    assert(
      box.top >= -1 && box.bottom <= height + 1,
      "Journey dialog must fit the visible viewport",
    );
    await page.$eval(".journey-start", (n) =>
      n.scrollIntoView({ block: "center" }),
    );
    const link = await page.$eval(".journey-start", (n) =>
      n.getBoundingClientRect().toJSON(),
    );
    assert(
      link.top >= 0 && link.bottom <= height,
      "Journey actions must be reachable by native scrolling",
    );
    if (width === 1108)
      await page.screenshot({ path: output + "/journey-drawer.png" });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await page.waitForFunction(
      () =>
        document.querySelector(".journey-toggle") === document.activeElement,
    );
    if (width === 1108)
      await page.screenshot({ path: output + "/world-compact.png" });
  }
  pass(
    "Journey no longer blocks the World: its drawer fits short/landscape/phone viewports, scrolls to all actions, and Escape restores trigger focus",
  );
  await page.click(".journey-toggle");
  await page.waitForSelector("dialog[open]");
  await page.click(".journey-start");
  await page.waitForSelector(".today-page");
  assert.equal(await page.$("dialog[open]"), null);
  assert.deepEqual(
    await page.evaluate(() => ({
      demo: localStorage.getItem("study-world.demo.v1"),
      personal: localStorage.getItem("study-world.personal.v1"),
    })),
    original,
  );
  pass(
    "Continue your journey closes the drawer and opens Today; browsing, paging and closing preserve all personal/demo data",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
