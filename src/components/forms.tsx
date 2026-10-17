import { useState } from "react";
import { AiImportForm } from "./AiImportForm";
import { Check, Clock3, Plus, Sparkles, Trash2, RotateCcw } from "./icons";
import { useApp } from "../data/AppProvider";
import {
  addTasks,
  clone,
  ensureTopic,
  undoTaskCompletion,
} from "../domain/engine";
import type { TaskDraft } from "../domain/engine";
import { themes, today, uid } from "../domain/model";
import type { Subject, Task, Theme } from "../domain/model";
import { parseTargets } from "../domain/parser";
import type { Proposal } from "../domain/parser";
import { ErrorText, Field, Modal, useDialog } from "./ui";
export function SubjectForm({ initial }: { initial?: Subject }) {
  const { update, data, notify } = useApp(),
    { close } = useDialog();
  const [name, setName] = useState(initial?.name ?? ""),
    [color, setColor] = useState(initial?.color ?? "#718c6b"),
    [theme, setTheme] = useState<Theme>(initial?.theme ?? "generic"),
    [error, setError] = useState("");
  return (
    <Modal title={initial ? "Edit subject" : "A new island of possibility"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !name.trim() ||
            data.subjects.some(
              (s) =>
                s.id !== initial?.id &&
                s.name.trim().toLowerCase() === name.trim().toLowerCase(),
            )
          )
            return setError("Choose a unique subject name.");
          try {
            update((s) => {
              const next = clone(s),
                subject: Subject = {
                  id: initial?.id ?? uid(),
                  name: name.trim(),
                  color,
                  theme,
                  archived: initial?.archived ?? false,
                };
              if (initial)
                next.subjects[
                  next.subjects.findIndex((a) => a.id === initial.id)
                ] = subject;
              else next.subjects.push(subject);
              return next;
            });
            notify(initial ? "Subject updated." : "Your new subject is ready.");
            close();
          } catch {
            setError("Please check your subject details.");
          }
        }}
      >
        <div className="modal-body">
          <Field label="Subject name">
            <input
              autoFocus
              required
              maxLength={100}
              placeholder="e.g. Physics, Japanese, Design…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="form-grid">
            <Field label="Island theme">
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
              >
                {themes.map((t) => (
                  <option key={t} value={t}>
                    {t === "generic"
                      ? "Forest · any new subject"
                      : t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Subject colour">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </Field>
          </div>
          <p className="muted small">
            Subjects are not fixed to six. Each active subject gets its own
            island.
          </p>
          <ErrorText message={error} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn primary">
            <Plus size={16} />
            {initial ? "Save changes" : "Create subject"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function TaskFields({
  draft,
  onChange,
  completed,
  autoFocus = false,
}: {
  draft: TaskDraft;
  onChange: <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => void;
  completed: boolean;
  autoFocus?: boolean;
}) {
  return (
    <>
      <Field label="What will you work on?">
        <input
          autoFocus={autoFocus}
          required
          maxLength={500}
          value={draft.title}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="Solve 30 Percentage questions"
        />
      </Field>
      <div className="form-grid">
        <Field label="Estimated minutes">
          <input
            type="number"
            min={1}
            max={1440}
            required
            value={draft.minutes || ""}
            onChange={(e) => onChange("minutes", Number(e.target.value))}
          />
        </Field>
        <Field
          label="Vocabulary range (optional)"
          hint="Each range gets its own revision schedule."
        >
          <input
            maxLength={100}
            placeholder="e.g. 1-50"
            value={draft.range}
            disabled={completed}
            onChange={(e) => onChange("range", e.target.value)}
          />
        </Field>
      </div>
      <div className="check-row">
        <label>
          <input
            type="checkbox"
            checked={draft.priority}
            onChange={(e) => onChange("priority", e.target.checked)}
          />{" "}
          Priority task
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.revision}
            disabled={completed}
            onChange={(e) => onChange("revision", e.target.checked)}
          />{" "}
          Schedule revision on completion
        </label>
      </div>
      <Field label="Notes & resource links">
        <textarea
          rows={3}
          maxLength={10000}
          value={draft.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          placeholder="Notes, links, question ranges…"
        />
      </Field>
      {(draft.notes.match(/https?:\/\/[^\s]+/g) ?? []).map((url, i) => (
        <a
          key={i}
          className="text-link resource"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          Open resource {i + 1}
        </a>
      ))}
    </>
  );
}
export function TaskForm({
  initial,
  subjectId,
  topic: defaultTopic,
}: {
  initial?: Task;
  subjectId?: string;
  topic?: string;
}) {
  const { data, update, notify } = useApp(),
    { close } = useDialog();
  const initialTopic = data.topics.find((t) => t.id === initial?.topicId),
    subjects = data.subjects.filter((s) => !s.archived);
  const [draft, setDraft] = useState<TaskDraft>({
    subjectId: initialTopic?.subjectId ?? subjectId ?? subjects[0]?.id ?? "",
    topic: initialTopic?.name ?? defaultTopic ?? "",
    title: initial?.title ?? "",
    minutes: initial?.minutes ?? 30,
    priority: initial?.priority ?? false,
    revision: initial?.revision ?? true,
    range: initial?.range ?? "",
    notes: initial?.notes ?? "",
  });
  const [error, setError] = useState("");
  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const completed = !!initial?.completedOn;
  return (
    <Modal
      variant={initial ? "drawer" : "modal"}
      title={
        initial
          ? completed
            ? "Completed work"
            : "Task details"
          : "One small step forward"
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (initial)
              update((s) => {
                const next = clone(s),
                  task = next.tasks.find((t) => t.id === initial.id)!;
                const topic = completed
                  ? initialTopic!
                  : ensureTopic(next, draft.subjectId, draft.topic);
                Object.assign(task, {
                  title: draft.title.trim(),
                  topicId: topic.id,
                  minutes: draft.minutes,
                  priority: draft.priority,
                  revision: draft.revision,
                  range: draft.range.trim(),
                  notes: draft.notes,
                });
                return next;
              });
            else update((s) => addTasks(s, [draft], today()));
            notify(initial ? "Task updated." : "Task added to today.");
            close();
          } catch {
            setError(
              "Check that the topic, task and estimated minutes are valid.",
            );
          }
        }}
      >
        <div className="modal-body">
          <div className="form-grid">
            <Field label="Subject">
              <select
                value={draft.subjectId}
                required
                disabled={completed}
                onChange={(e) => {
                  set("subjectId", e.target.value);
                  set("topic", "");
                }}
              >
                <option value="" disabled>
                  Choose a subject
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Topic">
              <input
                list="topic-options"
                required
                disabled={completed}
                value={draft.topic}
                maxLength={150}
                onChange={(e) => set("topic", e.target.value)}
                placeholder="e.g. Percentage"
              />
              <datalist id="topic-options">
                {data.topics
                  .filter((t) => t.subjectId === draft.subjectId)
                  .map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
              </datalist>
            </Field>
          </div>
          <TaskFields
            draft={draft}
            onChange={set}
            completed={completed}
            autoFocus
          />
          {completed && (
            <div className="callout green">
              Completed on {initial.completedOn}. Undo completion to change its
              topic, vocabulary range or revision setting. Saved recall/test
              results will be kept.
            </div>
          )}
          <ErrorText message={error} />
        </div>
        <div className="modal-footer">
          {initial && completed && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                update((s) => undoTaskCompletion(s, initial.id));
                notify(
                  "Completion undone. Task is unfinished; recorded recalls and tests are kept.",
                );
                close();
              }}
            >
              <RotateCcw size={16} />
              Undo completion
            </button>
          )}
          {initial && !completed && (
            <button
              type="button"
              className="btn danger-text"
              onClick={() => {
                if (confirm("Delete this unfinished task?")) {
                  update((s) => ({
                    ...s,
                    tasks: s.tasks.filter((t) => t.id !== initial.id),
                  }));
                  close();
                  notify("Task deleted.");
                }
              }}
            >
              Delete task
            </button>
          )}
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn primary" disabled={!subjects.length}>
            <Check size={16} />
            {initial ? "Save changes" : "Add to today"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export const pasteExample = `Maths:\n! Percentage | Solve 30 questions | 50 min\nTime & Work | Review examples | 25 min\nEnglish:\nVocabulary | Learn words 1-50 | 20 min\nDSA:\nArrays & Hashing | Solve two hash map problems | 45 min`;
export function ImportForm({ initialText = "" }: { initialText?: string }) {
  const [manual, setManual] = useState(false),
    [draft, setDraft] = useState(initialText);
  return manual ? (
    <ManualImportForm
      initialText={draft}
      onAi={(text) => {
        setDraft(text);
        setManual(false);
      }}
    />
  ) : (
    <AiImportForm
      initialText={draft}
      onManual={(text) => {
        setDraft(text);
        setManual(true);
      }}
    />
  );
}
function ManualImportForm({
  initialText = "",
  onAi,
}: {
  initialText?: string;
  onAi: (text: string) => void;
}) {
  const { data, update, notify } = useApp(),
    { close } = useDialog();
  const [text, setText] = useState(initialText),
    [proposals, setProposals] = useState<Proposal[] | null>(null),
    [error, setError] = useState("");
  const subjects = data.subjects.filter((a) => !a.archived);
  const set = (i: number, patch: Partial<Proposal>) =>
    setProposals((items) =>
      items!.map((a, n) => (n === i ? { ...a, ...patch } : a)),
    );
  const valid =
    proposals?.length &&
    proposals.every(
      (a) =>
        a.subjectId &&
        a.topic.trim() &&
        a.title.trim() &&
        Number.isInteger(a.minutes) &&
        a.minutes > 0 &&
        a.minutes <= 1440,
    );
  return (
    <Modal
      className={proposals ? "paste-review-modal" : "paste-entry-modal"}
      title={
        proposals
          ? "Check your plan before saving"
          : "What would you like to study?"
      }
      wide
    >
      <div className="modal-body">
        <div className="callout soft">
          <Sparkles size={18} />
          <span>
            A local, rule-based reader—not AI. Nothing is saved until you
            confirm. Check subjects, topics and estimates.
            <button className="text-link" onClick={() => onAi(text)}>
              Use AI-assisted import instead
            </button>
          </span>
        </div>
        {!proposals ? (
          <>
            <Field label="Paste your daily targets">
              <textarea
                className="paste-box"
                autoFocus
                rows={10}
                maxLength={20000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={pasteExample}
              />
            </Field>
            <button className="text-link" onClick={() => setText(pasteExample)}>
              Use the example format
            </button>
            <p className="muted small">
              Subject heading, then: Topic | Task | Minutes. Mark a priority
              with !. Unknown lines stay editable—we don’t guess.
            </p>
          </>
        ) : (
          <>
            <div className="paste-review-layout">
              <aside className="paste-source">
                <span className="eyebrow">WHAT YOU PASTED</span>
                <pre>{text}</pre>
                <div className="callout soft">
                  Nothing is saved until you confirm. Subjects, topics, ranges
                  and estimates stay editable.
                </div>
                <button
                  className="text-link"
                  onClick={() => setProposals(null)}
                >
                  Edit pasted text
                </button>
              </aside>
              <div className="paste-review-content">
                <div className="review-meta">
                  <strong>{proposals.length} proposed tasks</strong>
                  <span>
                    <Clock3 size={14} />
                    {proposals.reduce((n, a) => n + a.minutes, 0)} minutes
                    estimated
                  </span>
                </div>
                <div className="proposal-list">
                  {proposals.map((p, i) => (
                    <div className="proposal" key={i}>
                      <div className="proposal-top">
                        <span className="number-badge">{i + 1}</span>
                        <input
                          aria-label={`Task ${i + 1} title`}
                          value={p.title}
                          onChange={(e) => set(i, { title: e.target.value })}
                        />
                        <button
                          className="icon-btn"
                          aria-label={`Remove proposal ${i + 1}`}
                          onClick={() =>
                            setProposals((a) => a!.filter((_, n) => n !== i))
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <div className="proposal-fields">
                        <Field label="Subject">
                          <select
                            value={p.subjectId}
                            onChange={(e) =>
                              set(i, { subjectId: e.target.value })
                            }
                          >
                            <option value="">Choose subject</option>
                            {subjects.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Topic">
                          <input
                            value={p.topic}
                            onChange={(e) => set(i, { topic: e.target.value })}
                            placeholder="Topic required"
                          />
                        </Field>
                        <Field label="Minutes">
                          <input
                            type="number"
                            min={1}
                            max={1440}
                            value={p.minutes || ""}
                            onChange={(e) =>
                              set(i, { minutes: Number(e.target.value) })
                            }
                          />
                        </Field>
                      </div>
                      <div className="check-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={p.priority}
                            onChange={(e) =>
                              set(i, { priority: e.target.checked })
                            }
                          />
                          Priority
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={p.revision}
                            onChange={(e) =>
                              set(i, { revision: e.target.checked })
                            }
                          />
                          Revision on completion
                        </label>
                        {p.range && <small>Range {p.range}</small>}
                      </div>
                      {p.warning && (
                        <small className="muted">
                          {!p.subjectId || !p.topic.trim()
                            ? "Choose a subject and topic to continue."
                            : p.warning.includes("30-minute")
                              ? p.warning
                              : "Reviewed — you can adjust any field."}
                        </small>
                      )}
                    </div>
                  ))}
                </div>
                {!valid && (
                  <p className="form-error">
                    Every task needs a subject, topic, title and valid estimate.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
        <ErrorText message={error} />
      </div>
      <div className="modal-footer">
        <button
          className="btn"
          onClick={proposals ? () => setProposals(null) : close}
        >
          {proposals ? "Back to paste" : "Cancel"}
        </button>
        {proposals ? (
          <button
            className="btn primary"
            disabled={!valid}
            onClick={() => {
              try {
                update((s) => addTasks(s, proposals, today()));
                notify(`${proposals.length} tasks added. Your plan is ready.`);
                close();
              } catch {
                setError("Check the proposed tasks before saving.");
              }
            }}
          >
            <Check size={16} />
            Confirm & add tasks
          </button>
        ) : (
          <button
            className="btn primary"
            disabled={!text.trim()}
            onClick={() => {
              if (text.split("\n").length > 100)
                return setError("Paste up to 100 lines at a time.");
              const items = parseTargets(text, data);
              if (!items.length)
                return setError(
                  "Include at least one task below a subject heading.",
                );
              setError("");
              setProposals(items);
            }}
          >
            <Sparkles size={16} />
            Review my targets
          </button>
        )}
      </div>
    </Modal>
  );
}
