// The fixtures of accept-as-sent: an answer accepted as sent in the board page's act, as a held
// answer in the draft record, as the answer event, in the board state and in a `fetch` result.
// Each validates against the contract; the change's tests say so by name.

import {
  type ActCommand,
  BOARD_PROTOCOL_VERSION,
  type DraftMessage,
  type LifecycleHostMessage,
} from "../schemas/board-protocol/index.ts";
import type { AnswerEvent } from "../schemas/output/index.ts";
import { type FetchResult, RESULT_VERSIONS } from "../schemas/tool-envelopes/index.ts";

const when = "2026-11-16T09:30:00Z";

/** The Tree question "plan" accepted as sent, with the open prompt's note and a derived value. */
export const acceptAsSentAct: ActCommand = {
  version: BOARD_PROTOCOL_VERSION,
  type: "act",
  actionId: "aX9kQ2mPz7RtLw4nB8cYhA",
  acts: [
    {
      type: "answer",
      itemId: "plan",
      rev: 1,
      asSent: true,
      note: "Va bene così.",
      derived: { "plan__tree.count": 3 },
      when,
    },
  ],
};

/** A draft record whose "plan" answer is held for Submit as accepted. */
export const acceptAsSentDraft: DraftMessage = {
  version: BOARD_PROTOCOL_VERSION,
  type: "draft",
  record: {
    delivery: "submitted",
    questions: { plan: { rev: 1, held: { act: "answer", order: 0, asSent: true } } },
  },
};

/** The answer event the agent collects. */
export const acceptAsSentEvent: AnswerEvent = {
  cursor: "k3x9.1",
  type: "answer",
  itemId: "plan",
  rev: 1,
  who: "Sara Conti",
  when,
  asSent: true,
  note: "Va bene così.",
  derived: { "plan__tree.count": 3 },
};

/** The board state after it, with its receipt. */
export const acceptAsSentState: LifecycleHostMessage = {
  version: BOARD_PROTOCOL_VERSION,
  type: "state",
  state: {
    ask: "waiting",
    questions: [
      {
        itemId: "plan",
        rev: 1,
        state: "answered",
        answer: { asSent: true, note: "Va bene così.", when, receipt: "sent" },
      },
    ],
  },
};

/** `fetch` of the accepted question: its answer holds `asSent`. */
export const acceptAsSentFetch: FetchResult = {
  versions: RESULT_VERSIONS,
  epoch: "k3x9",
  askId: "plan-review-p8r3",
  state: "answered",
  item: {
    type: "question",
    id: "plan",
    rev: 1,
    props: { text: "Is the plan right?" },
    state: "answered",
    answer: {
      cursor: "k3x9.1",
      asSent: true,
      note: "Va bene così.",
      derived: { "plan__tree.count": 3 },
      who: "Sara Conti",
      when,
    },
  },
};
