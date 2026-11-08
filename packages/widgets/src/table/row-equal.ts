// When a row of the Table need not render again (review U-1 of review-table-g6, table-widget task
// 6.11). The board's live graph is a new object for each value a Table shows, and the Table builds
// new sets and maps for each render, so the default shallow comparison would redraw every row on a
// one-cell edit. A row redraws only when its own data differ: its cells, its marks, its entries and
// lines, or a computed value of its own in the graph.

import { isFormulaError, type NodeResult } from "@askboard/compute";
import { cellResult } from "./model/derived.ts";
import type { NodeRowProps } from "./row.tsx";

const sameSet = (left: ReadonlySet<string> | undefined, right: ReadonlySet<string> | undefined) => {
  if (left === right) return true;
  const a = left ?? new Set<string>();
  const b = right ?? new Set<string>();
  if (a.size !== b.size) return false;
  for (const member of a) if (!b.has(member)) return false;
  return true;
};

const sameMap = (
  left: ReadonlyMap<string, string> | undefined,
  right: ReadonlyMap<string, string> | undefined,
) => {
  if (left === right) return true;
  const a = left ?? new Map<string, string>();
  const b = right ?? new Map<string, string>();
  if (a.size !== b.size) return false;
  for (const [key, text] of a) if (b.get(key) !== text) return false;
  return true;
};

const sameLines = (left: NodeRowProps["lines"], right: NodeRowProps["lines"]) =>
  left === right ||
  (left.length === right.length &&
    left.every((line, at) => {
      const other = right[at];
      return (
        other !== undefined &&
        line.key === other.key &&
        line.id === other.id &&
        line.column === other.column &&
        line.text === other.text
      );
    }));

// A computed value as the row shows it: a number, a string, or an error that names its kind.
const sameResult = (left: NodeResult | undefined, right: NodeResult | undefined): boolean => {
  if (Object.is(left, right)) return true;
  return (
    left !== undefined &&
    right !== undefined &&
    isFormulaError(left) &&
    isFormulaError(right) &&
    left.error === right.error &&
    left.address === right.address
  );
};

const sameComputed = (previous: NodeRowProps, next: NodeRowProps): boolean => {
  if (previous.graph === next.graph) return true;
  for (const column of next.columns) {
    if (column.formula === undefined) continue;
    const before = cellResult(
      previous.graph,
      previous.itemId,
      previous.row.id,
      column.field,
      column,
    );
    const after = cellResult(next.graph, next.itemId, next.row.id, column.field, column);
    if (!sameResult(before, after)) return false;
  }
  return true;
};

/** Whether the row draws what it drew: React's `arePropsEqual` for `NodeRow`. */
export const rowPropsEqual = (previous: NodeRowProps, next: NodeRowProps): boolean =>
  previous.itemId === next.itemId &&
  previous.row === next.row &&
  previous.position === next.position &&
  previous.columns === next.columns &&
  previous.stop === next.stop &&
  previous.current === next.current &&
  previous.editable === next.editable &&
  previous.added === next.added &&
  previous.editing === next.editing &&
  previous.lineText === next.lineText &&
  sameSet(previous.changed, next.changed) &&
  sameSet(previous.derived, next.derived) &&
  sameSet(previous.refused, next.refused) &&
  sameMap(previous.entries, next.entries) &&
  sameLines(previous.lines, next.lines) &&
  sameComputed(previous, next);
