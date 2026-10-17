import { useEffect, useRef, useState } from "react";
import { useApp } from "../data/AppProvider";
import { today, normalize } from "../domain/model";
import {
  catalogueFor,
  chooseAlternative,
  commitAiTargets,
  duplicateKeys,
  reviewTasks,
  validateAiPlan,
} from "../domain/ai-targets";
import type { AiPlan, ReviewTask } from "../domain/ai-targets";
import { Check, Sparkles, Trash2 } from "./icons";
import { ErrorText, Field, Modal, useDialog } from "./ui";

export function AiImportForm({
  initialText = "",
  onManual,
}: {
  initialText?: string;
  onManual: (text: string) => void;
}) {
  const { data, update, notify } = useApp(),
    { close } = useDialog();
  const [text, setText] = useState(initialText),
    [accessCode, setAccessCode] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null),
    [plan, setPlan] = useState<AiPlan | null>(null),
    [rows, setRows] = useState<ReviewTask[]>([]),
    [model, setModel] = useState("");
  const [reviewed, setReviewed] = useState(false),
    [allowNew, setAllowNew] = useState(false),
    [allowDuplicates, setAllowDuplicates] = useState(false);
  const current = useRef<AbortController | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/targets/status", { signal: c.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((v) => setConfigured(v.configured === true))
      .catch(() => {
        if (!c.signal.aborted) setConfigured(false);
      });
    return () => {
      c.abort();
      current.current?.abort();
    };
  }, []);
  const subjects = data.subjects.filter((s) => !s.archived),
    duplicates = duplicateKeys(data, rows);
  const newNames = [
    ...new Set(
      rows
        .filter(
          (r) =>
            !r.subjectId &&
            !subjects.some(
              (s) => normalize(s.name) === normalize(r.subjectName),
            ),
        )
        .map((r) => r.subjectName.trim()),
    ),
  ];
  const patch = (key: string, value: Partial<ReviewTask>) => {
    setRows((items) =>
      items.map((r) => (r.key === key ? { ...r, ...value } : r)),
    );
    setReviewed(false);
  };
  const valid =
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.title.trim() &&
        r.topicName.trim() &&
        (r.subjectId
          ? subjects.some((s) => s.id === r.subjectId)
          : r.subjectName.trim()) &&
        Number.isInteger(r.minutes) &&
        r.minutes !== null &&
        r.minutes >= 1 &&
        r.minutes <= 1440 &&
        (!r.alternatives.length || r.selectedAlternative !== null),
    );
  const analyse = async () => {
    const controller = new AbortController();
    current.current?.abort();
    current.current = controller;
    setBusy(true);
    setError("");
    try {
      const request = { text, catalogue: catalogueFor(data) };
      const response = await fetch("/api/targets/analyse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Import-Access-Code": accessCode,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(80000),
        ]),
      });
      const result = await response.json().catch(() => {
        throw Error(
          "The private AI endpoint is unavailable. Your paste is unchanged.",
        );
      });
      if (!response.ok)
        throw Error(
          typeof result.error === "string"
            ? result.error
            : "Analysis failed. Your paste is unchanged.",
        );
      const checked = validateAiPlan(result.plan, request);
      if (!controller.signal.aborted) {
        setPlan(checked);
        setRows(reviewTasks(checked));
        setModel(
          typeof result.model === "string"
            ? result.model.slice(0, 200)
            : "Free model",
        );
        setReviewed(false);
        setAllowNew(false);
        setAllowDuplicates(false);
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Analysis failed safely. Your paste is unchanged.",
        );
    } finally {
      if (current.current === controller) {
        setBusy(false);
        current.current = null;
      }
    }
  };
  const cancel = () => {
    current.current?.abort();
    current.current = null;
    setBusy(false);
    setError("Analysis cancelled. Your original paste is still here.");
  };
  return (
    <Modal
      wide
      title={
        plan ? "Review your AI-organised targets" : "Paste your study targets"
      }
      className={
        plan
          ? "paste-review-modal ai-import-modal"
          : "paste-entry-modal ai-import-modal"
      }
    >
      <div className="modal-body">
        <div className="callout soft">
          <Sparkles size={18} />
          <span>
            {plan
              ? "AI suggestions, not facts. Check the unchanged source and edit every assignment before saving."
              : "AI can understand headings, resources, learning ranges and “OR” choices. Nothing is saved until you confirm."}
          </span>
        </div>
        {!plan ? (
          <>
            <Field label="Paste your daily targets">
              <textarea
                autoFocus
                className="paste-box"
                rows={12}
                maxLength={20000}
                value={text}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  "MATHS\n1) Practice 10 Multiply at Expert level — Maths Workout App\n\nENGLISH\n1) OWS 1–50 from Blackbook\n2) Daily Editorial OR Reading Comprehension"
                }
              />
            </Field>
            <p className="muted small">
              Paste as-is, including headings, wrapped lines, book names and
              links. “10 Multiply” is understood as 10 multiplication questions.
            </p>
            {configured === false && (
              <div className="callout ai-setup" role="status">
                <strong>Private AI setup needed</strong>
                <p>
                  Set OPENROUTER_API_KEY and AI_IMPORT_ACCESS_CODE in your
                  hosting server’s private environment (or{" "}
                  <code>server/.env.local</code> locally), then restart the
                  server. Never put your API key in this dialog. You can still
                  use the manual reader below.
                </p>
              </div>
            )}
            {configured !== false && (
              <Field label="Private AI import access code (not your API key)">
                <input
                  type="password"
                  autoComplete="off"
                  value={accessCode}
                  disabled={busy}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Your server’s separate access code"
                />
              </Field>
            )}
            <label className="ai-consent">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Send this paste and my active subject/topic catalogue to
                OpenRouter and its model provider. Do not send scores or study
                history. Only free models; no paid fallback.
              </span>
            </label>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => onManual(text)}
            >
              Use the local manual reader instead (no AI)
            </button>
            {busy && (
              <p className="muted" role="status">
                Analysing with a free model… This can take up to a minute. Your
                paste will stay here if it fails.
              </p>
            )}
          </>
        ) : (
          <div className="paste-review-layout">
            <aside className="paste-source">
              <span className="eyebrow">YOUR UNCHANGED PASTE</span>
              <pre>{text}</pre>
              <p className="muted small">Model: {model}</p>
              {plan.sharedResources.length > 0 && (
                <>
                  <h3>Shared resources</h3>
                  {plan.sharedResources.map((r, i) => (
                    <div key={i} className="ai-shared-resource">
                      <Field label={`Shared resource ${i + 1} name`}>
                        <input
                          value={r.name}
                          maxLength={500}
                          onChange={(e) => {
                            setPlan(
                              (p) =>
                                p && {
                                  ...p,
                                  sharedResources: p.sharedResources.map(
                                    (x, n) =>
                                      n === i
                                        ? { ...x, name: e.target.value }
                                        : x,
                                  ),
                                },
                            );
                            setReviewed(false);
                          }}
                        />
                      </Field>
                      <Field label={`Shared resource ${i + 1} URL`}>
                        <input
                          value={r.url ?? ""}
                          maxLength={2000}
                          onChange={(e) => {
                            setPlan(
                              (p) =>
                                p && {
                                  ...p,
                                  sharedResources: p.sharedResources.map(
                                    (x, n) =>
                                      n === i
                                        ? { ...x, url: e.target.value || null }
                                        : x,
                                  ),
                                },
                            );
                            setReviewed(false);
                          }}
                        />
                      </Field>
                      <button
                        className="text-link"
                        onClick={() => {
                          setPlan(
                            (p) =>
                              p && {
                                ...p,
                                sharedResources: p.sharedResources.filter(
                                  (_, n) => n !== i,
                                ),
                              },
                          );
                          setReviewed(false);
                        }}
                      >
                        Remove shared resource {i + 1}
                      </button>
                    </div>
                  ))}
                </>
              )}
              {plan.sharedNotes.map((n, i) => (
                <Field key={i} label={`Shared note ${i + 1}`}>
                  <textarea
                    value={n.text}
                    maxLength={2000}
                    rows={3}
                    onChange={(e) => {
                      setPlan(
                        (p) =>
                          p && {
                            ...p,
                            sharedNotes: p.sharedNotes.map((x, j) =>
                              j === i ? { ...x, text: e.target.value } : x,
                            ),
                          },
                      );
                      setReviewed(false);
                    }}
                  />
                </Field>
              ))}
              {plan.questions.length > 0 && (
                <div className="callout">
                  <strong>Check these uncertainties</strong>
                  <ul>
                    {plan.questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                className="text-link"
                onClick={() => {
                  setPlan(null);
                  setReviewed(false);
                  setError("");
                }}
              >
                Back to the original paste
              </button>
            </aside>
            <div className="paste-review-content">
              <div className="review-meta">
                <strong>{rows.length} proposed targets</strong>
                <span>
                  {rows.filter((r) => r.minutes === null).length} need a time
                  estimate
                </span>
              </div>
              <div className="proposal-list">
                {rows.map((r, i) => {
                  const topics = data.topics.filter(
                    (t) => t.subjectId === r.subjectId,
                  );
                  return (
                    <section
                      className="proposal ai-proposal"
                      key={r.key}
                      aria-label={`Proposed target ${i + 1}`}
                    >
                      <div className="proposal-top">
                        <span className="number-badge">{i + 1}</span>
                        <input
                          aria-label={`Target ${i + 1} title`}
                          value={r.title}
                          onChange={(e) =>
                            patch(r.key, { title: e.target.value })
                          }
                        />
                        <button
                          className="icon-btn"
                          aria-label={`Remove target ${i + 1}`}
                          onClick={() => {
                            setRows((items) =>
                              items.filter((t) => t.key !== r.key),
                            );
                            setReviewed(false);
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      {r.alternatives.length > 0 && (
                        <Field label="Choose ONE activity — not both">
                          <select
                            aria-label={`Target ${i + 1} alternative`}
                            value={r.selectedAlternative ?? ""}
                            onChange={(e) => {
                              if (e.target.value === "") {
                                patch(r.key, { selectedAlternative: null });
                                return;
                              }
                              const next = chooseAlternative(
                                r,
                                Number(e.target.value),
                              );
                              patch(r.key, next);
                            }}
                          >
                            <option value="">Choose one before saving</option>
                            {r.alternatives.map((a, n) => (
                              <option key={n} value={n}>
                                {a.title}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <div className="proposal-fields">
                        <Field label="Subject">
                          <select
                            aria-label={`Target ${i + 1} subject`}
                            value={r.subjectId ?? "__new"}
                            onChange={(e) =>
                              patch(r.key, {
                                subjectId:
                                  e.target.value === "__new"
                                    ? null
                                    : e.target.value,
                                subjectName:
                                  subjects.find((s) => s.id === e.target.value)
                                    ?.name ?? r.subjectName,
                                topicId: null,
                              })
                            }
                          >
                            {subjects.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                            <option value="__new">Propose a new subject</option>
                          </select>
                        </Field>
                        <Field label="Topic">
                          <input
                            aria-label={`Target ${i + 1} topic`}
                            list={`ai-topics-${r.key}`}
                            value={r.topicName}
                            onChange={(e) =>
                              patch(r.key, {
                                topicName: e.target.value,
                                topicId:
                                  topics.find(
                                    (t) =>
                                      normalize(t.name) ===
                                      normalize(e.target.value),
                                  )?.id ?? null,
                              })
                            }
                          />
                          <datalist id={`ai-topics-${r.key}`}>
                            {topics.map((t) => (
                              <option key={t.id} value={t.name} />
                            ))}
                          </datalist>
                        </Field>
                        <Field label="Study minutes (required)">
                          <input
                            aria-label={`Target ${i + 1} minutes`}
                            type="number"
                            min={1}
                            max={1440}
                            value={r.minutes ?? ""}
                            placeholder="Your estimate"
                            onChange={(e) =>
                              patch(r.key, {
                                minutes:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                      </div>
                      {!r.subjectId && (
                        <Field label="New subject name">
                          <input
                            aria-label={`Target ${i + 1} new subject`}
                            value={r.subjectName}
                            onChange={(e) =>
                              patch(r.key, { subjectName: e.target.value })
                            }
                          />
                        </Field>
                      )}
                      <div className="proposal-fields">
                        <Field label="Topic group (optional)">
                          <input
                            value={r.group}
                            disabled={!!r.topicId}
                            onChange={(e) =>
                              patch(r.key, { group: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Learning range">
                          <input
                            aria-label={`Target ${i + 1} range`}
                            value={r.range}
                            onChange={(e) =>
                              patch(r.key, { range: e.target.value })
                            }
                            placeholder="e.g. 1–50"
                          />
                        </Field>
                        <Field label="Practice quantity">
                          <input
                            value={r.quantity}
                            onChange={(e) =>
                              patch(r.key, { quantity: e.target.value })
                            }
                            placeholder="e.g. 10 questions"
                          />
                        </Field>
                      </div>
                      <div className="proposal-fields">
                        <Field label="Difficulty">
                          <input
                            value={r.difficulty}
                            onChange={(e) =>
                              patch(r.key, { difficulty: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Coverage / context, not a time estimate">
                          <input
                            aria-label={`Target ${i + 1} coverage`}
                            value={r.coverage}
                            onChange={(e) =>
                              patch(r.key, { coverage: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                      <Field label="Resource names, URLs & notes (editable)">
                        <textarea
                          aria-label={`Target ${i + 1} resources`}
                          rows={3}
                          maxLength={7000}
                          value={r.notes}
                          onChange={(e) =>
                            patch(r.key, { notes: e.target.value })
                          }
                        />
                      </Field>
                      <div className="check-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={r.priority}
                            onChange={(e) =>
                              patch(r.key, { priority: e.target.checked })
                            }
                          />
                          Priority
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={r.revision}
                            onChange={(e) =>
                              patch(r.key, { revision: e.target.checked })
                            }
                          />
                          Revision on completion
                        </label>
                      </div>
                      {r.minutes === null && (
                        <p className="ai-warning">
                          No study-time estimate was given. Enter one; counts
                          and video coverage are not automatically treated as
                          minutes.
                        </p>
                      )}
                      {r.warnings.map((w, n) => (
                        <p className="ai-warning" key={n}>
                          {w}
                        </p>
                      ))}
                      {duplicates.has(r.key) && (
                        <p className="ai-warning">
                          Possible duplicate of another proposal or unfinished
                          task.
                        </p>
                      )}
                      <details className="ai-evidence">
                        <summary>Original source for this target</summary>
                        <pre>{r.source}</pre>
                      </details>
                    </section>
                  );
                })}
              </div>
              {newNames.length > 0 && (
                <label className="ai-consent">
                  <input
                    type="checkbox"
                    checked={allowNew}
                    onChange={(e) => setAllowNew(e.target.checked)}
                  />
                  <span>
                    Also create these new subjects: {newNames.join(", ")}.
                    Existing subjects will not be renamed.
                  </span>
                </label>
              )}
              {duplicates.size > 0 && (
                <label className="ai-consent">
                  <input
                    type="checkbox"
                    checked={allowDuplicates}
                    onChange={(e) => setAllowDuplicates(e.target.checked)}
                  />
                  <span>
                    I intentionally want to add the flagged duplicate targets.
                  </span>
                </label>
              )}
              <label className="ai-consent">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                <span>
                  I checked the original paste, subject/topic assignments,
                  resources, choices and estimates.
                </span>
              </label>
              {!valid && (
                <p className="form-error">
                  Every target needs a subject, topic, title, study-time
                  estimate and a selected alternative where offered. Remove
                  targets you do not want.
                </p>
              )}
            </div>
          </div>
        )}
        <ErrorText message={error} />
      </div>
      <div className="modal-footer">
        <button
          className="btn"
          onClick={
            busy
              ? cancel
              : plan
                ? () => {
                    setPlan(null);
                    setError("");
                  }
                : close
          }
        >
          {busy ? "Cancel analysis" : plan ? "Back to paste" : "Cancel"}
        </button>
        {plan ? (
          <button
            className="btn primary"
            disabled={
              !valid ||
              !reviewed ||
              (newNames.length > 0 && !allowNew) ||
              (duplicates.size > 0 && !allowDuplicates)
            }
            onClick={() => {
              try {
                update((s) =>
                  commitAiTargets(s, rows, plan, today(), {
                    allowNewSubjects: allowNew,
                    allowDuplicates,
                    reviewed,
                  }),
                );
                notify(`${rows.length} reviewed targets added.`);
                close();
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Recheck the proposals before saving.",
                );
              }
            }}
          >
            <Check size={16} />
            Confirm & add targets
          </button>
        ) : (
          <button
            className="btn primary"
            disabled={
              busy ||
              configured !== true ||
              !text.trim() ||
              !consent ||
              accessCode.length < 16
            }
            onClick={() => void analyse()}
          >
            <Sparkles size={16} />
            {busy ? "Analysing…" : "Analyse targets with AI"}
          </button>
        )}
      </div>
    </Modal>
  );
}
