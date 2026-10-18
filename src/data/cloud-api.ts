import type { SupabaseClient } from "@supabase/supabase-js";
import { dataSchema } from "../domain/model";
import type { AppData } from "../domain/model";
export interface CloudRecord {
  data: AppData;
  revision: number;
}
export interface CloudApi {
  load(userId: string, signal: AbortSignal): Promise<CloudRecord | null>;
  save(
    userId: string,
    data: AppData,
    revision: number | null,
    signal: AbortSignal,
  ): Promise<CloudRecord>;
}
export class CloudError extends Error {
  constructor(public kind: "conflict" | "connection" | "invalid") {
    super(kind);
  }
}
export function parseCloudRecord(record: unknown): CloudRecord {
  if (
    !record ||
    typeof record !== "object" ||
    !("revision" in record) ||
    !("data" in record) ||
    !Number.isSafeInteger(record.revision) ||
    Number(record.revision) < 1
  )
    throw new CloudError("invalid");
  const parsed = dataSchema.safeParse(record.data);
  if (!parsed.success) throw new CloudError("invalid");
  return { data: parsed.data, revision: Number(record.revision) };
}
export function cloudApi(client: SupabaseClient): CloudApi {
  return {
    async load(userId, signal) {
      const { data, error } = await client
        .from("study_workspaces")
        .select("data,revision")
        .eq("user_id", userId)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw new CloudError("connection");
      return data ? parseCloudRecord(data) : null;
    },
    async save(userId, value, revision, signal) {
      const data = dataSchema.parse(value);
      const table = client.from("study_workspaces");
      const write =
        revision === null
          ? table.insert({ user_id: userId, data })
          : table
              .update({ data })
              .eq("user_id", userId)
              .eq("revision", revision);
      const result = await write
        .select("data,revision")
        .abortSignal(signal)
        .maybeSingle();
      if (result.error)
        throw new CloudError(
          result.error.code === "23505" ? "conflict" : "connection",
        );
      if (!result.data) throw new CloudError("conflict");
      return parseCloudRecord(result.data);
    },
  };
}
