// The pending asks the user sees beside the chat (FR-23; mod spec, "A subagent's board link",
// "Pending-asks list"; design decision 7, Pending asks; finding row 12). The status entry lists
// each pending ask on one line, "<title> · <who> · <n> open · <link>", and is rebuilt from every
// poll's list: set only when its text changes, cleared when no ask is pending, so an ask answered,
// closed or discarded leaves it. A new ask a subagent owns gets one toast, "AskBoard · <title> ·
// <link>", since its own PostToolUse message stays in the subagent's transcript.
//
// Agent text is the contract's `agentTextPiece`: escapes shown, and a line's text before its link
// cut to the notice limit, the title giving way first; the link, AskBoard's own, is kept whole.

import { agentTextPiece, NOTICE_TEXT_MAX_CHARS, type PendingAsk } from "@askboard/contract";
import type { Memory } from "./memory.ts";
import type { ModApi } from "./mod-api.ts";

const SEPARATOR = " · ";
const TOAST_HEAD = "AskBoard";

/** The least of a title a line keeps before it cuts who asked instead. */
const TITLE_MIN_CHARS = 20;

const points = (text: string): number => Array.from(text).length;

/** The escaped text, uncut. */
const escaped = (text: string): string => agentTextPiece(text, Number.POSITIVE_INFINITY);

/** A title followed by `tail`, both agent text, within the notice limit, then the link whole. */
const lineOf = (title: string, tail: string, link: string): string => {
  const shownTail = escaped(tail);
  const room = NOTICE_TEXT_MAX_CHARS - points(shownTail);
  const text =
    room >= TITLE_MIN_CHARS
      ? `${agentTextPiece(title, room)}${shownTail}`
      : agentTextPiece(`${title}${tail}`);
  return `${text}${SEPARATOR}${link}`;
};

const whoOf = (ask: PendingAsk): string =>
  ask.agentName === undefined ? ask.label : `${ask.label}${SEPARATOR}${ask.agentName}`;

/** A pending ask's line in the status entry. */
export const pendingLine = (ask: PendingAsk): string =>
  lineOf(ask.title, `${SEPARATOR}${whoOf(ask)}${SEPARATOR}${ask.openQuestions} open`, ask.link);

/** The toast of a subagent's new ask. */
export const toastLine = (ask: PendingAsk): string => {
  const room = NOTICE_TEXT_MAX_CHARS - points(`${TOAST_HEAD}${SEPARATOR}`);
  return `${TOAST_HEAD}${SEPARATOR}${agentTextPiece(ask.title, room)}${SEPARATOR}${ask.link}`;
};

const setStatus = (memory: Memory, $: ModApi, text: string | undefined): void => {
  if (text === memory.status) return;
  memory.status = text;
  $.ui.status(text);
};

/** Shows a poll's pending asks: the status entry, and a toast for each new subagent's ask. */
export const showPending = (memory: Memory, $: ModApi, pending: readonly PendingAsk[]): void => {
  setStatus(memory, $, pending.length === 0 ? undefined : pending.map(pendingLine).join("\n"));
  for (const ask of pending) {
    if (ask.agent_id === undefined || memory.toasted.has(ask.askId)) continue;
    memory.toasted.add(ask.askId);
    $.ui.toast(toastLine(ask));
  }
};

/** No session process: no ask is pending. */
export const clearPending = (memory: Memory, $: ModApi): void => {
  setStatus(memory, $, undefined);
};
