// The follow-up thread's texts and keys (ask-lifecycle, task 6.5; EXPERIENCE.md, Follow-up thread,
// Explain and Voice and Tone: Follow-up; FR-10): the message count, each message's time in en-US
// ("5:42 PM"), the author of the agent's replies, whether Explain still waits for its reply, and
// the composer's send key, a modified Enter.

import type { Locale, ThreadEntry } from "@askboard/contract";
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

/** A message's time as en-US hours and minutes, in the viewer's time zone unless one is given. */
export const timeOf = (when: string, timeZone?: string): string =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone === undefined ? {} : { timeZone }),
  })
    .format(new Date(when))
    // Newer ICU data puts a narrow no-break space before AM and PM.
    .replace(/\s/g, " ");

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
