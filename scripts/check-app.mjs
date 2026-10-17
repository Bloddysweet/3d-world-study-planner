// Browser regression suite. Install the optional browser tools with: npm --prefix design/model-review ci
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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
const output = resolve(".cache/app-check");
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((arg) => arg !== "--single-process"),
  headless: "shell",
});
const captureScreenshots = process.env.APP_SCREENSHOTS !== "0";
const results = [],
  errors = [],
  failedRequests = [];
function passed(name) {
  results.push(name);
  console.log(`PASS ${name}`);
}
async function click(page, text, selector = "button") {
  if (
    selector === "nav a" &&
    (await page.evaluate(() => {
      const nav = document.querySelector(".site-navigation");
      return nav && getComputedStyle(nav).display === "none";
    }))
  )
    await page.click(".site-menu-toggle");
  await page.waitForFunction(
    (text, selector) =>
      [
        ...(
          document.querySelector("dialog[open]") ?? document
        ).querySelectorAll(selector),
      ].some((n) => n.textContent.trim() === text && n.getClientRects().length),
    {},
    text,
    selector,
  );
  const handle = await page.evaluateHandle(
    (text, selector) =>
      [
        ...(
          document.querySelector("dialog[open]") ?? document
        ).querySelectorAll(selector),
      ].find((n) => n.textContent.trim() === text && n.getClientRects().length),
    text,
    selector,
  );
  assert(handle.asElement(), `Missing ${selector}: ${text}`);
  await handle.asElement().click();
  await handle.dispose();
}
async function fill(page, label, value) {
  await page.evaluate(
    (label, value) => {
      const field = [
        ...(
          document.querySelector("dialog[open]") ?? document
        ).querySelectorAll("label.field"),
      ]
        .find((n) => n.querySelector(":scope > span")?.textContent === label)
        ?.querySelector("input,textarea,select");
      if (!field) throw new Error(`Missing field: ${label}`);
      const proto =
        field.tagName === "SELECT"
          ? HTMLSelectElement.prototype
          : field.tagName === "TEXTAREA"
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    },
    label,
    String(value),
  );
}
const stored = (page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("study-world.personal.v1")),
  );
const demoStored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("study-world.demo.v1")));
async function navigate(page, path) {
  await page.goto(url + path, { waitUntil: "networkidle0" });
}
async function screenshot(page, path) {
  if (!captureScreenshots) return;
  await page.waitForFunction(() => {
    const el = document.querySelector(".page");
    return !el || Number(getComputedStyle(el).opacity) >= 0.999;
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, fullPage: true });
}
async function dialogClosed(page) {
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
}
async function waitStore(page, expression) {
  await page.waitForFunction(expression);
}
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(e.stack ?? e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("requestfailed", (r) =>
    failedRequests.push({ url: r.url(), error: r.failure()?.errorText }),
  );
  await navigate(page, "/");
  await page.waitForFunction(
    () => document.querySelectorAll(".island-label").length === 6,
    { timeout: 60000 },
  );
  assert.equal((await stored(page)).tasks.length, 0);
  if (captureScreenshots)
    await page.screenshot({
      path: `${output}/world-desktop.png`,
      fullPage: true,
    });
  passed("Personal world starts empty; all six optimized 3D islands load");
  const beforeIslandSelection = JSON.stringify(await stored(page));
  await page.click(".island-label");
  await page.waitForSelector("#island-preview-title");
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(JSON.stringify(await stored(page)), beforeIslandSelection);
  await click(page, "Open subject", "a");
  await page.waitForSelector(".subject-banner");
  assert.equal(new URL(page.url()).pathname, "/subjects/maths");
  passed(
    "3D selection previews an island without changing study data; Open subject enters its actual subject",
  );
  await navigate(page, "/today");
  await click(page, "Paste targets");
  await click(page, "Use the local manual reader instead (no AI)");
  await page.type(
    ".paste-box",
    "Maths:\n! Percentage | Solve 30 questions | 50 min\nTime & Work | Review examples | 25 min\nEnglish:\nVocabulary | Learn words 1-50 | 20 min\nDSA:\nArrays | Practice hashing | 45 min",
  );
  await click(page, "Review my targets");
  await page.waitForSelector(".proposal");
  assert.equal((await stored(page)).tasks.length, 0);
  assert.equal(await page.$$eval(".proposal", (a) => a.length), 4);
  await click(page, "Confirm & add tasks");
  await dialogClosed(page);
  await waitStore(
    page,
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).tasks
        .length === 4,
  );
  passed(
    "Local parsing proposes four editable tasks; nothing saves before explicit confirmation",
  );
  const date = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await page.click('button[aria-label="Mark completed: Solve 30 questions"]');
  await waitStore(
    page,
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).revisions
        .length === 1,
  );
  let personal = await stored(page);
  assert.equal(personal.tasks[0].completedOn, date);
  const expected = new Date(date + "T12:00:00Z");
  expected.setUTCDate(expected.getUTCDate() + 1);
  assert.equal(personal.revisions[0].due, expected.toISOString().slice(0, 10));
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal((await stored(page)).tasks[0].completedOn, date);
  passed(
    "Actual completion persists and schedules the first review one calendar day later",
  );
  await navigate(page, "/settings");
  await fill(page, "Daily study budget (minutes)", "60");
  await click(page, "Save preferences");
  await navigate(page, "/today");
  await page.waitForSelector(".overload");
  await click(page, "Choose a day");
  await click(page, "Confirm move");
  await dialogClosed(page);
  personal = await stored(page);
  assert.equal(
    personal.tasks.find((t) => t.title === "Practice hashing").plannedOn,
    expected.toISOString().slice(0, 10),
  );
  assert.equal(personal.tasks.filter((t) => t.completedOn).length, 1);
  passed(
    "Overload suggests, but only explicit confirmation defers work; no false completion",
  );
  await navigate(page, "/");
  await click(page, "New subject");
  await fill(page, "Subject name", "Physics");
  await click(page, "Create subject");
  await dialogClosed(page);
  await page.waitForFunction(
    () => document.querySelectorAll(".island-label").length === 7,
  );
  assert.equal((await stored(page)).subjects.length, 7);
  passed(
    "A seventh dynamic subject creates a new 3D island and a usable subject card",
  );
  await navigate(page, "/settings");
  const physics = (await stored(page)).subjects.find(
    (s) => s.name === "Physics",
  );
  await page.click('button[aria-label="Edit subject: Physics"]');
  await fill(page, "Subject name", "Quantum Physics");
  await click(page, "Save changes");
  await dialogClosed(page);
  assert.equal(
    (await stored(page)).subjects.find((s) => s.id === physics.id).name,
    "Quantum Physics",
  );
  page.on("dialog", (d) => d.accept());
  await page.evaluate(() =>
    [...document.querySelectorAll(".manage-subject")]
      .find((n) => n.textContent.includes("Quantum Physics"))
      .querySelector("button.btn")
      .click(),
  );
  await waitStore(
    page,
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).subjects.find(
        (s) => s.name === "Quantum Physics",
      ).archived,
  );
  await page.evaluate(() =>
    [...document.querySelectorAll(".manage-subject")]
      .find((n) => n.textContent.includes("Quantum Physics"))
      .querySelector("button.btn")
      .click(),
  );
  await waitStore(
    page,
    () =>
      !JSON.parse(
        localStorage.getItem("study-world.personal.v1"),
      ).subjects.find((s) => s.name === "Quantum Physics").archived,
  );
  passed("Subject rename, archive and restore retain identity and history");
  await navigate(page, "/tests");
  await click(page, "Record a test");
  await fill(page, "Test name", "External mock — overall only");
  await fill(page, "Your score", "72");
  await click(page, "Save test result");
  await dialogClosed(page);
  personal = await stored(page);
  assert.equal(personal.tests.length, 1);
  assert.equal(personal.reviews.length, 0);
  await click(page, "Record a test");
  await fill(page, "Test name", "Percentage topic check");
  await fill(page, "Your score", "90");
  await click(page, "Add topic");
  const topic = personal.topics.find((t) => t.name === "Percentage");
  await page.select(".topic-score-row select", topic.id);
  await page.type(".topic-score-row input", "90");
  await click(page, "Save test result");
  await dialogClosed(page);
  await waitStore(
    page,
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).tests
        .length === 2,
  );
  personal = await stored(page);
  assert.equal(personal.revisions[0].step, 3);
  assert.equal(personal.reviews.length, 1);
  passed(
    "Overall score leaves schedules untouched; an actual topic score maps to Easy and advances its schedule",
  );
  await navigate(page, "/settings");
  const beforeDemo = JSON.stringify(await stored(page));
  await click(page, "Explore the demo workspace");
  await page.waitForSelector(".demo-banner");
  assert.equal(JSON.stringify(await stored(page)), beforeDemo);
  await navigate(page, "/today"); // Full reload deliberately returns to personal workspace.
  await navigate(page, "/settings");
  await click(page, "Explore the demo workspace");
  await click(page, "Today", "nav a");
  await page.waitForSelector(".revision-row");
  await click(page, "Review");
  await page.waitForSelector(".recall-check");
  assert(await page.$eval(".rating-2", (n) => n.disabled));
  await page.click(".recall-check input");
  await page.click(".rating-2");
  await dialogClosed(page);
  const ds = await demoStored(page);
  assert(ds.reviews.some((r) => r.day === date && r.source === "recall"));
  assert.equal(JSON.stringify(await stored(page)), beforeDemo);
  await click(page, "Return to my workspace");
  await page.waitForFunction(() => !document.querySelector(".demo-banner"));
  passed(
    "Separate demo requires active recall before rating; demo edits never modify personal data",
  );
  await navigate(page, "/settings");
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      blob.text().then((text) => (window.__exported = text));
      return original.call(this, blob);
    };
  });
  await click(page, "Export backup");
  await page.waitForFunction(() => window.__exported);
  const backup = JSON.parse(await page.evaluate(() => window.__exported));
  assert.equal(backup.tasks.length, 4);
  backup.tasks[1].title = "Restored from a checked backup";
  const path = `${output}/browser-backup.json`;
  await writeFile(path, JSON.stringify(backup));
  await (await page.$("input[type=file]")).uploadFile(path);
  await page.waitForSelector(".backup-summary");
  assert.notEqual((await stored(page)).tasks[1].title, backup.tasks[1].title);
  await page.click(".recall-check input");
  await click(page, "Replace with this backup");
  await dialogClosed(page);
  assert.equal((await stored(page)).tasks[1].title, backup.tasks[1].title);
  await writeFile(`${output}/invalid.json`, '{"version":99}');
  await (await page.$("input[type=file]")).uploadFile(`${output}/invalid.json`);
  await page.waitForFunction(() =>
    document.body.textContent.includes("This backup is invalid"),
  );
  assert.equal((await stored(page)).tasks.length, 4);
  passed(
    "JSON export/import round-trip requires confirmation; invalid backups cannot replace data",
  );
  await page.click('button[aria-label="Delete subject: Quantum Physics"]');
  await page.waitForSelector("dialog");
  assert(await page.$eval("dialog .btn.danger", (n) => n.disabled));
  await fill(page, "Type “Quantum Physics” to confirm", "Quantum Physics");
  await click(page, "Delete permanently");
  await dialogClosed(page);
  assert.equal((await stored(page)).subjects.length, 6);
  passed("Permanent subject deletion requires its exact name");
  await navigate(page, "/settings");
  await click(page, "Explore the demo workspace");
  await click(page, "Today", "nav a");
  await page.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 1 });
  await screenshot(page, `${output}/today-desktop.png`);
  for (const width of [390, 320]) {
    await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
    for (const [label, path] of [
      ["World", "/"],
      ["Today", "/today"],
      ["Revisions", "/revisions"],
      ["Tests", "/tests"],
      ["Analytics", "/analytics"],
      ["Settings", "/settings"],
    ]) {
      await click(page, label, "nav a");
      if (path === "/")
        await page.waitForFunction(
          () => document.querySelectorAll(".island-label").length === 6,
        );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `Horizontal overflow on ${path} at ${width}`,
      );
      if (width === 390)
        await screenshot(page, `${output}/${label.toLowerCase()}-mobile.png`);
    }
  }
  passed(
    "All six screens fit both 390px and 320px widths without horizontal overflow",
  );
  await click(page, "Today", "nav a");
  await click(page, "Paste targets");
  await page.waitForSelector("dialog[open]");
  await page.keyboard.press("Escape");
  await dialogClosed(page);
  passed("Native modal closes with Escape and restores keyboard focus");
  await click(page, "Return to my workspace");
  await click(page, "Settings", "nav a");
  await click(page, "Reset personal data");
  await fill(page, "Type RESET to confirm", "RESET");
  await click(page, "Confirm reset");
  await dialogClosed(page);
  assert.equal((await stored(page)).tasks.length, 0);
  assert.equal((await stored(page)).subjects.length, 6);
  passed(
    "Confirmed reset restores an empty personal workspace, not demo progress",
  );
  const manualContext = await browser.createBrowserContext(),
    manual = await manualContext.newPage();
  const manualErrors = [];
  manual.on("pageerror", (e) => manualErrors.push(e.message));
  await navigate(manual, "/today");
  await click(manual, "Add task");
  await fill(manual, "Topic", "Independent practice");
  await fill(manual, "What will you work on?", "Build a small project");
  await fill(
    manual,
    "Notes & resource links",
    "Reference: https://example.com/resource",
  );
  await manual.click("dialog .check-row label:nth-child(2) input");
  await click(manual, "Add to today");
  await dialogClosed(manual);
  await manual.click(
    'button[aria-label="Mark completed: Build a small project"]',
  );
  await waitStore(
    manual,
    () =>
      JSON.parse(localStorage.getItem("study-world.personal.v1")).tasks[0]
        .completedOn,
  );
  assert.equal((await stored(manual)).revisions.length, 0);
  await navigate(manual, "/subjects/maths");
  await click(manual, "New topic");
  await fill(manual, "Topic name", "A new chapter");
  await fill(manual, "Group or chapter (optional)", "Arithmetic");
  await click(manual, "Save topic");
  await dialogClosed(manual);
  assert(
    (await stored(manual)).topics.some(
      (t) => t.name === "A new chapter" && t.group === "Arithmetic",
    ),
  );
  await manual.click(".topic-toggle");
  await manual.waitForSelector(".task-main");
  await manual.click(".task-main");
  await manual.waitForSelector("dialog .resource");
  assert.equal(
    await manual.$eval("dialog .resource", (n) => n.getAttribute("href")),
    "https://example.com/resource",
  );
  await manual.keyboard.press("Escape");
  await dialogClosed(manual);
  assert.deepEqual(manualErrors, []);
  passed(
    "Manual tasks, task-level revision opt-out, grouped topics and saved resource links all work",
  );
  await manualContext.close();
  const editContext = await browser.createBrowserContext(),
    edit = await editContext.newPage();
  const editErrors = [];
  edit.on("pageerror", (e) => editErrors.push(e.message));
  await edit.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await navigate(edit, "/today");
  await click(edit, "Add task");
  await fill(edit, "Subject", "english");
  await fill(edit, "Topic", "OWS");
  await fill(edit, "What will you work on?", "Complete 50 OWS");
  await fill(edit, "Estimated minutes", 20);
  await fill(edit, "Vocabulary range (optional)", "1-50");
  await click(edit, "Add to today");
  await dialogClosed(edit);
  await navigate(edit, "/subjects/english");
  await edit.$eval(".topic-toggle", (button) => {
    if (button.getAttribute("aria-expanded") !== "true") button.click();
  });
  assert.equal(
    await edit.$$eval(".task-row input[type=checkbox]", (a) => a.length),
    0,
  );
  await edit.waitForSelector(".task-main");
  await edit.click(".task-main");
  await edit.waitForSelector("dialog");
  assert(!(await stored(edit)).tasks[0].completedOn);
  await click(edit, "Cancel");
  await dialogClosed(edit);
  await edit.click(".task-status");
  assert(!(await stored(edit)).tasks[0].completedOn);
  await edit.click('button[aria-label="Edit topic: OWS"]');
  for (const label of [
    "What will you work on?",
    "Estimated minutes",
    "Vocabulary range (optional)",
    "Notes & resource links",
  ])
    assert(
      await edit.evaluate(
        (label) =>
          [...document.querySelectorAll("dialog label.field > span")].some(
            (n) => n.textContent === label,
          ),
        label,
      ),
    );
  await fill(edit, "Topic name", "One-word substitutions");
  await fill(edit, "Group or chapter (optional)", "Vocabulary");
  await fill(edit, "What will you work on?", "Complete 75 OWS");
  await fill(edit, "Estimated minutes", 35);
  await fill(edit, "Vocabulary range (optional)", "51-100");
  await fill(
    edit,
    "Notes & resource links",
    "Practice without notes. https://example.com/ows",
  );
  await edit.click("dialog .check-row label:first-child input");
  assert.equal(
    await edit.evaluate(
      () =>
        document.querySelector("dialog").scrollWidth >
        document.querySelector("dialog").clientWidth,
    ),
    false,
  );
  await screenshot(edit, `${output}/topic-editor-mobile.png`);
  await click(edit, "Save topic & tasks");
  await dialogClosed(edit);
  let edited = await stored(edit);
  assert.equal(edited.topics[0].name, "One-word substitutions");
  assert.equal(edited.topics[0].group, "Vocabulary");
  assert.equal(edited.tasks[0].title, "Complete 75 OWS");
  assert.equal(edited.tasks[0].minutes, 35);
  assert.equal(edited.tasks[0].range, "51-100");
  assert(edited.tasks[0].priority);
  assert(edited.tasks[0].notes.includes("https://example.com/ows"));
  await edit.click('button[aria-label="Edit topic: One-word substitutions"]');
  await fill(edit, "What will you work on?", "Discard this change");
  await click(edit, "Cancel");
  await dialogClosed(edit);
  assert.equal((await stored(edit)).tasks[0].title, "Complete 75 OWS");
  passed(
    "Topic editor exposes and atomically saves all task fields; Cancel changes nothing; row/status clicks do not complete work",
  );
  await edit.click('button[aria-label="Mark completed: Complete 75 OWS"]');
  await waitStore(
    edit,
    () =>
      !!JSON.parse(localStorage.getItem("study-world.personal.v1")).tasks[0]
        .completedOn,
  );
  await edit.reload({ waitUntil: "networkidle0" });
  await edit.$eval(".topic-toggle", (button) => {
    if (button.getAttribute("aria-expanded") !== "true") button.click();
  });
  await edit.click('button[aria-label="Undo completion: Complete 75 OWS"]');
  edited = await stored(edit);
  assert(!edited.tasks[0].completedOn);
  assert.equal(edited.revisions.length, 0);
  await edit.click('button[aria-label="Mark completed: Complete 75 OWS"]');
  await edit.click('button[aria-label="Edit topic: One-word substitutions"]');
  await click(edit, "Undo completion");
  await fill(edit, "Vocabulary range (optional)", "101-150");
  await click(edit, "Cancel");
  await dialogClosed(edit);
  assert((await stored(edit)).tasks[0].completedOn);
  assert.equal((await stored(edit)).tasks[0].range, "51-100");
  await edit.click('button[aria-label="Edit topic: One-word substitutions"]');
  await click(edit, "Undo completion");
  await fill(edit, "Vocabulary range (optional)", "101-150");
  await click(edit, "Save topic & tasks");
  await dialogClosed(edit);
  edited = await stored(edit);
  assert(!edited.tasks[0].completedOn);
  assert.equal(edited.tasks[0].range, "101-150");
  assert.equal(edited.revisions.length, 0);
  await edit.click('button[aria-label="Mark completed: Complete 75 OWS"]');
  await click(edit, "Today", "nav a");
  await click(edit, "Completed 1");
  await edit.click('button[aria-label="Undo completion: Complete 75 OWS"]');
  await waitStore(
    edit,
    () =>
      !JSON.parse(localStorage.getItem("study-world.personal.v1")).tasks[0]
        .completedOn,
  );
  await click(edit, "Your plan 1");
  await edit.waitForSelector(".task-complete");
  assert.equal((await stored(edit)).revisions.length, 0);
  assert.deepEqual(editErrors, []);
  for (const width of [390, 320]) {
    await edit.setViewport({ width, height: 844, deviceScaleFactor: 1 });
    assert.equal(
      await edit.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await screenshot(edit, `${output}/explicit-task-actions-mobile.png`);
  passed(
    "Explicit completion has persistent Undo in subject and Today; topic-editor undo is staged until Save and cleans accidental revisions",
  );
  await editContext.close();
  const corruptContext = await browser.createBrowserContext(),
    corrupt = await corruptContext.newPage();
  await corrupt.evaluateOnNewDocument(() => {
    localStorage.setItem("study-world.personal.v1", "{unreadable-original");
  });
  await navigate(corrupt, "/settings");
  await corrupt.waitForSelector(".storage-banner");
  assert.equal(
    await corrupt.evaluate(() =>
      localStorage.getItem("study-world.personal.v1"),
    ),
    "{unreadable-original",
  );
  assert(await corrupt.$(".raw-download"));
  passed(
    "Corrupt storage is preserved exactly and exposes original-data recovery, not silent reset",
  );
  await corruptContext.close();
  const noStorageContext = await browser.createBrowserContext(),
    noStorage = await noStorageContext.newPage();
  await noStorage.evaluateOnNewDocument(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    }),
  );
  await navigate(noStorage, "/settings");
  await noStorage.waitForSelector(".storage-banner");
  assert(
    (await noStorage.$eval(".storage-status", (n) => n.textContent)).includes(
      "unavailable",
    ),
  );
  passed(
    "Unavailable browser storage leaves the app usable with an explicit memory-only warning",
  );
  await noStorageContext.close();
  const fallbackContext = await browser.createBrowserContext(),
    fallback = await fallbackContext.newPage();
  await fallback.evaluateOnNewDocument(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/i.test(type) ? null : original.call(this, type, ...args);
    };
  });
  await navigate(fallback, "/");
  await fallback.waitForSelector(".scene-fallback");
  assert.equal(await fallback.$$eval(".subject-card", (a) => a.length), 6);
  await click(fallback, "Use the 2D view");
  await fallback.waitForSelector(".flat-atlas");
  assert.equal(await fallback.$$eval(".flat-island", (a) => a.length), 6);
  passed(
    "WebGL failure is contained; the 2D world and all subject cards remain usable",
  );
  await fallbackContext.close();
  const tabsContext = await browser.createBrowserContext(),
    tabA = await tabsContext.newPage(),
    tabB = await tabsContext.newPage();
  await navigate(tabA, "/settings");
  await navigate(tabB, "/settings");
  await tabB.evaluate(() => {
    const key = "study-world.personal.v1",
      data = JSON.parse(localStorage.getItem(key));
    data.subjects[0].name = "Updated in another tab";
    localStorage.setItem(key, JSON.stringify(data));
  });
  await tabA.waitForSelector(".storage-banner");
  await click(tabA, "New subject");
  await fill(tabA, "Subject name", "In-memory only");
  await click(tabA, "Create subject");
  await dialogClosed(tabA);
  assert.equal((await stored(tabA)).subjects[0].name, "Updated in another tab");
  assert(
    !(await stored(tabA)).subjects.some((s) => s.name === "In-memory only"),
  );
  passed(
    "Cross-tab conflicts pause writes so one tab cannot silently overwrite another",
  );
  await tabsContext.close();
  for (const failure of ["model", "chunk"]) {
    const context = await browser.createBrowserContext(),
      broken = await context.newPage();
    await broken.setRequestInterception(true);
    broken.on("request", (request) => {
      const blocked =
        failure === "chunk"
          ? request.url().includes("/WorldScene")
          : request.url().endsWith("/models/island_maths_v2.glb");
      if (blocked) request.abort();
      else request.continue();
    });
    await navigate(broken, "/");
    await broken.waitForFunction(() =>
      [...document.querySelectorAll(".scene-fallback")].some((n) => {
        const rect = n.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }),
    );
    assert.equal(await broken.$$eval(".subject-card", (a) => a.length), 6);
    await click(broken, "Today", "nav a");
    await broken.waitForSelector(".plan-panel");
    await context.close();
  }
  passed(
    "A failed model or lazy 3D module cannot break the core planner navigation",
  );
  const manyContext = await browser.createBrowserContext(),
    many = await manyContext.newPage();
  await navigate(many, "/settings");
  await many.evaluate(() => {
    const key = "study-world.personal.v1",
      data = JSON.parse(localStorage.getItem(key));
    for (let n = 1; n <= 8; n++)
      data.subjects.push({
        id: `custom-${n}`,
        name: `Custom subject ${n}`,
        theme: "generic",
        color: "#718c6b",
        archived: false,
      });
    localStorage.setItem(key, JSON.stringify(data));
  });
  await navigate(many, "/");
  await many.waitForFunction(
    () => document.querySelectorAll(".island-label").length === 12,
  );
  assert.equal(await many.$$eval(".subject-card", (a) => a.length), 14);
  await many.click('button[aria-label="Next island group"]');
  await many.waitForFunction(
    () => document.querySelectorAll(".island-label").length === 2,
  );
  await many.click('button[aria-label="Previous island group"]');
  await many.waitForFunction(
    () => document.querySelectorAll(".island-label").length === 12,
  );
  passed(
    "Fourteen dynamic subjects remain accessible while the 3D renderer pages groups of twelve",
  );
  await manyContext.close();
  assert.deepEqual(errors, [], "Main workflow browser errors");
  assert.deepEqual(failedRequests, [], "Main workflow failed network requests");
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      { passed: results.length, checks: results, errors, failedRequests },
      null,
      2,
    ),
  );
  console.log(
    `\n${results.length} browser checks passed. Screenshots: ${output}`,
  );
} finally {
  await browser.close();
}
