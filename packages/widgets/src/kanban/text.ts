// The Kanban's counter and names (view-and-widgets spec: Kanban at the keyboard; ux-update-draft
// block 2). Pure: the string lookup is passed in.

import type { Say } from "@askboard/view/catalog";

/** The toolbar's counter: "No changes", or "Your changes: N moved". */
export const counterText = (moved: number, text: Say): string =>
  moved === 0 ? text("widget.noChanges") : text("kanban.counterMoved", { count: moved });

/** A card's accessible name: its label and its column's, "Fix login, in To do". */
export const cardName = (label: string, column: string, text: Say): string =>
  text("kanban.cardName", { label, column });

/** A column's accessible name: its label and its count of cards. */
export const columnName = (label: string, count: number, text: Say): string =>
  text("kanban.columnName", { label, count });
