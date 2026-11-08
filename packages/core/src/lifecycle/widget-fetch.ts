// Widget values in `fetch`'s full values (widget-answers design decision 7; AD-9, FR-20), all in
// reference addressing: a question's items and answers name an expanded item through its
// reference, and the answer holds the full edited values and the derived values the board sent; a
// widget item or a molecule reference alone comes as the user left it. An expanded ID is no item
// the agent sent, so it is none here. Pure over what the ask holds. Plain ECMAScript (AD-1).

import {
  type FetchAnswer,
  type FetchItem,
  isLayoutType,
  mapNestedItems,
  nestedItemsOf,
  type QuestionState,
  WIDGET_TYPES,
  type WidgetType,
  widgetTypeOf,
} from "@askboard/contract";
import { referenceAddressing } from "../molecules/addressing.ts";
import type { ExpansionMap } from "../molecules/map.ts";
import { valueInReferenceAddressing } from "../molecules/rewrite.ts";
import type { MoleculeSource } from "../molecules/source.ts";
import type { BoardModel, QuestionRecord } from "./model.ts";
import type { QuestionStatus } from "./states.ts";
import type { KeptAnswer } from "./widget-event.ts";

type Json = Readonly<Record<string, unknown>>;
type Question = Extract<FetchItem, { readonly type: "question" }>;
type Area = Extract<FetchItem, { readonly type: "area" }>;
type WidgetItem = Exclude<FetchItem, { readonly type: "question" | "area" }>;
type SentItem = { readonly type: string; readonly id: string; readonly props: unknown };

/** What the addressing reads: the ask's map, its molecule source and the kept answer values. */
export type WidgetFetch = {
  readonly map: ExpansionMap;
  readonly source: MoleculeSource | undefined;
  readonly kept: ReadonlyMap<string, KeptAnswer>;
};

// An item of a question's props with its ID and props in reference addressing.
const itemInReference = (item: SentItem, { map, source }: WidgetFetch): SentItem => {
  const { id, props } = valueInReferenceAddressing(map, source, item.id, item.props);
  return id === item.id && props === item.props ? item : { ...item, id, props };
};

// A question's props with its widget items in reference addressing; none held, none changed.
const propsInReference = <P extends object>(props: P, fetch: WidgetFetch): P => {
  const { items } = props as { readonly items?: readonly SentItem[] };
  if (items === undefined || fetch.map.size === 0) return props;
  return { ...props, items: items.map((item) => itemInReference(item, fetch)) };
};

// The answer with the widget content its event has kept: the full edited values, the results and
// the derived values, by the event's cursor.
const answerInReference = (answer: FetchAnswer, fetch: WidgetFetch): FetchAnswer => {
  const kept = "cursor" in answer ? fetch.kept.get(answer.cursor) : undefined;
  if (kept === undefined) return answer;
  const values = Object.fromEntries(
    Object.entries(kept.values).map(([itemId, props]) => {
      const value = valueInReferenceAddressing(fetch.map, fetch.source, itemId, props);
      return [value.id, value.props];
    }),
  );
  const addressing = referenceAddressing(fetch.map);
  const derived = addressing.derived(kept.derived);
  const results = addressing.results(kept.results);
  return {
    ...answer,
    ...(Object.keys(values).length === 0 ? {} : { values }),
    ...(Object.keys(results).length === 0 ? {} : { results }),
    ...(Object.keys(derived).length === 0 ? {} : { derived }),
  };
};

/** A question's full value with its widgets in reference addressing and its answers' values. */
export const questionInReference = (question: Question, fetch: WidgetFetch): Question => ({
  ...question,
  props: propsInReference(question.props, fetch),
  ...(question.answer === undefined ? {} : { answer: answerInReference(question.answer, fetch) }),
  ...(question.previous === undefined
    ? {}
    : { previous: answerInReference(question.previous, fetch) }),
});

/** An area's full value with the widgets of its questions in reference addressing. */
export const areaInReference = (area: Area, fetch: WidgetFetch): Area => {
  if (fetch.map.size === 0) return area;
  const [first, ...others] = area.props.items;
  const inReference = (question: typeof first) => ({
    ...question,
    props: propsInReference(question.props, fetch),
  });
  return {
    ...area,
    props: { ...area.props, items: [inReference(first), ...others.map(inReference)] },
  };
};

/** A widget item's identity: which question holds it, and how the agent names it. */
type Found = { readonly question: QuestionRecord; readonly item: SentItem };

// The widget item, layout or reference the agent names `itemId` among the questions' current items,
// at any depth of their layouts (layouts, design decision 5): an item no reference expanded, or a
// reference's expanded item; never an expanded ID.
const findWidget = (
  model: BoardModel,
  itemId: string,
  { map }: WidgetFetch,
  types: readonly WidgetType[],
): Found | undefined => {
  for (const question of model.questions()) {
    const { items = [] } = model.propsOf(question) as { readonly items?: readonly SentItem[] };
    for (const { item: nested } of nestedItemsOf(items)) {
      const item = nested as SentItem;
      if (widgetTypeOf(item.type, types) === undefined) continue;
      const entry = map.get(item.id);
      if (entry === undefined ? item.id === itemId : entry.reference === itemId) {
        return { question, item };
      }
    }
  }
  return undefined;
};

// The value the latest answer left for the item, else the value as sent. A layout's value is the
// layout with each item inside it, at every depth, as the answer left it.
const valueLeft = (found: Found, status: QuestionStatus, fetch: WidgetFetch): unknown => {
  const answer = status.answer;
  const kept = answer?.kind === "logged" ? fetch.kept.get(answer.entry.event.cursor) : undefined;
  const edited: Json = kept?.values ?? {};
  const left = (item: SentItem): SentItem =>
    Object.hasOwn(edited, item.id) ? { ...item, props: edited[item.id] } : item;
  if (!isLayoutType(found.item.type)) return left(found.item).props;
  const [layout] = mapNestedItems([found.item], (item) =>
    isLayoutType((item as SentItem).type) ? item : left(item as SentItem),
  );
  return (layout as SentItem).props;
};

// The result the latest answer gave for the item, when its type declares a result: what is kept
// for a type that declares none is never returned (AD-10, NFR-10).
const resultLeft = (
  found: Found,
  status: QuestionStatus,
  fetch: WidgetFetch,
  types: readonly WidgetType[],
): { readonly value: unknown } | undefined => {
  if (widgetTypeOf(found.item.type, types)?.result === undefined) return undefined;
  const answer = status.answer;
  const kept = answer?.kind === "logged" ? fetch.kept.get(answer.entry.event.cursor) : undefined;
  const given: Json = kept?.results ?? {};
  return Object.hasOwn(given, found.item.id) ? { value: given[found.item.id] } : undefined;
};

/**
 * A widget item or a reference alone, as the user left it, with its question's ID and state;
 * undefined for an ID that names none, an expanded ID among them.
 */
export const widgetItemValue = (
  model: BoardModel,
  itemId: string,
  statusOf: (question: QuestionRecord) => QuestionStatus,
  fetch: WidgetFetch,
  types: readonly WidgetType[] = WIDGET_TYPES,
): { readonly item: WidgetItem; readonly generation: number } | undefined => {
  const found = findWidget(model, itemId, fetch, types);
  if (found === undefined) return undefined;
  const status = statusOf(found.question);
  const props = valueLeft(found, status, fetch);
  const { id, props: addressed } = valueInReferenceAddressing(
    fetch.map,
    fetch.source,
    found.item.id,
    props,
  );
  const result = resultLeft(found, status, fetch, types);
  const item: WidgetItem = {
    type: found.item.type as WidgetItem["type"],
    id,
    questionId: found.question.id,
    props: addressed as WidgetItem["props"],
    state: status.state as QuestionState,
    ...(result === undefined ? {} : { result: result.value }),
  };
  return { item, generation: found.question.generation };
};
