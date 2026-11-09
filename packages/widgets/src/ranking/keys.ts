// The Ranking at the keyboard (view-and-widgets spec: Ranking at the keyboard; design decision 8):
// the list's cursor actions move the current row and never the order, and the toolbar's tools are
// enabled only where their act is possible. The tools and their table actions are one list, so the
// toolbar and the key table are compared in a test (spec: every visible action in the table). Pure.

import type { RankingKeyAction } from "@askboard/contract";
import { canMove, type MoveKind } from "./moves.ts";

/** The tools of the toolbar, each enabled or not. */
export type RankingTools = {
  readonly moveUp: boolean;
  readonly moveDown: boolean;
  readonly toTop: boolean;
  readonly toBottom: boolean;
  readonly keep: boolean;
  readonly selectNone: boolean;
};

/** One tool: its place in `RankingTools`, its table action and its label's string key. */
export type RankingTool = {
  readonly key: keyof RankingTools;
  readonly action: RankingKeyAction;
  readonly label:
    | "ranking.moveUp"
    | "ranking.moveDown"
    | "ranking.toTop"
    | "ranking.toBottom"
    | "ranking.keep"
    | "ranking.selectNone";
  /** The move it makes, for the four that move rows. */
  readonly move?: MoveKind;
  /** Goes into "More" when the toolbar is crowded. */
  readonly overflow: boolean;
};

/** The toolbar's tools, in order. */
export const RANKING_TOOLS: readonly RankingTool[] = [
  { key: "moveUp", action: "move.up", label: "ranking.moveUp", move: "up", overflow: false },
  {
    key: "moveDown",
    action: "move.down",
    label: "ranking.moveDown",
    move: "down",
    overflow: false,
  },
  { key: "toTop", action: "move.top", label: "ranking.toTop", move: "top", overflow: true },
  {
    key: "toBottom",
    action: "move.bottom",
    label: "ranking.toBottom",
    move: "bottom",
    overflow: true,
  },
  { key: "keep", action: "ranking.keep", label: "ranking.keep", overflow: false },
  {
    key: "selectNone",
    action: "select.none",
    label: "ranking.selectNone",
    overflow: true,
  },
];

/** A cursor action of the list. */
export type CursorMove = "up" | "down" | "first" | "last";

/**
 * The row the current row becomes on a cursor action: up and down move by one and stop at the
 * ends, first and last go to the ends. A current row the order lacks starts at the first row.
 */
export const currentAfter = (
  order: readonly string[],
  current: string,
  move: CursorMove,
): string | undefined => {
  const at = order.indexOf(current);
  if (at < 0) return order[0];
  switch (move) {
    case "up":
      return order[Math.max(0, at - 1)];
    case "down":
      return order[Math.min(order.length - 1, at + 1)];
    case "first":
      return order[0];
    case "last":
      return order.at(-1);
  }
};

/**
 * Which tools act, for the rows a move would act on (`acting`): each move when it would move
 * something, "Keep this order" whenever the Ranking can change, "Select none" while rows are
 * selected; none in a read-only Ranking.
 */
export const rankingTools = (
  order: readonly string[],
  acting: readonly string[],
  hasSelection: boolean,
  disabled: boolean,
): RankingTools => {
  if (disabled) {
    return {
      moveUp: false,
      moveDown: false,
      toTop: false,
      toBottom: false,
      keep: false,
      selectNone: false,
    };
  }
  const rows = new Set(acting);
  return {
    moveUp: canMove(order, rows, "up"),
    moveDown: canMove(order, rows, "down"),
    toTop: canMove(order, rows, "top"),
    toBottom: canMove(order, rows, "bottom"),
    keep: true,
    selectNone: hasSelection,
  };
};
