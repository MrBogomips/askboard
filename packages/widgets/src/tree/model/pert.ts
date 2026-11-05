// A work breakdown's values (molecules design decision 14; view spec, "WBS layout"): a Tree with
// `pert` shows each visible row's expected effort and spread, read from the board's live graph
// (`<item>.<node>.expected` and `.spread`, which `compute`'s PERT writes), or the formula error a
// value reads as; a leaf has estimate cells, a parent, whose own estimates PERT ignores, none. A
// work breakdown of several top-level packages ends with a Total row, the item's roll-ups; with one,
// that package's row shows them. Values show with one decimal in en-US and the `d` affix; a row
// whose values are in error shows a field error under it, the wording this change's. An answer
// carrying the Tree's value carries its derived values by `TREE_PERT_ANSWER_DERIVED` (contract spec,
// "WBS answer derived values"; F7), rounded with `compute`'s own `ROUND`. Plain ECMAScript.

import { type FormulaError, isFormulaError, roundNumber } from "@askboard/compute";
import { TREE_PERT_ANSWER_DERIVED, type TreeNode } from "@askboard/contract";
import type { BoardGraph } from "../../graph/index.ts";
import type { TreeRow } from "./rows.ts";

/** A value as a cell shows it, or the formula error it reads as. */
export type PertValue =
  | { readonly kind: "value"; readonly value: number; readonly text: string }
  | { readonly kind: "error"; readonly error: FormulaError };

export type PertValues = { readonly expected: PertValue; readonly spread: PertValue };

export type PertRow = PertValues & {
  /** The row has estimate cells: a leaf's, never a parent's. */
  readonly estimates: boolean;
};

const DAYS = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** A value in days as a cell shows it: `5.5 d`. */
export const pertText = (value: number): string => `${DAYS.format(value)} d`;

// A node's value, a number; any other value reads as a value error.
const valueAt = (graph: BoardGraph, address: string): PertValue => {
  const read = graph.read(address);
  if (isFormulaError(read)) return Object.freeze({ kind: "error", error: read });
  if (typeof read !== "number") {
    const error = Object.freeze({ error: "value", address, detail: "not a number" } as const);
    return Object.freeze({ kind: "error", error });
  }
  return Object.freeze({ kind: "value", value: read, text: pertText(read) });
};

const valuesAt = (graph: BoardGraph, prefix: string): PertValues =>
  Object.freeze({
    expected: valueAt(graph, `${prefix}.expected`),
    spread: valueAt(graph, `${prefix}.spread`),
  });

/** A visible row's expected effort and spread, and whether it has estimate cells. */
export const pertRow = (graph: BoardGraph, itemId: string, row: TreeRow): PertRow =>
  Object.freeze({ ...valuesAt(graph, `${itemId}.${row.node.id}`), estimates: !row.hasChildren });

/** The field error under a row whose values are in error (AD-13: it never blocks "Answer"). */
export const PERT_NOT_COMPUTED = "No expected effort or spread: they could not be computed.";

/** The field error under a row, the Total row's included; none while both values are numbers. */
export const pertNote = ({ expected, spread }: PertValues): string | undefined =>
  expected.kind === "error" || spread.kind === "error" ? PERT_NOT_COMPUTED : undefined;

/** The Total row's values, the item's roll-ups; none with fewer than two top-level packages. */
export const pertTotal = (
  graph: BoardGraph,
  itemId: string,
  nodes: readonly TreeNode[],
): PertValues | undefined => (nodes.length > 1 ? valuesAt(graph, itemId) : undefined);

/** What a work breakdown's grid shows of the graph: each shown row's values, then the Total's. */
export type PertGrid = {
  readonly rows: ReadonlyMap<string, PertRow>;
  readonly total: PertValues | undefined;
};

/** The values of the rows the grid shows, by node, and of its Total row (`pertTotal`). */
export const pertValues = (
  graph: BoardGraph,
  itemId: string,
  rows: readonly TreeRow[],
  nodes: readonly TreeNode[],
): PertGrid =>
  Object.freeze({
    rows: new Map(rows.map((row) => [row.node.id, pertRow(graph, itemId, row)])),
    total: pertTotal(graph, itemId, nodes),
  });

/** The derived values an answer carries, by reference (`wbs.portal.expected`), each a number. */
export type PertDerived = Readonly<Record<string, number>>;

const { fields, decimals } = TREE_PERT_ANSWER_DERIVED;

// A node's value rounded as the answer carries it, or undefined when it is no finite number.
const roundedAt = (graph: BoardGraph, address: string): number | undefined => {
  const value = graph.read(address);
  if (typeof value !== "number") return undefined;
  const rounded = roundNumber(value, decimals);
  return Number.isFinite(rounded) ? rounded : undefined;
};

const allNodes = (nodes: readonly TreeNode[]): TreeNode[] =>
  nodes.flatMap((node) => [node, ...allNodes(node.children ?? [])]);

/**
 * The derived values a work breakdown's answer carries (`TREE_PERT_ANSWER_DERIVED`): of each node,
 * in document order, the fields whose rounded value differs from the board as sent, or that the
 * agent did not send; then the item's totals, always; a value in error never.
 */
export const pertDerived = (
  live: BoardGraph,
  sent: BoardGraph,
  itemId: string,
  nodes: readonly TreeNode[],
): PertDerived => {
  const entries: [string, number][] = [];
  for (const node of allNodes(nodes)) {
    for (const field of fields) {
      const address = `${itemId}.${node.id}.${field}`;
      const value = roundedAt(live, address);
      if (value !== undefined && value !== roundedAt(sent, address)) entries.push([address, value]);
    }
  }
  for (const field of fields) {
    const address = `${itemId}.${field}`;
    const value = roundedAt(live, address);
    if (value !== undefined) entries.push([address, value]);
  }
  return Object.freeze(Object.fromEntries(entries));
};
