// The settings view (settings-languages design decision 6): the body of the `settings` message
// `board-host` sends a board when it connects and after each write, which adds the protocol's
// version and type.

import type { SettingsMessage, WriteOutcome } from "@askboard/contract";
import type { SettingsInEffect } from "./settings.ts";

export type SettingsView = Omit<SettingsMessage, "version" | "type">;

/** Each key's row, both files and the warnings no row holds, with a write's outcome after one. */
export const settingsView = (
  { rows, files, warnings }: SettingsInEffect,
  write?: WriteOutcome,
): SettingsView => ({ keys: rows, files, warnings, ...(write === undefined ? {} : { write }) });
