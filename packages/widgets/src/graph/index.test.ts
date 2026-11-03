import { describe, expect, test } from "bun:test";
import {
  uj2ExpandedBoardDocument,
  uj2ExpandedDerived,
  uj2ExpandedEditedValues,
} from "@askboard/contract/fixtures";
import type { BoardContent } from "@askboard/view/catalog";
import { liveGraph, sentGraph } from "./index.ts";

// The expanded UJ-2 board's items, the WBS `wbs__tree` and the plan `schedule__plan` over it.
const [question] = uj2ExpandedBoardDocument.items;

// The board the shell gives every item for a draft record: one object per record.
const boardFor = (
  items: BoardContent["items"],
  draft: ReadonlyMap<string, unknown>,
): BoardContent => ({ items, draft, shown: draft });

describe("one graph for the WBS and the plan (molecules, design decision 13; view spec, The board graph chunk)", () => {
  test("the WBS and the plan reading one board read one graph, the board as sent until the draft holds a value", () => {
    const items = [...question.props.items];
    const board = boardFor(items, new Map());
    const forTree = liveGraph(board);
    expect(liveGraph(board)).toBe(forTree);
    expect(forTree).toBe(sentGraph(board));
    // The approved ask's values (molecules, task 7.1).
    expect(forTree?.read("wbs__tree.expected")).toBeCloseTo(40.67, 2);
    expect(forTree?.read("schedule__plan.finishDate")).toBe("2026-12-11");
  });

  test("a draft update gives one live graph build, which both read, and a later update another", () => {
    const items = [...question.props.items];
    const before = liveGraph(boardFor(items, new Map()));
    const edited = boardFor(items, new Map(Object.entries(uj2ExpandedEditedValues)));
    const forTree = liveGraph(edited);
    const forPlan = liveGraph(edited);
    expect(forPlan).toBe(forTree);
    expect(forTree).not.toBe(before);
    // The approved answer's derived values, as the WBS and the plan report them.
    const total: unknown = forTree?.read("wbs__tree.expected");
    expect(total).toBe(uj2ExpandedDerived["wbs__tree.expected"]);
    // The plan's derived `finish` is its finish date (gantt-widget design decision 10).
    const finish: unknown = forPlan?.read("schedule__plan.finishDate");
    expect(finish).toBe(uj2ExpandedDerived["schedule__plan.finish"]);
    // The same values in a new record are a new draft update: the board's graph moves on once.
    const again = boardFor(items, new Map(Object.entries(uj2ExpandedEditedValues)));
    const next = liveGraph(again);
    expect(liveGraph(again)).toBe(next);
    expect(next?.read("schedule__plan.finishDate")).toBe("2026-12-02");
  });
});
