// The Kanban's constants and types (latex-kanban-timeline, design decision 4): the limits of its
// props, the schemas' IDs, its element shape and the shapes of an item and a change. Each frozen
// constant is marked pure, so that a view chunk drops those it does not use.

import type { ElementShape } from "../element-diff.ts";

export const KANBAN_MIN_COLUMNS = 2;
export const KANBAN_MAX_COLUMNS = 12;
export const KANBAN_MIN_CARDS = 1;
export const KANBAN_MAX_CARDS = 200;
export const KANBAN_COLUMN_LABEL_MAX_CHARS = 60;
export const KANBAN_CARD_LABEL_MAX_CHARS = 200;
export const KANBAN_CARD_DESCRIPTION_MAX_CHARS = 500;

export const KANBAN_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:kanban-props",
  changes: "urn:askboard:output:kanban-changes",
} as const);

/**
 * The Kanban's shape for the one generic diff (AD-20): its cards as a flat list, so that a moved
 * card is one `set` of its `column`. The columns are no elements: their changes are no Kanban's.
 */
export const KANBAN_SHAPE: ElementShape = /* @__PURE__ */ Object.freeze({ elements: "cards" });

export type KanbanColumn = { readonly id: string; readonly label: string };

export type KanbanCard = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  /** The ID of the column the card is in. */
  readonly column: string;
};

export type KanbanProps = {
  readonly columns: readonly KanbanColumn[];
  readonly cards: readonly KanbanCard[];
};

export type KanbanItem = {
  readonly type: "kanban";
  readonly id: string;
  readonly props: KanbanProps;
};

/** A Kanban's only change: a card moved to a column. */
export type KanbanChange = {
  readonly op: "set";
  /** `<item>.<card>.column`. */
  readonly target: string;
  /** The ID of the column. */
  readonly value: string;
};
