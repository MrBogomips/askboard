// The pending asks the user sees beside the chat (FR-23; mod spec, "A subagent's board link",
// "Pending-asks list"; design decision 7, Pending asks; finding row 12). Each poll's list is kept for
// the band above the prompt (`band.ts`), which is redrawn only when the list changes, so an ask
// answered, closed or discarded leaves it. The engine draws that band on the terminal and desktop
// alone: while the session also draws on another surface, one status entry of one line shows the
// first ask's line, "<title> · <who> · <n> open · <link>", and how many more; it is set only when
// its text changes. A new ask a subagent owns gets one toast, "AskBoard · <title> · <link>", since
// its own PostToolUse message stays in the subagent's transcript.
//
// Agent text is the contract's `agentTextPiece`: escapes shown, and a line's text before its link
// cut to the notice limit, the title giving way first; the link, AskBoard's own, is kept whole.

import { agentTextPiece, NOTICE_TEXT_MAX_CHARS, type PendingAsk } from "@askboard/contract";
import type { Memory } from "./memory.ts";
import type { ModApi } from "./mod-api.ts";

export const SEPARATOR = " · ";
export const HEAD = "AskBoard";

/** The surfaces the engine draws the band above the prompt on; any other gets the status entry. */
export const BAND_SURFACES: ReadonlySet<string> = new Set(["terminal", "desktop"]);

/** The least of a title a line keeps before it cuts who asked instead. */
export const TITLE_MIN_CHARS = 20;

export const points = (text: string): number => Array.from(text).length;

/** The escaped text, uncut. */
const escaped = (text: string): string => agentTextPiece(text, Number.POSITIVE_INFINITY);

/** A title followed by `tail`, both agent text, within `max`: the title gives way first. */
export const textOf = (title: string, tail: string, max: number): string => {
  const shownTail = escaped(tail);
  const room = max - points(shownTail);
  return room >= TITLE_MIN_CHARS
    ? `${agentTextPiece(title, room)}${shownTail}`
    : agentTextPiece(`${title}${tail}`, max);
};

const whoOf = (ask: PendingAsk): string =>
  ask.agentName === undefined ? ask.label : `${ask.label}${SEPARATOR}${ask.agentName}`;

/** What follows a pending ask's title: who asked and its questions still open. */
export const tailOf = (ask: PendingAsk): string =>
  `${SEPARATOR}${whoOf(ask)}${SEPARATOR}${ask.openQuestions} open`;

/** A pending ask's line: its text within the notice limit, then the link whole. */
export const pendingLine = (ask: PendingAsk): string =>
  `${textOf(ask.title, tailOf(ask), NOTICE_TEXT_MAX_CHARS)}${SEPARATOR}${ask.link}`;

/** The status entry where a surface draws no band: the first ask's line, and how many more. */
const statusOf = (pending: readonly PendingAsk[]): string | undefined => {
  const [first] = pending;
  if (first === undefined) return undefined;
  const more = pending.length - 1;
  return more === 0 ? pendingLine(first) : `${pendingLine(first)}${SEPARATOR}+${more} more`;
};

/** The toast of a subagent's new ask. */
export const toastLine = (ask: PendingAsk): string => {
  const room = NOTICE_TEXT_MAX_CHARS - points(`${HEAD}${SEPARATOR}`);
  return `${HEAD}${SEPARATOR}${agentTextPiece(ask.title, room)}${SEPARATOR}${ask.link}`;
};

const setStatus = (memory: Memory, $: ModApi, text: string | undefined): void => {
  if (text === memory.status) return;
  memory.status = text;
  $.ui.status(text);
};

// Keeps the list the band draws, and redraws it when the list changed.
const keepPending = (memory: Memory, $: ModApi, pending: readonly PendingAsk[]): void => {
  if (JSON.stringify(pending) === JSON.stringify(memory.pending)) return;
  memory.pending = pending;
  $.ui.invalidate("ui.render");
};

/**
 * Shows a poll's pending asks: the band, the status entry while a surface draws no band, and a
 * toast for each new subagent's ask.
 */
export const showPending = async (
  memory: Memory,
  $: ModApi,
  pending: readonly PendingAsk[],
): Promise<void> => {
  keepPending(memory, $, pending);
  const surfaces = await $.session.surfaces();
  const bandless = surfaces.some((surface) => !BAND_SURFACES.has(surface));
  setStatus(memory, $, bandless ? statusOf(pending) : undefined);
  for (const ask of pending) {
    if (ask.agent_id === undefined || memory.toasted.has(ask.askId)) continue;
    memory.toasted.add(ask.askId);
    $.ui.toast(toastLine(ask));
  }
};

/** No session process: no ask is pending. */
export const clearPending = (memory: Memory, $: ModApi): void => {
  keepPending(memory, $, []);
  setStatus(memory, $, undefined);
};
