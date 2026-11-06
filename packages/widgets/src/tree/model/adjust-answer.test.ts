import { describe, expect, test } from "bun:test";
import {
  ANSWER_EVENT_MAX_CHARS,
  elementChanges,
  TREE_MAX_NODES,
  TREE_SHAPE,
  type TreeNode,
  type TreeProps,
} from "@askboard/contract";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import { liveGraph, sentGraph } from "../../graph/index.ts";
import { applyAdjustment, planAdjustment } from "./adjust.ts";
import { marksOf } from "./marks.ts";
import { pertDerived } from "./pert.ts";
import { NO_SELECTION, selectAll, toggle } from "./selection.ts";

// A bulk adjustment is changes (spec, "A bulk adjustment is changes" and "Tree change highlight"):
// the adjusted value goes through the real answer path, the contract's diff and the board's graph.
const [question] = uj2ExpandedBoardDocument.items;
const [WBS, PLAN] = question.props.items;
const TREE = "wbs__tree";
const sent = WBS.props as unknown as TreeProps;
const FIELDS = ["optimistic", "mostLikely", "pessimistic"];

const adjusted = (value: TreeProps, fields: string[], tenths: number, ids = selectAll(value)) =>
  applyAdjustment(value, planAdjustment(value, ids, fields, tenths));

describe("an adjustment of two most likely estimates", () => {
  const ids = toggle(toggle(NO_SELECTION, sent, "portal"), sent, "reporting");
  const edited = adjusted(sent, ["mostLikely"], 100, ids);

  test("marks each changed cell and counts each node once", () => {
    const marks = marksOf(sent, edited);
    expect(marks.count).toBe(2);
    expect([...marks.byNode].map(([id, mark]) => [id, mark.fields])).toEqual([
      ["portal", ["mostLikely"]],
      ["reporting", ["mostLikely"]],
    ]);
  });

  test("gives one set per changed value and nothing else", () => {
    const changes = elementChanges(TREE, sent, edited, TREE_SHAPE);
    expect(changes.map((change) => [change.op, change.target])).toEqual([
      ["set", `${TREE}.portal.mostLikely`],
      ["set", `${TREE}.reporting.mostLikely`],
    ]);
  });

  test("carries the derived values as they stood: the rolled-up ones follow the edit", () => {
    const items = [WBS, PLAN];
    const draft = new Map<string, unknown>([[TREE, edited]]);
    const board = { items, draft, shown: draft };
    const live = liveGraph(board);
    const before = sentGraph(board);
    if (live === undefined || before === undefined) throw new Error("the board computes nothing");
    const derived = pertDerived(live, before, TREE, edited.nodes);
    expect(Object.keys(derived)).toContain(`${TREE}.portal.expected`);
    expect(Object.keys(derived)).toContain(`${TREE}.expected`);
    expect(derived[`${TREE}.expected`]).not.toBe(40.67);
  });
});

describe("a very large adjustment", () => {
  test("of three estimates of a 500-node Tree gives changes over the answer limit: the too-large path", () => {
    const leaves: TreeNode[] = Array.from({ length: TREE_MAX_NODES }, (_, at) => ({
      id: `leaf${at}`,
      label: `Leaf ${at}`,
      optimistic: 10 + (at % 7),
      mostLikely: 20 + (at % 11),
      pessimistic: 40 + (at % 13),
    }));
    const big = { ...sent, nodes: leaves } as unknown as TreeProps;
    const edited = adjusted(big, FIELDS, 100);
    const changes = elementChanges(TREE, big, edited, TREE_SHAPE);
    expect(changes.length).toBeGreaterThan(1000);
    expect(JSON.stringify(changes).length).toBeGreaterThan(ANSWER_EVENT_MAX_CHARS);
  });
});
