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
