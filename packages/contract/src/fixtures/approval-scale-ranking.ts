// The Approval, Scale and Ranking's fixtures (approval-scale-ranking, design decisions 1, 2 and
// 10): `withWidgetTypes`, which tests use to give the shipped registry the entries that are not yet
// in it, each type's example items and results, and one answer of the three: the act that sends it
// and the event that logs it. Each takes its version from its constant. Tests only; no shipped
// unit imports them.

import { type ActCommand, BOARD_PROTOCOL_VERSION } from "../schemas/board-protocol/index.ts";
import type { AnswerEvent } from "../schemas/output/index.ts";
import { RESULT_VERSIONS } from "../schemas/tool-envelopes/index.ts";
import type { ApprovalItem } from "../widgets/approval/index.ts";
import { WIDGET_TYPES, type WidgetType } from "../widgets/registry.ts";

/**
 * The shipped registry then each given entry whose type it does not hold, each type once: the
 * registry a test passes where a type is not registered yet (design decision 10). The same test
 * passes before and after the type joins `WIDGET_TYPES`.
 */
export const withWidgetTypes = (...entries: readonly WidgetType[]): readonly WidgetType[] => {
  const held = new Set(WIDGET_TYPES.map(({ type }) => type));
  const added = entries.filter(({ type }) => {
    if (held.has(type)) return false;
    held.add(type);
    return true;
  });
  return [...WIDGET_TYPES, ...added];
};

/** An Approval, last in the question it approves. */
export const APPROVAL_FIXTURE_ITEM: ApprovalItem = { type: "approval", id: "verdict", props: {} };

/** An Approval's result of each decision. */
export const APPROVAL_RESULTS = {
  approve: { decision: "approve" },
  approveWithChanges: { decision: "approve-with-changes" },
  reject: { decision: "reject" },
} as const;

/** A slider with a unit, a rating with labels and a range, in a question's items. */
export const SCALE_FIXTURE_ITEMS = [
  { type: "scale", id: "share", props: { min: 0, max: 100, step: 5, unit: "%" } },
  {
    type: "scale",
    id: "mood",
    props: { min: 1, max: 5, display: "rating", minLabel: "Low", maxLabel: "High" },
  },
  { type: "scale", id: "budget", props: { min: 0, max: 100, step: 5, range: true, unit: "k" } },
] as const;

/** A result of each of the three Scales, on a step of its own. */
export const SCALE_RESULTS = {
  slider: { value: 35 },
  rating: { value: 4 },
  range: { low: 20, high: 60 },
} as const;

/** A Ranking of three items. */
export const RANKING_FIXTURE_ITEM = {
  type: "ranking",
  id: "priorities",
  props: {
    items: [
      { id: "speed", label: "Speed", description: "How fast it answers" },
      { id: "cost", label: "Cost" },
      { id: "comfort", label: "Comfort" },
    ],
  },
} as const;

/** The Ranking's result: each of its items once, in the user's order. */
export const RANKING_RESULT = { order: ["cost", "speed", "comfort"] } as const;

const SESSION = {
  epoch: "k3x9",
  askId: "review-widgets-r4q7",
  question: "review",
} as const;
const WHEN = "2026-11-07T10:15:00Z";
const WHO = "Sara Conti";
const NOTE = "Show the training line as an optional extra.";

/** The session of the answer fixtures: its epoch, ask and the question that holds the three. */
export const RESULT_WIDGETS_SESSION = SESSION;

/** The results of the three widgets of one question, by item ID. */
export const RESULT_WIDGETS_RESULTS = {
  [APPROVAL_FIXTURE_ITEM.id]: APPROVAL_RESULTS.approveWithChanges,
  share: SCALE_RESULTS.slider,
  [RANKING_FIXTURE_ITEM.id]: RANKING_RESULT,
} as const;

/** The act that sends an Approval's verdict with its reason: a result and the note, no edit. */
export const approvalAct: ActCommand = {
  version: BOARD_PROTOCOL_VERSION,
  type: "act",
  actionId: "qL4nS9mXw3UtM7vYz2dAqF",
  acts: [
    {
      type: "answer",
      itemId: SESSION.question,
      rev: 1,
      note: NOTE,
      results: { [APPROVAL_FIXTURE_ITEM.id]: APPROVAL_RESULTS.approveWithChanges },
      when: WHEN,
    },
  ],
};

/** The act that sends the three widgets' results with the note. */
export const resultWidgetsAct: ActCommand = {
  ...approvalAct,
  actionId: "rM5oT0nYx4VuN8wZa3eBrG",
  acts: [
    {
      type: "answer",
      itemId: SESSION.question,
      rev: 1,
      note: NOTE,
      results: RESULT_WIDGETS_RESULTS,
      when: WHEN,
    },
  ],
};

/** The event that logs an Approval's verdict beside the edit of another item of its question. */
export const approvalAnswerEvent: AnswerEvent = {
  cursor: `${SESSION.epoch}.1`,
  type: "answer",
  itemId: SESSION.question,
  rev: 1,
  who: WHO,
  when: WHEN,
  note: NOTE,
  changes: [{ op: "set", target: "wbs.ux.label", value: "UX design" }],
  results: { [APPROVAL_FIXTURE_ITEM.id]: APPROVAL_RESULTS.approveWithChanges },
};

/** The event that logs the three widgets' results. */
export const resultWidgetsAnswerEvent: AnswerEvent = {
  cursor: `${SESSION.epoch}.1`,
  type: "answer",
  itemId: SESSION.question,
  rev: 1,
  who: WHO,
  when: WHEN,
  note: NOTE,
  results: RESULT_WIDGETS_RESULTS,
};

/** What `fetch` returns for the Ranking alone: its props and its latest answer's order. */
export const rankingFetchItemResult: Readonly<Record<string, unknown>> = {
  versions: RESULT_VERSIONS,
  epoch: SESSION.epoch,
  askId: SESSION.askId,
  state: "answered",
  item: {
    ...RANKING_FIXTURE_ITEM,
    questionId: SESSION.question,
    state: "answered",
    result: RANKING_RESULT,
  },
  unchecked: true,
};
