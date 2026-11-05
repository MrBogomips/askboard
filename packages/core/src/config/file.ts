// One configuration file as ask-core reads it (settings-languages design decision 4): absent, applied
// with its known keys, or not applied at all, with the reason kept for the diagnostic and the panel.

import { CONFIGURATION_KEYS, type ConfigurationValues, type FileProblem } from "@askboard/contract";
import { configurationProblem } from "@askboard/contract/validate";
import type { FileRead } from "./ports.ts";

export type FileState =
  | { readonly status: "absent" }
  | {
      readonly status: "applied";
      readonly values: Partial<ConfigurationValues>;
      /** The keys the configuration does not define, in the file's order. */
      readonly unknown: readonly string[];
      readonly othersCanWrite: boolean;
    }
  | { readonly status: "not-applied"; readonly problem: FileProblem };

const KNOWN: ReadonlySet<string> = new Set(CONFIGURATION_KEYS);

const parsed = (text: string): { readonly ok: boolean; readonly value?: unknown } => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

/** A file's state: its known keys when it passes the configuration schema, none otherwise. */
export const fileState = (read: FileRead): FileState => {
  if (read.kind === "absent") return { status: "absent" };
  if (read.kind === "unreadable") {
    return { status: "not-applied", problem: { code: "unreadable", error: read.code } };
  }
  const json = parsed(read.text);
  if (!json.ok) return { status: "not-applied", problem: { code: "not-json" } };
  const problem = configurationProblem(json.value);
  if (problem !== undefined) return { status: "not-applied", problem };
  const values: Record<string, unknown> = {};
  const unknown: string[] = [];
  for (const [key, value] of Object.entries(json.value as Record<string, unknown>)) {
    if (KNOWN.has(key)) values[key] = value;
    else if (key !== "version") unknown.push(key);
  }
  return { status: "applied", values, unknown, othersCanWrite: read.othersCanWrite };
};
