// The Kanban's rules that its schemas cannot say (latex-kanban-timeline, design decision 4): the
// column and card IDs unique within the item (AD-7, child IDs within their item), and each card's
// column one of the item's columns. Problems name the element, `card "fix-login"`.
//
// Plain ECMAScript with no JSON and no Ajv: the kanban chunk bundles it. Nothing here throws on a
// value it cannot read: it checks only the parts the schema's shape would let through, and the
// registry runs it after the schema.

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";

type Entry = { readonly id: string; readonly path: string; readonly element: string };

// The elements of a list that have a string ID, in order, with the path of their ID.
const entriesOf = (props: Record<string, unknown>, key: string, noun: string): Entry[] => {
  const list = props[key];
  if (!Array.isArray(list)) return [];
  return list.flatMap((element, index) => {
    const id = isRecord(element) ? element.id : undefined;
    return typeof id === "string"
      ? [{ id, path: `/${key}/${index}`, element: `${noun} "${id}"` }]
      : [];
  });
};

/**
 * What a schema-valid Kanban's props still get wrong: an ID held twice, across the columns and the
 * cards, and a card whose `column` names no column of the item. Props that are no object give one
 * problem; a list that is not one is the schema's.
 */
export const kanbanPropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a Kanban's props are an object {columns, cards}" }];
  }
  const columns = entriesOf(props, "columns", "column");
  const cards = entriesOf(props, "cards", "card");
  const problems: Problem[] = [];
  const seen = new Set<string>();
  for (const { id, path, element } of [...columns, ...cards]) {
    if (seen.has(id)) {
      problems.push({
        path: `${path}/id`,
        message: `the ID "${id}" is held twice: each column and card of a Kanban has an ID of its own (${element})`,
      });
    }
    seen.add(id);
  }
  const held = new Set(columns.map(({ id }) => id));
  const cardList = Array.isArray(props.cards) ? props.cards : [];
  cardList.forEach((card, index) => {
    const column = isRecord(card) ? card.column : undefined;
    const id = isRecord(card) ? card.id : undefined;
    if (typeof column !== "string" || held.has(column)) return;
    problems.push({
      path: `/cards/${index}/column`,
      message: `card "${String(id)}" names the column "${column}", which the item does not hold`,
    });
  });
  return problems;
};
