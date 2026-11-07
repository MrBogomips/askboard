// How a request's wording reads a Kanban's props (latex-kanban-timeline, design decision 4): the
// expected shape and the field list of each of its objects, keyed `kanban.props.cards[].column`,
// and which element a path is in. Nothing here validates.

import { isRecord, type Segments } from "../../problems.ts";
import { ID_SHAPE, isIndex, text } from "../wording-parts.ts";
import {
  KANBAN_CARD_DESCRIPTION_MAX_CHARS,
  KANBAN_CARD_LABEL_MAX_CHARS,
  KANBAN_COLUMN_LABEL_MAX_CHARS,
  KANBAN_MAX_CARDS,
  KANBAN_MAX_COLUMNS,
  KANBAN_MIN_CARDS,
  KANBAN_MIN_COLUMNS,
} from "./constants.ts";

export const KANBAN_EXPECTED: Readonly<Record<string, string>> = {
  "kanban.props": "a Kanban's props {columns, cards}",
  "kanban.props.columns": `a list of ${KANBAN_MIN_COLUMNS} to ${KANBAN_MAX_COLUMNS} columns, each {id, label}`,
  "kanban.props.columns[]": "a column {id, label}",
  "kanban.props.columns[].id": `${ID_SHAPE}, unique among the Kanban's columns and cards`,
  "kanban.props.columns[].label": text(KANBAN_COLUMN_LABEL_MAX_CHARS),
  "kanban.props.cards": `a list of ${KANBAN_MIN_CARDS} to ${KANBAN_MAX_CARDS} cards, each {id, label, description?, column}`,
  "kanban.props.cards[]": "a card {id, label, description?, column}",
  "kanban.props.cards[].id": `${ID_SHAPE}, unique among the Kanban's columns and cards`,
  "kanban.props.cards[].label": text(KANBAN_CARD_LABEL_MAX_CHARS),
  "kanban.props.cards[].description": text(KANBAN_CARD_DESCRIPTION_MAX_CHARS),
  "kanban.props.cards[].column": `${ID_SHAPE}, the ID of one of the Kanban's columns`,
};

export const KANBAN_FIELDS: Readonly<Record<string, string>> = {
  "kanban.props": "a Kanban's props hold only columns and cards",
  "kanban.props.columns[]": "a column holds only id and label",
  "kanban.props.cards[]": "a card holds only id, label, description and column",
};

/** The column or card a path from a Kanban item is in, by its ID, worded `card "fix-login"`. */
export const kanbanElementOf = (item: unknown, rest: Segments): string | undefined => {
  const key = rest[1];
  if (!isRecord(item) || (key !== "cards" && key !== "columns") || !isIndex(rest[2])) {
    return undefined;
  }
  const list = isRecord(item.props) ? item.props[key] : undefined;
  const element: unknown = Array.isArray(list) ? list[Number(rest[2])] : undefined;
  const id = isRecord(element) ? element.id : undefined;
  return typeof id === "string" ? `${key === "cards" ? "card" : "column"} "${id}"` : undefined;
};
