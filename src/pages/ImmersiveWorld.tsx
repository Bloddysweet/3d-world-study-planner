import { Component, lazy, Suspense, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Compass,
  Layers3,
  Leaf,
  Plus,
  RevisionIcon,
  Sparkles,
  X,
} from "../components/icons";
import { useApp } from "../data/AppProvider";
import { dailyPlan, statusLabels, topicStatus } from "../domain/engine";
import { SubjectForm } from "../components/forms";
import { SubjectIcon, useDialog } from "../components/ui";
import { TaskRow } from "./Planner";
import { WorldPopover } from "../components/WorldPopover";
const Scene = lazy(() => import("../components/WorldScene"));
function JourneyDetails() {
  const { data, date, demo, switchDemo } = useApp();
  const plan = dailyPlan(data, date);
  const due = plan.items.filter((i) => i.kind === "revision").length;
  return (
    <>
      <div className="journey-details">
        <div className="panel-eyebrow">
          ONE SMALL STEP AT A TIME <Leaf size={13} />
        </div>
        <div className="journey-total">
          <strong>
            {plan.total}
            <small> min</small>
          </strong>
          <span>of {plan.available} min planned</span>
        </div>
        <div className="journey-track">
          <i
            style={{
              width: `${Math.min(100, (plan.total / Math.max(1, plan.available)) * 100)}%`,
            }}
          />
        </div>
        {plan.overload > 0 && (
          <p className="journey-overload">
            {plan.overload} min over your budget · nothing is moved
            automatically
          </p>
        )}
        <div className="journey-row">
          <RevisionIcon size={15} />
          <span>Reviews to revisit</span>
          <b>{due}</b>
        </div>
        <div className="journey-row">
          <BookOpen size={15} />
          <span>Learning tasks</span>
          <b>{plan.items.length - due}</b>
        </div>
        <Link className="btn primary journey-start" to="/today">
          Continue your journey <ArrowRight size={15} />
        </Link>
        {!demo && !data.tasks.length && (
          <button className="text-link world-demo" onClick={switchDemo}>
            Explore demo <ArrowRight size={13} />
          </button>
        )}
      </div>
    </>
  );
}
class SceneGuard extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function ImmersiveWorld() {
  const { data, date, update } = useApp(),
    { open } = useDialog();
  const [params, setParams] = useSearchParams();
  const subjects = data.subjects.filter((s) => !s.archived),
    selected = subjects.find((s) => s.id === params.get("island"));
  const entered = !!selected;
  const topics = data.topics.filter((t) => t.subjectId === selected?.id),
    activeTopic = topics.find((t) => t.id === params.get("topic"));
  const plan = dailyPlan(data, date);
  const change = useCallback(
    (values: Record<string, string | null>) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(values)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const select = useCallback(
    (id: string | null) =>
      change({ island: id, view: id ? "island" : null, topic: null }),
    [change],
  );
  const toFlat = () =>
    update((s) => ({
      ...s,
      preferences: { ...s.preferences, worldMode: "2d" },
    }));
  useEffect(() => {
    if (selected)
      document
        .getElementById("island-preview-title")
        ?.focus({ preventScroll: true });
  }, [selected?.id]);
  useEffect(() => {
    if (activeTopic)
      document
        .getElementById("world-topic-title")
        ?.focus({ preventScroll: true });
  }, [activeTopic?.id]);
  useEffect(() => {
    if (!entered) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]"))
        change(
          activeTopic
            ? { topic: null }
            : { island: null, view: null, topic: null },
        );
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [entered, activeTopic, change]);
  const fallback = (
    <div className="scene-fallback">
      <Compass size={28} />
      <strong>Your learning is safe.</strong>
      <p>
        The 3D world could not load. Switch to the lightweight view to keep
        planning.
      </p>
      <button className="btn primary" onClick={toFlat}>
        Use the 2D view
      </button>
    </div>
  );
  return (
    <div
      className={`page world-experience ${entered ? "is-exploring" : ""} ${selected ? "has-selection" : ""}`}
    >
      <div className="world-atmosphere" aria-hidden="true" />
      <SceneGuard fallback={fallback}>
          <Suspense
            fallback={
              <div className="immersive-loading">
                <Sparkles />
                <span>Gathering your islands…</span>
              </div>
            }
          >
            <Scene
              subjects={subjects}
              selectedId={selected?.id}
              onSelect={select}
              exploring={entered}
              onTopicSelect={(id) => change({ topic: id || null })}
              activeTopicId={activeTopic?.id}
              onFallback={toFlat}
              immersive
            />
          </Suspense>
      </SceneGuard>
      <div className="world-hud-left">
        <div className="world-introduction">
          <h1 className="world-overline">
            <span aria-hidden="true" /> YOUR LIVING STUDY WORLD
          </h1>
        </div>
        <WorldPopover
          title="Today’s journey"
          className="journey-menu"
          trigger={
            <>
              <Compass size={15} />
              Today’s journey{" "}
              <span className="journey-count">{plan.items.length}</span>
            </>
          }
        >
          <JourneyDetails />
        </WorldPopover>
      </div>
      <div className="world-top-tools">
        <button
          className="btn glass-panel"
          onClick={() => open(<SubjectForm />)}
        >
          <Plus size={16} />
          <span>New subject</span>
        </button>
      </div>
      {!subjects.length && (
        <div className="world-empty glass-panel">
          <Sparkles size={32} />
          <h2>Your world begins here.</h2>
          <p>
            Plant your first subject island. Your learning will shape what
            grows.
          </p>
          <button className="btn primary" onClick={() => open(<SubjectForm />)}>
            Create a subject <Plus size={15} />
          </button>
          <button className="text-link empty-flat-link" onClick={toFlat}>
            <Layers3 size={14} />
            Use the 2D atlas
          </button>
        </div>
      )}
      {selected && (
        <aside
          className="island-console glass-panel"
          aria-label="Selected island"
        >
          <button
            className="console-back text-link"
            onClick={() => select(null)}
          >
            <ArrowLeft size={13} />
            All islands
          </button>
          <div className="console-title">
            <SubjectIcon subject={selected} size={22} />
            <div>
              <span className="panel-eyebrow">
                {entered ? "EXPLORING YOUR ISLAND" : "AN ISLAND OF POSSIBILITY"}
              </span>
              <h2 id="island-preview-title" tabIndex={-1}>
                {selected.name}
              </h2>
            </div>
          </div>
          <div className="console-scroll-area">
            {activeTopic ? (
              <div className="world-topic-tasks">
                <div className="world-topic-heading">
                  <div>
                    <span
                      className={`topic-state state-${topicStatus(data, activeTopic.id)}`}
                    >
                      {statusLabels[topicStatus(data, activeTopic.id)]}
                    </span>
                    <h3 id="world-topic-title" tabIndex={-1}>
                      {activeTopic.name}
                    </h3>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Close topic tasks"
                    onClick={() => change({ topic: null })}
                  >
                    <X size={16} />
                  </button>
                </div>
                {data.tasks
                  .filter((t) => t.topicId === activeTopic.id)
                  .map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                {!data.tasks.some((t) => t.topicId === activeTopic.id) && (
                  <p>
                    No tasks here yet. Open the subject editor to add your first
                    one.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="console-stats">
                  <span>
                    <strong>{topics.length}</strong> topics
                  </span>
                  <span>
                    <strong>
                      {
                        topics.filter(
                          (t) => topicStatus(data, t.id) === "strong",
                        ).length
                      }
                    </strong>{" "}
                    strong
                  </span>
                  <span>
                    <strong>
                      {
                        data.revisions.filter(
                          (r) =>
                            topics.some((t) => t.id === r.topicId) &&
                            r.due <= date,
                        ).length
                      }
                    </strong>{" "}
                    due
                  </span>
                </div>
                <div className="console-topic-list">
                  {topics.slice(0, entered ? topics.length : 5).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => change({ view: "island", topic: t.id })}
                    >
                      <i
                        className={`status-seed state-${topicStatus(data, t.id)}`}
                      />
                      <span>
                        {t.name}
                        <small>{statusLabels[topicStatus(data, t.id)]}</small>
                      </span>
                      <ArrowRight size={13} />
                    </button>
                  ))}
                </div>
                {!topics.length && (
                  <p className="console-note">
                    A fresh start. Add topics in the subject editor to plant
                    your garden.
                  </p>
                )}
                {topics.length > 0 && (
                  <p className="console-note">
                    Select a crystal plot to open its tasks here. Turn the
                    island to explore every side.
                  </p>
                )}
              </>
            )}
          </div>
          <Link
            className="btn primary console-open-subject"
            to={`/subjects/${selected.id}${activeTopic ? `?topic=${encodeURIComponent(activeTopic.id)}` : ""}`}
          >
            <BookOpen size={16} />
            <span>Open subject</span> <ArrowRight size={16} />
          </Link>
        </aside>
      )}
      <div className="world-bottom-left">
        <details className="world-atlas glass-panel">
          <summary>
            <Layers3 size={16} />
            Island atlas <span>{subjects.length}</span>
          </summary>
          <div className="atlas-list">
            {subjects.map((s) => (
              <div key={s.id} className="atlas-item">
                <button
                  onClick={(event) => {
                    select(s.id);
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                  }}
                  aria-label={`Find island: ${s.name}`}
                >
                  <SubjectIcon subject={s} size={17} />
                  <span>{s.name}</span>
                  <Compass size={13} />
                </button>
                <Link
                  className="subject-card"
                  to={`/subjects/${s.id}`}
                  aria-label={`Open subject: ${s.name}`}
                >
                  <ArrowRight size={15} />
                </Link>
              </div>
            ))}
            <Link to="/settings">
              Manage subjects <ArrowRight size={13} />
            </Link>
          </div>
        </details>
        <span className="world-evidence">
          <Leaf size={12} />
          Grown from real learning. Never just clicks.
        </span>
      </div>
    </div>
  );
}
