// External revised-topic exams, real persistence and the existing manual journal.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createServer } from "vite";
process.env.AWS_EXECUTION_ENV ??= "AWS_Lambda_nodejs22.x";
const require = createRequire(
  new URL("../design/model-review/package.json", import.meta.url),
);
const { default: chromium } = await import(
  require.resolve("@sparticuz/chromium")
);
const { default: puppeteer } = await import(require.resolve("puppeteer-core"));
const app = process.env.APP_URL ?? "http://127.0.0.1:5175";
const output = ".cache/exam-check";
await mkdir(output, { recursive: true });
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
const model = await server.ssrLoadModule("/src/domain/model.ts");
const engine = await server.ssrLoadModule("/src/domain/engine.ts");
const date = model.today();
let fixture = model.emptyData();
fixture.subjects.push({
  id: "creative",
  name: "Creative study",
  color: "#768b65",
  theme: "generic",
  archived: false,
});
fixture = engine.addTasks(
  fixture,
  fixture.subjects.flatMap((s, i) =>
    (s.id === "english" ? ["1–50", "51–100"] : [""]).map((range) => ({
      subjectId: s.id,
      topic: `Exam topic ${i + 1}`,
      title: "Learn and revise",
      minutes: 20,
      priority: false,
      revision: true,
      range,
      notes: "",
    })),
  ),
  model.addDays(date, -8),
);
for (const t of fixture.tasks)
  fixture = engine.completeTask(fixture, t.id, model.addDays(date, -8));
for (const r of fixture.revisions)
  fixture = engine.rateRevision(fixture, r.id, "Good", model.addDays(date, -7));
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
  await page.setViewport({ width: 1440, height: 1000 });
  const go = (path) => page.goto(app + path, { waitUntil: "networkidle0" });
  const store = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")),
    );
  const fill = async (label, value, scope = "dialog[open]") =>
    page.evaluate(
      (scope, label, value) => {
        const root = document.querySelector(scope);
        const input = [...root.querySelectorAll("label.field")]
          .find((l) => l.querySelector(":scope>span")?.textContent === label)
          ?.querySelector("input,textarea");
        if (!input) throw Error("Missing " + label);
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        ).set.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      },
      scope,
      label,
      String(value),
    );
  const button = async (text, scope = "body") =>
    page.evaluate(
      (scope, text) => {
        const b = [
          ...document.querySelector(scope).querySelectorAll("button"),
        ].find((n) => n.textContent.trim() === text);
        if (!b) throw Error("Missing " + text);
        b.click();
      },
      scope,
      text,
    );
  await go("/tests");
  const legacy = JSON.parse(JSON.stringify(fixture));
  delete legacy.preferences.examIntervalDays;
  await page.evaluate(
    (data) =>
      localStorage.setItem("study-world.personal.v1", JSON.stringify(data)),
    legacy,
  );
  await go("/tests");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).preferences
        .examIntervalDays === 7,
  );
  const baseline = await store();
  assert(
    await page.$eval(".revision-exam-panel", (n) =>
      n.textContent.includes("Exam due"),
    ),
  );
  assert(
    await page.$eval(
      ".exam-plan-count",
      (n) =>
        n.textContent.includes("7 revised topics") &&
        n.textContent.includes("8 topic/range"),
    ),
  );
  assert.deepEqual(baseline.revisions, fixture.revisions);
  pass(
    "Legacy v1 data loads with a seven-day checkpoint from actual recall, including a seventh dynamic subject and both vocabulary ranges",
  );
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewport({ width, height: 1000 });
    await go("/tests");
    const seen = [];
    for (let i = 0; i < 10; i++) {
      const titles = await page.$$eval(".exam-topic-grid strong", (nodes) =>
        nodes.map((n) => n.textContent),
      );
      assert(titles.length <= (width <= 640 ? 2 : 4));
      seen.push(...titles);
      if (
        await page.$eval('[aria-label="Next syllabus page"]', (n) => n.disabled)
      )
        break;
      const before = await page.$eval(
        ".exam-plan-pagination span",
        (n) => n.textContent,
      );
      await page.click('[aria-label="Next syllabus page"]');
      await page.waitForFunction(
        (t) =>
          document.querySelector(".exam-plan-pagination span").textContent !==
          t,
        {},
        before,
      );
    }
    assert.equal(new Set(seen).size, 7);
    assert.equal(seen.length, 7);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  assert.deepEqual(await store(), baseline);
  pass(
    "The bounded syllabus fits 320/390/768/1440px; paging exposes every topic without duplicate rows or study-data changes",
  );
  await page.setViewport({ width: 390, height: 844 });
  await go("/tests");
  await button("Record revision exam result");
  await page.waitForSelector("dialog[open]");
  assert.equal(
    await page.$$eval(".exam-record-syllabus li", (n) => n.length),
    8,
  );
  assert(await page.$eval("dialog .modal-footer .primary", (n) => n.disabled));
  await fill("Test date", "");
  await page.waitForSelector("dialog[open]");
  await fill("Test date", date);
  await fill("Your score", 80);
  await button("Cancel", "dialog[open]");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  assert.deepEqual(await store(), baseline);
  await go("/today");
  assert(await page.$(".exam-due-reminder"));
  await page.click(".exam-due-reminder a");
  await page.waitForSelector(".revision-exam-panel");
  pass(
    "Today links to the due exam; opening, clearing a date, drafting and cancelling never records completion, and full-syllabus confirmation is required",
  );
  await go("/settings");
  await fill("Revision exam interval (days)", 14, ".settings-page");
  await go("/tests");
  assert.equal((await store()).preferences.examIntervalDays, 7);
  await go("/settings");
  await fill("Revision exam interval (days)", 14, ".settings-page");
  await button("Save preferences");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).preferences
        .examIntervalDays === 14,
  );
  await go("/tests");
  assert(
    await page.$eval(".revision-exam-panel", (n) =>
      n.textContent.includes("Upcoming"),
    ),
  );
  await go("/today");
  assert.equal(await page.$(".exam-due-reminder"), null);
  assert.deepEqual((await store()).revisions, baseline.revisions);
  await go("/settings");
  await fill("Revision exam interval (days)", 7, ".settings-page");
  await button("Save preferences");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).preferences
        .examIntervalDays === 7,
  );
  pass(
    "Exam interval edits are staged, saved explicitly and retained after reload; only the next checkpoint changes, not revision dates",
  );
  await go("/tests");
  await fill("Test name", "Ordinary external mock", ".inline-test-form");
  await fill("Your score", 70, ".inline-test-form");
  await button("Save test result", ".inline-test-form");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).tests
        .length === 1,
  );
  assert(!(await store()).tests[0].revisionExam);
  assert(
    await page.$eval(".revision-exam-panel", (n) =>
      n.textContent.includes("Exam due"),
    ),
  );
  await page.screenshot({ path: output + "/mobile-due.png", fullPage: true });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: output + "/desktop-due.png" });
  pass(
    "The ordinary external-result journal still works; an unrelated manual record does not silently complete the scheduled exam",
  );
  await button("Record revision exam result");
  await page.waitForSelector("dialog[open]");
  await fill("Your score", 80);
  await page.click("dialog .recall-check input");
  await button("Save test result", "dialog[open]");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).tests
        .length === 2,
  );
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  const completed = await store();
  assert.deepEqual(completed.revisions, baseline.revisions);
  assert.deepEqual(completed.reviews, baseline.reviews);
  assert.equal(completed.tests[1].revisionExam.coverage.length, 8);
  assert(
    await page.$eval(".revision-exam-panel", (n) =>
      n.textContent.includes("Waiting for revisions"),
    ),
  );
  await go("/today");
  assert.equal(await page.$(".exam-due-reminder"), null);
  await go("/tests");
  assert.equal((await store()).tests.length, 2);
  model.dataSchema.parse(await store());
  await page.evaluate(() =>
    [...document.querySelectorAll(".test-card-main")]
      .find((n) => n.textContent.includes("Revision exam"))
      .click(),
  );
  await page.waitForSelector(".exam-history-syllabus");
  assert(
    await page.$eval(
      ".exam-history-syllabus",
      (n) => n.textContent.includes("1–50") && n.textContent.includes("51–100"),
    ),
  );
  pass(
    "Explicit completion saves the syllabus with the existing journal, clears the due reminder, survives reload and leaves schedules unchanged for overall-only scores",
  );
  const next = engine.rateRevision(
    completed,
    completed.revisions[0].id,
    "Good",
    date,
  );
  await page.evaluate(
    (data) =>
      localStorage.setItem("study-world.personal.v1", JSON.stringify(data)),
    next,
  );
  await go("/tests");
  assert(
    await page.$eval(".revision-exam-panel", (n) =>
      n.textContent.includes("Upcoming"),
    ),
  );
  assert(
    await page.$eval(".exam-plan-count", (n) =>
      n.textContent.includes("1 revised topic"),
    ),
  );
  assert.equal((await store()).tests.length, 2);
  pass(
    "A newly completed recall starts the next checkpoint without fabricating another finished exam or reusing old covered material",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
  await server.close();
}
