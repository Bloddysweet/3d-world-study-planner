// Reference-page interaction checks. Optional tools: npm --prefix design/model-review ci
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
const output = ".cache/page-check";
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
const store = (page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("study-world.personal.v1")),
  );
async function click(page, text) {
  await page.evaluate((text) => {
    const root = document.querySelector("dialog[open]") ?? document;
    const b = [...root.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === text,
    );
    if (!b) throw Error("Missing button " + text);
    b.click();
  }, text);
}
async function fill(page, label, value) {
  await page.evaluate(
    (label, value) => {
      const root = document.querySelector("dialog[open]") ?? document;
      const f = [...root.querySelectorAll("label.field")]
        .find((l) => l.querySelector(":scope>span")?.textContent === label)
        ?.querySelector("input,textarea");
      if (!f) throw Error("Missing field " + label);
      Object.getOwnPropertyDescriptor(
        f.tagName === "TEXTAREA"
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        "value",
      ).set.call(f, value);
      f.dispatchEvent(new Event("input", { bubbles: true }));
    },
    label,
    String(value),
  );
}
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  const goto = (path) => page.goto(url + path, { waitUntil: "networkidle0" });
  const shot = async (name) =>
    page.screenshot({
      path: `${output}/${name}.png`,
      fullPage: !(await page.$("dialog[open]")),
    });
  await goto("/settings");
  await click(page, "Explore the demo workspace");
  await page.waitForFunction(() => localStorage.getItem("study-world.demo.v1"));
  await page.evaluate(() =>
    localStorage.setItem(
      "study-world.personal.v1",
      localStorage.getItem("study-world.demo.v1"),
    ),
  );
  await goto("/revisions");
  const beforeCalendar = await store(page),
    month = await page.$eval(".month-calendar h2", (n) => n.textContent);
  await page.click('[aria-label="Next month"]');
  assert.notEqual(
    await page.$eval(".month-calendar h2", (n) => n.textContent),
    month,
  );
  await page.click('[aria-label="Previous month"]');
  assert.equal(
    await page.$eval(".month-calendar h2", (n) => n.textContent),
    month,
  );
  await page.click(".month-grid button:not(.outside-month)");
  assert(await page.$('[aria-pressed="true"]'));
  await click(page, "Clear date filter");
  assert.deepEqual(await store(page), beforeCalendar);
  pass("Calendar month navigation and date filtering never mutate schedules");
  for (const width of [320, 390]) {
    await page.setViewport({ width, height: 844 });
    await goto("/today");
    assert(
      await page.$$eval(".revision-main", (nodes) =>
        nodes.every((n) => n.getBoundingClientRect().width >= 150),
      ),
      "Review titles must stay readable, not squeezed into single letters",
    );
    assert(
      await page.$$eval(".revision-row", (nodes) =>
        nodes.every((n) => n.getBoundingClientRect().height < 180),
      ),
    );
    assert(
      await page.$$eval(".task-actions", (nodes) =>
        nodes.every((n) =>
          [...n.children].every(
            (c) =>
              c.getBoundingClientRect().right <=
              n.closest(".task-row").getBoundingClientRect().right,
          ),
        ),
      ),
      "All task actions, including Move, must remain visible",
    );
    await shot(`today-${width}`);
  }
  await page.setViewport({ width: 1440, height: 1000 });
  pass(
    "Mobile review titles remain readable on 320px and 390px screens, with compact wrapped actions",
  );
  await goto("/tests");
  const beforeTests = await store(page);
  await fill(page, "Test name", "Inline overall-only check");
  await fill(page, "Your score", 75);
  assert.equal((await store(page)).tests.length, beforeTests.tests.length);
  await click(page, "Save test result");
  await page.waitForFunction(
    (n) =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).tests
        .length ===
      n + 1,
    {},
    beforeTests.tests.length,
  );
  assert.deepEqual((await store(page)).revisions, beforeTests.revisions);
  assert.equal(await page.$eval(".inline-test-form input", (n) => n.value), "");
  pass(
    "Inline external test saves only on confirmation, resets its draft and leaves schedules unchanged for overall-only scores",
  );
  await goto("/analytics");
  await click(page, "7 days");
  assert.equal(
    await page.$eval(".insight-stats .insight-stat p", (n) => n.textContent),
    "Within the last 7 days",
  );
  await click(page, "All time");
  assert.equal(
    await page.$eval(".insight-stats .insight-stat p", (n) => n.textContent),
    "Across recorded history",
  );
  assert.equal(
    await page.$eval(".insight-stats .insight-stat:nth-child(2) strong", (n) =>
      Number(n.textContent),
    ),
    (await store(page)).tasks.filter((t) => t.completedOn).length,
  );
  pass(
    "Analytics period controls update actual evidence, including all-time completion count",
  );
  await goto("/settings");
  const savedBudget = (await store(page)).preferences.dailyMinutes;
  await fill(page, "Daily study budget (minutes)", savedBudget + 10);
  assert.equal((await store(page)).preferences.dailyMinutes, savedBudget);
  await page.click('nav a[href="/today"]');
  await page.waitForSelector("#today-paste");
  await goto("/settings");
  assert.equal(
    await page.$eval("#study-preferences", (n) => n.tagName),
    "FORM",
  );
  assert.equal((await store(page)).preferences.dailyMinutes, savedBudget);
  pass(
    "Settings edits stay staged; leaving the page does not silently save preferences",
  );
  await goto("/today");
  await page.$eval("#today-paste", (n) => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    ).set.call(n, "Maths:\nPercentage | Review-page test task | 25 min");
    n.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const beforePaste = await store(page);
  await click(page, "Read my plan");
  await page.waitForSelector(".paste-review-modal");
  assert.equal(
    await page.$eval(
      '.proposal input[aria-label="Task 1 title"]',
      (n) => n.value,
    ),
    "Review-page test task",
  );
  assert.deepEqual(await store(page), beforePaste);
  await shot("paste-review-desktop");
  await page.setViewport({ width: 390, height: 844 });
  await shot("paste-review-mobile");
  await click(page, "Confirm & add tasks");
  await page.waitForFunction(
    (n) =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).tasks
        .length ===
      n + 1,
    {},
    beforePaste.tasks.length,
  );
  pass(
    "Today text opens editable paste review without saving until explicit confirmation",
  );
  await page.evaluate(() =>
    [...document.querySelectorAll(".task-main")]
      .find((b) => b.textContent.includes("Review-page test task"))
      .click(),
  );
  await page.waitForSelector(".task-detail-view");
  assert.equal(
    await page.$eval(
      ".task-detail-view",
      (n) => n.getBoundingClientRect().right,
    ),
    390,
  );
  await shot("task-details-mobile");
  await page.setViewport({ width: 1440, height: 1000 });
  await shot("task-details-desktop");
  await click(page, "Mark completed");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).tasks.find(
        (t) => t.title === "Review-page test task",
      ).completedOn,
  );
  await click(page, "Undo completion");
  await page.waitForFunction(
    () =>
      !JSON.parse(localStorage.getItem("study-world.personal.v1")).tasks.find(
        (t) => t.title === "Review-page test task",
      ).completedOn,
  );
  await click(page, "Cancel");
  pass(
    "Read-only task drawer fits desktop/mobile and completes or undoes actual work without closing",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(`${checks.length} page checks passed. Evidence: ${output}`);
} finally {
  await browser.close();
}
