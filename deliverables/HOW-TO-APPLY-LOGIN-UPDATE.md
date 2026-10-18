# How to apply the login & cloud-saving update by hand

This is the step-by-step companion to **`deliverables/study-world-login-cloud-update.zip`** (same instructions as `MANUAL-UPDATE.txt`, kept here so the `APP_GUIDE.md` reference resolves). Use it for manual publication **without** a new Arena session.

Your Supabase database/login settings are already prepared, and the two public connection settings were added to Render. The remaining step is uploading the new website code.

**Use `study-world-login-cloud-update.zip` instead of any earlier ZIP.** It includes the smaller visible labels and mobile performance improvements too.

## What is in the ZIP

Application source for this update, at the archive root (no extra top-level folder):

- `src/` — includes `src/preview-frame.ts`, `src/auth/` (AuthPage, AuthProvider, AccountPanel) and `src/data/cloud-workspace.ts`
- `server/`, `supabase/`, `scripts/`, `tests/`, `.github/`
- `package.json`, `package-lock.json` (pins `@supabase/supabase-js`), `index.html`, `vite.config.ts`, `tsconfig.json`, `render.yaml`
- Guide files: `APP_GUIDE.md`, `APP_VERIFICATION.md`, `README.md`, `CODE_REVIEW.md`, `MANUAL-UPDATE.txt`

No keys, `.env` files, `node_modules`, build output, `public/` models or Blender assets are included. Render installs dependencies from `package-lock.json` and builds with its existing environment variables.

## Before uploading

1. On the browser where you currently study, open **Settings → Your data → Export backup** and keep the JSON file safe. Do not clear site storage. This update never automatically uploads or replaces your local progress.
2. If anything else changed the same code files since the previous update, compare them first instead of overwriting those edits.

## Upload through GitHub

1. Open the **3d-world-study-planner** repository on GitHub and select the **main** branch.
2. **Code → Add file → Upload files**.
3. From inside the extracted ZIP folder, drag in: `src`, `scripts`, `supabase`, `server`, `package.json`, `package-lock.json`, `vite.config.ts`, `APP_GUIDE.md`, `APP_VERIFICATION.md` (the rest is optional but harmless).
4. Confirm the paths land directly at **`src/auth/AuthPage.tsx`**, **`src/data/cloud-workspace.ts`** and **`src/preview-frame.ts`** — no extra `study-world-login-cloud-update/` prefix.
5. Commit (for example: *Add private accounts and cloud study saving*). Use a pull request if you prefer; merge only after its checks pass.

**Do not run `supabase/setup-study-workspaces.sql` again.** It only records the migration already applied to the database.

If you use GitHub Desktop instead: update/back up your checkout, copy the extracted files into its root preserving folder paths, review Changes, then commit and push through your usual deployment/PR workflow.

## Let Render deploy

- Keep the environment variables already added: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (both are now also listed in `render.yaml` as dashboard-set values).
- Keep OpenRouter/private environment variables unchanged. No secret/service-role key belongs in a `VITE_` variable — the build rejects one.
- Keep build command `npm ci --include=dev && npm run build` and start command `npm start`.
- When the update reaches Render's deployment branch, auto-deploy runs if enabled; otherwise use **Manual Deploy → Deploy latest commit**. Wait for **Live**, then reload the website. The source update, not just an environment rebuild, adds the login features.

## First live checks (still required)

1. Open `https://studyworld-i2ap.onrender.com/settings` → **Account & cloud saving** → **Sign in / Create account** → **Create an account**. Confirm the email from the same browser, then sign in.
2. If no email arrives, stop and report it without sharing credentials — public email delivery may still need provider setup. Do not disable email confirmation as a workaround.
3. On the original browser, use **Import this browser’s progress** to bring local work into the account (it is an explicit replacement with an automatic backup download, never a silent merge).
4. Sign in on a second device and check the workspace follows. A second account must not see the first account's records.
5. Test password-reset delivery, offline edit/reconnect, and briefly the 3D world on a real phone.

Verification limits: the automated suite (207 tests, strict TypeScript, production build) and the mock-Supabase browser groups were run here; real signup/reset emails, cross-device sync and two-real-account RLS were **not** exercised and must be checked live.
