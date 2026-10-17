import { dataSchema, emptyData } from "../domain/model";
import type { AppData } from "../domain/model";
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface LoadResult {
  data: AppData;
  status: "ready" | "empty" | "corrupt" | "unavailable";
  message: string;
  raw?: string;
}
export const storageKey = (demo: boolean) =>
  demo ? "study-world.demo.v1" : "study-world.personal.v1";
export interface StudyRepository {
  load(demo?: boolean): LoadResult;
  save(data: AppData, demo?: boolean): void;
}
export class LocalStudyRepository implements StudyRepository {
  constructor(private storage: StoragePort | null) {}
  load(demo = false): LoadResult {
    if (!this.storage)
      return {
        data: emptyData(),
        status: "unavailable",
        message:
          "Storage is unavailable. Changes stay in this tab; export a backup before leaving.",
      };
    let raw: string | null;
    try {
      raw = this.storage.getItem(storageKey(demo));
    } catch {
      return {
        data: emptyData(),
        status: "unavailable",
        message:
          "Browser storage is blocked. Changes stay in memory; export before leaving.",
      };
    }
    if (raw === null)
      return {
        data: emptyData(),
        status: "empty",
        message: "Your personal workspace is ready.",
      };
    try {
      const data = dataSchema.parse(JSON.parse(raw));
      return {
        data,
        status: "ready",
        message: "Saved locally on this browser.",
      };
    } catch {
      return {
        data: emptyData(),
        status: "corrupt",
        raw,
        message:
          "Saved data could not be read. It has NOT been overwritten. Download the original below, then import a valid backup or explicitly reset.",
      };
    }
  }
  save(data: AppData, demo = false) {
    if (!this.storage) throw new Error("Storage unavailable");
    this.storage.setItem(
      storageKey(demo),
      JSON.stringify(dataSchema.parse(data)),
    );
  }
}
export function browserRepository() {
  try {
    return new LocalStudyRepository(window.localStorage);
  } catch {
    return new LocalStudyRepository(null);
  }
}
export function readBackup(value: string): AppData {
  return dataSchema.parse(JSON.parse(value));
}
export function download(
  value: string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
