// The Kanban's model (latex-kanban-timeline, design decision 9), pure: the columns with their
// cards, a card's move to another column, the value the draft holds, the cards that moved and the
// arrow keys. A move changes the card's `column` and leaves every card at its index in `cards`, so
// that the diff against the props as sent is `set`s of `.column` only: the one generic diff would
// give a `move` for a reordered card, which the Kanban's changes schema refuses (AD-20). Each edit
// gives a new frozen value, or the same value when nothing changes, since the draft record
// compares values by identity. Plain ECMAScript: no DOM, no `Date`.

import type { KanbanCard, KanbanColumn, KanbanProps } from "@askboard/contract";

/** A column with the cards that stand in it, in the order of the props' `cards`. */
export type KanbanColumnView = KanbanColumn & { readonly cards: readonly KanbanCard[] };

/** The arrow keys of the cards' Tab stop. */
export type KanbanKey = "up" | "down" | "left" | "right";

/**
 * The columns in the agent's order, each with its cards in the order of `cards`. A card whose
 * column the item does not hold is in none: the contract refuses such props, and the board never
 * draws a card it cannot place.
 */
export const columnsOf = (props: KanbanProps): readonly KanbanColumnView[] =>
  props.columns.map((column) => ({
    ...column,
    cards: props.cards.filter((card) => card.column === column.id),
  }));

/**
 * The props with the card in `columnId`, every card at its index in `cards`. The same props, by
 * identity, when the card or the column is not the item's or the card is already there.
 */
export const moveTo = (props: KanbanProps, cardId: string, columnId: string): KanbanProps => {
  const index = props.cards.findIndex((card) => card.id === cardId);
  const card = props.cards[index];
  const holds = props.columns.some((column) => column.id === columnId);
  if (card === undefined || !holds || card.column === columnId) return props;
  const cards = props.cards.map((held, at) =>
    at === index ? Object.freeze({ ...held, column: columnId }) : held,
  );
  return Object.freeze({ ...props, cards: Object.freeze(cards) });
};

/** The IDs of the cards in another column than `sent` has them in, in the order of `cards`. */
export const movedOf = (sent: KanbanProps, shown: KanbanProps): readonly string[] => {
  const was = new Map(sent.cards.map((card) => [card.id, card.column]));
  return shown.cards.filter((card) => was.get(card.id) !== card.column).map((card) => card.id);
};

/**
 * What the draft holds for the item: `edited`, or nothing while no card is in another column than
 * `sent` has it, so that moving every card back leaves no value and no change.
 */
export const valueFor = (sent: KanbanProps, edited: KanbanProps): KanbanProps | undefined =>
  movedOf(sent, edited).length === 0 ? undefined : edited;

/** The first card of the first column that holds one. */
export const firstCard = (columns: readonly KanbanColumnView[]): string | undefined =>
  columns.find((column) => column.cards.length > 0)?.cards[0]?.id;

// The card a sideways key reaches: in the nearest column that holds a card, in the direction of the
// key, at the same height or at the last card of a shorter column.
const sideways = (
  columns: readonly KanbanColumnView[],
  from: number,
  row: number,
  step: 1 | -1,
): string | undefined => {
  for (let at = from + step; at >= 0 && at < columns.length; at += step) {
    const { cards } = columns[at] as KanbanColumnView;
    if (cards.length > 0) return cards[Math.min(row, cards.length - 1)]?.id;
  }
  return undefined;
};

/**
 * The card an arrow key makes current: Up and Down within the column, Left and Right to the nearest
 * card of the next column that holds one. At an edge it is the current card itself; for a current
 * card the columns do not hold, nothing.
 */
export const neighbour = (
  columns: readonly KanbanColumnView[],
  current: string,
  key: KanbanKey,
): string | undefined => {
  const column = columns.findIndex(({ cards }) => cards.some((card) => card.id === current));
  const cards = columns[column]?.cards;
  if (cards === undefined) return undefined;
  const row = cards.findIndex((card) => card.id === current);
  if (key === "up") return cards[Math.max(0, row - 1)]?.id;
  if (key === "down") return cards[Math.min(cards.length - 1, row + 1)]?.id;
  return sideways(columns, column, row, key === "left" ? -1 : 1) ?? current;
};
