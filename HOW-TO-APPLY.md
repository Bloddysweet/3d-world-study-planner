# How to apply this update

This package brings Study World up to date with: **sleep schedule tracking**
(Today), **study streaks**, **Settings tabs** (minimal scrolling), **empty
production workspaces** (no demo data), **login/signup fixes**, **AI paste
setup diagnostics**, and refreshed guides.

## 1. Update the code

If you use git: pull this branch/PR into your project. If you received a ZIP,
copy its contents over your project folder (it replaces/merges source files;
your `.env` and `node_modules` are untouched).

## 2. Install and build

```bash
npm ci --include=dev
npm run build
```

## 3. Render environment checklist (for the optional AI paste)

In the Render dashboard → your service → **Environment**, set:

| Name                    | Value                                             | Notes                    |
| ----------------------- | ------------------------------------------------- | ------------------------ |
| `OPENROUTER_API_KEY`    | your `sk-or-…` key                                | never shown to browsers  |
| `AI_IMPORT_ACCESS_CODE` | a private code **16+ characters**                 | typed into the paste box |
| `AI_IMPORT_DAILY_LIMIT` | `40`                                              | optional cap             |
| `VITE_SUPABASE_URL`     | your Supabase project URL                         | for cloud login          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your Supabase publishable (anon) key       | for cloud login          |

Generate an access code with:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

### Google sign-in (required once)

The login page has a **Continue with Google** button. To make it work, enable
the provider in Supabase once:

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth
   client ID** (type: Web application).
2. Add the authorised redirect URI:
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
3. Supabase Dashboard → **Authentication → Providers → Google** → paste the
   Client ID and Client Secret → **Enable**.
4. Supabase → **Authentication → URL Configuration** → add your site:
   - Site URL: `https://YOUR-SITE`
   - Redirect URLs: `https://YOUR-SITE/auth/callback`

Until the provider is enabled, the button shows the provider error instead of
redirecting. Email/password sign-in is unaffected.

### The three classic mistakes

1. Typing the **OpenRouter key** into the app's dialog — the dialog wants the
   **access code** only. The key never leaves the server.
2. An access code **shorter than 16 characters**.
3. Wrong variable names (`OPENAI_API_KEY` etc.). Use the exact names above.

### Verify

Open `https://YOUR-SITE/api/targets/status` — it must answer
`"configured": true`. If it says `false`, its `missing` array names exactly
which variables to set. The in-app paste dialog shows the same list under
"Private AI setup needed".

## 4. Confirm the update

1. Sign up with a new email → the confirmation message mentions the OTP code.
2. A new workspace starts **empty** ("Your world begins here") — example
   subjects live only in the opt-in demo sandbox.
3. Today → log last night's sleep and save a streak.
4. Settings → one screen per tab, minimal scrolling.

Sleep entries stay on your account/device like everything else: one entry per
morning, updated in place if you re-save the same day.
