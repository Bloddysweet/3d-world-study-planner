import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Code2,
  Globe2,
  Network,
  Puzzle,
  Sprout,
  X,
} from "./icons";
import { motion, useReducedMotion } from "motion/react";
import type { Subject, Theme } from "../domain/model";
const DialogContext = createContext<{
  open: (node: ReactNode) => void;
  close: () => void;
} | null>(null);
export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  return (
    <DialogContext.Provider
      value={{ open: setDialog, close: () => setDialog(null) }}
    >
      {children}
      {dialog}
    </DialogContext.Provider>
  );
}
export function useDialog() {
  const value = useContext(DialogContext);
  if (!value) throw new Error("Missing dialog provider");
  return value;
}
export function Modal({
  title,
  children,
  wide = false,
  variant = "modal",
  className = "",
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  variant?: "modal" | "drawer";
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    { close } = useDialog();
  useEffect(() => {
    const el = dialog.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    el?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = old;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "wide" : ""} ${variant === "drawer" ? "task-drawer" : ""} ${className}`}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header className="modal-header">
        <div>
          <span className="eyebrow">YOUR LEARNING, YOUR WAY</span>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button className="icon-btn" aria-label="Close dialog" onClick={close}>
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Page({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={`page ${className}`}
      initial={{ opacity: 0, y: reduced ? 0 : 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.div>
  );
}
export function SubjectIcon({
  subject,
  size = 22,
}: {
  subject: Pick<Subject, "theme" | "color">;
  size?: number;
}) {
  const icons = {
    maths: Calculator,
    reasoning: Puzzle,
    english: BookOpen,
    gk: Globe2,
    dsa: Network,
    software: Code2,
    generic: Sprout,
  };
  const Icon = icons[subject.theme as Theme] ?? Sprout;
  return (
    <span
      className="subject-icon"
      style={{ color: subject.color, background: subject.color + "16" }}
    >
      <Icon size={size} />
    </span>
  );
}
export function Chip({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`chip ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-sprout">
        <Sprout size={30} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </div>
  );
}
export function SectionTitle({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
export function ArrowLink() {
  return <ArrowRight size={17} />;
}
export function ErrorText({ message }: { message: string }) {
  return message ? (
    <div className="form-error" role="alert">
      {message}
    </div>
  ) : null;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
