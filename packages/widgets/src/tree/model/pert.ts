// A work breakdown's values (molecules design decision 14; view spec, "WBS layout"): a Tree with
// `pert` shows each visible row's expected effort and spread, read from the board's live graph
// (`<item>.<node>.expected` and `.spread`, which `compute`'s PERT writes), or the formula error a
// value reads as; a leaf has estimate cells, a parent, whose own estimates PERT ignores, none. A
// work breakdown of several top-level packages ends with a Total row, the item's roll-ups; with one,
// that package's row shows them. Values show with one decimal in en-US and the `d` affix. Plain ECMAScript.

import { type FormulaError, isFormulaError } from "@askboard/compute";
import type { TreeNode } from "@askboard/contract";
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

/** The Total row's values, the item's roll-ups; none with fewer than two top-level packages. */
export const pertTotal = (
  graph: BoardGraph,
  itemId: string,
  nodes: readonly TreeNode[],
): PertValues | undefined => (nodes.length > 1 ? valuesAt(graph, itemId) : undefined);
