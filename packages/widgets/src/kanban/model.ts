// The Kanban's model (latex-kanban-timeline, design decision 9; kanban-order, design decisions 4 and
// 7), pure: the columns with their cards, a card's place in a column, the value the draft holds,
// the cards that moved and the arrow keys. Every edit builds a raw value, and the draft holds the
// value its own changes rebuild (`arranged`), so that `ask-core`'s round trip takes it back exactly
// and the board never sends an order the user did not give (AD-10, AD-20, NFR-10). Each edit gives
// a new frozen value, or the same value when nothing changes. Plain ECMAScript: no DOM, no `Date`.

import {
  applyElementChanges,
  elementChanges,
  KANBAN_SHAPE,
  type KanbanCard,
  type KanbanColumn,
  type KanbanProps,
} from "@askboard/contract";

/** A column with the cards that stand in it, in the order of the props' `cards`. */
export type KanbanColumnView = KanbanColumn & { readonly cards: readonly KanbanCard[] };

/** The arrow keys of the cards' Tab stop. */
export type KanbanKey = "up" | "down" | "left" | "right";

/** A move within a card's column: one place up or down, or to its top or bottom. */
export type KanbanMove = "up" | "down" | "top" | "bottom";

// The item ID the changes' targets carry here; the board's own ID never matters to the diff.
const ITEM = "kanban";

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

const changesOf = (sent: KanbanProps, value: KanbanProps) =>
  elementChanges(ITEM, sent, value, KANBAN_SHAPE);

/**
 * The value the changes of `raw` against `sent` rebuild: `raw`'s order in each column, the flat
 * list in the interleaving the inverse gives. Idempotent, and its own diff is the diff of `raw`;
 * what the draft holds, since `ask-core` compares an answer's value with its changes' rebuild
 * exactly. `raw` must be a Kanban of the same cards by ID; anything else throws.
 */
export const arranged = (sent: KanbanProps, raw: KanbanProps): KanbanProps =>
  applyElementChanges(ITEM, sent, changesOf(sent, raw), KANBAN_SHAPE);

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

/**
 * The props with the card in `columnId` at `slot` among that column's other cards (0 to their
 * count, clamped): in the list, right after the card before the slot, or right before the first
 * card of the column; into a column with no other card, the card keeps its index. The one edit of
 * a drop and of the four moves within a column. The same props, by identity, when the card or the
 * column is not the item's or the card is already at that place. A raw value: `valueFor` arranges.
 */
export const placeIn = (
  props: KanbanProps,
  cardId: string,
  columnId: string,
  slot: number,
): KanbanProps => {
  const card = props.cards.find(({ id }) => id === cardId);
  const holds = props.columns.some(({ id }) => id === columnId);
  if (card === undefined || !holds) return props;
  const column = props.cards.filter((held) => held.column === columnId);
  const others = column.filter(({ id }) => id !== cardId);
  const at = Math.min(others.length, Math.max(0, Number.isFinite(slot) ? Math.trunc(slot) : 0));
  if (card.column === columnId && column.findIndex(({ id }) => id === cardId) === at) return props;
  const placed = Object.freeze({ ...card, column: columnId });
  const rest = props.cards.filter(({ id }) => id !== cardId);
  const anchor = at === 0 ? others[0] : others[at - 1];
  const where =
    anchor === undefined ? props.cards.indexOf(card) : rest.indexOf(anchor) + (at === 0 ? 0 : 1);
  const cards =
    anchor === undefined
      ? props.cards.map((held) => (held === card ? placed : held))
      : [...rest.slice(0, where), placed, ...rest.slice(where)];
  return Object.freeze({ ...props, cards: Object.freeze(cards) });
};

/**
 * The props with the card one place up or down in its column, or at its top or bottom: the same
 * props, by identity, where it cannot go or the item lacks the card.
 */
export const moveWithin = (props: KanbanProps, cardId: string, move: KanbanMove): KanbanProps => {
  const card = props.cards.find(({ id }) => id === cardId);
  if (card === undefined) return props;
  const column = props.cards.filter((held) => held.column === card.column);
  const at = column.findIndex(({ id }) => id === cardId);
  const slot = { up: at - 1, down: at + 1, top: 0, bottom: column.length - 1 }[move];
  return placeIn(props, cardId, card.column, slot);
};

/**
 * The IDs of the cards the answer would report for `shown` against `sent`, those a `set` or a
 * `move` names, in the order of `shown`'s `cards`.
 */
export const movedOf = (sent: KanbanProps, shown: KanbanProps): readonly string[] => {
  const named = new Set(changesOf(sent, shown).map(({ target }) => target.split(".")[1]));
  return shown.cards.filter(({ id }) => named.has(id)).map(({ id }) => id);
};

/**
 * What the draft holds for the item: the value the changes of `edited` against `sent` rebuild, or
 * nothing while there is no change, so that moving everything back leaves no value.
 */
export const valueFor = (sent: KanbanProps, edited: KanbanProps): KanbanProps | undefined => {
  const changes = changesOf(sent, edited);
  return changes.length === 0 ? undefined : applyElementChanges(ITEM, sent, changes, KANBAN_SHAPE);
};

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
