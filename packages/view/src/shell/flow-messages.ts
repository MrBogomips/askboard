// The status messages of the answering flow as pure builders (answering-flow-fixes, design
// decisions 4 and 5; #182). They say only what is true: `sentMessageOf` is called once a command
// has been sent (NFR-10), and no message claims delivery. Agent and user strings (an option's
// label, a question's title) are cut at 80 characters and stay data: the region renders them as
// text through the catalogue (AD-8).

import type { ViewQuestion } from "../view-document.ts";
import type { ViewAct, ViewAnswerAct } from "../view-protocol.ts";
import type { StatusMessage } from "./status-messages.ts";

const LIMIT = 80;

// At most `LIMIT` characters, the last an ellipsis when something was cut; whole code points.
const cut = (text: string): string => {
  const points = Array.from(text);
  return points.length <= LIMIT ? text : `${points.slice(0, LIMIT - 1).join("")}…`;
};

// The chosen labels, then the "Other…" text, joined with ", "; none when the answer names no choice.
const optionOf = (act: ViewAnswerAct): string | undefined => {
  const parts = [...(act.choice ?? []), ...(act.other === undefined ? [] : [act.other])];
  return parts.length === 0 ? undefined : cut(parts.join(", "));
};

/**
 * The message for a command that was sent. A card's own act: the answer with its option, or
 * without it, or the note alone. Submit's: the count of the answers it sent, nothing when it sent
 * none. Postpone, decline, reopen, edit choices and follow-ups say nothing here.
 */
export const sentMessageOf = (
  via: "answer" | "submit",
  acts: readonly ViewAct[],
): StatusMessage | undefined => {
  if (via === "submit") {
    const count = acts.filter((act) => act.type === "answer").length;
    return count === 0 ? undefined : { key: "status.submitted", params: { count } };
  }
  for (const act of acts) {
    if (act.type === "note") return { key: "status.noteSent" };
    if (act.type === "answer") {
      const option = optionOf(act);
      return option === undefined
        ? { key: "status.answerSentPlain" }
        : { key: "status.answerSent", params: { option } };
    }
  }
  return undefined;
};

/** The message for questions the agent added: the title of one (its header chip, else its text), else the count. */
export const addedMessageOf = (questions: readonly ViewQuestion[]): StatusMessage | undefined => {
  const [only, ...rest] = questions;
  if (only === undefined) return undefined;
  if (rest.length > 0) return { key: "status.added", params: { count: questions.length } };
  const { header, text } = only.props;
  return { key: "status.added", params: { count: 1, title: cut(header ?? text) } };
};

/** The question the board went to, as the message names it: its title and its place on the board. */
export type NextTarget = { readonly title: string; readonly n: number; readonly m: number };

/** "Next: {title}, {n} of {m}.": the title is the agent's, so it goes in as text, cut at 80. */
export const nextMessageOf = ({ title, n, m }: NextTarget): StatusMessage => ({
  key: "status.next",
  params: { title: cut(title), n, m },
});

const withNext = (
  messages: readonly StatusMessage[],
  next?: NextTarget,
): readonly StatusMessage[] => (next === undefined ? messages : [...messages, nextMessageOf(next)]);

/**
 * The messages for a command that was sent, as `sentMessageOf` says them, and after them, when the
 * flow recorded a question for the acted one at the act, where the board went. A revision says the
 * change was sent and never moves. Said when the board page reports the command sent, never earlier.
 */
export const sentMessagesOf = (
  via: "answer" | "submit",
  acts: readonly ViewAct[],
  { next, revision = false }: { readonly next?: NextTarget; readonly revision?: boolean } = {},
): readonly StatusMessage[] => {
  if (revision && via === "answer" && acts.some((act) => act.type === "answer")) {
    return [{ key: "status.changeSent" }];
  }
  const sent = sentMessageOf(via, acts);
  return sent === undefined ? [] : withNext([sent], next);
};

/** A postpone that took effect, and where the board went. */
export const postponedMessagesOf = (next?: NextTarget): readonly StatusMessage[] =>
  withNext([{ key: "status.postponed" }], next);

/** A decline that took effect, and where the board went. */
export const declinedMessagesOf = (next?: NextTarget): readonly StatusMessage[] =>
  withNext([{ key: "status.declined" }], next);

/** A held answer lost its ready mark to a field: the field to fix (`fieldToFixOf`'s label). */
export const readyLostMessageOf = (label: string): StatusMessage => ({
  key: "status.readyLost",
  params: { label: cut(label) },
});

/** An area has nothing left to do. */
export const areaDoneMessageOf = (area: string): StatusMessage => ({
  key: "status.areaDone",
  params: { area: cut(area) },
});

/** Every question has an answer: the two lines of the completion panel, counted from receipts. */
export const allAnsweredMessagesOf = ({
  sent,
  delivered,
}: {
  readonly sent: number;
  readonly delivered: number;
}): readonly StatusMessage[] => [
  { key: "completion.title" },
  { key: "completion.counts", params: { s: sent, d: delivered } },
];

/** "All together": nothing is left to do and nothing has been sent. */
export const allReadyMessageOf = (): StatusMessage => ({ key: "bar.allReady" });

/** "Undo" of a prefill took effect. */
export const prefillUndoneMessageOf = (): StatusMessage => ({ key: "status.prefillUndone" });

/** The delivered count, from receipts that read delivered (the gate decides when it is said). */
export const deliveredMessageOf = ({
  sent,
  delivered,
}: {
  readonly sent: number;
  readonly delivered: number;
}): StatusMessage => ({ key: "status.delivered", params: { d: delivered, s: sent } });
