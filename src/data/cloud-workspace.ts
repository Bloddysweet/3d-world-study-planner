import { z } from "zod";
import { dataSchema, emptyData } from "../domain/model";
import type { AppData } from "../domain/model";
import type { StoragePort } from "./repository";
import { CloudError, parseCloudRecord } from "./cloud-api";
import type { CloudApi } from "./cloud-api";
export const accountStorageKey = (id: string) => `study-world.account.${id}.v1`;
export const cacheSchema = z.object({
  version: z.literal(1),
  data: dataSchema,
  revision: z.number().int().positive().safe().nullable(),
  dirty: z.boolean(),
  savedAt: z.number().optional(),
});
export type CloudPhase =
  | "loading"
  | "saved"
  | "pending"
  | "saving"
  | "offline"
  | "conflict"
  | "error";
export interface CloudSnapshot {
  data: AppData;
  revision: number | null;
  dirty: boolean;
  ready: boolean;
  phase: CloudPhase;
  message: string;
  cacheWarning: boolean;
  raw?: string;
}
/** Serial saves, durable account-scoped drafts, CAS conflicts and stale-session guards. */
export class CloudWorkspace {
  private state: CloudSnapshot;
  private listeners = new Set<() => void>();
  private epoch = 0;
  private active = false;
  private busy = false;
  private baselineKnown = false;
  private timer?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;
  constructor(
    readonly userId: string,
    private api: CloudApi,
    private storage:
      | (StoragePort & Partial<Pick<Storage, "removeItem">>)
      | null,
    private draftKey = accountStorageKey(userId),
  ) {
    this.state = {
      data: emptyData(),
      revision: null,
      dirty: false,
      ready: false,
      phase: "loading",
      message: "Loading your cloud workspace…",
      cacheWarning: false,
    };
    try {
      const raw =
        storage?.getItem(draftKey) ??
        storage?.getItem(accountStorageKey(userId));
      if (raw !== null && raw !== undefined) {
        const result = cacheSchema.safeParse(JSON.parse(raw));
        if (!result.success) throw new Error("Invalid recovery copy");
        this.state = { ...this.state, ...result.data };
      }
    } catch {
      let raw: string | undefined;
      try {
        raw =
          storage?.getItem(draftKey) ??
          storage?.getItem(accountStorageKey(userId)) ??
          undefined;
      } catch {
        /* storage blocked */
      }
      this.state = {
        ...this.state,
        raw,
        cacheWarning: true,
        ready: true,
        phase: "error",
        message:
          raw !== undefined
            ? "This account’s local recovery copy is unreadable. Download it before loading the cloud version."
            : "Browser recovery storage is unavailable. Cloud connection is still being checked.",
      };
    }
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(patch: Partial<CloudSnapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private persist() {
    if (this.state.raw !== undefined) return;
    try {
      if (!this.storage) throw new Error();
      this.storage.setItem(
        this.state.dirty ? this.draftKey : accountStorageKey(this.userId),
        JSON.stringify({
          version: 1,
          data: this.state.data,
          revision: this.state.revision,
          dirty: this.state.dirty,
          savedAt: Date.now(),
        }),
      );
      if (!this.state.dirty && this.draftKey !== accountStorageKey(this.userId))
        this.storage.removeItem?.(this.draftKey);
      if (this.state.cacheWarning) this.emit({ cacheWarning: false });
    } catch {
      if (!this.state.cacheWarning) this.emit({ cacheWarning: true });
    }
  }
  start() {
    this.active = true;
    this.busy = false;
    this.epoch++;
    if (this.state.raw === undefined) void this.reconcile();
  }
  dispose() {
    this.active = false;
    this.epoch++;
    this.busy = false;
    clearTimeout(this.timer);
    this.abort?.abort();
  }
  edit(data: AppData) {
    if (!this.active || !this.state.ready || this.state.raw !== undefined)
      return false;
    const value = dataSchema.parse(data);
    this.emit({
      data: value,
      dirty: true,
      phase:
        this.state.phase === "conflict"
          ? "conflict"
          : this.baselineKnown
            ? "pending"
            : "offline",
      message:
        "Changes kept in this account’s local recovery copy; waiting for cloud save.",
    });
    this.persist();
    this.schedule();
    return true;
  }
  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, 650);
  }
  pauseForOtherTab() {
    clearTimeout(this.timer);
    this.emit({
      phase: "conflict",
      message:
        "This account changed in another tab. Sync is paused. Download this copy if needed, then check the cloud.",
    });
  }
  async reconcile(
    resolution?: "cloud" | "local",
    backupCloud?: (data: AppData) => void,
  ) {
    const discardLocal = resolution === "cloud";
    if (
      !this.active ||
      this.busy ||
      (this.state.raw !== undefined && !discardLocal)
    )
      return;
    clearTimeout(this.timer);
    this.busy = true;
    const epoch = this.epoch;
    this.abort = new AbortController();
    this.emit({
      phase: "loading",
      ready: discardLocal ? false : this.state.ready,
      message: "Checking your cloud workspace…",
    });
    try {
      const result = await this.api.load(this.userId, this.abort.signal);
      if (!this.active || epoch !== this.epoch) return;
      const remote = result ? parseCloudRecord(result) : null;
      const current = this.state;
      this.baselineKnown = true;
      const sameData =
        remote && JSON.stringify(remote.data) === JSON.stringify(current.data);
      if (resolution === "local") {
        if (remote) backupCloud?.(remote.data);
        this.emit({
          revision: remote?.revision ?? null,
          dirty: true,
          ready: true,
          phase: "pending",
          message:
            "Your chosen copy is ready to save against the latest cloud revision.",
        });
        this.persist();
        this.schedule();
      } else if (
        !discardLocal &&
        current.dirty &&
        !sameData &&
        current.revision !== (remote?.revision ?? null)
      ) {
        this.emit({
          ready: true,
          phase: "conflict",
          message:
            "The cloud has another version. Your local edits are preserved. Download this copy before choosing which version to keep.",
        });
      } else if (!discardLocal && current.dirty && !sameData) {
        this.emit({
          ready: true,
          phase: "pending",
          message: "Local changes ready to sync.",
        });
        this.schedule();
      } else {
        this.emit({
          data: sameData ? current.data : (remote?.data ?? emptyData()),
          revision: remote?.revision ?? null,
          dirty: false,
          ready: true,
          phase: "saved",
          raw: undefined,
          message: remote
            ? "Saved to your private cloud workspace."
            : "New cloud workspace. Import this browser’s progress, or start fresh.",
        });
        this.persist();
      }
    } catch (error) {
      if (!this.active || epoch !== this.epoch) return;
      this.baselineKnown = false;
      this.emit({
        ready: true,
        phase:
          error instanceof CloudError && error.kind === "invalid"
            ? "error"
            : "offline",
        message:
          error instanceof CloudError && error.kind === "invalid"
            ? "Cloud data could not be validated. Nothing was overwritten. Export a backup and contact support."
            : "Cloud is unreachable. Your account’s recovery copy is kept locally. Check your connection and retry.",
      });
    } finally {
      if (epoch === this.epoch) this.busy = false;
    }
  }
  async flush() {
    if (
      !this.active ||
      this.busy ||
      !this.baselineKnown ||
      !this.state.dirty ||
      this.state.raw !== undefined ||
      !["pending", "saving"].includes(this.state.phase)
    )
      return;
    this.busy = true;
    const epoch = this.epoch,
      captured = this.state.data,
      revision = this.state.revision;
    this.abort = new AbortController();
    this.emit({ phase: "saving", message: "Saving to your cloud workspace…" });
    try {
      const result = parseCloudRecord(
        await this.api.save(this.userId, captured, revision, this.abort.signal),
      );
      if (!this.active || epoch !== this.epoch) return;
      const dirty = this.state.data !== captured;
      const conflict = this.state.phase === "conflict";
      this.emit({
        revision: result.revision,
        dirty,
        phase: conflict ? "conflict" : dirty ? "pending" : "saved",
        message: conflict
          ? "Another tab changed this workspace. Check the cloud before continuing."
          : dirty
            ? "Saving your newer edits next…"
            : "Saved to your private cloud workspace.",
      });
      this.persist();
      if (dirty && !conflict) this.schedule();
    } catch (error) {
      if (!this.active || epoch !== this.epoch) return;
      const conflict = error instanceof CloudError && error.kind === "conflict";
      this.emit({
        phase: conflict ? "conflict" : "offline",
        message: conflict
          ? "The cloud changed on another device. Your edits are preserved locally; download a backup before choosing a version."
          : "Cloud save failed. Your edits remain in this account’s recovery copy. Retry to check the cloud before saving again.",
      });
      this.persist();
    } finally {
      if (epoch === this.epoch) this.busy = false;
    }
  }
}
