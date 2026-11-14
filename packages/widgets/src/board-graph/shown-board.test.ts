import { describe, expect, test } from "bun:test";
import { TREE_SHAPE } from "@askboard/contract";
import {
  TABLE_FIXTURE_ITEM,
  uj2ExpandedBoardDocument,
  uj2ExpandedEditedValues,
} from "@askboard/contract/fixtures";
import type { BoardContent, BoardWidgetItem } from "@askboard/view/catalog";
import { summaryItemsOf } from "../approval/items.ts";
import { summarise } from "../approval/summary.ts";
import { liveGraph } from "./board-graph.ts";
import { linkedPlans } from "./plan-link.ts";

// The board over the revision the card shows (document-review, task 6.19; design decision 15). The
// shell builds each board from the document with every question at the revision its card shows, so
// that a card that shows revision 1 after the agent's revision 2 removed a Tree, the Gantt over it
// and a Table reads a board that still holds them. Two boards stand for the two revisions: the
// shown one (revision 1) holds the work breakdown, its plan, the Table and an Approval; the current
// one (revision 2) holds the Approval alone.
const [question] = uj2ExpandedBoardDocument.items;
const [WBS, PLAN] = question.props.items;
const VERDICT: BoardWidgetItem = { type: "approval", id: "verdict", props: {} };
const TABLE = { ...TABLE_FIXTURE_ITEM };

const boardOf = (items: readonly BoardWidgetItem[], shown: ReadonlyMap<string, unknown>) =>
  ({
    items,
    questionItems: new Map([[question.id, items.map((item) => item.id)]]),
    draft: shown,
    shown,
  }) satisfies BoardContent;

const EDITED = new Map<string, unknown>([[PLAN.id, uj2ExpandedEditedValues[PLAN.id]]]);
const shownBoard = boardOf([WBS, PLAN, TABLE, VERDICT], EDITED);
const currentBoard = boardOf([VERDICT], new Map());

describe("the board over the shown revision, as the widgets read it", () => {
  test("linkedPlans gives revision 1's plans for its Tree; the current board gives none", () => {
    expect(linkedPlans(shownBoard, WBS.id).map((plan) => plan.id)).toEqual([PLAN.id]);
    expect(linkedPlans(currentBoard, WBS.id)).toEqual([]);
  });

  test("the Approval's summary counts the edits of a Tree only revision 1 holds", () => {
    const tree = uj2ExpandedEditedValues[WBS.id];
    const withTree = boardOf([WBS, VERDICT], new Map([[WBS.id, tree]]));
    const shapeOf = (type: string) => (type === "tree" ? TREE_SHAPE : undefined);
    const run = (board: BoardContent) =>
      summarise({
        items: summaryItemsOf(board, question.id, VERDICT.id),
        shapeOf,
        locale: "en-US",
        words: { on: "on", off: "off", none: "-" },
      });
    expect(tree).toBeDefined();
    expect(run(withTree).count).toBeGreaterThan(0);
    expect(run(currentBoard).count).toBe(0);
  });

  test("the live graph holds the plan and the Table of revision 1; the current board holds nothing to compute", () => {
    expect(liveGraph(shownBoard)).toBeDefined();
    expect(liveGraph(currentBoard)).toBeUndefined();
  });
});
