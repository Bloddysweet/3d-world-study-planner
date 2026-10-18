import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { dataSchema, emptyData, today } from "../domain/model";
import type { AppData } from "../domain/model";
import { browserRepository, storageKey } from "./repository";
import { demoData } from "./demo";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../auth/client";
import { cloudApi } from "./cloud-api";
import { CloudWorkspace, accountStorageKey } from "./cloud-workspace";
import type { CloudSnapshot } from "./cloud-workspace";
const repository = browserRepository();
const tabId = crypto.randomUUID();
const noSubscribe = () => () => {};
const noSnapshot = () => null;
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
  cloud: CloudSnapshot | null;
  checkCloud: () => void;
  resolveCloud: (
    choice: "cloud" | "local",
    backupCloud?: (data: AppData) => void,
  ) => void;
}
const Context = createContext<Store | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [controller] = useState(() => {
    if (!user || !supabase) return null;
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      /* cloud can still work */
    }
    return new CloudWorkspace(
      user.id,
      cloudApi(supabase),
      storage,
      `${accountStorageKey(user.id)}.draft.${tabId}`,
    );
  });
  const cloud = useSyncExternalStore(
    controller?.subscribe ?? noSubscribe,
    controller?.getSnapshot ?? noSnapshot,
  );
  const [initial] = useState(() => repository.load());
  const [localData, setLocalData] = useState(initial.data);
  const localRef = useRef(localData);
  const [demo, setDemo] = useState(false);
  const [localBlocked, setLocalBlocked] = useState(
    !["ready", "empty"].includes(initial.status),
  );
  const [localMessage, setLocalMessage] = useState(initial.message);
  const [localRaw, setLocalRaw] = useState(initial.raw);
  const [notice, notify] = useState("");
  const [date, setDate] = useState(today());
  const data = !demo && cloud ? cloud.data : localData;
  const blocked =
    !demo && cloud
      ? cloud.cacheWarning ||
        ["offline", "conflict", "error"].includes(cloud.phase)
      : localBlocked;
  const raw = !demo && cloud ? cloud.raw : localRaw;
  const storageMessage =
    !demo && cloud
      ? cloud.message +
        (cloud.cacheWarning
          ? " Browser recovery storage is unavailable; export a backup."
          : "")
      : localMessage;
  useEffect(() => {
    if (!controller) return;
    controller.start();
    const retry = () => {
      if (document.visibilityState === "visible") void controller.reconcile();
    };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => {
      controller.dispose();
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
    };
  }, [controller]);
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
    if ((controller && !demo) || localBlocked) return;
    try {
      repository.save(localData, demo);
      setLocalMessage(
        demo
          ? "Demo sandbox — separate from your personal data."
          : "Saved locally on this browser.",
      );
    } catch {
      setLocalBlocked(true);
      setLocalMessage(
        "Could not save to browser storage. Your changes are in memory. Export a backup before leaving.",
      );
    }
  }, [localData, demo, localBlocked, controller]);
  useEffect(() => {
    if (!blocked && !cloud?.dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [blocked, cloud?.dirty]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (controller && !demo) {
        if (e.key === null || e.key === accountStorageKey(controller.userId))
          controller.pauseForOtherTab();
      } else if (e.key === null || e.key === storageKey(demo)) {
        setLocalBlocked(true);
        setLocalMessage(
          "This workspace changed in another tab. Automatic saving is paused. Export this tab if needed, then reload to use the other tab’s version.",
        );
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [demo, controller]);
  function replace(next: AppData) {
    const value = dataSchema.parse(next);
    if (controller && !demo) {
      if (!controller.edit(value))
        notify(
          "Workspace is not ready. Resolve recovery/loading in Account first.",
        );
    } else {
      localRef.current = value;
      setLocalData(value);
      setLocalRaw(undefined);
      setLocalBlocked(false);
    }
  }
  function update(fn: (s: AppData) => AppData) {
    setDate(today());
    const current =
      controller && !demo ? controller.getSnapshot().data : localRef.current;
    const value = dataSchema.parse(fn(current));
    if (controller && !demo) {
      if (!controller.edit(value))
        notify(
          "Workspace is not ready. Resolve recovery/loading in Account first.",
        );
    } else {
      localRef.current = value;
      setLocalData(value);
    }
  }
  function switchDemo() {
    if (
      !controller &&
      localBlocked &&
      !confirm(
        "Saving is paused. Switching workspaces will discard any in-memory changes. Export a backup first if needed. Continue?",
      )
    )
      return;
    const nextDemo = !demo;
    if (!nextDemo && controller) {
      setDemo(false);
      notify("Back in your account workspace.");
      return;
    }
    const result = repository.load(nextDemo);
    const next =
      nextDemo && result.status === "empty" ? demoData(date) : result.data;
    localRef.current = next;
    setLocalData(next);
    setDemo(nextDemo);
    setLocalBlocked(!["ready", "empty"].includes(result.status));
    setLocalRaw(result.raw);
    setLocalMessage(result.message);
    notify(
      nextDemo
        ? "Demo opened. Personal data is untouched."
        : "Back in your personal workspace.",
    );
  }
  if (cloud && !cloud.ready && !demo)
    return (
      <div className="account-loading" role="status">
        <h1>Opening your cloud workspace…</h1>
        <p>Your browser’s local progress will not be uploaded automatically.</p>
      </div>
    );
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
        cloud,
        checkCloud: () => {
          void controller?.reconcile();
        },
        resolveCloud: (choice, backup) => {
          void controller?.reconcile(choice, backup);
        },
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
