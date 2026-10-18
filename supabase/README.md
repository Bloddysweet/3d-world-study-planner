# Supabase accounts — 18 October 2026

## Remote setup already completed

User-authorized setup was applied through the Supabase connector to **3d-world-study-planner**, reference `bmgccobqrzeywefydyif`. The other project in the account was not modified. No real user accounts or workspace rows were created as tests.

- `setup-study-workspaces.sql` records the applied `create_private_study_workspaces` migration. **Do not run it again** on the existing project.
- `public.study_workspaces`: one JSON-object workspace per auth user, positive revision counter, server-managed revision increments/timestamps; account deletion cascades to that account's row.
- RLS enabled. Authenticated users have an owner-only USING and WITH CHECK policy (`auth.uid() = user_id`). Public/anonymous table grants revoked.
- Read-back checks confirmed RLS, anonymous SELECT/INSERT denial, authenticated-owner policy, update trigger and initially zero workspace rows. These are configuration checks, not real two-user endpoint certification.
- Auth site URL: `https://studyworld-i2ap.onrender.com`.
- Exact redirect allowlist: that root URL, `/auth/callback`, `/reset-password` on the same origin; no wildcard/localhost redirects were added.
- Email/password and signup enabled; email confirmation required; existing refresh-token rotation retained. Google login was not configured.

## App integration now implemented locally

- `src/auth`: optional Supabase client; login/signup/logout; confirmation callback; request/reset-password UI; account/import/recovery panel in Settings. Local mode remains usable without a configured project.
- Set **VITE_SUPABASE_URL** and **VITE_SUPABASE_PUBLISHABLE_KEY** in the build environment. The user reports these are already set in Render. Rebuild is required when either changes. Only publishable/legacy anon keys are accepted. Vite rejects a mistaken secret/service-role key before bundling; no private key belongs in browser variables.
- PKCE email links should be opened in the browser where requested. Signup never silently uploads guest/demo records. The development preview shell does not create a competing auth client; only its app iframe does.
- The whole study UI remounts on account-identity changes, clearing prior-account forms and dialogs. Auth token refresh for the same identity does not reset the workspace.
- `CloudWorkspace` validates cloud/cache data; coalesces and serializes saves; updates with an owner/revision filter; treats duplicate first inserts or empty CAS updates as conflicts. Its generation and abort guards ignore stale responses after account disposal/StrictMode effect cleanup.
- Cloud load/autosave plus manual check, online and window-focus checks. This is **not realtime collaborative merging**. Conflicts pause writes until explicit selection; the UI initiates backup downloads before intentional cloud/local replacement.
- Local browser data and demo data stay in their original separate keys. Account clean caches are namespaced by user ID. Unsynced copies use independent per-tab draft keys, so another tab's clean save cannot erase them. Interrupted/closed-tab drafts can be reviewed/downloaded/restored in Settings → Account. Account caches are not encrypted; on shared devices export needed work, sign out, then clear site data.
- Corrupt recovery copies are preserved; automatic writes are blocked until recovery. Storage failures surface warnings and keep the in-memory copy. Export before closing when storage is unavailable.
- Settings drafts survive unchanged background cloud refreshes. Demo edits do not enter cloud saves. A new account gets no database row until an explicit edit/import.

## Remaining deployment/user setup

The live app has **not** received these files yet. Apply `deliverables/study-world-login-cloud-update.zip` manually, review its replacement files, let CI pass, and deploy from the intended Render branch. It includes the prior compact-label/mobile performance changes as well. No build output, models, node_modules, `.env` files or keys are in the archive. The SQL file is documentation only: no migration rerun is needed.

No custom SMTP was configured by this update; none was present at the last connector check. Public confirmation/reset email delivery still needs an appropriate provider and real delivery tests. Do not turn off email confirmation to work around delivery problems. Built-in email sending may be restricted or rate limited. Start by testing your own address, and check the Auth logs/provider setup if mail does not arrive.

The existing AI endpoint's private access mechanism is unchanged. Account login does not automatically authorize that endpoint or expose the OpenRouter key.

## Verification

- Strict typecheck and production builds passed; 206 tests across 20 files passed; production dependency audit reported zero vulnerabilities. Two upstream Zod annotation warnings remain non-blocking.
- 14 focused account browser groups passed against both the dev iframe and the actual Express production app, using an intercepted **fake** Supabase service. Includes invalid login, account isolation/reload, guest import, autosave, conflict selection, offline recovery, demo exclusion, first insertion, email requests, PKCE recovery exchange and 320/390/430 form widths. No browser page errors or live Supabase requests. Reports: `.cache/accounts/browser-report.json` and `browser-report-production.json`.
- 23 production app regression groups, 7 mobile-world groups, 9 dragon-pair groups and 5 shared-header groups passed after integration. Header checks cover seven pages × 14 widths from 320–1800. An initial concurrent header run timed out; the standalone run with a 60-second navigation timeout passed all unchanged layout assertions.
- A synthetic privileged-key build was correctly rejected before asset generation.
- Real signup/confirmation delivery, reset emails and cross-device/two-real-account RLS tests must still be performed on the deployed site. Mock tests are not that certification. Physical-device FPS/Safari/Firefox certification is also not claimed.

### Reproduce optional browser tests

Install root and optional tooling with `npm ci --include=dev` and `npm --prefix design/model-review ci`.

For dev account tests, start Vite on 5174 with a fake public configuration:

```sh
VITE_SUPABASE_URL=https://study-world-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fake_browser_test_key npm run dev -- --port 5174 --strictPort
# In another terminal:
npm run test:accounts:browser
```

The script intercepts that exact mock host and refuses a different Supabase host. For production tests, build with that same fake configuration into a non-hidden test output such as `dist/account-checks`, serve it using `createProductionApp`, and set `ACCOUNT_TEST_URL` to that local server. Do not use a real Supabase endpoint for the mocked suite. Never deploy the mock-configured build; Render must build fresh from source with its real public environment settings.
