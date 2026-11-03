import { describe, expect, test } from "bun:test";
import type { FormulaError } from "@askboard/compute";
import type { TreeNode } from "@askboard/contract";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import type { BoardContent, BoardWidgetItem } from "@askboard/view/catalog";
import { type BoardGraph, liveGraph } from "../../graph/index.ts";
import { pertRow, pertText, pertTotal } from "./pert.ts";
import { visibleRows } from "./rows.ts";

// The expanded UJ-2 board (molecules design decision 9): the WBS `wbs__tree`, the plan over it.
const [question] = uj2ExpandedBoardDocument.items;
const [WBS, PLAN] = question.props.items;
const TREE = "wbs__tree";

const graphOf = (items: readonly BoardWidgetItem[], draft = new Map<string, unknown>()) => {
  const board: BoardContent = { items, draft, shown: draft };
  const graph = liveGraph(board);
  if (graph === undefined) throw new Error("the board computes nothing");
  return graph;
};

// The WBS's nodes with one node's fields replaced, wherever it sits.
const withFields = (
  nodes: readonly TreeNode[],
  id: string,
  fields: Record<string, number>,
): TreeNode[] =>
  nodes.map((node) =>
    node.id === id
      ? { ...node, ...fields }
      : node.children === undefined
        ? node
        : { ...node, children: withFields(node.children, id, fields) },
  );

// What a row shows: each value's text, or its error's kind, and whether it has estimate cells.
const shown = (graph: BoardGraph, nodes: readonly TreeNode[]) =>
  Object.fromEntries(
    visibleRows(nodes, new Set()).map((row) => {
      const { expected, spread, estimates } = pertRow(graph, TREE, row);
      const text = (value: typeof expected) =>
        value.kind === "value" ? value.text : `error:${value.error.error}`;
      return [row.node.id, [text(expected), text(spread), estimates]];
    }),
  );

const totalText = (graph: BoardGraph, nodes: readonly TreeNode[]) => {
  const total = pertTotal(graph, TREE, nodes);
  return total === undefined
    ? undefined
    : [total.expected, total.spread].map((value) => (value.kind === "value" ? value.text : value));
};

describe("the WBS's values (molecules design decision 14; view spec, WBS layout)", () => {
  test("the UJ-2 work breakdown opens with each package's expected effort and spread, parents with their roll-ups and no estimate cells", () => {
    const graph = graphOf([WBS, PLAN]);
    const rows = shown(graph, WBS.props.nodes);
    expect(rows.ux).toEqual(["5.5 d", "1.2 d", true]);
    expect(rows.design).toEqual(["14.0 d", "1.6 d", false]);
    expect(rows.build?.[2]).toBe(false);
    expect(totalText(graph, WBS.props.nodes)).toEqual(["40.7 d", "3.2 d"]);
  });

  test("with the portal's estimates 4, 6 and 10, the portal, Build and the Total follow", () => {
    const nodes = withFields(WBS.props.nodes, "portal", {
      optimistic: 4,
      mostLikely: 6,
      pessimistic: 10,
    });
    const graph = graphOf([WBS, PLAN], new Map([[TREE, { ...WBS.props, nodes }]]));
    const rows = shown(graph, nodes);
    expect(rows.portal).toEqual(["6.3 d", "1.0 d", true]);
    expect(rows.build?.[0]).toBe("20.3 d");
    expect(totalText(graph, nodes)?.[0]).toBe("34.3 d");
  });

  test("a work breakdown with one top-level package has no Total row: that package's row shows the totals", () => {
    const [, build] = WBS.props.nodes;
    if (build === undefined) throw new Error("the fixture has no Build");
    const solo = { ...WBS, props: { ...WBS.props, nodes: [build] } };
    const graph = graphOf([solo]);
    expect(pertTotal(graph, TREE, solo.props.nodes)).toBeUndefined();
    expect(shown(graph, solo.props.nodes).build?.[0]).toBe(
      pertText(graph.read(`${TREE}.expected`) as number),
    );
  });

  test("a value in error reads as the error with its kind; a value that is no number reads as a value error", () => {
    const cycle: FormulaError = {
      error: "cycle",
      address: `${TREE}.ux.expected`,
      detail: "on a cycle",
    };
    const graph: BoardGraph = {
      read: (address) => (address.endsWith(".expected") ? cycle : "soon"),
      warnings: [],
    };
    const [first] = visibleRows(WBS.props.nodes, new Set());
    if (first === undefined) throw new Error("the fixture has no rows");
    const row = pertRow(graph, TREE, first);
    expect(row.expected).toEqual({ kind: "error", error: cycle });
    expect(row.spread).toMatchObject({ kind: "error", error: { error: "value" } });
    expect(totalText(graph, WBS.props.nodes)?.[0]).toEqual({ kind: "error", error: cycle });
  });
});

describe("the WBS's display text (DESIGN.md Input atoms, the d affix)", () => {
  test("one decimal in en-US with the d affix, half away from zero", () => {
    expect(pertText(5.5)).toBe("5.5 d");
    expect(pertText(14)).toBe("14.0 d");
    expect(pertText(40.666_666)).toBe("40.7 d");
    expect(pertText(0.25)).toBe("0.3 d");
    expect(pertText(1234.56)).toBe("1,234.6 d");
  });
});
