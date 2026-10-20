import { useState } from "react";
import { useApp } from "../data/AppProvider";
import { ChevronLeft, ChevronRight, ShieldCheck } from "../components/icons";
import { Chip, Heading, Page } from "../components/ui";
import { addDays, displayDate, today } from "../domain/model";
import {
  setWeekLock,
  setWellnessDay,
  weekDays,
  weekStartOf,
  wellnessWeek,
} from "../domain/wellness";

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function LockIcon({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <rect
        x="4.5"
        y="10"
        width="15"
        height="10"
        rx="2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d={open ? "M8 10V7a4 4 0 0 1 7.6-1.7" : "M8 10V7a4 4 0 0 1 8 0v3"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WellnessPage() {
  const { data, update, notify } = useApp();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(today()));
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const week = wellnessWeek(data, weekStart);
  const days = weekDays(weekStart);
  const locked = week.locked;
  const isCurrentWeek = weekStart === weekStartOf(today());
  const entry = (day: string) =>
    week.days.find((d) => d.day === day) ?? { day, diet: "", gym: "" };
  const save = (day: string, patch: { diet?: string; gym?: string }) => {
    const result = setWellnessDay(data, weekStart, day, patch);
    if (!result.ok) return notify(result.error);
    update(() => result.data);
  };
  const move = (offset: number) => {
    setWeekStart(addDays(weekStart, offset * 7));
    setConfirmUnlock(false);
  };
  return (
    <Page className="wellness-page">
      <Heading
        eyebrow="DIET & GYM"
        title="The week, set once"
        description="Plan meals and training for each day, then lock the week so the plan holds you to it."
        action={
          <div className="wellness-week-nav">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous week"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {isCurrentWeek
                ? "This week"
                : `${displayDate(weekStart)} – ${displayDate(addDays(weekStart, 6))}`}
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next week"
              onClick={() => move(1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        }
      />
      <div className="wellness-lockbar">
        <div>
          <span className="wellness-lock-icon">
            {locked ? <LockIcon /> : <LockIcon open />}
          </span>
          <strong>{locked ? "Week locked" : "Week open"}</strong>
          <span className="muted small">
            {locked
              ? "Diet and gym entries are read-only until you unlock."
              : "Edit freely, then lock when the plan is final."}
          </span>
        </div>
        {locked ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!confirmUnlock) {
                setConfirmUnlock(true);
                return;
              }
              update((s) => setWeekLock(s, weekStart, false));
              setConfirmUnlock(false);
              notify("Week unlocked. You can edit again.");
            }}
          >
            <LockIcon open />
            {confirmUnlock ? "Confirm unlock" : "Unlock week"}
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              update((s) => setWeekLock(s, weekStart, true));
              notify("Week locked. Diet and gym are now read-only.");
            }}
          >
            <LockIcon />
            Lock week
          </button>
        )}
      </div>
      <section className="panel wellness-card">
        <div className="wellness-row wellness-head">
          <span>Day</span>
          <span>Diet</span>
          <span>Gym</span>
        </div>
        {days.map((day, i) => {
          const value = entry(day);
          const isToday = day === today();
          return (
            <div
              className={`wellness-row ${isToday ? "is-today" : ""}`}
              key={day}
            >
              <div className="wellness-day">
                <strong>{dayNames[i]}</strong>
                <span>{displayDate(day)}</span>
                {isToday && <Chip tone="green">Today</Chip>}
              </div>
              <label className="wellness-field">
                <span className="sr-only">{`Diet for ${dayNames[i]}`}</span>
                <input
                  key={`${weekStart}-${day}-diet`}
                  type="text"
                  maxLength={300}
                  placeholder="Meals for the day"
                  defaultValue={value.diet}
                  disabled={locked}
                  onBlur={(e) => {
                    if (e.target.value !== value.diet)
                      save(day, { diet: e.target.value });
                  }}
                />
              </label>
              <label className="wellness-field">
                <span className="sr-only">{`Gym for ${dayNames[i]}`}</span>
                <input
                  key={`${weekStart}-${day}-gym`}
                  type="text"
                  maxLength={300}
                  placeholder="Training or rest"
                  defaultValue={value.gym}
                  disabled={locked}
                  onBlur={(e) => {
                    if (e.target.value !== value.gym)
                      save(day, { gym: e.target.value });
                  }}
                />
              </label>
            </div>
          );
        })}
      </section>
      <p className="wellness-footnote">
        <ShieldCheck size={14} /> Locked weeks keep their plan exactly as
        written. Locks apply per week — next week starts open.
      </p>
    </Page>
  );
}
