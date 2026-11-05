import { describe, expect, test } from "bun:test";
import { ganttPlanBoardDocument, treeEditedValue } from "@askboard/contract/fixtures";
import { linkedTree, treeNodesOf } from "./link.ts";

const [question] = ganttPlanBoardDocument.items;
const [WBS, SCHEDULE] = question.props.items;
// The board's items as the port gives them: every question's items, flattened.
const ITEMS = [WBS, SCHEDULE];

const planNaming = (workPackages: string) => ({
  ...SCHEDULE,
  props: { ...SCHEDULE.props, workPackages },
});

describe("a Gantt plan's link to its Tree (gantt-widget design decision 9, AD-10)", () => {
  test("gives the Tree the fixture plan names, as the board sent it", () => {
    expect(linkedTree(SCHEDULE, ITEMS)).toBe(WBS);
  });

  test("is checked against every item of the board, wherever the Tree sits", () => {
    const other = { type: "tree", id: "other", props: WBS.props };
    expect(linkedTree(SCHEDULE, [SCHEDULE, other, WBS])).toBe(WBS);
  });

  test("throws for work packages that name no item, naming the plan and the problem", () => {
    expect(() => linkedTree(planNaming("missing"), ITEMS)).toThrow(
      'the Gantt plan "schedule" refuses its link: /workPackages: plan schedule: its work packages missing name no item',
    );
  });

  test("throws for work packages that name an item that is no Tree", () => {
    expect(() => linkedTree(planNaming("schedule"), ITEMS)).toThrow("name a gantt, not a Tree");
  });

  test("throws for a Tree without the three estimates as number columns", () => {
    const tree = { ...WBS, props: { ...WBS.props, columns: WBS.props.columns?.slice(1) } };
    expect(() => linkedTree(SCHEDULE, [tree, SCHEDULE])).toThrow("has no number column optimistic");
  });
});

// The board's shown values: each item's draft value, else its question's latest answer's.
const showing = (shown: ReadonlyMap<string, unknown>) => ({ shown });

describe("the nodes of a plan's Tree", () => {
  test("are the Tree's as sent while the board shows no value for it", () => {
    expect(treeNodesOf(WBS, showing(new Map()))).toBe(WBS.props.nodes);
    expect(treeNodesOf(WBS, showing(new Map([["schedule", SCHEDULE.props]])))).toBe(
      WBS.props.nodes,
    );
  });

  test("are the ones the board shows: the draft's once the user edited the Tree, or the answer's on a question being revised (molecules, design decision 11)", () => {
    expect(treeNodesOf(WBS, showing(new Map([["wbs", treeEditedValue]])))).toBe(
      treeEditedValue.nodes,
    );
    const revised = { draft: new Map(), shown: new Map([["wbs", treeEditedValue]]) };
    expect(treeNodesOf(WBS, revised)).toBe(treeEditedValue.nodes);
  });
});
