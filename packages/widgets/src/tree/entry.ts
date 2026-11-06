// What the Tree's cell editor reads and commits (design decision 6; spec, "Tree editing"): the
// name's cell, a number field read by AskBoard's own parser, in the ask's locale, never the browser's number
// input, or a text field. A commit gives the value after the entry, through the model's `rename`
// and `setField`, which return the same value when nothing changes (an empty name included, which
// is never committed), or a refusal with the reason the field error shows.

import {
  GANTT_PLAN_ESTIMATES,
  type Locale,
  TREE_LABEL_MAX_CHARS,
  TREE_PERT_MAX_ESTIMATE,
  TREE_TEXT_MAX_CHARS,
  type TreeColumn,
  type TreeNode,
  type TreeProps,
} from "@askboard/contract";
import { type StringKey, say } from "@askboard/view/catalog";
import { parseNumber } from "../shared/number.ts";
import { fieldText } from "./cells.ts";
import { estimateOrderProblem, type OrderRule } from "./model/coherence.ts";
import { can, estimateProblem, rename, setField } from "./model/edits.ts";
import { cellCount } from "./model/rows.ts";

/** What a cell edits: the name, or a field of its column's type. */
export type EntryKind = "name" | TreeColumn["type"];

export type CellEntry =
  /** The value after the entry: the same value when it changes nothing. */
  | { readonly kind: "value"; readonly value: TreeProps }
  | { readonly kind: "refused"; readonly reason: string };

/** The refusal of a name past the contract's limit, in `language`. */
export const nameTooLong = (language: Locale): string =>
  say(language, "tree.entry.nameTooLong", { max: TREE_LABEL_MAX_CHARS.toLocaleString(language) });

const textTooLong = (language: Locale): string =>
  say(language, "tree.entry.textTooLong", { max: TREE_TEXT_MAX_CHARS.toLocaleString(language) });

const estimateOutOfRange = (language: Locale): string =>
  say(language, "tree.entry.estimateRange", {
    max: TREE_PERT_MAX_ESTIMATE.toLocaleString(language),
  });

// The catalogue's wording of each rule of the order of the estimates.
const ORDER_TEXT: Readonly<Record<OrderRule, StringKey>> = {
  optimisticLikely: "tree.entry.order.optimisticLikely",
  likelyPessimistic: "tree.entry.order.likelyPessimistic",
  optimisticPessimistic: "tree.entry.order.optimisticPessimistic",
};

// A length in code points, as the contract counts it.
const lengthOf = (text: string): number => [...text].length;

const valued = (value: TreeProps): CellEntry => Object.freeze({ kind: "value", value });

const refused = (reason: string): CellEntry => Object.freeze({ kind: "refused", reason });

/** What the cell `cell` edits: 0 is the name, then one per column; `undefined` past them. */
export const entryKindOf = (
  columns: readonly TreeColumn[] | undefined,
  cell: number,
): EntryKind | undefined => (cell === 0 ? "name" : columns?.[cell - 1]?.type);

/**
 * What the cell `cell` of the node `nodeId` edits, as `entryKindOf` says, but nothing on a work
 * breakdown parent's estimate, which PERT ignores (`can("editEstimate")`; molecules design decision
 * 14), nor on the value cells past the fields.
 */
export const entryKindAt = (
  value: TreeProps,
  nodeId: string,
  cell: number,
): EntryKind | undefined => {
  const field = cell === 0 ? undefined : value.columns?.[cell - 1]?.field;
  const estimate = field !== undefined && GANTT_PLAN_ESTIMATES.some((name) => name === field);
  return estimate && !can("editEstimate", value, nodeId)
    ? undefined
    : entryKindOf(value.columns, cell);
};

/**
 * The cells of the node `nodeId` that take an edit, as a comma-separated list of their numbers: it
 * is what the row marks `data-editable` for the hover layer, a primitive so that a row re-renders
 * only when it changes. None once the Tree is read-only.
 */
export const editableCells = (value: TreeProps, nodeId: string, disabled = false): string => {
  if (disabled) return "";
  const cells = Array.from({ length: cellCount(value) }, (_, cell) => cell);
  return cells.filter((cell) => entryKindAt(value, nodeId, cell) !== undefined).join(",");
};

/** The editor's starting text: the name, or the field as the cell shows it. */
export const startTextOf = (
  columns: readonly TreeColumn[] | undefined,
  node: TreeNode,
  cell: number,
  locale: Locale = "en-US",
): string => {
  if (cell === 0) return node.label;
  const column = columns?.[cell - 1];
  return column === undefined ? "" : fieldText(node, column, locale);
};

/** Commits `text` in the cell `cell` of the node `nodeId`. */
export const enterCell = (
  value: TreeProps,
  nodeId: string,
  cell: number,
  text: string,
  locale: Locale = "en-US",
  language: Locale = locale,
): CellEntry => {
  if (cell === 0) {
    return lengthOf(text) > TREE_LABEL_MAX_CHARS
      ? refused(nameTooLong(language))
      : valued(rename(value, nodeId, text));
  }
  const column = value.columns?.[cell - 1];
  if (column === undefined) return valued(value);
  if (column.type === "text") {
    return lengthOf(text) > TREE_TEXT_MAX_CHARS
      ? refused(textTooLong(language))
      : valued(setField(value, nodeId, column.field, text));
  }
  const entry = parseNumber(text, locale, language);
  if (entry.kind === "refused") return refused(entry.reason);
  const number = entry.kind === "number" ? entry.value : undefined;
  // A work breakdown's estimate outside its range (molecules design decision 14).
  const problem = estimateProblem(value, column.field, number);
  if (problem !== undefined) return refused(estimateOutOfRange(language));
  // A work breakdown's estimates stay in order, a row sent out of order not made worse.
  const order = estimateOrderProblem(value, nodeId, column.field, number);
  return order === undefined
    ? valued(setField(value, nodeId, column.field, number))
    : refused(say(language, ORDER_TEXT[order]));
};
