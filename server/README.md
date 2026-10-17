# Private AI target import

The app stays local-first. **Paste targets** now defaults to an optional server-assisted OpenRouter reader, followed by editable review. The explicit **local manual reader (no AI)** still works without a key or network. Neither reader saves anything until confirmation.

## Private setup

Use Node 22.12+ and run commands from the repository root.

1. Copy `server/.env.example` to `server/.env.local` (file explorer is fine). This local file is ignored by Git. Never put a real key in chat, browser code, a `VITE_` variable, a screenshot or a committed file.
2. Privately edit the copy:
   - `OPENROUTER_API_KEY`: your OpenRouter key.
   - `AI_IMPORT_ACCESS_CODE`: a **different**, random code of at least 16 characters. This protects a publicly reachable preview from unauthorised use. Generate privately with the command in the example file; do not share its output in chat.
3. Start/restart `npm run dev`. The Vite development server mounts the private API itself; a second API process is unnecessary in development.
4. Open **Paste targets**, enter only the separate access code in its password field, and consent to sending the paste/catalogue externally. The OpenRouter key is **never** entered in the dialog.
5. Analyse, inspect the source evidence and editable subject/topic/resource relationships, fill missing study-time estimates, select one option per OR, and confirm. New subjects and possible duplicates require separate permission.

Configure before writing an unsaved paste: restarting a dev server can reload the page. AI errors and cancelling an analysis keep the paste in the open dialog; drafts/access codes are not persisted after the dialog is closed or the page reloads.

**Network requirement:** the server must be permitted to reach `https://openrouter.ai`. This Arena sandbox's outbound allowlist currently does not include that host. Configuring a key alone does not overcome that restriction; real requests need an environment with OpenRouter access. No real key, discovery call or inference has been verified here.

## Free-only behaviour and limits

- Discover the current model catalogue instead of hard-coding a supposedly permanent free model. Eligible IDs end in `:free` or are `openrouter/free`, explicitly price both input/output and all reported fees at zero, support response-format requests and have at least 32k context.
- Prefer structured-output support and larger context; try at most two eligible models. `OPENROUTER_FREE_MODELS` optionally prioritises eligible IDs, not paid models. This is capability-based selection, **not a measured accuracy ranking**.
- Every inference sends zero input/output maximum prices, requires the requested parameters and denies data-collection providers. No automatic paid fallback. These restrictions may leave no usable free provider; the safe result is an error, not relaxed privacy or paid routing.
- Free availability, provider compatibility and account quotas vary. Check the OpenRouter account's own settings/limits; process-local app limits are not an account-level billing guarantee.
- Default limits: 8 HTTP attempts/minute across this server, 2 active imports, 40 valid analysis attempts/UTC day, 20,000 paste characters, bounded catalogue/body size. Limits/cache reset on restart. One analysis can try two free candidates, so 40 imports is not a 40-provider-call quota. Discovery timeout is 10 seconds; each inference timeout is 25 seconds.
- Strict local validation rejects malformed/truncated output, foreign/stale IDs, fabricated source excerpts/URLs and unsupported duration estimates. Validation does **not** prove every semantic assignment correct. Always review. Mocked fixture tests are not real-model accuracy benchmarks.

## What leaves the browser / what is saved

Only the unchanged pasted text and active subject/topic catalogue go to the private API and OpenRouter. No stored task list, scores, test history or revision history is sent. Treat the pasted text and catalogue names as data being shared with an external provider; omit anything sensitive. Provider policies still apply; this is not an offline AI model or a guarantee of zero operational retention.

The access code goes only to this app's same-origin API, is not forwarded to OpenRouter and is held in dialog memory only. The API key stays server-side. The API uses no-store responses and does not log paste/key/provider response bodies.

Analysis only produces proposals. On confirmation, existing local update/storage logic saves tasks/topics and approved new subjects atomically. Resource names/URLs, optional grouping, quantity, difficulty, coverage and source context are retained in task notes; learning ranges use the existing task field. Shared fallback resources remain shared context in notes, not extra tasks. The storage schema and completion/revision/external-test mechanics are unchanged.

Examples from the supplied sample: **10 Multiply = 10 multiplication questions**, not minutes/sets; first 3 hours of a video is coverage, not an automatic study estimate; squares/cubes/tables stay separate; editorial OR comprehension stays one choose-one target; a Telegram PDF fallback is not a task. Missing minutes require the reviewer's estimate. External calculation mocks do not create scores or completed test records.

## Built app / deployment

The recommended production setup is now **one server**, not Vite preview:

```sh
npm ci --include=dev
npm run build
npm start
```

`npm start` serves only built `dist/` public files plus the private API on the same origin. It binds to `0.0.0.0`, honours Render's `PORT` (otherwise `AI_API_PORT`, otherwise 3001), supports direct app links and binary asset requests, and has a lightweight `/healthz` endpoint. It does not serve repository sources, env files or Git metadata. Vite's preview server remains optional for local inspection, not production hosting.

`render.yaml` supplies a Free Node Web Service blueprint: build `npm ci --include=dev && npm run build`, start `npm start`, health `/healthz`, and auto-deploy **after CI checks pass**. Enter `OPENROUTER_API_KEY` and a separate `AI_IMPORT_ACCESS_CODE` (16+ random ASCII characters) only in Render's Environment settings. Do not put values in the YAML, GitHub files/Actions secrets, browser code or chat. GitHub Actions needs no API secrets: `.github/workflows/ci.yml` runs typecheck, all tests, build and dependency audit on pushes/pull requests, using pinned action revisions.

When first connecting Render, explicitly select the branch containing these app files (`arena/6f4e1cae-3d-world-study-planner` in this session). Do not deploy the old default branch before these changes are merged into it. GitHub Actions/Render checks have been configured locally but have **not** run on those platforms or been pushed yet.

Render accounts, repository authorisation, blueprint acceptance, live free-provider availability and actual deployment must still be verified in the user's dashboard. The free service may sleep and restart; no keep-awake workaround is installed. All app import limits/cache reset on process restart. Do not add an AI key to a health monitor. Export/import browser backups when moving origins; deploying does not transfer or synchronise study data.

For another hosting platform, expose this server behind the same HTTPS origin and preserve the public Host or trusted forwarded-host header. A static-only host cannot run AI imports; manual reading still works. The separate `npm run ai:server` command remains available for API-only local testing (port 3001), but is unnecessary with `npm start` or `npm run dev`. The import access code protects a private single-user service, not multi-user accounts; distributed deployment needs proper authentication and shared rate-limit storage.

## Reproduce verification

```sh
npm run test:ai          # mocked provider + domain + local HTTP tests
npm run typecheck
npm test
npm run build
npm --prefix design/model-review ci --no-audit --no-fund
npm run test:ai:browser  # requires running dev server on 5173
```

The browser suite uses explicit mocked API responses and no real credentials/model. It exercises the real same-origin embedded app, editable review, confirmation, mobile resizing, cancellation, errors, duplicates and new subjects. Screenshots: `design/ai-import/review-desktop.png`, `review-mobile.png`; transient report: `.cache/ai-import/browser-report.json`.

A future real-model evaluation should run the actual user paste through currently eligible free candidates and compare subjects/topics, all ten targets, resource ownership, URLs, ranges, coverage and the OR choice against the expected structure in `tests/fixtures/study-targets.ts`. Its URLs are deliberately anonymised to avoid publishing private folder/invite identifiers; real input URLs must be preserved in real output. Record the actual returned model/date and discrepancies before selecting a preferred candidate; never treat the fixture itself as an inference result.
