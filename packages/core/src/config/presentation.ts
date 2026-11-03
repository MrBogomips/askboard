// The presentation keys a board reads and writes (settings-languages design decision 6): a board
// gets the user file's presentation keys as they are now, over the rest of the first read, and
// writes one presentation key, with a schema value, into the user file as it is now, keeping every
// other key in its order (AD-14, FR-35).

import {
  CONFIGURATION_VERSION,
  PRESENTATION_KEYS,
  type PresentationKey,
  type PresentationSetting,
  type WriteOutcome,
} from "@askboard/contract";
import { configurationProblem } from "@askboard/contract/validate";
import type { FileRead, Replace, WriteResult } from "./ports.ts";
import type { SettingsInEffect } from "./settings.ts";

const PRESENTATION: ReadonlySet<string> = new Set(PRESENTATION_KEYS);

/** The settings a board opens with: `fresh`'s presentation keys and user file over `first`. */
export const boardSettings = (
  first: SettingsInEffect,
  fresh: SettingsInEffect,
): SettingsInEffect => {
  const rows = Object.fromEntries(PRESENTATION_KEYS.map((key) => [key, fresh.rows[key]]));
  const values = Object.fromEntries(PRESENTATION_KEYS.map((key) => [key, fresh.values[key]]));
  return {
    values: { ...first.values, ...values },
    rows: { ...first.rows, ...rows },
    files: { user: fresh.files.user, project: first.files.project },
    warnings: fresh.warnings,
  };
};

/**
 * Whether a board's write names a presentation key and a value the configuration schema allows for
 * it. `board-host`'s schema checks the same before ask-core sees it; this checks again.
 */
export const isPresentationSetting = (setting: PresentationSetting): boolean => {
  const { key, value }: { readonly key: unknown; readonly value: unknown } = setting;
  if (typeof key !== "string" || !PRESENTATION.has(key) || value === undefined) return false;
  return configurationProblem({ version: CONFIGURATION_VERSION, [key]: value }) === undefined;
};

const REFUSE: Replace = { kind: "refuse", reason: "file-not-applied" };

const asText = (value: unknown): Replace => ({
  kind: "write",
  text: `${JSON.stringify(value, null, 2)}\n`,
});

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * The user file with one key set: in place when the file holds it, else last, every other key kept
 * in its order. A file that cannot be read or fails its check is refused, so it is never
 * overwritten; with no file, a new one holds the version, then the key.
 */
export const withSetting =
  ({ key, value }: PresentationSetting) =>
  (current: FileRead): Replace => {
    if (current.kind === "absent") return asText({ version: CONFIGURATION_VERSION, [key]: value });
    if (current.kind === "unreadable") return REFUSE;
    const file = parsed(current.text);
    if (file === undefined || configurationProblem(file) !== undefined) return REFUSE;
    return asText({ ...(file as Record<string, unknown>), [key]: value });
  };

/** What the board is told of its write; `path` is the user file as the panel shows it. */
export const outcomeOf = (
  key: PresentationKey,
  result: WriteResult,
  path: string | undefined,
): WriteOutcome => {
  const where = path === undefined ? {} : { path };
  if (result.kind === "written") return { key, outcome: "saved" };
  if (result.kind === "refused") {
    return { key, outcome: "refused", reason: result.reason, ...where };
  }
  return { key, outcome: "failed", reason: result.code, ...where };
};
