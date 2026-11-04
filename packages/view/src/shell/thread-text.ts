// The follow-up thread's texts and keys (ask-lifecycle, task 6.5; EXPERIENCE.md, Follow-up thread,
// Explain and Voice and Tone: Follow-up; FR-10): the message count, each message's time in the
// ask's locale ("5:42 PM", "17:42"), the author of the agent's replies, whether Explain still waits
// for its reply, and the composer's send key, a modified Enter.

import { formatTime, type Locale, type ThreadEntry } from "@askboard/contract";
import { t } from "../strings/index.ts";
import type { ViewAct } from "../view-protocol.ts";

/**
 * Who the agent's replies are from. The agent's own name comes with push-delivery's agent records
 * (FR-24); until then its replies are headed "Agent".
 */
export const agentAuthor = (language: Locale = "en-US"): string => t(language, "thread.agent");

/** The English author, as before the catalogue. */
export const AGENT_AUTHOR = agentAuthor();

/** The thread's messages: each follow-up and each reply under it. */
export const messageCountOf = (thread: readonly ThreadEntry[] | undefined): number =>
  (thread ?? []).reduce((count, entry) => count + 1 + entry.replies.length, 0);

export const messagesLabel = (count: number, language: Locale = "en-US"): string =>
  count === 0 ? t(language, "thread.noMessages") : t(language, "thread.messages", { count });

/**
 * The viewer's offset from UTC at an instant, in minutes east of UTC as RFC 3339 writes it
 * (`+01:00` is 60): the viewer's time zone, the one value the view takes from the runtime (AD-13).
 */
export const viewerOffset = (instant: string): number => 0 - new Date(instant).getTimezoneOffset();

/**
 * A message's time as hours and minutes in the ask's locale (`5:42 PM`, `17:42`), at the viewer's
 * offset unless one is given (settings-languages design decision 8).
 */
export const timeOf = (
  when: string,
  locale: Locale = "en-US",
  offsetMinutes: number = viewerOffset(when),
): string => formatTime(when, offsetMinutes, locale);

/** Whether an Explain follow-up waits for its reply: in the thread without one, or on its way. */
export const explainPending = (
  thread: readonly ThreadEntry[] | undefined,
  sending: readonly ViewAct[],
  language: Locale = "en-US",
): boolean => {
  const explain = t(language, "question.explainText");
  return (
    (thread ?? []).some((entry) => entry.text === explain && entry.replies.length === 0) ||
    sending.some((act) => act.type === "follow-up" && act.text === explain)
  );
};

/** The composer's send key: Ctrl+Enter or Cmd+Enter; Enter alone adds a line (F-50). */
export const isSendKey = (event: {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}): boolean => event.key === "Enter" && (event.ctrlKey || event.metaKey);
