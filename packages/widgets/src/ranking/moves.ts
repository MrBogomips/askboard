// The Ranking's moves (view-and-widgets spec: Moving a Ranking's selection; design decision 8, the
// PO's answer to question 2): "Move up", "Move down", "To top" and "To bottom" act on the selected
// rows, else on the current row. Up takes each run of selected rows one place past the unselected
// row right above it, keeping their order and leaving rows packed at the top where they are; "To
// top" gathers them at the top in their order; down and "To bottom" alike. Pure: a move that would
// move nothing returns the array it was given, which is how a tool knows to be disabled.

/** The four moves, as the tools and the keys name them. */
export type MoveKind = "up" | "down" | "top" | "bottom";

/** Every move, in the toolbar's order. */
export const MOVES: readonly MoveKind[] = ["up", "down", "top", "bottom"];

/**
 * The rows a move acts on: the selected ones, in the order's order, else the current row alone.
 * Rows the order lacks do not count, so a selection of only such rows is none.
 */
export const actingRows = (
  order: readonly string[],
  selected: ReadonlySet<string>,
  current: string,
): readonly string[] => {
  const picked = order.filter((id) => selected.has(id));
  if (picked.length > 0) return picked;
  return order.includes(current) ? [current] : [];
};

// Each selected row goes before the unselected row last placed, so a run of them passes it together.
const raised = (order: readonly string[], chosen: ReadonlySet<string>): string[] => {
  const out: string[] = [];
  for (const id of order) {
    const above = out.at(-1);
    if (chosen.has(id) && above !== undefined && !chosen.has(above)) {
      out.splice(out.length - 1, 0, id);
    } else {
      out.push(id);
    }
  }
  return out;
};

const reversed = (order: readonly string[]): string[] => [...order].reverse();

const placed = (
  order: readonly string[],
  chosen: ReadonlySet<string>,
  kind: MoveKind,
): string[] => {
  switch (kind) {
    case "up":
      return raised(order, chosen);
    case "down":
      return reversed(raised(reversed(order), chosen));
    case "top":
      return [...order.filter((id) => chosen.has(id)), ...order.filter((id) => !chosen.has(id))];
    case "bottom":
      return [...order.filter((id) => !chosen.has(id)), ...order.filter((id) => chosen.has(id))];
  }
};

/**
 * `order` after `kind` on the `chosen` rows; the same array when nothing moves (no row, a row the
 * order lacks, every row, rows already as far as they go).
 */
export const moveRows = (
  order: readonly string[],
  chosen: ReadonlySet<string>,
  kind: MoveKind,
): readonly string[] => {
  const next = placed(order, chosen, kind);
  return next.every((id, at) => id === order[at]) ? order : next;
};

/** Whether the move would move anything: a tool that would not is disabled. */
export const canMove = (
  order: readonly string[],
  chosen: ReadonlySet<string>,
  kind: MoveKind,
): boolean => moveRows(order, chosen, kind) !== order;
