// How a request's wording reads a Ranking's props (approval-scale-ranking, design decision 1): the
// expected shape and the field list of each of its objects, keyed `ranking.props.items[].label`,
// and which element a path is in. Nothing here validates.

import { isRecord, type Segments } from "../../problems.ts";
import { ID_SHAPE, isIndex, text } from "../wording-parts.ts";
import {
  RANKING_DESCRIPTION_MAX_CHARS,
  RANKING_LABEL_MAX_CHARS,
  RANKING_MAX_ITEMS,
  RANKING_MIN_ITEMS,
} from "./constants.ts";

export const RANKING_EXPECTED: Readonly<Record<string, string>> = {
  "ranking.props": "a Ranking's props {items}",
  "ranking.props.items": `a list of ${RANKING_MIN_ITEMS} to ${RANKING_MAX_ITEMS} elements, each {id, label, description?}`,
  "ranking.props.items[]": "an element {id, label, description?}",
  "ranking.props.items[].id": `${ID_SHAPE}, unique among the Ranking's elements`,
  "ranking.props.items[].label": text(RANKING_LABEL_MAX_CHARS),
  "ranking.props.items[].description": text(RANKING_DESCRIPTION_MAX_CHARS),
};

export const RANKING_FIELDS: Readonly<Record<string, string>> = {
  "ranking.props": "a Ranking's props hold only items",
  "ranking.props.items[]": "an element holds only id, label and description",
};

/** The element a path from a Ranking item is in, by its ID, worded `element "speed"`. */
export const rankingElementOf = (item: unknown, rest: Segments): string | undefined => {
  if (!isRecord(item) || rest[1] !== "items" || !isIndex(rest[2])) return undefined;
  const items = isRecord(item.props) ? item.props.items : undefined;
  const element: unknown = Array.isArray(items) ? items[Number(rest[2])] : undefined;
  const id = isRecord(element) ? element.id : undefined;
  return typeof id === "string" ? `element "${id}"` : undefined;
};
