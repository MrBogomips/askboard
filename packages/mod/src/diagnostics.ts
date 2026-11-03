// The mod's debug lines: fixed text naming routes, statuses and counts only, never a token, a path
// or agent text (design decision 7, Never). A line that a poll could repeat every second is written
// once per epoch.

import type { Memory } from "./memory.ts";
import type { ModApi } from "./mod-api.ts";

export const debug = ($: ModApi, line: string): void => {
  $.ui.log(`AskBoard: ${line}`, { to: "debug" });
};

/** Writes `line` the first time this epoch. */
export const debugOnce = (memory: Memory, $: ModApi, line: string): void => {
  if (memory.logged.has(line)) return;
  memory.logged.add(line);
  debug($, line);
};
