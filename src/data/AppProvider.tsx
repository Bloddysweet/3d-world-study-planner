import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { dataSchema, emptyData, today } from "../domain/model";
import type { AppData } from "../domain/model";
import { browserRepository, storageKey } from "./repository";
import { demoData } from "./demo";
const repository = browserRepository();
interface Store {
  data: AppData;
  demo: boolean;
  update: (fn: (data: AppData) => AppData) => void;
  replace: (data: AppData) => void;
  switchDemo: () => void;
  reset: () => void;
  notice: string;
  notify: (text: string) => void;
  storageMessage: string;
  blocked: boolean;
  raw?: string;
  date: string;
}
const Context = createContext<Store | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => repository.load());
  const [data, setData] = useState(initial.data),
    ref = useRef(data);
  const [demo, setDemo] = useState(false),
    [blocked, setBlocked] = useState(
      !["ready", "empty"].includes(initial.status),
    );
  const [storageMessage, setStorageMessage] = useState(initial.message),
    [raw, setRaw] = useState(initial.raw);
  const [notice, notify] = useState(""),
    [date, setDate] = useState(today());
  useEffect(() => {
    const refresh = () => setDate(today());
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => notify(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (blocked) return;
    try {
      repository.save(data, demo);
      setStorageMessage(
        demo
          ? "Demo sandbox — separate from your personal data."
          : "Saved locally on this browser.",
      );
    } catch {
      setBlocked(true);
      setStorageMessage(
        "Could not save to browser storage. Your changes are in memory. Export a backup before leaving.",
      );
    }
  }, [data, demo, blocked]);
  useEffect(() => {
    if (!blocked) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [blocked]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === storageKey(demo)) {
        setBlocked(true);
        setStorageMessage(
          "This workspace changed in another tab. Automatic saving is paused. Export this tab if needed, then reload to use the other tab’s version.",
        );
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [demo]);
  function update(fn: (s: AppData) => AppData) {
    setDate(today());
    const next = dataSchema.parse(fn(ref.current));
    ref.current = next;
    setData(next);
  }
  function replace(next: AppData) {
    const value = dataSchema.parse(next);
    ref.current = value;
    setData(value);
    setRaw(undefined);
    setBlocked(false);
  }
  function switchDemo() {
    if (
      blocked &&
      !confirm(
        "Saving is paused. Switching workspaces will discard any in-memory changes in this workspace. Export a backup first if needed. Continue?",
      )
    )
      return;
    const nextDemo = !demo,
      result = repository.load(nextDemo);
    const next =
      nextDemo && result.status === "empty" ? demoData(date) : result.data;
    ref.current = next;
    setData(next);
    setDemo(nextDemo);
    setBlocked(!["ready", "empty"].includes(result.status));
    setRaw(result.raw);
    setStorageMessage(result.message);
    notify(
      nextDemo
        ? "Demo opened. Personal data is untouched."
        : "Back in your personal workspace.",
    );
  }
  return (
    <Context.Provider
      value={{
        data,
        demo,
        update,
        replace,
        switchDemo,
        reset: () => replace(demo ? demoData(date) : emptyData()),
        notice,
        notify,
        storageMessage,
        blocked,
        raw,
        date,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing app provider");
  return value;
}
