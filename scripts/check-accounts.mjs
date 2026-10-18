// Mock-service browser verification. Never calls the user's Supabase project.
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
const baseURL = process.env.ACCOUNT_TEST_URL || "http://127.0.0.1:5174";
const checks = [],
  errors = [],
  calls = [];
const pass = (text) => {
  checks.push(text);
  console.log("PASS " + text);
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ids = {
  alice: "00000000-0000-4000-8000-000000000001",
  bob: "00000000-0000-4000-8000-000000000002",
};
const rows = new Map();
let offline = false,
  recoveryRequests = 0,
  passwordChanges = 0,
  signups = 0;
const user = (name) => ({
  id: ids[name],
  aud: "authenticated",
  role: "authenticated",
  email: `${name}@example.test`,
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: new Date().toISOString(),
});
const token = (name) =>
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ) +
  "." +
  Buffer.from(
    JSON.stringify({
      sub: ids[name],
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url") +
  ".fake_signature";
const session = (name) => ({
  access_token: token(name),
  refresh_token: `fake_refresh_${name}`,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: user(name),
});
let page;
try {
  page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => void d.accept());
  await page.setViewport({ width: 1200, height: 1000, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    void (async () => {
      const url = new URL(request.url());
      if (!url.hostname.endsWith(".supabase.co")) return request.continue();
      assert.equal(
        url.hostname,
        "study-world-test.supabase.co",
        "Do not call live Supabase during mocks",
      );
      const method = request.method(),
        headers = request.headers();
      const cors = {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
        "access-control-allow-headers":
          headers["access-control-request-headers"] || "*",
      };
      const respond = (body, status = 200) =>
        request.respond({
          status,
          contentType: "application/json",
          headers: cors,
          body: JSON.stringify(body),
        });
      if (method === "OPTIONS")
        return request.respond({ status: 204, headers: cors });
      calls.push({
        path: url.pathname,
        method,
        body: request.postData(),
        query: url.search,
      });
      if (offline)
        return respond({ message: "Simulated offline connection" }, 503);
      const body = JSON.parse(request.postData() || "{}");
      const bearer = headers.authorization?.replace(/^Bearer /i, "");
      let subject;
      try {
        subject = JSON.parse(
          Buffer.from(bearer.split(".")[1], "base64url").toString(),
        ).sub;
      } catch {}
      const name = Object.keys(ids).find((n) => ids[n] === subject) || "bob";
      if (url.pathname.endsWith("/token")) {
        const selected = body.refresh_token?.includes("alice")
          ? "alice"
          : body.email?.startsWith("alice")
            ? "alice"
            : "bob";
        if (body.password === "wrong-password")
          return respond(
            {
              error: "invalid_grant",
              error_description: "Invalid login credentials",
            },
            400,
          );
        return respond(session(selected));
      }
      if (url.pathname.endsWith("/signup")) {
        signups++;
        return respond({
          user: { ...user("bob"), email: body.email },
          session: null,
        });
      }
      if (url.pathname.endsWith("/recover")) {
        recoveryRequests++;
        assert(url.searchParams.get("redirect_to").endsWith("/reset-password"));
        return respond({});
      }
      if (url.pathname.endsWith("/logout")) return respond({});
      if (url.pathname.endsWith("/user")) {
        if (method === "PUT") passwordChanges++;
        return respond(user(name));
      }
      if (url.pathname === "/rest/v1/study_workspaces") {
        const owner =
          url.searchParams.get("user_id")?.replace(/^eq\./, "") || body.user_id;
        if (!subject || owner !== subject)
          return respond(
            { message: "RLS rejected mismatched owner", code: "42501" },
            403,
          );
        const previous = rows.get(owner);
        if (method === "GET") return respond(previous ? [previous] : []);
        if (method === "POST") {
          if (previous)
            return respond(
              { message: "Duplicate workspace", code: "23505" },
              409,
            );
          const row = { data: body.data, revision: 1 };
          rows.set(owner, row);
          return respond(row, 201);
        }
        if (method === "PATCH") {
          const expected = Number(
            url.searchParams.get("revision")?.replace(/^eq\./, ""),
          );
          if (!previous || expected !== previous.revision) return respond(null);
          const row = { data: body.data, revision: previous.revision + 1 };
          rows.set(owner, row);
          return respond(row);
        }
      }
      return respond({ message: "Unknown mock route" }, 404);
    })().catch(async (error) => {
      errors.push(error.message);
      try {
        await request.abort();
      } catch {}
    });
  });
  await page.goto(baseURL + "/settings", { waitUntil: "networkidle0" });
  const preview = await page.$("iframe");
  let frame = preview ? await preview.contentFrame() : page.mainFrame();
  await frame.waitForSelector(".account-panel");
  const base = JSON.parse(
    await frame.evaluate(() => localStorage.getItem("study-world.personal.v1")),
  );
  base.preferences.worldMode = "2d";
  base.preferences.dailyMinutes = 222;
  base.subjects[0].name = "Guest-only progress";
  const personal = JSON.stringify(base);
  const alice = structuredClone(base);
  alice.preferences.dailyMinutes = 100;
  alice.subjects[0].name = "Alice private subject";
  const bob = structuredClone(base);
  bob.preferences.dailyMinutes = 175;
  bob.subjects[0].name = "Bob private subject";
  rows.set(ids.alice, { data: alice, revision: 1 });
  rows.set(ids.bob, { data: bob, revision: 1 });
  await frame.evaluate(
    (value) => localStorage.setItem("study-world.personal.v1", value),
    personal,
  );
  const go = async (path) => {
    await frame.goto(baseURL + path, { waitUntil: "networkidle0" });
  };
  const button = async (text) => {
    const found = await frame.evaluate((text) => {
      const b = [...document.querySelectorAll("button")].find(
        (n) => n.textContent.trim() === text,
      );
      if (!b || b.disabled) return false;
      b.click();
      return true;
    }, text);
    assert(found, "Enabled button not found: " + text);
  };
  const phase = (state) =>
    frame.waitForSelector(`[data-cloud-phase="${state}"]`, { timeout: 20000 });
  const signIn = async (name) => {
    await go("/login");
    await frame.waitForSelector(".auth-fields input[type=email]");
    await frame.type(".auth-fields input[type=email]", name + "@example.test");
    await frame.type(
      ".auth-fields input[type=password]",
      "example-password-123",
    );
    await frame.click(".auth-fields button[type=submit]");
    await phase("saved");
    await frame.waitForFunction(
      (email) =>
        document.querySelector(".account-email")?.textContent.includes(email),
      {},
      name + "@example.test",
    );
  };
  const preference = async (value) => {
    const input = await frame.$("#study-preferences input[type=number]");
    await input.focus();
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await input.type(String(value));
    await frame.click('button[form="study-preferences"]');
  };
  const waitRemote = async (name, value) => {
    for (
      let i = 0;
      i < 70 && rows.get(ids[name])?.data.preferences.dailyMinutes !== value;
      i++
    )
      await delay(100);
    if (rows.get(ids[name])?.data.preferences.dailyMinutes !== value) {
      console.log(
        "DEBUG",
        JSON.stringify(
          {
            calls,
            ui: await frame.$eval(".settings-page", (n) => n.textContent),
            inputs: await frame.$$eval("#study-preferences input", (ns) =>
              ns.map((n) => ({ type: n.type, value: n.value })),
            ),
          },
          null,
          2,
        ),
      );
      await page.screenshot({ path: ".cache/accounts-failure.png" });
    }
    assert.equal(rows.get(ids[name])?.data.preferences.dailyMinutes, value);
    await phase("saved");
  };
  await go("/login");
  await frame.waitForSelector(".auth-fields input[type=email]");
  await frame.type(".auth-fields input[type=email]", "alice@example.test");
  await frame.type(".auth-fields input[type=password]", "wrong-password");
  await frame.click(".auth-fields button[type=submit]");
  await frame.waitForFunction(() =>
    document
      .querySelector(".auth-card [role=alert]")
      ?.textContent.includes("Invalid login"),
  );
  assert.equal(calls.filter((c) => c.path.startsWith("/rest/")).length, 0);
  pass("Invalid credentials do not open or write an account workspace");
  await signIn("alice");
  assert.equal(rows.get(ids.alice).data.preferences.dailyMinutes, 100);
  assert.equal(
    await frame.evaluate(() => localStorage.getItem("study-world.personal.v1")),
    personal,
  );
  assert(
    !calls.some(
      (c) =>
        c.path.startsWith("/rest/") && ["POST", "PATCH"].includes(c.method),
    ),
  );
  pass(
    "Login loads the account without automatically uploading guest or demo data",
  );
  await preference(125);
  await waitRemote("alice", 125);
  pass(
    "Preference edits autosave through owner-filtered revision-checked updates",
  );
  await button("Import this browser’s progress");
  await waitRemote("alice", 222);
  assert.equal(
    await frame.evaluate(() => localStorage.getItem("study-world.personal.v1")),
    personal,
  );
  pass(
    "Explicit browser import replaces only the account copy, with confirmation and backup download",
  );
  const writesBeforeDemo = calls.filter(
    (c) => ["POST", "PATCH"].includes(c.method) && c.path.startsWith("/rest/"),
  ).length;
  await button("Explore the demo workspace");
  await preference(365);
  await delay(900);
  assert.equal(rows.get(ids.alice).data.preferences.dailyMinutes, 222);
  assert.equal(
    calls.filter(
      (c) =>
        ["POST", "PATCH"].includes(c.method) && c.path.startsWith("/rest/"),
    ).length,
    writesBeforeDemo,
  );
  await frame.evaluate(() =>
    [...document.querySelectorAll(".demo-banner button")][0].click(),
  );
  await phase("saved");
  pass("Demo edits never enter the account database");
  const newer = structuredClone(rows.get(ids.alice));
  newer.revision++;
  newer.data.preferences.dailyMinutes = 333;
  rows.set(ids.alice, newer);
  await preference(444);
  await phase("conflict");
  assert.equal(rows.get(ids.alice).data.preferences.dailyMinutes, 333);
  assert(
    await frame.evaluate(() =>
      Object.keys(localStorage).some(
        (k) =>
          k.includes(".draft.") &&
          JSON.parse(localStorage.getItem(k)).data.preferences.dailyMinutes ===
            444,
      ),
    ),
  );
  await button("Keep this copy instead");
  await waitRemote("alice", 444);
  pass(
    "Conflicts preserve the cloud and local draft until explicit replacement against a fresh revision",
  );
  offline = true;
  await preference(555);
  await phase("offline");
  assert.equal(rows.get(ids.alice).data.preferences.dailyMinutes, 444);
  offline = false;
  await button("Check cloud / Retry");
  await waitRemote("alice", 555);
  pass("Failed saves keep per-tab recovery drafts and reconnect safely");
  await button("Sign out");
  await frame.waitForSelector('.account-panel a[href="/login"]');
  assert.equal(
    await frame.$eval("#study-preferences input[type=number]", (n) => n.value),
    "222",
  );
  assert(
    !(await frame.$eval(".account-panel", (n) => n.textContent)).includes(
      "alice@example.test",
    ),
  );
  await signIn("bob");
  assert.equal(
    await frame.$eval("#study-preferences input[type=number]", (n) => n.value),
    "175",
  );
  assert(
    !(await frame.$eval(".settings-page", (n) => n.textContent)).includes(
      "Alice private subject",
    ),
  );
  assert.equal(rows.get(ids.alice).data.preferences.dailyMinutes, 555);
  await go("/settings");
  await phase("saved");
  assert(
    (await frame.$eval(".account-email", (n) => n.textContent)).includes(
      "bob@example.test",
    ),
  );
  pass(
    "Logout restores local mode; another account and a reload never reuse the prior account workspace",
  );
  await go("/reset-password");
  await frame.waitForSelector(
    '.auth-fields input[autocomplete="new-password"]',
  );
  const passwords = await frame.$$(".auth-fields input[type=password]");
  await passwords[0].type("new-password-123");
  await passwords[1].type("new-password-123");
  await frame.click(".auth-fields button[type=submit]");
  await phase("saved");
  assert.equal(passwordChanges, 1);
  pass("Authenticated password update completes through the recovery route");
  await button("Sign out");
  await go("/login");
  await button("Create an account");
  await frame.type(".auth-fields input[type=email]", "new-user@example.test");
  await frame.type(".auth-fields input[type=password]", "example-password-123");
  await frame.click(".auth-fields button[type=submit]");
  await frame.waitForFunction(() =>
    document
      .querySelector(".auth-card [role=status]")
      ?.textContent.includes("Check your email"),
  );
  assert.equal(signups, 1);
  await button("Forgot password?");
  await frame.click(".auth-fields button[type=submit]");
  await frame.waitForFunction(() =>
    document
      .querySelector(".auth-card [role=status]")
      ?.textContent.includes("reset email"),
  );
  assert.equal(recoveryRequests, 1);
  pass(
    "Signup confirmation and password-reset requests show useful email-delivery guidance (mock mail only)",
  );
  for (const width of [320, 390, 430]) {
    if (preview)
      await page.select(
        'select[aria-label="Mobile preview width"]',
        String(width),
      );
    else await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
    await frame.waitForFunction((w) => innerWidth === w, {}, width);
    assert(
      await frame.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Account login must fit " + width,
    );
  }
  await mkdir(".cache/accounts", { recursive: true });
  await page.screenshot({ path: ".cache/accounts/login-mobile.png" });
  pass("Account forms fit 320/390/430 without horizontal page overflow");
  rows.delete(ids.bob);
  await signIn("bob");
  assert.equal(rows.has(ids.bob), false);
  await preference(155);
  await waitRemote("bob", 155);
  assert.equal(rows.get(ids.bob).revision, 1);
  pass(
    "An empty account creates its first private row only after an explicit study edit",
  );
  await button("Sign out");
  await go("/login");
  await button("Forgot password?");
  await frame.type(".auth-fields input[type=email]", "bob@example.test");
  await frame.click(".auth-fields button[type=submit]");
  await frame.waitForFunction(() =>
    document
      .querySelector(".auth-card [role=status]")
      ?.textContent.includes("reset email"),
  );
  await go("/reset-password?code=mock_recovery_code");
  await frame.waitForSelector(
    '.auth-fields input[autocomplete="new-password"]',
  );
  const recoveredPasswords = await frame.$$(
    ".auth-fields input[type=password]",
  );
  await recoveredPasswords[0].type("recovered-password-123");
  await recoveredPasswords[1].type("recovered-password-123");
  await frame.click(".auth-fields button[type=submit]");
  await phase("saved");
  assert.equal(
    calls.filter(
      (c) => c.path.endsWith("/token") && c.query.includes("grant_type=pkce"),
    ).length,
    1,
  );
  assert.equal(passwordChanges, 2);
  pass(
    "PKCE email callback exchanges once, opens password recovery and returns to the correct account",
  );
  assert.deepEqual(errors, []);
  pass("No browser page errors or live Supabase requests");
} finally {
  await mkdir(".cache/accounts", { recursive: true });
  await writeFile(
    `.cache/accounts/browser-report${process.env.ACCOUNT_TEST_URL ? "-production" : ""}.json`,
    JSON.stringify(
      { checks, errors, requests: calls.length, mocked: true },
      null,
      2,
    ),
  );
  await browser.close();
}
