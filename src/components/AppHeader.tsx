import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ClipboardPaste,
  Compass,
  LayoutList,
  Menu,
  RevisionIcon,
  Settings2,
  IslandMark,
  X,
} from "./icons";
import { useApp } from "../data/AppProvider";
import { dailyPlan } from "../domain/engine";
import { displayDate } from "../domain/model";
import { ImportForm } from "./forms";
import { useDialog } from "./ui";

const navigation = [
  { to: "/", label: "World", icon: Compass },
  { to: "/today", label: "Today", icon: LayoutList },
  { to: "/revisions", label: "Revisions", icon: RevisionIcon },
  { to: "/tests", label: "Tests", icon: ClipboardCheck },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

/** One navigation system for the World and all working pages. */
export function AppHeader() {
  const { data, date, demo } = useApp();
  const { open } = useDialog();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const plan = dailyPlan(data, date);
  const due = plan.items.filter((item) => item.kind === "revision").length;
  useEffect(() => setExpanded(false), [location.pathname, location.search]);
  useEffect(() => {
    const large = matchMedia("(min-width: 761px)");
    const resize = () => {
      if (large.matches) setExpanded(false);
    };
    large.addEventListener("change", resize);
    return () => large.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    header.current?.querySelector<HTMLAnchorElement>("nav a")?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        event.stopPropagation();
        setExpanded(false);
        toggle.current?.focus();
      }
    };
    const outside = (event: Event) => {
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      )
        setExpanded(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [expanded]);
  return (
    <header
      ref={header}
      className={`site-header ${expanded ? "is-menu-open" : ""}`}
    >
      <Link
        to="/"
        className="site-brand"
        aria-label="Study World home"
        onClick={() => setExpanded(false)}
      >
        <span className="site-brand-mark">
          <IslandMark size={40} />
        </span>
        <span className="site-brand-wordmark">
          Study World<small>A LITTLE EVERY DAY</small>
        </span>
      </Link>
      <nav
        id="site-navigation"
        className="site-navigation"
        aria-label="Main navigation"
      >
        {navigation.map(({ to, label, icon: Icon }) => {
          const count =
            to === "/today" ? plan.items.length : to === "/revisions" ? due : 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              aria-label={label}
              title={
                count
                  ? `${label} · ${count} ${to === "/today" ? "planned items" : "due reviews"}`
                  : label
              }
              onClick={() => {
                setExpanded(false);
                requestAnimationFrame(() =>
                  document
                    .getElementById("main")
                    ?.focus({ preventScroll: true }),
                );
              }}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={`site-nav-count ${to === "/revisions" ? "is-due" : ""}`}
                  data-count={count}
                  aria-hidden="true"
                />
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className="site-header-actions">
        {demo && <span className="site-demo-label">Demo</span>}
        <time className="site-header-date" dateTime={date}>
          <CalendarDays size={15} aria-hidden="true" />
          {displayDate(date, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </time>
        <button
          type="button"
          className="site-paste-button"
          aria-label="Paste targets"
          title="Paste targets"
          onClick={() => {
            setExpanded(false);
            open(<ImportForm />);
          }}
        >
          <ClipboardPaste size={18} aria-hidden="true" />
          <span>Paste targets</span>
        </button>
        <button
          ref={toggle}
          type="button"
          className="site-menu-toggle"
          aria-label={
            expanded ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={expanded}
          aria-controls="site-navigation"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (
            <X size={19} aria-hidden="true" />
          ) : (
            <Menu size={19} aria-hidden="true" />
          )}
          <span>Menu</span>
        </button>
      </div>
    </header>
  );
}
