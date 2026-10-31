// The board-protocol messages of the lifecycle ask (ask-lifecycle, design decision 8): what its
// transcripts record and what the protocol examples add, one valid message of each 1.1 type.

import type { BoardQuestion, LifecycleBoardDocument } from "../schemas/board-document/index.ts";
import {
  type ActCommand,
  BOARD_PROTOCOL_VERSION,
  type DraftMessage,
  type LifecycleBoardState,
  type LifecycleHostMessage,
  type LifecyclePageMessage,
} from "../schemas/board-protocol/index.ts";
import type { UpdateInput } from "../schemas/input/index.ts";
import { lifecycleBoardDocument, lifecycleDraftRecord } from "./lifecycle.ts";

const version = BOARD_PROTOCOL_VERSION;
const when = "2026-10-31T14:05:12Z";

/** The action IDs of the transcripts' commands: 22 base64url characters each. */
export const ACTION_IDS = {
  submit: "aX9kQ2mPz7RtLw4nB8cYhA",
  stale: "bY3nR8kLq2WsM6vTx1dZfE",
  closed: "cZ5pT1mNw7QrK4yHs9eXgB",
} as const;

export const lifecycleBoard: LifecycleHostMessage = {
  version,
  type: "board",
  document: lifecycleBoardDocument,
};

// The board's questions in board order, at their revisions.
const questionsOf = (document: LifecycleBoardDocument): readonly BoardQuestion[] =>
  document.items.flatMap((item) => (item.type === "area" ? item.props.items : [item]));

type Status = LifecycleBoardState["questions"][number];

const stateOf = (
  ask: LifecycleBoardState["ask"],
  document: LifecycleBoardDocument,
  statuses: Readonly<Record<string, Partial<Status>>> = {},
): LifecycleHostMessage => {
  const questions = questionsOf(document).map(
    ({ id, rev }) => ({ itemId: id, rev, state: "open", ...statuses[id] }) as Status,
  );
  return {
    version,
    type: "state",
    state: { ask, questions: questions as unknown as LifecycleBoardState["questions"] },
  };
};

export const lifecycleWaiting = stateOf("waiting", lifecycleBoardDocument);

/** Submit in submitted delivery: two answers and a postpone, in the user's order. */
export const lifecycleSubmit: ActCommand = {
  version,
  type: "act",
  actionId: ACTION_IDS.submit,
  acts: [
    {
      type: "answer",
      itemId: "region",
      rev: 1,
      choice: ["EU", "US"],
      optionNotes: { US: "East coast only, at first." },
      when,
    },
    {
      type: "answer",
      itemId: "payment",
      rev: 1,
      other: "Mollie",
      note: "Mollie is cheaper for iDEAL payments.",
      when,
    },
    { type: "postpone", itemId: "erp-export", rev: 1 },
  ],
};

export const lifecycleDone: LifecycleHostMessage = {
  version,
  type: "done",
  actionId: ACTION_IDS.submit,
};

/** The state after the submit: two answers sent, one question postponed, one still open. */
export const lifecycleSubmitted = stateOf("partly-answered", lifecycleBoardDocument, {
  region: {
    state: "answered",
    answer: {
      choice: ["EU", "US"],
      optionNotes: { US: "East coast only, at first." },
      when,
      receipt: "sent",
    },
  },
  payment: {
    state: "answered",
    answer: {
      other: "Mollie",
      note: "Mollie is cheaper for iDEAL payments.",
      when,
      receipt: "sent",
    },
  },
  "erp-export": { state: "postponed" },
});

const reworded = { text: "Which payment provider should checkout use in the EU?" };

/** The agent rewords the payment question, which goes to rev 2. */
export const paymentRewording: UpdateInput = {
  askId: lifecycleBoardDocument.askId,
  actions: [{ action: "change", itemId: "payment", props: reworded }],
};

const revisedDocument: LifecycleBoardDocument = {
  ...lifecycleBoardDocument,
  items: lifecycleBoardDocument.items.map((item) =>
    item.type === "area" && item.id === "scope"
      ? {
          ...item,
          props: {
            ...item.props,
            items: item.props.items.map((question) =>
              question.id === "payment"
                ? {
                    ...question,
                    rev: 2,
                    props: { ...question.props, ...reworded },
                  }
                : question,
            ),
          },
        }
      : item,
  ) as unknown as LifecycleBoardDocument["items"],
};

export const lifecycleRevisedBoard: LifecycleHostMessage = {
  version,
  type: "board",
  document: revisedDocument,
};

export const lifecycleRevisedWaiting = stateOf("waiting", revisedDocument);

/** The same submit, sent with its answer to the payment question still at rev 1. */
export const lifecycleStaleSubmit: ActCommand = { ...lifecycleSubmit, actionId: ACTION_IDS.stale };

export const lifecycleStaleRefusal: LifecycleHostMessage = {
  version,
  type: "refused",
  reason: "act",
  actionId: ACTION_IDS.stale,
  index: 1,
  itemId: "payment",
  detail: "act 1 names revision 1 of the question payment, which is at revision 2",
};

/** The draft record a tab mirrors while the user is still typing, then its last one. */
export const lifecycleFirstDraft: DraftMessage = {
  version,
  type: "draft",
  record: {
    ...lifecycleDraftRecord,
    questions: { ...lifecycleDraftRecord.questions, payment: { rev: 1, other: "Mol" } },
  },
};

export const lifecycleLastDraft: DraftMessage = {
  version,
  type: "draft",
  record: lifecycleDraftRecord,
};

/** The agent closes the ask. */
export const closing: UpdateInput = {
  askId: lifecycleBoardDocument.askId,
  actions: [{ action: "close" }],
};

export const lifecycleClosed: LifecycleHostMessage = { version, type: "closed", reason: "agent" };

/** An answer sent once the ask is closed. */
export const lifecycleLateAnswer: ActCommand = {
  version,
  type: "act",
  actionId: ACTION_IDS.closed,
  acts: [{ type: "answer", itemId: "rollout", rev: 1, choice: ["Behind a flag"], when }],
};

export const lifecycleClosedRefusal: LifecycleHostMessage = {
  version,
  type: "refused",
  reason: "closed",
  actionId: ACTION_IDS.closed,
  detail: "the ask is closed",
};

export const lifecycleClosedState = stateOf("closed", lifecycleBoardDocument);

/** One valid message of each type protocol 1.1 adds, in each direction. */
export const lifecycleProtocolExamples: {
  readonly toHost: readonly LifecyclePageMessage[];
  readonly toPage: readonly LifecycleHostMessage[];
} = {
  toHost: [lifecycleSubmit, lifecycleLastDraft],
  toPage: [
    lifecycleBoard,
    lifecycleSubmitted,
    lifecycleClosedState,
    lifecycleDone,
    lifecycleLastDraft,
    lifecycleClosed,
    lifecycleStaleRefusal,
    lifecycleClosedRefusal,
    { version, type: "discarded", reason: "board-closed" },
  ],
};
