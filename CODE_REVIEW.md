# Pre-push code review

**Date:** 17 October 2026\
**Result:** Issues found below were corrected. No remaining blocking issue was found in the reviewed scope. **Nothing has been pushed or deployed.** This is not a guarantee of zero bugs or an independent security audit.

## Findings and fixes

| Finding | Impact | Correction |
|---|---|---|
| Missing production website server/start command | Deployment blocker: the old standalone process served only the API; Vite preview was not a production solution | Added a single production service for built public assets, app deep links, private API and `/healthz`. `npm start` honours Render's `PORT` and binds to `0.0.0.0`. Runtime dependencies include its TypeScript runner. |
| Vulnerable test-tool dependencies | Dependency audit found moderate/critical advisories in the development test tree; the production tree initially audited clean | Updated Vitest to 4.1.12 and its dependency tree. Fresh installation, all tests and full audit passed. |
| Decoding HTTP chunks independently | Split multi-byte characters could corrupt a user's pasted text | Bound the raw byte buffers and decode UTF-8 once, after the complete request. Regression test splits every byte of Unicode text. |
| Oversized chunked bodies could lose their error response | Async-iterator termination could destroy the socket before HTTP 413 was sent | Added a bounded reader, early Content-Length rejection and non-buffering drain on overflow. Real HTTP tests cover known-length and chunked bodies, with zero provider calls. |
| Daily import limit checked before asynchronous body reading only | Two concurrent requests could exceed the remaining quota | Recheck/reserve the daily quota immediately before dispatch, without another await. Concurrent-body regression verifies exactly one dispatch when one import remains. |
| Video-coverage guard rejected a separate explicit study estimate | A valid “first 3 hours of video; study estimate 45 min” proposal could fail validation | Check each duration against its own coverage span; allow the separate estimate, reject using coverage as study minutes, including abbreviated/video-first examples. |
| Free-model pricing validation accepted blank price strings / ignored additional fees | Ambiguous model fees could pass an input/output-only zero-price check | Require nonblank zero-valued prompt/completion and all reported fee fields. Reject malformed cost reports. Zero-price routing, source validation and no paid fallback remain enforced. |
| User sample contained private resource identifiers | Publishing fixtures could expose a shared-folder identifier or group invitation | Anonymised all fixture resource URLs with reserved `resources.example` URLs, preserving paste structure, quantities, resources and alternatives. No actual user workspace data was modified. |
| Browser regression assumed the former default rule reader and old 2D markup | Automation failed although the current explicit fallback/atlas was usable | Explicitly select the no-AI reader, assert the actual 2D atlas/island count, and allow screenshot capture to be disabled for the software-WebGL interaction run. |

## Deployment and CI preparation

- `server/app.ts`, `server/production.ts`: serve **only** built `dist/` public files, never repository files. API errors use safe generic responses. Tests cover navigation, HEAD, asset MIME/cache, binary range requests, missing assets, private-file/traversal paths, API routing and health.
- `render.yaml`: Free Node Web Service, production start, lightweight health check and deployment after passing CI. Secret values are **not** in the file. Choose the branch containing this app when connecting Render.
- `.github/workflows/ci.yml`: tests, typecheck, build and dependency audit on pushes/PRs; read-only repository permissions and action revisions pinned to verified upstream v6 commit IDs. No OpenRouter key is required in CI.
- CI/Render configuration has not been executed on those platforms. Account/repository authorisation and an actual deployment still need checking in Render.

## Fresh verification

| Check | Result |
|---|---|
| Clean `npm ci` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | **182 tests / 17 files passed** |
| `npm run build` | Passed; only two non-blocking upstream Zod comment-annotation warnings |
| Full root `npm audit --audit-level=moderate` | **0 reported vulnerabilities** at review time |
| Optional `design/model-review` dependency audit | **0 reported vulnerabilities** at review time |
| Built-file secret-isolation check | Built using two obviously fake server-only sentinels; neither appeared in any of the 57 production files |
| Heuristic repository text scan | No matching real-key/token/private-key patterns detected; no `server/.env.local` was created and the path is Git-ignored |
| `npm run test:ai:browser` | **8 groups passed**, real embedded app with explicitly mocked AI responses, desktop and 320/390/430 phone review layouts |
| Production browser regression | **23 groups passed** against `npm start` on port 3001; no main-workflow browser errors or failed requests |
| `npm run test:male-assets` | Passed: matching male rig, animation/weights and regenerated original Aurel byte identity |
| `npm run test:sky-runtime-assets` | Passed: approved original rig/hash and runtime isolation |
| Actual production `/healthz`, `/api/targets/status` | Healthy; AI honestly reports unconfigured without credentials |
| `git diff --check` | Passed |

Production-browser command: `APP_URL=http://127.0.0.1:3001 APP_SCREENSHOTS=0 npm run test:browser`. The final interaction run suppresses expensive software-WebGL screenshots but retains all assertions, including 320/390 page overflow checks. Report: `.cache/app-check/results.json`; log: `.cache/production-browser-check-final.log`. An earlier full screenshot run stopped at the obsolete `.world-art` selector after 19 passing groups; this was corrected before the final complete pass. The first foreground invocation also exceeded the tool wait time; subsequent runs used a managed process and persisted logs.

Production browser checks include manual import and explicit confirmation, real completion/Undo/revisions, external test-score effects, dynamic subjects, demo isolation, backups and invalid imports, editing/cancellation, corrupt/blocked storage recovery, cross-tab conflicts, WebGL/optional-3D failures and 14-subject paging. AI browser checks additionally cover minimal request payload, missing estimates, OR selection, duplicates/new-subject permissions, cancellation and malformed/rate-limited responses without data loss. AI screenshot sources now use anonymised fixture URLs.

## Still requires a live check

- **No real OpenRouter key or inference was used.** This sandbox's outbound allowlist excludes OpenRouter. Enter the real key only in Render's private Environment settings, together with a separate random import access code; then verify model discovery and your actual sample in the live app.
- Mocked fixture success is **not proof of real-model extraction accuracy**. Free-model availability, provider privacy compatibility and quotas can prevent inference; there is no paid fallback. Review semantic assignments before confirming.
- Render Free may sleep/restart. App rate limits/cache are process-local and are not account-level billing controls or multi-user authentication. No artificial keep-awake requests were installed.
- Study records remain local to each browser/origin. Export/import a backup when moving to the hosted URL; deployment does not synchronise devices.
- No physical-device, Safari/Firefox, full animation-pose or always-on uptime certification. Older specialised World browser suites were not all rerun; the current app-wide browser suite and dragon asset audits passed.
