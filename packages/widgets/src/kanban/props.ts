// A Kanban's props as the component takes them (design decision 9): the view hands props over as
// data, unchecked, so the shape the schema would give is checked here, then the contract's own
// check of what a schema cannot say. A problem throws, naming the item; the item's error boundary
// then fails it and its question never counts as visible (AD-10). The value the draft holds is
// shown only while it is the agent's Kanban with cards moved.

import {
  KANBAN_MAX_CARDS,
  KANBAN_MAX_COLUMNS,
  KANBAN_MIN_CARDS,
  KANBAN_MIN_COLUMNS,
  type KanbanProps,
  kanbanPropsProblems,
} from "@askboard/contract";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const columnProblem = (column: unknown, at: number): string | undefined => {
  if (!isRecord(column)) return `column ${at + 1} is no object`;
  if (typeof column.id !== "string") return `column ${at + 1} has no string ID`;
  if (typeof column.label !== "string") return `column ${at + 1} has no string label`;
  return undefined;
};

const cardProblem = (card: unknown, at: number): string | undefined => {
  if (!isRecord(card)) return `card ${at + 1} is no object`;
  if (typeof card.id !== "string") return `card ${at + 1} has no string ID`;
  if (typeof card.label !== "string") return `card ${at + 1} has no string label`;
  if (typeof card.column !== "string") return `card ${at + 1} has no string column`;
  if (card.description !== undefined && typeof card.description !== "string") {
    return `the description of card ${at + 1} is no string`;
  }
  return undefined;
};

// What the schema says: 2 to 12 columns and 1 to 200 cards, each with the fields the board reads.
const shapeProblem = (props: unknown): string | undefined => {
  if (!isRecord(props)) return "its props are no object";
  const { columns, cards } = props;
  if (!Array.isArray(columns)) return "its props hold no list of columns";
  if (!Array.isArray(cards)) return "its props hold no list of cards";
  if (columns.length < KANBAN_MIN_COLUMNS || columns.length > KANBAN_MAX_COLUMNS) {
    return `a Kanban holds ${KANBAN_MIN_COLUMNS} to ${KANBAN_MAX_COLUMNS} columns, and this one holds ${columns.length}`;
  }
  if (cards.length < KANBAN_MIN_CARDS || cards.length > KANBAN_MAX_CARDS) {
    return `a Kanban holds ${KANBAN_MIN_CARDS} to ${KANBAN_MAX_CARDS} cards, and this one holds ${cards.length}`;
  }
  return (
    columns.map(columnProblem).find((problem) => problem !== undefined) ??
    cards.map(cardProblem).find((problem) => problem !== undefined)
  );
};

/** The props as an agent's Kanban, or an error naming the item and the problem. */
export const checkedKanbanProps = (itemId: string, props: unknown): KanbanProps => {
  const shape = shapeProblem(props);
  const problems =
    shape === undefined
      ? kanbanPropsProblems(props).map(({ path, message }) => `${path}: ${message}`)
      : [shape];
  if (problems.length === 0) return props as KanbanProps;
  throw new Error(`the Kanban "${itemId}" refuses its props: ${problems.join("; ")}`);
};

// Whether `edited` is the agent's Kanban with cards moved: the same columns and the same cards,
// each with its own label and description, in the same order.
const sameKanban = (sent: KanbanProps, edited: KanbanProps): boolean =>
  sent.columns.length === edited.columns.length &&
  sent.cards.length === edited.cards.length &&
  sent.columns.every(
    (column, at) =>
      column.id === edited.columns[at]?.id && column.label === edited.columns[at]?.label,
  ) &&
  sent.cards.every((card, at) => {
    const held = edited.cards[at];
    return (
      held?.id === card.id && held.label === card.label && held.description === card.description
    );
  });

/**
 * Whether the item shows `value` on a revision whose props are `props`: `value` is the agent's
 * Kanban with cards moved. The one predicate of `shownProps` and of the shell's drops of a held
 * value (the fact this chunk registers); a value, or props, that are no Kanban never fit.
 */
export const valueFits = (value: unknown, props: unknown): boolean => {
  try {
    return sameKanban(checkedKanbanProps("", props), checkedKanbanProps("", value));
  } catch {
    return false;
  }
};

/**
 * The Kanban to show: the value the draft holds, while it fits the agent's Kanban (`valueFits`),
 * else the agent's own. A value that is anything else was never made by this component.
 */
export const shownProps = (itemId: string, sent: KanbanProps, value: unknown): KanbanProps =>
  value !== undefined && valueFits(value, sent) ? checkedKanbanProps(itemId, value) : sent;
