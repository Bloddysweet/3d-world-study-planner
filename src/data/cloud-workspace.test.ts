import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyData } from "../domain/model";
import type { AppData } from "../domain/model";
import { CloudError, parseCloudRecord } from "./cloud-api";
import type { CloudApi, CloudRecord } from "./cloud-api";
import { CloudWorkspace, accountStorageKey } from "./cloud-workspace";
class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}
const sample = (minutes: number): AppData => ({
  ...emptyData(),
  preferences: { ...emptyData().preferences, dailyMinutes: minutes },
});
const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function setup() {
  const storage = new MemoryStorage();
  const api = {
    load: vi
      .fn<CloudApi["load"]>()
      .mockResolvedValue({ data: sample(100), revision: 1 }),
    save: vi
      .fn<CloudApi["save"]>()
      .mockImplementation(async (_id, data, revision) => ({
        data,
        revision: (revision ?? 0) + 1,
      })),
  };
  const controller = new CloudWorkspace(
    "alice",
    api,
    storage,
    accountStorageKey("alice") + ".draft.tab-one",
  );
  return { storage, api, controller };
}
describe("private cloud workspace coordinator", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("loads only the requested account, never the guest/demo copy, and creates nothing on first login", async () => {
    const { storage, api, controller } = setup();
    storage.setItem("study-world.personal.v1", JSON.stringify(sample(999)));
    api.load.mockResolvedValue(null);
    controller.start();
    await tick();
    expect(controller.getSnapshot().data.preferences.dailyMinutes).toBe(210);
    expect(api.load.mock.calls[0][0]).toBe("alice");
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.save).not.toHaveBeenCalled();
    controller.dispose();
  });
  it("coalesces edits and stores dirty per-tab recovery without changing the guest workspace", async () => {
    const { storage, api, controller } = setup();
    storage.setItem("study-world.personal.v1", "guest");
    controller.start();
    await tick();
    controller.edit(sample(120));
    controller.edit(sample(130));
    expect(
      JSON.parse(
        storage.getItem(accountStorageKey("alice") + ".draft.tab-one")!,
      ).dirty,
    ).toBe(true);
    await vi.advanceTimersByTimeAsync(700);
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save.mock.calls[0][2]).toBe(1);
    expect(controller.getSnapshot()).toMatchObject({
      phase: "saved",
      revision: 2,
      dirty: false,
    });
    expect(storage.getItem("study-world.personal.v1")).toBe("guest");
    expect(
      storage.getItem(accountStorageKey("alice") + ".draft.tab-one"),
    ).toBeNull();
    controller.dispose();
  });
  it("serializes edits made during an in-flight save against the returned revision", async () => {
    const { api, controller } = setup(),
      first = deferred<CloudRecord>();
    api.save.mockReturnValueOnce(first.promise);
    controller.start();
    await tick();
    controller.edit(sample(110));
    const flushing = controller.flush();
    controller.edit(sample(120));
    await vi.advanceTimersByTimeAsync(700);
    expect(api.save).toHaveBeenCalledTimes(1);
    first.resolve({ data: sample(110), revision: 2 });
    await flushing;
    expect(controller.getSnapshot()).toMatchObject({
      dirty: true,
      revision: 2,
    });
    await vi.advanceTimersByTimeAsync(700);
    expect(api.save.mock.calls[1][2]).toBe(2);
    expect(api.save.mock.calls[1][1].preferences.dailyMinutes).toBe(120);
    expect(controller.getSnapshot().phase).toBe("saved");
    controller.dispose();
  });
  it("preserves a failed/ambiguous save and recognizes an already-committed cloud copy on retry", async () => {
    const { api, controller } = setup();
    controller.start();
    await tick();
    api.save.mockRejectedValueOnce(new Error("network"));
    controller.edit(sample(150));
    await controller.flush();
    expect(controller.getSnapshot()).toMatchObject({
      dirty: true,
      phase: "offline",
    });
    api.load.mockResolvedValue({ data: sample(150), revision: 2 });
    await controller.reconcile();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "saved",
      revision: 2,
      dirty: false,
    });
    controller.dispose();
  });
  it("never silently overwrites a newer cloud revision, including after reload", async () => {
    const { storage, api, controller } = setup();
    storage.setItem(
      accountStorageKey("alice") + ".draft.reloaded",
      JSON.stringify({
        version: 1,
        data: sample(160),
        revision: 1,
        dirty: true,
      }),
    );
    api.load.mockResolvedValue({ data: sample(180), revision: 2 });
    const reloaded = new CloudWorkspace(
      "alice",
      api,
      storage,
      accountStorageKey("alice") + ".draft.reloaded",
    );
    reloaded.start();
    await tick();
    await vi.advanceTimersByTimeAsync(1000);
    expect(reloaded.getSnapshot()).toMatchObject({
      phase: "conflict",
      dirty: true,
    });
    expect(reloaded.getSnapshot().data.preferences.dailyMinutes).toBe(160);
    expect(api.save).not.toHaveBeenCalled();
    controller.dispose();
    reloaded.dispose();
  });
  it("supports explicit conflict resolution with a cloud backup and a new CAS baseline", async () => {
    const { api, controller } = setup();
    controller.start();
    await tick();
    controller.edit(sample(140));
    api.save.mockRejectedValueOnce(new CloudError("conflict"));
    await controller.flush();
    api.load.mockResolvedValue({ data: sample(190), revision: 5 });
    const backup = vi.fn();
    await controller.reconcile("local", backup);
    expect(backup).toHaveBeenCalledWith(sample(190));
    await vi.advanceTimersByTimeAsync(700);
    expect(api.save.mock.calls[1][2]).toBe(5);
    expect(controller.getSnapshot()).toMatchObject({
      phase: "saved",
      revision: 6,
    });
    controller.dispose();
  });
  it("supports deliberate cloud reload without discarding local edits if the read fails", async () => {
    const { api, controller } = setup();
    controller.start();
    await tick();
    controller.edit(sample(160));
    api.load.mockRejectedValueOnce(new Error());
    await controller.reconcile("cloud");
    expect(controller.getSnapshot().data.preferences.dailyMinutes).toBe(160);
    expect(controller.getSnapshot().dirty).toBe(true);
    api.load.mockResolvedValue({ data: sample(190), revision: 3 });
    await controller.reconcile("cloud");
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      phase: "saved",
      revision: 3,
    });
    controller.dispose();
  });
  it("queues offline-first edits without inserting over an existing remote workspace", async () => {
    const { api, controller } = setup();
    api.load.mockRejectedValueOnce(new Error());
    controller.start();
    await tick();
    controller.edit(sample(180));
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.save).not.toHaveBeenCalled();
    await controller.reconcile();
    expect(controller.getSnapshot().phase).toBe("conflict");
    expect(api.save).not.toHaveBeenCalled();
    controller.dispose();
  });
  it("aborts and ignores stale load responses after logout/disposal", async () => {
    const { api, controller } = setup(),
      read = deferred<CloudRecord>();
    api.load.mockReturnValue(read.promise);
    controller.start();
    const signal = api.load.mock.calls[0][1];
    controller.dispose();
    expect(signal.aborted).toBe(true);
    read.resolve({ data: sample(500), revision: 4 });
    await tick();
    expect(controller.getSnapshot().data.preferences.dailyMinutes).not.toBe(
      500,
    );
    expect(api.save).not.toHaveBeenCalled();
  });
  it("ignores stale saves after disposal and supports StrictMode effect restart", async () => {
    const { api, controller } = setup(),
      write = deferred<CloudRecord>();
    controller.start();
    await tick();
    controller.edit(sample(110));
    api.save.mockReturnValueOnce(write.promise);
    const flushing = controller.flush();
    controller.dispose();
    controller.start();
    await tick();
    write.resolve({ data: sample(110), revision: 99 });
    await flushing;
    expect(controller.getSnapshot().revision).not.toBe(99);
    controller.dispose();
  });
  it("does not erase corrupt recovery data or silently start writing", async () => {
    const { storage, api } = setup();
    const key = accountStorageKey("alice");
    storage.setItem(key, "broken-json");
    const controller = new CloudWorkspace("alice", api, storage);
    controller.start();
    await tick();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      raw: "broken-json",
    });
    expect(controller.edit(sample(160))).toBe(false);
    expect(storage.getItem(key)).toBe("broken-json");
    expect(api.load).not.toHaveBeenCalled();
    await controller.reconcile("cloud");
    expect(controller.getSnapshot().raw).toBeUndefined();
    controller.dispose();
  });
  it("keeps different accounts and same-account tab drafts separate", async () => {
    const { storage, api, controller } = setup();
    controller.start();
    await tick();
    controller.edit(sample(120));
    const second = new CloudWorkspace(
      "alice",
      api,
      storage,
      accountStorageKey("alice") + ".draft.tab-two",
    );
    second.start();
    await tick();
    second.edit(sample(140));
    const bob = new CloudWorkspace(
      "bob",
      api,
      storage,
      accountStorageKey("bob") + ".draft.tab-three",
    );
    bob.start();
    await tick();
    bob.edit(sample(160));
    expect(
      JSON.parse(
        storage.getItem(accountStorageKey("alice") + ".draft.tab-one")!,
      ).data.preferences.dailyMinutes,
    ).toBe(120);
    expect(
      JSON.parse(
        storage.getItem(accountStorageKey("alice") + ".draft.tab-two")!,
      ).data.preferences.dailyMinutes,
    ).toBe(140);
    expect(
      JSON.parse(
        storage.getItem(accountStorageKey("bob") + ".draft.tab-three")!,
      ).data.preferences.dailyMinutes,
    ).toBe(160);
    controller.dispose();
    second.dispose();
    bob.dispose();
  });
  it("keeps in-memory edits when local storage is blocked and can still save to cloud", async () => {
    const { api } = setup();
    const controller = new CloudWorkspace("alice", api, null);
    controller.start();
    await tick();
    controller.edit(sample(170));
    await controller.flush();
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      phase: "saved",
      cacheWarning: true,
    });
    controller.dispose();
  });
  it("halts automatic writes when another tab changes the account cache", async () => {
    const { api, controller } = setup();
    controller.start();
    await tick();
    controller.edit(sample(130));
    controller.pauseForOtherTab();
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.save).not.toHaveBeenCalled();
    expect(controller.getSnapshot().phase).toBe("conflict");
    controller.dispose();
  });
  it("keeps the data identity on a no-op cloud refresh so form drafts are not reset", async () => {
    const { controller } = setup();
    controller.start();
    await tick();
    const original = controller.getSnapshot().data;
    await controller.reconcile();
    expect(controller.getSnapshot().data).toBe(original);
    controller.dispose();
  });
  it("preserves even an empty-string corrupt cache until explicit recovery", async () => {
    const { storage, api } = setup();
    const key = accountStorageKey("alice");
    storage.setItem(key, "");
    const controller = new CloudWorkspace("alice", api, storage);
    controller.start();
    await tick();
    expect(controller.getSnapshot().phase).toBe("error");
    expect(controller.getSnapshot().raw).toBe("");
    expect(controller.edit(sample(150))).toBe(false);
    expect(storage.getItem(key)).toBe("");
    controller.dispose();
  });
  it("rejects malformed cloud payloads/revisions instead of replacing valid data", () => {
    expect(() => parseCloudRecord({ data: {}, revision: 1 })).toThrow(
      CloudError,
    );
    expect(() => parseCloudRecord({ data: emptyData(), revision: 0 })).toThrow(
      CloudError,
    );
    expect(() =>
      parseCloudRecord({
        data: emptyData(),
        revision: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow(CloudError);
  });
});
