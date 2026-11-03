// The Gantt's focus (proposal, open question 18): the grid's focused cell, which alone holds the
// grid's Tab stop, moved by the keys of `keys.ts` and kept inside the grid, with no wrap; and the
// toolbar's roving focus, which wraps and skips disabled tools. Positions count body cells from 0.

import type { FocusMove, ToolMove } from "./keys.ts";

export type GridFocus = { readonly row: number; readonly column: number };

export type GridSize = { readonly rows: number; readonly columns: number };

const within = (index: number, count: number): number => Math.max(0, Math.min(count - 1, index));

const at = (focus: GridFocus, row: number, column: number): GridFocus =>
  row === focus.row && column === focus.column ? focus : Object.freeze({ row, column });

/** The cell a move reaches; the same position when it would leave the grid. */
export const moveFocus = (focus: GridFocus, move: FocusMove, size: GridSize): GridFocus => {
  const { row, column } = focus;
  const target: Record<FocusMove, readonly [number, number]> = {
    up: [row - 1, column],
    down: [row + 1, column],
    left: [row, column - 1],
    right: [row, column + 1],
    home: [row, 0],
    end: [row, size.columns - 1],
  };
  const [toRow, toColumn] = target[move];
  return at(focus, within(toRow, size.rows), within(toColumn, size.columns));
};

/** The focus kept inside a grid whose rows changed; undefined when the grid holds no cell. */
export const clampFocus = (focus: GridFocus, size: GridSize): GridFocus | undefined => {
  if (size.rows === 0 || size.columns === 0) return undefined;
  return at(focus, within(focus.row, size.rows), within(focus.column, size.columns));
};

/** The tool a move reaches among the enabled ones; `from` itself when none other is enabled. */
export const nextTool = (enabled: readonly boolean[], from: number, move: ToolMove): number => {
  const count = enabled.length;
  const order =
    move === "first" || move === "last"
      ? Array.from({ length: count }, (_, index) => index)
      : Array.from({ length: count - 1 }, (_, step) => (from + step + 1) % count);
  if (move === "previous" || move === "last") order.reverse();
  return order.find((index) => enabled[index] === true) ?? from;
};

/** The tool that holds the toolbar's Tab stop: the active one, else the first enabled. */
export const toolTabStop = (enabled: readonly boolean[], active: number): number | undefined => {
  if (enabled[active] === true) return active;
  const first = enabled.indexOf(true);
  return first < 0 ? undefined : first;
};
