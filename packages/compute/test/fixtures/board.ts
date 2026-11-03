// The board's graph source fixtures (gantt-widget, task 7.4): the UJ-2 question's Tree and Gantt
// plan as the contract's fixtures write them, mapped by `boardGraphSource`. As sent, every value is
// the one the approved example's data give (`uj2-wbs-gantt.json`); after the approved answer's
// edits, the plan finishes on 2026-12-02 with UX design, the prototype, the portal and reporting
// critical, as the answer's derived values say. The same question as the molecules' expansion
// gives it (molecules, design decision 10), its Tree `wbs__tree` with `pert`, gives the same values
// under the expanded IDs, the Tree alone included.

import {
  ganttPlanBoardDocument,
  ganttPlanEditedValue,
  treeEditedValue,
  uj2ExpandedEditedValues,
  uj2ExpandedQuestion,
} from "@askboard/contract/fixtures";
import type { BoardSourceItem } from "../../src/board.ts";
import type { Address } from "../../src/types.ts";
import type { Expected } from "./index.ts";
import uj2 from "./uj2-wbs-gantt.json" with { type: "json" };

export type BoardSourceFixture = {
  readonly name: string;
  /** A question's items, as the board's graph source reads them. */
  readonly items: readonly BoardSourceItem[];
  readonly expected: Readonly<Record<Address, Expected>>;
};

const [question] = ganttPlanBoardDocument.items;
const [WBS, SCHEDULE] = question.props.items;

/** The UJ-2 question's Tree `wbs` and plan `schedule`, as the agent sent them. */
export const UJ2_BOARD: readonly BoardSourceItem[] = [WBS, SCHEDULE];

/** The same Tree and plan as the approved answer left them: `portal` split, `u-1` linked. */
export const UJ2_ANSWERED: readonly BoardSourceItem[] = [
  { ...WBS, props: treeEditedValue },
  { ...SCHEDULE, props: ganttPlanEditedValue },
];

const [TREE, PLAN] = uj2ExpandedQuestion.props.items;

/** The expanded UJ-2 question's Tree `wbs__tree`, with `pert`, and plan `schedule__plan`. */
export const UJ2_EXPANDED: readonly BoardSourceItem[] = [TREE, PLAN];

/** The expanded Tree and plan as the approved answer left them. */
export const UJ2_EXPANDED_ANSWERED: readonly BoardSourceItem[] = [
  { ...TREE, props: uj2ExpandedEditedValues[TREE.id] },
  { ...PLAN, props: uj2ExpandedEditedValues[PLAN.id] },
];

/** `expected` with each address under `wbs` and `schedule` moved to the expanded IDs. */
const expanded = (expected: Readonly<Record<Address, Expected>>, only?: string) =>
  Object.fromEntries(
    Object.entries(expected)
      .filter(([address]) => only === undefined || address.startsWith(`${only}.`))
      .map(([address, value]) => [
        address.replace(/^wbs\./, `${TREE.id}.`).replace(/^schedule\./, `${PLAN.id}.`),
        value,
      ]),
  );

// Each leaf's duration, start, finish and critical flag after the approved answer's edits.
const ANSWERED: readonly [string, number, string, string, boolean][] = [
  ["ux", 5, "2026-11-02", "2026-11-06", true],
  ["architecture", 4, "2026-11-02", "2026-11-05", false],
  ["prototype", 5, "2026-11-09", "2026-11-13", true],
  ["portal", 7, "2026-11-16", "2026-11-24", true],
  ["u-1", 8, "2026-11-16", "2026-11-25", false],
  ["billing", 10, "2026-11-06", "2026-11-19", false],
  ["reporting", 6, "2026-11-25", "2026-12-02", true],
];

export const BOARD_SOURCE_FIXTURES: readonly BoardSourceFixture[] = [
  { name: "uj2", items: UJ2_BOARD, expected: uj2.expected as Record<Address, Expected> },
  {
    name: "uj2-answered",
    items: UJ2_ANSWERED,
    expected: {
      "schedule.finish": 23,
      "schedule.finishDate": "2026-12-02",
      ...Object.fromEntries(
        ANSWERED.flatMap(([task, duration, start, finish, critical]) => [
          [`schedule.${task}.duration`, duration],
          [`schedule.${task}.startDate`, start],
          [`schedule.${task}.finishDate`, finish],
          [`schedule.${task}.critical`, critical],
        ]),
      ),
    },
  },
];

const [UJ2, UJ2_ANSWERED_FIXTURE] = BOARD_SOURCE_FIXTURES as readonly [
  BoardSourceFixture,
  BoardSourceFixture,
];

/** The UJ-2 fixtures again on the expanded question, and its Tree alone. */
export const EXPANDED_SOURCE_FIXTURES: readonly BoardSourceFixture[] = [
  { name: "uj2-expanded", items: UJ2_EXPANDED, expected: expanded(UJ2.expected) },
  { name: "uj2-expanded-wbs", items: [TREE], expected: expanded(UJ2.expected, "wbs") },
  {
    name: "uj2-expanded-answered",
    items: UJ2_EXPANDED_ANSWERED,
    expected: expanded(UJ2_ANSWERED_FIXTURE.expected),
  },
];
