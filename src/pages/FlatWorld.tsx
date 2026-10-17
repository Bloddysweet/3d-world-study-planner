import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Layers3,
  Leaf,
  Plus,
} from "../components/icons";
import { Empty, Page, SubjectIcon, useDialog } from "../components/ui";
import { SubjectForm } from "../components/forms";
import { useApp } from "../data/AppProvider";
import { statusLabels, topicStatus } from "../domain/engine";
import type { Subject } from "../domain/model";

/** A genuine lightweight map: no WebGL, decorative progress or fixed subject cap. */
export function FlatWorldPage() {
  const { data, date, update } = useApp(),
    { open } = useDialog();
  const [params, setParams] = useSearchParams();
  const subjects = data.subjects.filter((s) => !s.archived);
  const selected = subjects.find((s) => s.id === params.get("island"));
  const detail = useRef<HTMLElement>(null);
  const select = (id: string | null) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const key of ["island", "view", "topic"]) next.delete(key);
        if (id) next.set("island", id);
        return next;
      },
      { replace: true },
    );
  useEffect(() => {
    if (selected) {
      detail.current?.focus({ preventScroll: true });
      if (matchMedia("(max-width:640px)").matches)
        detail.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected?.id]);
  const topics = data.topics.filter((t) => t.subjectId === selected?.id);
  const switch3D = () =>
    update((s) => ({
      ...s,
      preferences: { ...s.preferences, worldMode: "3d" },
    }));
  return (
    <Page className="flat-world-page">
      <header className="flat-world-heading">
        <div>
          <span className="eyebrow">A QUIETER WAY TO EXPLORE</span>
          <h1>Your island atlas.</h1>
          <p>
            The same world. A lighter view. Choose an island to see your
            learning.
          </p>
        </div>
        <div className="flat-world-actions">
          <button className="btn" onClick={switch3D}>
            <Compass size={16} />
            3D world
          </button>
          <button className="btn primary" onClick={() => open(<SubjectForm />)}>
            <Plus size={16} />
            New subject
          </button>
        </div>
      </header>
      <div className={`flat-world-layout ${selected ? "has-selection" : ""}`}>
        <section className="flat-atlas" aria-label="2D island atlas">
          <div className="flat-atlas-caption">
            <Layers3 size={16} />
            <span>
              {subjects.length} {subjects.length === 1 ? "island" : "islands"} ·
              select to explore
            </span>
            <span className="flat-map-badge">2D</span>
          </div>
          {subjects.length ? (
            <div className="flat-island-grid">
              {subjects.map((subject, i) => {
                const ids = new Set(
                  data.topics
                    .filter((t) => t.subjectId === subject.id)
                    .map((t) => t.id),
                );
                const due = data.revisions.filter(
                  (r) => ids.has(r.topicId) && r.due <= date,
                ).length;
                return (
                  <button
                    key={subject.id}
                    className={`flat-island ${selected?.id === subject.id ? "selected" : ""}`}
                    style={
                      {
                        "--island-accent": subject.color,
                        "--island-tilt": `${i % 2 ? 3 : -3}deg`,
                      } as CSSProperties
                    }
                    onClick={() => select(subject.id)}
                    aria-pressed={selected?.id === subject.id}
                    aria-label={`Select island: ${subject.name}`}
                  >
                    <IslandDrawing subject={subject} />
                    <span className="flat-island-name">{subject.name}</span>
                    <span className="flat-island-meta">
                      {ids.size} topics{due > 0 ? ` · ${due} to revisit` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty
              title="Room for your first island"
              action={
                <button
                  className="btn primary"
                  onClick={() => open(<SubjectForm />)}
                >
                  Create a subject
                </button>
              }
            >
              Add a subject to begin your world.
            </Empty>
          )}
          <p className="flat-atlas-note">
            <Leaf size={13} />
            Learning evidence comes from your work, not from exploring the map.
          </p>
        </section>
        {selected && (
          <aside
            ref={detail}
            tabIndex={-1}
            className="flat-island-detail"
            aria-label="Selected 2D island"
          >
            <button className="text-link" onClick={() => select(null)}>
              <ArrowLeft size={14} />
              All islands
            </button>
            <SubjectIcon subject={selected} size={28} />
            <h2 id="island-preview-title">{selected.name}</h2>
            <p>
              {topics.length} topics ·{" "}
              {
                data.tasks.filter(
                  (t) =>
                    topics.some((p) => p.id === t.topicId) && t.completedOn,
                ).length
              }{" "}
              tasks completed
            </p>
            <Link className="btn primary" to={`/subjects/${selected.id}`}>
              Open subject
              <ArrowRight size={16} />
            </Link>
            <h3>Your topic garden</h3>
            {topics.length ? (
              <ul>
                {topics.map((topic) => (
                  <li key={topic.id}>
                    <Link
                      to={`/subjects/${selected.id}?topic=${encodeURIComponent(topic.id)}`}
                    >
                      <span>{topic.name}</span>
                      <small>{statusLabels[topicStatus(data, topic.id)]}</small>
                      <ArrowRight size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No topics yet. Open the subject to plant your first one.</p>
            )}
          </aside>
        )}
      </div>
    </Page>
  );
}
function IslandDrawing({ subject }: { subject: Subject }) {
  return (
    <span className="flat-island-drawing" aria-hidden="true">
      <svg viewBox="0 0 240 150" fill="none">
        <ellipse
          cx="120"
          cy="133"
          rx="69"
          ry="7"
          fill="#8d91a5"
          opacity=".12"
        />
        <path d="m30 75 87-38 93 36-27 36-62 23-64-24Z" fill="#a7ac95" />
        <path d="m30 75 88 30 3 27-64-24Z" fill="#a6a795" />
        <path d="m118 105 92-32-27 36-62 23Z" fill="#c4b9a6" />
        <path
          d="m30 75 87-38 93 36-92 32Z"
          fill="#d4dfb5"
          stroke="#f3efda"
          strokeWidth="3"
        />
        <path d="m60 79 58-24 59 24-59 22Z" fill="#bed09f" />
        <path
          d="m67 61 100 34M90 51l99 34M50 84l91-40M80 95l90-40"
          stroke="#f6edcf"
          strokeWidth="3"
        />
        <path
          d="m156 105 2 20m6-23 1 28"
          stroke="#a4c9c1"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {[
          [61, 64],
          [179, 68],
          [83, 49],
        ].map(([x, y]) => (
          <g key={x}>
            <path d={`M${x} ${y}v-17`} stroke="#9d9577" strokeWidth="3" />
            <circle cx={x} cy={y - 21} r="10" fill="#91b394" />
            <circle cx={x - 4} cy={y - 24} r="7" fill="#b4c7a3" />
          </g>
        ))}
        <path
          d="m99 73 19-11 21 10-20 12Z"
          fill="#fff9e9"
          stroke="#d8d5b6"
          strokeWidth="2"
        />
      </svg>
      <span className="flat-island-landmark">
        <SubjectIcon subject={subject} size={30} />
      </span>
    </span>
  );
}
