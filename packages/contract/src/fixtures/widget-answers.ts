// The widget answer fixtures (widget-answers, task 1.5), on the approved UJ-2 ask: the board's `act`
// for the Tree and the plan the user edited, the board state that logs it, the `fetch` of the
// reference `wbs`, and an answer event too large for a result. The board holds the question as
// `ask-core` expanded it (`wbs__tree`, `schedule__plan`); the agent's results name the references
// (`wbs`, `schedule`), which `ask-core` maps between (AD-9). Built on the molecules' fixtures.

import type { LifecycleBoardState } from "../schemas/board-protocol/index.ts";
import { type ActCommand, BOARD_PROTOCOL_VERSION } from "../schemas/board-protocol/index.ts";
import type { AnswerEvent } from "../schemas/output/index.ts";
import { type FetchResult, RESULT_VERSIONS } from "../schemas/tool-envelopes/index.ts";
import { uj2ExpandedDerived, uj2ExpandedEditedValues } from "./molecules.ts";

const version = BOARD_PROTOCOL_VERSION;
const when = "2026-11-02T09:30:00Z";

/** The UJ-2 session of the widget answer transcript: its ask, epoch and token. */
export const UJ2_SESSION = {
  epoch: "k3x9",
  askId: "portal-sow-plan-t2v6",
  token: "Wq4nT8xKd2RmP6vLc9bYhA",
  actionId: "dK3mR8nQw2TsL6vXy1cZpE",
  refusedActionId: "eL4nS9oRx3UtM7wYz2dAqF",
} as const;

const [WBS_TREE, SCHEDULE_PLAN] = ["wbs__tree", "schedule__plan"] as const;

/** The answer the board sends: both items as the user left them, with every derived value. */
export const uj2WidgetAnswerAct: ActCommand = {
  version,
  type: "act",
  actionId: UJ2_SESSION.actionId,
  acts: [
    {
      type: "answer",
      itemId: "plan",
      rev: 1,
      values: {
        [WBS_TREE]: uj2ExpandedEditedValues[WBS_TREE] as Record<string, unknown>,
        [SCHEDULE_PLAN]: uj2ExpandedEditedValues[SCHEDULE_PLAN] as Record<string, unknown>,
      },
      derived: uj2ExpandedDerived,
      when,
    },
  ],
};

/** The same answer with the Tree's columns edited, which an answer cannot change: refused whole. */
export const uj2WidgetRefusedAct: ActCommand = {
  ...uj2WidgetAnswerAct,
  actionId: UJ2_SESSION.refusedActionId,
  acts: [
    {
      type: "answer",
      itemId: "plan",
      rev: 1,
      values: {
        [WBS_TREE]: { ...(uj2ExpandedEditedValues[WBS_TREE] as object), columns: [] },
      },
      when,
    },
  ],
};

type StateQuestion = LifecycleBoardState["questions"][number];

const planState = (
  extra: Partial<StateQuestion>,
  ask: LifecycleBoardState["ask"] = "waiting",
): LifecycleBoardState => ({
  ask,
  questions: [{ itemId: "plan", rev: 1, state: "open", ...extra } as StateQuestion],
});

/** The refusal of that answer, naming the action, the act, the question and what is wrong. */
export const uj2WidgetActRefusal = {
  version,
  type: "refused",
  reason: "act",
  actionId: UJ2_SESSION.refusedActionId,
  index: 0,
  itemId: "plan",
  detail:
    "act 0 changes the columns of wbs__tree, which an answer cannot change: the Tree's columns are the agent's",
} as const;

/** The board state before any answer. */
export const uj2WidgetWaitingState = { version, type: "state", state: planState({}) } as const;

/** The board state after the answer: the logged values by expanded ID, and no derived value. */
export const uj2WidgetAnsweredState = {
  version,
  type: "state",
  state: planState(
    {
      state: "answered",
      answer: {
        values: {
          [WBS_TREE]: uj2ExpandedEditedValues[WBS_TREE] as Record<string, unknown>,
          [SCHEDULE_PLAN]: uj2ExpandedEditedValues[SCHEDULE_PLAN] as Record<string, unknown>,
        },
        when,
        receipt: "sent",
      },
    } as Partial<StateQuestion>,
    "answered",
  ),
} as const;

/** What `fetch` returns for the reference `wbs`: a Tree under its own ID, as the user left it. */
export const uj2WidgetFetchResult: FetchResult = {
  versions: RESULT_VERSIONS,
  epoch: UJ2_SESSION.epoch,
  askId: UJ2_SESSION.askId,
  state: "answered",
  item: {
    type: "tree",
    id: "wbs",
    questionId: "plan",
    props: uj2ExpandedEditedValues[WBS_TREE] as Record<string, unknown>,
    state: "answered",
  },
  unchecked: true,
};

/** An answer event whose `changes` and `derived` went over the limit: `fetch` has them. */
export const uj2WidgetTooLargeEvent: AnswerEvent = {
  cursor: `${UJ2_SESSION.epoch}.1`,
  type: "answer",
  itemId: "plan",
  rev: 1,
  who: "Sara Conti",
  when,
  tooLarge: true,
};
