// The Snapshot fixtures (snapshot design decision 2): the Snapshot data of an agent's Snapshot of
// E3's lifecycle ask, built from its fixtures. The agent has added the launch question and recorded
// the user's answer to it, reworded the rollout question to rev 2 and replied to its follow-up; the
// log is the lifecycle collect result's, then a postpone of the analytics question. So the data
// holds both areas, a postponed question, a decline, a recorded answer, an answer on the rollout
// question's older rev 1 (kept in `revisions`), a thread with a reply, and the ask's origin.

import { originMessage } from "../push/origin-message.ts";
import type {
  BoardArea,
  BoardQuestion,
  LifecycleBoardDocument,
} from "../schemas/board-document/index.ts";
import {
  BOARD_PROTOCOL_VERSION,
  type LifecycleBoardState,
  type LifecycleQuestionStatus,
} from "../schemas/board-protocol/index.ts";
import type { AddAction, ChangeAction, ReplyAction, UpdateAction } from "../schemas/input/index.ts";
import { OUTPUT_FORMAT_VERSION } from "../schemas/output/index.ts";
import { SNAPSHOT_DATA_VERSION, type SnapshotData } from "../schemas/snapshot-data/index.ts";
import {
  LIFECYCLE,
  lifecycleBoardDocument,
  lifecycleCollectResult,
  lifecycleUpdate,
} from "./lifecycle.ts";

const { epoch, askId } = LIFECYCLE;
const at = (seq: number) => `${epoch}.${seq}`;
const time = (minute: number) => `2026-10-31T14:${String(minute).padStart(2, "0")}:00Z`;
const sara = "Sara Conti";

// The lifecycle update's action of a kind, which the Snapshot's agent applied too.
const actionOf = <K extends UpdateAction["action"]>(kind: K) =>
  lifecycleUpdate.actions.find((action) => action.action === kind) as Extract<
    UpdateAction,
    { action: K }
  >;

const added: AddAction = actionOf("add");
const reworded: ChangeAction = actionOf("change");
const reply: ReplyAction = actionOf("reply");

const launch = { ...added.item, rev: 1 } as BoardQuestion;

const [scope, delivery] = lifecycleBoardDocument.items as readonly [BoardArea, BoardArea];
const [rollout] = delivery.props.items;

// The delivery area once rollout is at rev 2 and launch follows the last question.
const deliveryNow: BoardArea = {
  ...delivery,
  props: {
    ...delivery.props,
    items: [
      ...delivery.props.items.map((question) =>
        question.id === rollout.id
          ? { ...question, rev: 2, props: { ...question.props, ...reworded.props } }
          : question,
      ),
      launch,
    ] as unknown as BoardArea["props"]["items"],
  },
};

const document: LifecycleBoardDocument = { ...lifecycleBoardDocument, items: [scope, deliveryNow] };

const [logged] = lifecycleCollectResult.asks;
const events = [
  ...(logged?.events ?? []),
  { cursor: at(11), type: "postponed", itemId: "analytics", rev: 1 } as const,
];

const delivered = { receipt: "delivered" } as const;

// Every question in board order, as the board's state shows it after the log and the updates.
const questions: readonly LifecycleQuestionStatus[] = [
  {
    itemId: "region",
    rev: 1,
    state: "answered",
    answer: {
      choice: ["EU", "US"],
      optionNotes: { US: "East coast only, at first." },
      when: time(5),
      ...delivered,
    },
  },
  {
    itemId: "payment",
    rev: 1,
    state: "answered",
    answer: { choice: ["Adyen"], when: time(13), ...delivered },
  },
  { itemId: "analytics", rev: 1, state: "postponed" },
  {
    itemId: "rollout",
    rev: 2,
    state: "answered",
    answer: { choice: ["Behind a flag"], when: time(12), ...delivered },
    thread: [
      {
        cursor: reply.followUp,
        who: sara,
        when: time(7),
        text: "Why behind a flag?",
        replies: [{ text: reply.text, when: "2026-10-31T14:09:30Z" }],
      },
    ],
  },
  {
    itemId: "erp-export",
    rev: 1,
    state: "declined",
    answer: { declined: true, note: "Finance decides this.", when: time(14), receipt: "sent" },
  },
  {
    itemId: "launch",
    rev: 1,
    state: "answered",
    answer: { choice: ["Before Black Friday"], when: time(16), ...delivered, recorded: true },
  },
];

const state: LifecycleBoardState = {
  ask: "answered",
  questions: questions as LifecycleBoardState["questions"],
};

/** The agent's Snapshot of the lifecycle ask, with its origin, taken after the postpone. */
export const lifecycleSnapshotData: SnapshotData = {
  versions: {
    snapshot: SNAPSHOT_DATA_VERSION,
    output: OUTPUT_FORMAT_VERSION,
    boardProtocol: BOARD_PROTOCOL_VERSION,
  },
  snapshot: { takenAt: "2026-10-31T14:30:00Z", takenBy: "agent" },
  epoch,
  askId,
  document,
  revisions: [{ itemId: rollout.id, rev: 1, props: rollout.props }],
  state,
  origin: originMessage("/home/sara/shop", {
    origin: { label: "Main agent", directory: ".", branch: "feat/checkout" },
    agentName: "Planner",
    forUser: sara,
  }),
  events: events.map((event) => ({ event })) as SnapshotData["events"],
};
