// The Ranking at the keyboard (view-and-widgets spec: Ranking at the keyboard; design decision 8):
// the list's arrow keys move the current row and never the order, and the toolbar's tools are
// enabled only where their act is possible. Pure.

/** The tools of the toolbar, each enabled or not. */
export type RankingTools = {
  readonly moveUp: boolean;
  readonly moveDown: boolean;
  readonly keep: boolean;
};

/**
 * The row the current row becomes on `key`, or none for a key the list does not take: the arrow
 * keys move by one and stop at the ends, Home and End go to the ends. A current row the order lacks
 * starts at the first row.
 */
export const currentAfterKey = (
  order: readonly string[],
  current: string,
  key: string,
): string | undefined => {
  if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(key)) return undefined;
  const at = order.indexOf(current);
  if (at < 0) return order[0];
  switch (key) {
    case "ArrowUp":
      return order[Math.max(0, at - 1)];
    case "ArrowDown":
      return order[Math.min(order.length - 1, at + 1)];
    case "Home":
      return order[0];
    default:
      return order.at(-1);
  }
};

/**
 * Which tools act: "Move up" and "Move down" when the current row has a place to go, "Keep this
 * order" whenever the Ranking can change; none in a read-only Ranking.
 */
export const rankingTools = (
  order: readonly string[],
  current: string,
  disabled: boolean,
): RankingTools => {
  if (disabled) return { moveUp: false, moveDown: false, keep: false };
  const at = order.indexOf(current);
  return { moveUp: at > 0, moveDown: at >= 0 && at < order.length - 1, keep: true };
};

// The toolbar's keys are the shared toolbar's, since latex-kanban-timeline.
export { toolbarMoveOf } from "../shared/toolbar-focus.ts";
