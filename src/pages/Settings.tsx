import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Clock3,
  ClipboardCheck,
  Palette,
  Check,
  Download,
  Edit3,
  Plus,
  RotateCcw,
  RevisionIcon,
  ShieldCheck,
  Trash2,
  Upload,
} from "../components/icons";
import { AccountPanel } from "../auth/AccountPanel";
import { useAuth } from "../auth/AuthProvider";
import { useApp } from "../data/AppProvider";
import { deleteSubject } from "../domain/engine";
import { preferencesSchema } from "../domain/model";
import type { AppData, Subject } from "../domain/model";
import { download, readBackup } from "../data/repository";
import { SubjectForm } from "../components/forms";
import {
  Chip,
  ErrorText,
  Field,
  Heading,
  Modal,
  Page,
  SectionTitle,
  SubjectIcon,
  useDialog,
} from "../components/ui";
function DeleteSubjectForm({ subject }: { subject: Subject }) {
  const { update, notify } = useApp(),
    { close } = useDialog(),
    [typed, setTyped] = useState("");
  return (
    <Modal title="Permanently delete this subject?">
      <div className="modal-body">
        <div className="callout rose">
          This removes all of this subject’s topics, tasks, revisions and review
          history. Test records remain, but their deleted topic breakdowns are
          removed. This cannot be undone.
        </div>
        <Field label={`Type “${subject.name}” to confirm`}>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </Field>
        <p className="muted small">
          Archiving instead keeps your entire learning history.
        </p>
      </div>
      <div className="modal-footer">
        <button className="btn" onClick={close}>
          Cancel
        </button>
        <button
          className="btn danger"
          disabled={typed !== subject.name}
          onClick={() => {
            update((s) => deleteSubject(s, subject.id));
            notify("Subject and its learning history deleted.");
            close();
          }}
        >
          <Trash2 size={16} />
          Delete permanently
        </button>
      </div>
    </Modal>
  );
}
function ImportBackupForm({ backup }: { backup: AppData }) {
  const { demo, replace, notify } = useApp(),
    { close } = useDialog(),
    [confirmed, setConfirmed] = useState(false);
  return (
    <Modal title="Check this backup before importing">
      <div className="modal-body">
        <div className="callout amber">
          This replaces your entire {demo ? "demo" : "personal"} workspace—not a
          merge. Export your current data first if you want to keep it.
        </div>
        <div className="backup-summary">
          <span>
            <strong>{backup.subjects.length}</strong> subjects
          </span>
          <span>
            <strong>{backup.topics.length}</strong> topics
          </span>
          <span>
            <strong>{backup.tasks.length}</strong> tasks
          </span>
          <span>
            <strong>{backup.tests.length}</strong> tests
          </span>
        </div>
        <p className="muted">Schema v1 · structure and references validated.</p>
        <label className="recall-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I understand this will replace the current workspace.
        </label>
      </div>
      <div className="modal-footer">
        <button className="btn" onClick={close}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!confirmed}
          onClick={() => {
            replace(backup);
            notify("Backup imported.");
            close();
          }}
        >
          Replace with this backup
        </button>
      </div>
    </Modal>
  );
}
function ResetForm() {
  const { user } = useAuth();
  const { demo, reset, notify } = useApp(),
    { close } = useDialog(),
    [typed, setTyped] = useState("");
  return (
    <Modal
      title={demo ? "Restart the demo?" : "Start your personal world over?"}
    >
      <div className="modal-body">
        <p>
          {demo
            ? "Only the separate demo workspace will be reseeded. Your personal data stays untouched."
            : user
              ? "This clears your account’s cloud workspace after a successful sync, including study history. Other devices will see the reset when they refresh. Export a backup first."
              : "This permanently clears this browser’s personal tasks, topics, revision history, test results and custom subjects. The six editable starter subjects return."}
        </p>
        <p>Export a backup first if you need to keep your work.</p>
        <Field label="Type RESET to confirm">
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </Field>
      </div>
      <div className="modal-footer">
        <button className="btn" onClick={close}>
          Cancel
        </button>
        <button
          className="btn danger"
          disabled={typed !== "RESET"}
          onClick={() => {
            reset();
            notify(demo ? "Demo restarted." : "Personal workspace reset.");
            close();
          }}
        >
          Confirm reset
        </button>
      </div>
    </Modal>
  );
}
export function SettingsPage() {
  const { user } = useAuth();
  const {
      data,
      update,
      notify,
      demo,
      switchDemo,
      date,
      storageMessage,
      blocked,
      raw,
    } = useApp(),
    { open } = useDialog(),
    input = useRef<HTMLInputElement>(null);
  const [prefs, setPrefs] = useState(data.preferences),
    [gaps, setGaps] = useState(data.preferences.gaps.join(", ")),
    [error, setError] = useState(""),
    [backupError, setBackupError] = useState("");
  const [tab, setTab] = useState<
    "study" | "revision" | "tests" | "world" | "subjects" | "data"
  >("study");
  const previousPreferences = useRef(data.preferences);
  useEffect(() => {
    const previous = previousPreferences.current;
    previousPreferences.current = data.preferences;
    // A background cloud refresh must not erase an unsaved settings draft.
    setPrefs((current) =>
      JSON.stringify(current) === JSON.stringify(previous)
        ? data.preferences
        : current,
    );
    setGaps((current) =>
      current === previous.gaps.join(", ")
        ? data.preferences.gaps.join(", ")
        : current,
    );
  }, [data.preferences]);
  const draftGaps = gaps.split(",");
  return (
    <Page className="settings-page">
      <Heading
        title="Settings"
        description={
          user && !demo
            ? "Your study settings and private cloud workspace. Check sync status below."
            : "Your study time, revision rules, subjects and local browser data."
        }
        action={
          <button
            type="submit"
            form="study-preferences"
            className="btn primary"
          >
            <Check size={15} />
            Save preferences
          </button>
        }
      />
      <AccountPanel />
      <nav className="settings-tabs" aria-label="Settings sections">
        {(
          [
            ["study", "Study"],
            ["revision", "Revision"],
            ["tests", "Tests"],
            ["world", "World"],
            ["subjects", "Subjects"],
            ["data", "Your data"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? "active" : ""}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="settings-dashboard">
        <form
          className="settings-preferences"
          id="study-preferences"
          onSubmit={(event) => {
            event.preventDefault();
            const result = preferencesSchema.safeParse({
              ...prefs,
              gaps: gaps.split(",").map((value) => Number(value.trim())),
            });
            if (!result.success)
              return setError(
                "Use six gaps from 1–365 days, and three increasing thresholds between 0 and 100. Check the time limits too.",
              );
            update((s) => ({ ...s, preferences: result.data }));
            setError("");
            notify("Study preferences saved. Existing due dates kept.");
          }}
        >
          <section
            className="panel settings-section study-time-card"
            hidden={tab !== "study"}
          >
            <h2 className="settings-card-title">
              <span>
                <Clock3 size={19} />
              </span>
              Daily study time
            </h2>
            <div className="daily-budget-preview">
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((day) => (
                <div key={day}>
                  <span>{day}</span>
                  <i>
                    <b
                      style={{
                        width: `${Math.min(100, (prefs.dailyMinutes / 480) * 100)}%`,
                      }}
                    />
                  </i>
                  <strong>
                    {Math.floor(prefs.dailyMinutes / 60)}h{" "}
                    {prefs.dailyMinutes % 60}m
                  </strong>
                </div>
              ))}
            </div>
            <Field label="Daily study budget (minutes)">
              <input
                required
                type="number"
                min={15}
                max={1440}
                value={prefs.dailyMinutes}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    dailyMinutes: Number(e.target.value),
                  }))
                }
              />
            </Field>
            <p className="small muted">
              One daily budget applies to every day. Bars preview your draft
              budget estimate, not tracked study.
            </p>
            <Field label="Review estimate (minutes)">
              <input
                required
                type="number"
                min={1}
                max={240}
                value={prefs.revisionMinutes}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    revisionMinutes: Number(e.target.value),
                  }))
                }
              />
            </Field>
          </section>
          <section className="panel settings-section revision-settings-card" hidden={tab !== "revision"}>
            <h2 className="settings-card-title">
              <span>
                <RevisionIcon size={19} />
              </span>
              Revision schedule
            </h2>
            <p>
              Gap days after each actual recall. Transparent defaults—not a
              guaranteed best formula.
            </p>
            <div className="revision-gap-inputs">
              {Array.from({ length: 6 }, (_, i) => (
                <label key={i}>
                  <input
                    aria-label={`Gap before revision ${i + 1} (days)`}
                    required
                    type="number"
                    min={1}
                    max={365}
                    value={draftGaps[i]?.trim() ?? ""}
                    onChange={(e) => {
                      const next = [...draftGaps];
                      next[i] = e.target.value;
                      setGaps(next.join(", "));
                    }}
                  />
                  <span>step {i + 1}</span>
                </label>
              ))}
            </div>
            <Field label="Maintenance interval (days)">
              <input
                required
                type="number"
                min={1}
                max={365}
                value={prefs.maintenanceDays}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    maintenanceDays: Number(e.target.value),
                  }))
                }
              />
            </Field>
            <div className="rating-explainer">
              {[
                ["Forgot", "Back to step 1"],
                ["Hard", "Repeat step"],
                ["Good", "Next step"],
                ["Easy", "Advance two steps"],
              ].map(([rating, text], i) => (
                <div key={rating} className={`rating-guide-${i}`}>
                  <strong>{rating}</strong>
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setGaps("1, 2, 4, 7, 16, 30");
                setPrefs((p) => ({ ...p, maintenanceDays: 60 }));
              }}
            >
              Reset interval defaults
            </button>
            <p className="small muted">
              New learning restarts its combined topic/range schedule. Changes
              affect future ratings, not existing due dates.
            </p>
          </section>
          <section className="panel settings-section test-settings-card" hidden={tab !== "tests"}>
            <h2 className="settings-card-title">
              <span>
                <ClipboardCheck size={19} />
              </span>
              Tests
            </h2>
            <Field
              label="Revision exam interval (days)"
              hint="Default: 7 days. Applies to the next unsaved checkpoint; past exam dates and revision schedules stay unchanged."
            >
              <input
                required
                type="number"
                min={1}
                max={90}
                value={prefs.examIntervalDays ?? 7}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    examIntervalDays: Number(e.target.value),
                  }))
                }
              />
            </Field>
            {prefs.thresholds.map((value, i) => (
              <label className="threshold-setting" key={i}>
                <span>
                  <strong>{["Forgot", "Hard", "Good"][i]}</strong> if a topic
                  scores below
                </span>
                <div>
                  <input
                    aria-label={`${["Forgot to Hard", "Hard to Good", "Good to Easy"][i]} threshold`}
                    required
                    type="number"
                    min={1}
                    max={100}
                    value={value}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        thresholds: p.thresholds.map((n, index) =>
                          index === i ? Number(e.target.value) : n,
                        ) as [number, number, number],
                      }))
                    }
                  />
                  <span>%</span>
                </div>
              </label>
            ))}
            <p>
              Otherwise <strong>Easy</strong>. The boundaries must increase.
            </p>
            <div className="setting-rule">
              <span>Ready for a test after</span>
              <Chip>3 recalls per range</Chip>
            </div>
            <div className="callout soft small">
              Only actual topic scores move revision dates. An overall score is
              saved for analytics without changing schedules.
            </div>
          </section>
          <section className="panel settings-section world-settings-card" hidden={tab !== "world"}>
            <h2 className="settings-card-title">
              <span>
                <Palette size={19} />
              </span>
              World & motion
            </h2>
            <Field label="World display">
              <select
                value={prefs.worldMode}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    worldMode: e.target.value as "3d" | "2d",
                  }))
                }
              >
                <option value="3d">Interactive 3D world</option>
                <option value="2d">Lightweight 2D subject cards</option>
              </select>
            </Field>
            <p>
              Motion follows your device’s reduced-motion preference. The 3D
              view uses demand rendering and bounded resolution.
            </p>
            <div className="callout soft small">
              Learning progress follows actual completion, recalls and test
              results—not scene visits or clicks.
            </div>
            <h3>A separate demo workspace</h3>
            <p>Example data never replaces your personal world.</p>
            <button type="button" className="btn" onClick={switchDemo}>
              {demo
                ? "Return to my personal world"
                : "Explore the demo workspace"}
            </button>
            {demo && <Chip tone="amber">You are in the demo</Chip>}
            <ErrorText message={error} />
            <p className="small muted">
              Display and study changes apply after Save preferences.
            </p>
          </section>
        </form>
        <section
          className="panel settings-section subjects-settings"
          hidden={tab !== "subjects"}
        >
          <SectionTitle
            title="Subjects (islands)"
            action={
              <button
                className="btn primary"
                onClick={() => open(<SubjectForm />)}
              >
                <Plus size={16} />
                New subject
              </button>
            }
          >
            Rename, add or archive freely. Archived subjects keep their history
            and pause their plan.
          </SectionTitle>
          {data.subjects.map((subject) => (
            <div
              className={`manage-subject ${subject.archived ? "archived" : ""}`}
              key={subject.id}
            >
              <SubjectIcon subject={subject} size={19} />
              <div>
                <strong>{subject.name}</strong>
                <span>
                  {subject.archived
                    ? "Archived · history kept"
                    : `${data.topics.filter((t) => t.subjectId === subject.id).length} topics`}
                </span>
              </div>
              <button
                className="icon-btn"
                aria-label={`Edit subject: ${subject.name}`}
                onClick={() => open(<SubjectForm initial={subject} />)}
              >
                <Edit3 size={16} />
              </button>
              <button
                className="btn small-btn"
                onClick={() => {
                  if (
                    confirm(
                      subject.archived
                        ? `Restore ${subject.name} and resume its plan?`
                        : `Archive ${subject.name}? Tasks and reviews pause; all history stays.`,
                    )
                  ) {
                    update((s) => ({
                      ...s,
                      subjects: s.subjects.map((a) =>
                        a.id === subject.id
                          ? { ...a, archived: !a.archived }
                          : a,
                      ),
                    }));
                    notify(
                      subject.archived
                        ? "Subject restored."
                        : "Subject archived.",
                    );
                  }
                }}
              >
                <Archive size={14} />
                {subject.archived ? "Restore" : "Archive"}
              </button>
              <button
                className="icon-btn danger-text"
                aria-label={`Delete subject: ${subject.name}`}
                onClick={() => open(<DeleteSubjectForm subject={subject} />)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {!data.subjects.length && (
            <p className="muted">No subjects yet. Add as many as you need.</p>
          )}
        </section>
        <section
          className="panel settings-section"
          hidden={tab !== "data"}
        >
          <SectionTitle title="Your data" />
          <div className={`storage-status ${blocked ? "warning" : ""}`}>
            <ShieldCheck size={21} />
            <p>{storageMessage}</p>
          </div>
          <p className="muted small">
            {user && !demo
              ? "Account data syncs to Supabase when connected. Keep independent backups. Local recovery copies are stored on this device. "
              : "Local browser storage only. "}
            {user && !demo
              ? "Only successfully synced changes carry over to other devices. Unsynced edits need a recovery copy or backup."
              : "Clearing site data or using another device will not carry your work over. Export backups regularly."}
          </p>
          <div className="backup-actions">
            <button
              className="btn"
              onClick={() =>
                download(
                  JSON.stringify(data, null, 2),
                  `study-world-${demo ? "demo" : "personal"}-${date}.json`,
                )
              }
            >
              <Download size={16} />
              Export backup
            </button>
            <button className="btn" onClick={() => input.current?.click()}>
              <Upload size={16} />
              Import backup
            </button>
          </div>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Import JSON backup"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 15000000)
                return setBackupError("Choose a backup smaller than 15 MB.");
              try {
                const backup = readBackup(await file.text());
                setBackupError("");
                open(<ImportBackupForm backup={backup} />);
              } catch {
                setBackupError(
                  "This backup is invalid or from an unsupported version. Nothing was changed.",
                );
              }
            }}
          />
          {raw !== undefined && (
            <button
              className="btn danger-text raw-download"
              onClick={() =>
                download(
                  raw,
                  `study-world-unreadable-original-${date}.txt`,
                  "text/plain",
                )
              }
            >
              <Download size={16} />
              Download unreadable original
            </button>
          )}
          <ErrorText message={backupError} />
          <div className="data-reset-row">
            <button
              type="button"
              className="btn danger-text"
              onClick={() => open(<ResetForm />)}
            >
              <RotateCcw size={14} />
              {demo ? "Restart demo" : "Reset personal data"}
            </button>
            <small>Requires explicit confirmation.</small>
          </div>
        </section>
      </div>
      <footer className="settings-about">
        <ShieldCheck size={15} />
        Study World · local-first · schema v1 · optional private cloud accounts
      </footer>
    </Page>
  );
}
