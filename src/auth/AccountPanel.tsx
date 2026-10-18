import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { cloudConfigurationError, supabase } from "./client";
import { useApp } from "../data/AppProvider";
import { browserRepository, download } from "../data/repository";
import { accountStorageKey, cacheSchema } from "../data/cloud-workspace";
import type { AppData } from "../domain/model";
const backup = (data: AppData, label = "workspace") =>
  download(
    JSON.stringify(data, null, 2),
    `study-world-${label}-${Date.now()}.json`,
  );
function recoveryCopies(userId: string) {
  const copies: { key: string; data: AppData; savedAt?: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(`${accountStorageKey(userId)}.draft.`)) continue;
      try {
        const parsed = cacheSchema.safeParse(
          JSON.parse(localStorage.getItem(key)!),
        );
        if (parsed.success && parsed.data.dirty)
          copies.push({
            key,
            data: parsed.data.data,
            savedAt: parsed.data.savedAt,
          });
      } catch {
        /* unreadable copies are not overwritten */
      }
    }
  } catch {
    /* storage unavailable */
  }
  return copies.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
}
export function AccountPanel() {
  const auth = useAuth(),
    app = useApp();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const cloud = app.cloud;
  const working =
    busy || cloud?.phase === "saving" || cloud?.phase === "loading";
  const canReplace =
    !app.demo &&
    cloud &&
    ["saved", "pending"].includes(cloud.phase) &&
    !cloud.raw;
  const copies = auth.user ? recoveryCopies(auth.user.id) : [];
  function replaceWith(value: AppData, label: string) {
    if (
      !canReplace ||
      !confirm(
        `${label}: ${value.topics.length} topics and ${value.tasks.length} tasks. This REPLACES the current account workspace, not a merge. A backup download of the current copy will start first. Continue?`,
      )
    )
      return;
    backup(app.data, "before-import");
    app.replace(value);
    app.notify(
      "Chosen copy imported. Watch the cloud save status before closing.",
    );
  }
  return (
    <section
      id="account"
      className="panel account-panel"
      aria-labelledby="account-heading"
    >
      <h2 id="account-heading">Account & cloud saving</h2>
      {!auth.user ? (
        <>
          <p>
            Your current progress stays in this browser. Sign in to keep a
            separate private cloud workspace.
          </p>
          <Link className="btn primary" to="/login">
            Sign in / Create account
          </Link>
          {!supabase && (
            <p className="small muted">{cloudConfigurationError}</p>
          )}
        </>
      ) : (
        <>
          <p className="account-email">
            Signed in as <strong>{auth.user.email}</strong>
          </p>
          <p data-cloud-phase={cloud?.phase} role="status">
            {cloud?.message}
          </p>
          {cloud?.cacheWarning && (
            <p className="callout amber">
              Local recovery storage is unavailable or unreadable. Export your
              copy before closing.
            </p>
          )}
          {app.demo && (
            <p className="callout amber">
              Demo data stays separate and is never uploaded. Return to your
              account workspace to import or resolve cloud copies.
            </p>
          )}
          <div className="account-actions">
            <button className="btn" disabled={working} onClick={app.checkCloud}>
              Check cloud / Retry
            </button>
            <button
              className="btn"
              onClick={() => backup(app.data, app.demo ? "demo" : "account")}
            >
              Download this copy
            </button>
            {cloud?.raw && (
              <button
                className="btn"
                onClick={() =>
                  download(
                    cloud.raw!,
                    `study-world-unreadable-recovery-${Date.now()}.json`,
                  )
                }
              >
                Download unreadable recovery
              </button>
            )}
            <button
              className="btn"
              disabled={working || app.demo}
              onClick={() => {
                if (
                  !confirm(
                    "Load the latest cloud version? This replaces this tab’s account copy. A backup download will start first. Other tabs’ unsaved recovery copies will not be deleted.",
                  )
                )
                  return;
                if (cloud?.raw)
                  download(
                    cloud.raw,
                    `study-world-unreadable-recovery-${Date.now()}.json`,
                  );
                else backup(app.data, "before-cloud-reload");
                app.resolveCloud("cloud");
              }}
            >
              Load cloud version
            </button>
            {cloud?.phase === "conflict" && (
              <button
                className="btn"
                disabled={working || app.demo || !!cloud.raw}
                onClick={() => {
                  if (
                    !confirm(
                      "Save THIS tab’s copy instead of the latest cloud version? This is a replacement, not a merge. A backup download of the cloud version will start first. Continue?",
                    )
                  )
                    return;
                  app.resolveCloud("local", (value) =>
                    backup(value, "cloud-before-replacement"),
                  );
                }}
              >
                Keep this copy instead
              </button>
            )}
          </div>
          <div className="account-actions">
            <button
              className="btn primary"
              disabled={!canReplace || working}
              onClick={() => {
                const local = browserRepository().load(false);
                if (!["ready", "empty"].includes(local.status)) {
                  setError(
                    "The browser’s local workspace is unreadable/unavailable. Export its original copy in local mode first.",
                  );
                  return;
                }
                replaceWith(local.data, "Import this browser’s local progress");
              }}
            >
              Import this browser’s progress
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                if (
                  cloud?.dirty &&
                  !confirm(
                    "There are unsynced account edits. A recovery copy may be available on this browser, but download a backup first if needed. Sign out anyway?",
                  )
                )
                  return;
                setBusy(true);
                setError("");
                try {
                  const result = await supabase!.auth.signOut({
                    scope: "local",
                  });
                  if (result.error) throw result.error;
                } catch {
                  setError(
                    "Sign out could not finish. Check your connection and try again.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Sign out
            </button>
          </div>
          {copies.length > 0 && (
            <details className="account-recovery">
              <summary>
                Unsynced recovery copies on this browser ({copies.length})
              </summary>
              <p className="small muted">
                Copies from interrupted saves or other tabs. Never merged
                automatically. Export before replacing or removing one.
              </p>
              {copies.map((copy) => (
                <div className="account-recovery-row" key={copy.key}>
                  <span>
                    {copy.savedAt
                      ? new Date(copy.savedAt).toLocaleString()
                      : "Recovery copy"}{" "}
                    · {copy.data.tasks.length} tasks
                  </span>
                  <button
                    className="btn"
                    onClick={() => backup(copy.data, "recovery")}
                  >
                    Download
                  </button>
                  <button
                    className="btn"
                    disabled={!canReplace || working}
                    onClick={() =>
                      replaceWith(copy.data, "Restore recovery copy")
                    }
                  >
                    Restore
                  </button>
                </div>
              ))}
            </details>
          )}
          <p className="small muted">
            Cloud sync runs on changes, sign-in, reconnect and window focus.
            Same-account tabs have separate unsynced recovery copies. On shared
            devices, export any needed progress, sign out, and clear site data
            afterward.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="callout rose">
          {error}
        </p>
      )}
    </section>
  );
}
