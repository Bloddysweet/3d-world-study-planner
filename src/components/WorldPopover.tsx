import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "./icons";
import { fitWorldPopover } from "../domain/world-popover";
import type { PopoverLayout } from "../domain/world-popover";

/** Non-modal, viewport-fitted tools. Portal above the world HUD; measure within
 * the iframe's own viewport, not its scaled outer preview dimensions. */
export function WorldPopover({
  title,
  trigger,
  className = "",
  children,
}: {
  title: string;
  trigger: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false),
    [layout, setLayout] = useState<PopoverLayout | null>(null);
  const root = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLElement>(null),
    content = useRef<HTMLDivElement>(null);
  const id = useId();
  const host =
    root.current?.closest<HTMLElement>(".world-experience") ?? root.current;
  const dismiss = () => {
    setOpen(false);
    button.current?.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    if (!open || !button.current || !panel.current || !host) return;
    const measure = () => {
      const anchor = button.current,
        el = panel.current,
        body = content.current;
      if (!anchor || !el || !body) return;
      const vv = window.visualViewport;
      const screen = {
        left: vv?.offsetLeft ?? 0,
        top: vv?.offsetTop ?? 0,
        right: (vv?.offsetLeft ?? 0) + (vv?.width ?? innerWidth),
        bottom: (vv?.offsetTop ?? 0) + (vv?.height ?? innerHeight),
      };
      const world = host.getBoundingClientRect();
      let top = Math.max(screen.top, world.top) + 12;
      let bottom = Math.min(screen.bottom, world.bottom) - 12;
      for (const n of document.querySelectorAll<HTMLElement>(
        ".site-header,.site-notices",
      )) {
        const r = n.getBoundingClientRect();
        if (r.width && r.height) top = Math.max(top, r.bottom + 10);
      }
      for (const n of host.querySelectorAll<HTMLElement>(
        ".world-bottom-left,.world-controls-menu",
      )) {
        const r = n.getBoundingClientRect();
        if (r.width && r.height && r.top > top + 80)
          bottom = Math.min(bottom, r.top - 12);
      }
      // If the viewport is exceptionally short, keep the header/close button
      // reachable and scroll the body rather than imposing a large min-height.
      bottom = Math.max(top + 1, bottom);
      const bounds = {
        left: Math.max(screen.left, world.left) + 12,
        right: Math.min(screen.right, world.right) - 12,
        top,
        bottom,
      };
      const header = el.querySelector("header")!;
      const style = getComputedStyle(el);
      const naturalHeight =
        body.scrollHeight +
        header.getBoundingClientRect().height +
        14 +
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom) +
        2;
      const next = fitWorldPopover(
        anchor.getBoundingClientRect(),
        bounds,
        naturalHeight,
        320,
        className.includes("world-controls-menu"),
      );
      setLayout((previous) =>
        previous &&
        Object.keys(next).every(
          (k) =>
            previous[k as keyof PopoverLayout] ===
            next[k as keyof PopoverLayout],
        )
          ? previous
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const n of [
      host,
      button.current,
      content.current,
      content.current?.firstElementChild,
      panel.current.querySelector("header"),
      ...document.querySelectorAll(".site-header,.site-notices"),
    ])
      if (n) observer.observe(n);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [open, host, className]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (
        e.target instanceof Node &&
        !root.current?.contains(e.target) &&
        !panel.current?.contains(e.target)
      )
        setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    window.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      window.removeEventListener("keydown", escape, true);
    };
  }, [open]);
  return (
    <div ref={root} className={`world-popover-root ${className}`}>
      <button
        ref={button}
        type="button"
        className="world-popover-trigger glass-panel"
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open &&
        host &&
        createPortal(
          <section
            ref={panel}
            id={id}
            role="dialog"
            aria-label={title}
            className={`world-popover world-fitted-popover glass-panel ${className.includes("journey-menu") ? "journey-popover" : "controls-popover"}`}
            data-placement={layout?.placement}
            style={
              layout
                ? {
                    position: "fixed",
                    left: layout.left,
                    top: layout.top,
                    width: layout.width,
                    maxWidth: "none",
                    maxHeight: layout.maxHeight,
                  }
                : { visibility: "hidden" }
            }
          >
            <header>
              <h2>{title}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label={`Close ${title}`}
                onClick={dismiss}
              >
                <X size={16} />
              </button>
            </header>
            <div ref={content} className="world-popover-body">
              {children}
            </div>
          </section>,
          host,
        )}
    </div>
  );
}
