import { describe, expect, test } from "bun:test";
import type { FormulaError } from "@askboard/compute";
import type { TreeNode } from "@askboard/contract";
import {
  uj2ExpandedBoardDocument,
  uj2ExpandedDerived,
  uj2ExpandedEditedValues,
} from "@askboard/contract/fixtures";
import type { BoardContent, BoardWidgetItem } from "@askboard/view/catalog";
import { type BoardGraph, liveGraph, sentGraph } from "../../graph/index.ts";
import {
  PERT_NOT_COMPUTED,
  pertDerived,
  pertNote,
  pertRow,
  pertText,
  pertTotal,
  pertValues,
  rollupNote,
  rollupText,
} from "./pert.ts";
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

  test("a row whose values are in error has a field error under it; one whose values are numbers none (DESIGN.md, Derived value)", () => {
    const cycle: FormulaError = { error: "cycle", address: `${TREE}.ux.expected` };
    const spreadOnly: BoardGraph = {
      read: (address) => (address.endsWith(".spread") ? cycle : 1),
      warnings: [],
    };
    const [first] = visibleRows(WBS.props.nodes, new Set());
    if (first === undefined) throw new Error("the fixture has no rows");
    expect(pertNote(pertRow(spreadOnly, TREE, first))).toBe(PERT_NOT_COMPUTED);
    expect(PERT_NOT_COMPUTED).toBe("No expected effort or spread: they could not be computed.");
    expect(pertNote(pertRow(graphOf([WBS, PLAN]), TREE, first))).toBeUndefined();
  });
});

describe("the values a work breakdown's grid shows (molecules design decision 14)", () => {
  test("each shown row's by node, and the Total row's", () => {
    const graph = graphOf([WBS, PLAN]);
    const rows = visibleRows(WBS.props.nodes, new Set(["build"]));
    const values = pertValues(graph, TREE, rows, WBS.props.nodes);
    expect([...values.rows.keys()]).toEqual(["design", "ux", "architecture", "prototype", "build"]);
    expect(values.rows.get("build")).toEqual(
      pertRow(graph, TREE, rows[4] as (typeof rows)[number]),
    );
    expect(values.total).toEqual(pertTotal(graph, TREE, WBS.props.nodes));
    expect(Object.isFrozen(values)).toBe(true);
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

describe("the derived values a work breakdown reports (contract spec, WBS answer derived values; F7)", () => {
  // The WBS's own derived values among the approved answer's fourteen.
  const approved = Object.fromEntries(
    Object.entries(uj2ExpandedDerived).filter(([key]) => key.startsWith(`${TREE}.`)),
  );
  const items = [WBS, PLAN];

  test("after the approved edits, exactly the approved answer's twelve values of the WBS", () => {
    const draft = new Map(Object.entries(uj2ExpandedEditedValues));
    const live = graphOf(items, draft);
    const sent = sentGraph({ items, draft, shown: draft });
    if (sent === undefined) throw new Error("the board as sent computes nothing");
    const edited = draft.get(TREE) as { readonly nodes: readonly TreeNode[] };
    expect(Object.keys(approved)).toHaveLength(12);
    const derived: unknown = pertDerived(live, sent, TREE, edited.nodes);
    expect(derived).toEqual(approved);
  });

  test("with no edit, the item's expected effort and spread only", () => {
    const graph = graphOf(items);
    expect(pertDerived(graph, graph, TREE, WBS.props.nodes)).toEqual({
      [`${TREE}.expected`]: 40.67,
      [`${TREE}.spread`]: 3.21,
    });
  });

  // A graph reading the values given, by address, and a missing reference for any other.
  const reading = (values: Readonly<Record<string, number | FormulaError>>): BoardGraph => ({
    read: (address) =>
      Object.hasOwn(values, address)
        ? (values[address] as number | FormulaError)
        : { error: "missing-reference", address, detail: `no node ${address}` },
    warnings: [],
  });
  const leaf: readonly TreeNode[] = [{ id: "solo", label: "Solo" }];

  test("a value in error is left out, the item's totals included", () => {
    const cycle = {
      error: "cycle",
      address: `${TREE}.solo.expected`,
      detail: "on a cycle",
    } as const;
    const live = reading({
      [`${TREE}.solo.expected`]: cycle,
      [`${TREE}.solo.spread`]: 2,
      [`${TREE}.expected`]: cycle,
      [`${TREE}.spread`]: 2,
    });
    const sent = reading({ [`${TREE}.solo.spread`]: 1 });
    expect(pertDerived(live, sent, TREE, leaf)).toEqual({
      [`${TREE}.solo.spread`]: 2,
      [`${TREE}.spread`]: 2,
    });
  });

  test("a value no rounding keeps finite is left out, as a value in error is", () => {
    const live = reading({
      [`${TREE}.solo.expected`]: Number.POSITIVE_INFINITY,
      [`${TREE}.solo.spread`]: 1,
      [`${TREE}.expected`]: Number.NaN,
      [`${TREE}.spread`]: 1,
    });
    expect(pertDerived(live, reading({}), TREE, leaf)).toEqual({
      [`${TREE}.solo.spread`]: 1,
      [`${TREE}.spread`]: 1,
    });
  });

  test("a node whose value differs only beyond the second decimal is not reported; one the agent did not send is", () => {
    const live = reading({
      [`${TREE}.solo.expected`]: 2.0049,
      [`${TREE}.solo.spread`]: 1.2341,
      [`${TREE}.added.expected`]: 1,
      [`${TREE}.added.spread`]: 0,
      [`${TREE}.expected`]: 3.0049,
      [`${TREE}.spread`]: 1.2341,
    });
    const sent = reading({ [`${TREE}.solo.expected`]: 2.0011, [`${TREE}.solo.spread`]: 1.2349 });
    const nodes: readonly TreeNode[] = [...leaf, { id: "added", label: "Added" }];
    expect(pertDerived(live, sent, TREE, nodes)).toEqual({
      [`${TREE}.added.expected`]: 1,
      [`${TREE}.added.spread`]: 0,
      [`${TREE}.expected`]: 3,
      [`${TREE}.spread`]: 1.23,
    });
  });

  test("a parent's values count as a node's, children walked at any depth", () => {
    const nodes: readonly TreeNode[] = [
      { id: "top", label: "Top", children: [{ id: "deep", label: "Deep" }] },
    ];
    const live = reading({
      [`${TREE}.top.expected`]: 5,
      [`${TREE}.top.spread`]: 1,
      [`${TREE}.deep.expected`]: 5,
      [`${TREE}.deep.spread`]: 1,
      [`${TREE}.expected`]: 5,
      [`${TREE}.spread`]: 1,
    });
    const sent = reading({
      [`${TREE}.top.expected`]: 4,
      [`${TREE}.top.spread`]: 1,
      [`${TREE}.deep.expected`]: 4,
      [`${TREE}.deep.spread`]: 1,
    });
    expect(Object.keys(pertDerived(live, sent, TREE, nodes))).toEqual([
      `${TREE}.top.expected`,
      `${TREE}.deep.expected`,
      `${TREE}.expected`,
      `${TREE}.spread`,
    ]);
  });
});

describe("an added row's empty roll-ups (review F-11)", () => {
  const error = { kind: "error", error: { error: "value", address: "a", detail: "x" } } as const;
  const empty = { expected: error, spread: error };
  const full = {
    expected: { kind: "value", value: 1, text: "1.0 d" },
    spread: { kind: "value", value: 1, text: "1.0 d" },
  } as const;

  test("an added row's missing value reads as a muted dash, a number as itself", () => {
    expect(rollupText(error, true)).toEqual({ text: "\u2014", muted: true });
    expect(rollupText(full.expected, true)).toEqual({ text: "1.0 d", muted: false });
  });

  test("another row's missing value reads as before: blank, not muted", () => {
    expect(rollupText(error, false)).toEqual({ text: "", muted: false });
  });

  test("an added row has no note while it is the current row, then a neutral one", () => {
    expect(rollupNote(empty, { added: true, current: true })).toBeUndefined();
    expect(rollupNote(empty, { added: true, current: false })).toEqual({
      text: PERT_NOT_COMPUTED,
      neutral: true,
    });
  });

  test("another row's note is the field error's, whether or not it is current", () => {
    expect(rollupNote(empty, { added: false, current: true })).toEqual({
      text: PERT_NOT_COMPUTED,
      neutral: false,
    });
    expect(rollupNote(full, { added: true, current: false })).toBeUndefined();
  });
});
