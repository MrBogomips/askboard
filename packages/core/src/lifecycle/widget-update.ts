// Widget items and molecule references in `update` (widget-answers design decision 5; AD-9, AD-20):
// an added question's references expand through the session's source, and a `change` naming a
// widget item or a reference merges its props key by key and, for a reference, expands the whole
// again, replacing its items and its entries in the expansion map. Works on the update's own
// copies: the aggregate keeps them only when every action applies. Plain ECMAScript (AD-1).

import {
  type LifecycleAskInput,
  mapNestedItems,
  nestedItemsOf,
  type QuestionProps,
  WIDGET_TYPES,
  type WidgetType,
  widgetTypeOf,
} from "@askboard/contract";
import type { ExpansionEntry } from "../molecules/map.ts";
import { expandSentItems } from "../molecules/on-ask.ts";
import { referencesIn } from "../molecules/references.ts";
import type { MoleculeSource } from "../molecules/source.ts";
import { type BoardModel, itemIdsOf, type QuestionRecord } from "./model.ts";

type Json = Readonly<Record<string, unknown>>;
type SentItem = { readonly type: string; readonly id: string; readonly props: Json };
type AddedItem = LifecycleAskInput["items"][number];

/** What an update may change of an ask's molecules: copies, committed with the model's. */
export type WidgetUpdate = {
  readonly source: MoleculeSource | undefined;
  expansion: Map<string, ExpansionEntry>;
  references: Map<string, Json>;
};

/** A widget item or reference the agent names, in the question that holds it. */
export type WidgetHolder = {
  readonly question: QuestionRecord;
  readonly item: SentItem;
  /** Set when the name is a molecule reference's ID. */
  readonly reference?: string;
};

export type WidgetStep =
  | { readonly ok: true; readonly props: QuestionProps }
  | { readonly ok: false; readonly detail: string; readonly itemId?: string };

// The question's own list: the walker's start, and the list a molecule reference lives in.
const itemsOf = (props: unknown): readonly SentItem[] => {
  const { items } = props as { readonly items?: readonly SentItem[] };
  return items ?? [];
};

// Every item of the question at every depth of its layouts, document order (layouts, design
// decision 5); a molecule reference stays at the top level, which `collapsed` reads.
const allItemsOf = (props: unknown): readonly SentItem[] =>
  nestedItemsOf(itemsOf(props)).map(({ item }) => item as SentItem);

const sentWidget = ({ type }: SentItem, types: readonly WidgetType[]): boolean =>
  widgetTypeOf(type, types) !== undefined;

/**
 * The widget item, layout or reference named `itemId` in the questions' current items, at any depth
 * of their layouts; never an expanded ID.
 */
export const holderOf = (
  model: BoardModel,
  widgets: WidgetUpdate,
  itemId: string,
  types: readonly WidgetType[] = WIDGET_TYPES,
): WidgetHolder | undefined => {
  for (const question of model.questions()) {
    for (const item of allItemsOf(model.propsOf(question))) {
      if (!sentWidget(item, types)) continue;
      const entry = widgets.expansion.get(item.id);
      if (entry === undefined ? item.id === itemId : entry.reference === itemId) {
        return { question, item, ...(entry === undefined ? {} : { reference: entry.reference }) };
      }
    }
  }
  return undefined;
};

// Every ID of a widget item, an expanded item or a reference the ask holds.
const widgetIdsOf = (
  model: BoardModel,
  widgets: WidgetUpdate,
  types: readonly WidgetType[],
): Set<string> => {
  const ids = new Set(widgets.references.keys());
  for (const question of model.questions()) {
    for (const item of allItemsOf(model.propsOf(question))) {
      if (sentWidget(item, types)) ids.add(item.id);
    }
  }
  return ids;
};

const SAY_PROBLEMS = 3;

// The first problems of an expansion, in a sentence.
const inWords = (problems: readonly { readonly message: string }[]): string =>
  problems
    .slice(0, SAY_PROBLEMS)
    .map(({ message }) => message)
    .join("; ");

/** Expands a replacement items list before it can become a board revision. */
export const replaceQuestionItems = (
  model: BoardModel,
  widgets: WidgetUpdate,
  question: QuestionRecord,
  props: QuestionProps,
): WidgetStep => {
  const item = { type: "question" as const, id: question.id, props };
  const sent = expandSentItems([item], widgets.source);
  if (!sent.ok)
    return { ok: false, detail: inWords(sent.problems), itemId: sent.problems[0]?.itemId };
  const own = new Set(itemIdsOf(model.propsOf(question)));
  const ownReferences = new Set(
    [...own].flatMap((id) => {
      const entry = widgets.expansion.get(id);
      return entry === undefined ? [] : [entry.reference];
    }),
  );
  const references = referencesIn([item]);
  const [expanded] = sent.items as [{ readonly props: QuestionProps }];
  const collision = [...references.keys()].find(
    (id) => widgets.references.has(id) && !ownReferences.has(id),
  );
  if (collision !== undefined)
    return { ok: false, itemId: collision, detail: `the ID "${collision}" is in use in the ask` };
  // Older entries still address answers on kept revisions; the new entries describe this one.
  widgets.expansion = new Map([...widgets.expansion, ...sent.map]);
  for (const [id, reference] of references) widgets.references.set(id, reference);
  return { ok: true, props: expanded.props };
};

/**
 * An added item with its references expanded, its entries joined to the update's map. An ID that
 * another widget item or reference of the ask holds refuses it. An item with no reference passes
 * through and looks nothing up (AD-2).
 */
export const expandAdded = (
  model: BoardModel,
  widgets: WidgetUpdate,
  item: AddedItem,
  types: readonly WidgetType[] = WIDGET_TYPES,
): { readonly ok: true; readonly item: AddedItem } | Extract<WidgetStep, { ok: false }> => {
  const references = referencesIn([item]);
  if (references.size === 0) return { ok: true, item };
  const sent = expandSentItems([item], widgets.source);
  if (!sent.ok)
    return { ok: false, detail: inWords(sent.problems), itemId: sent.problems[0]?.itemId };
  const held = widgetIdsOf(model, widgets, types);
  const taken = [...references.keys(), ...sent.map.keys()].find((id) => held.has(id));
  if (taken !== undefined) {
    return { ok: false, detail: `the ID "${taken}" is in use in the ask`, itemId: taken };
  }
  widgets.expansion = new Map([...widgets.expansion, ...sent.map]);
  for (const [id, props] of references) widgets.references.set(id, props);
  return { ok: true, item: sent.items[0] as AddedItem };
};

// The items of a question with each reference back in its place, one item for its expanded ones,
// and `changed` carrying the given props.
const collapsed = (
  items: readonly SentItem[],
  widgets: WidgetUpdate,
  changed: { readonly reference: string; readonly props: Json },
): readonly unknown[] => {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const entry = widgets.expansion.get(item.id);
    if (entry === undefined) return [item];
    if (seen.has(entry.reference)) return [];
    seen.add(entry.reference);
    const props =
      entry.reference === changed.reference
        ? changed.props
        : widgets.references.get(entry.reference);
    return [{ type: "molecule", id: entry.reference, props: props ?? {} }];
  });
};

// The map with `reference`'s entries replaced by `fresh`, the new ones in the old ones' place.
const withEntriesOf = (
  map: ReadonlyMap<string, ExpansionEntry>,
  reference: string,
  fresh: ReadonlyMap<string, ExpansionEntry>,
): Map<string, ExpansionEntry> => {
  const next = new Map<string, ExpansionEntry>();
  let placed = false;
  for (const [id, entry] of map) {
    if (entry.reference !== reference) next.set(id, entry);
    else if (!placed) {
      for (const [freshId, freshEntry] of fresh) next.set(freshId, freshEntry);
      placed = true;
    }
  }
  return next;
};

/**
 * The question's props once the reference `holder` names takes `props` over its own, key by key,
 * and expands again whole; the update's map and kept props move to the new expansion. Refused,
 * with the update untouched, when the expansion has problems.
 */
export const changedReference = (
  model: BoardModel,
  widgets: WidgetUpdate,
  holder: WidgetHolder & { readonly reference: string },
  props: Json,
): WidgetStep => {
  const { question, reference } = holder;
  const merged = { ...widgets.references.get(reference), ...props };
  const current = model.propsOf(question);
  const items = collapsed(itemsOf(current), widgets, { reference, props: merged });
  const sent = expandSentItems(
    [{ type: "question", id: question.id, props: { ...current, items } }],
    widgets.source,
  );
  if (!sent.ok) return { ok: false, detail: inWords(sent.problems), itemId: reference };
  const fresh = new Map([...sent.map].filter(([, entry]) => entry.reference === reference));
  widgets.expansion = withEntriesOf(widgets.expansion, reference, fresh);
  widgets.references.set(reference, merged);
  const [expanded] = sent.items as [{ readonly props: QuestionProps }];
  return { ok: true, props: expanded.props };
};

/**
 * The question's props with the plain widget item or layout `holder` names, at any depth, holding
 * `props` merged over its own, key by key: a layout's `items` or `tabs` are replaced whole.
 */
export const mergedWidget = (
  model: BoardModel,
  holder: WidgetHolder,
  props: Json,
): QuestionProps => {
  const current = model.propsOf(holder.question);
  const items = mapNestedItems(itemsOf(current), (item) => {
    const held = item as SentItem;
    return held.id === holder.item.id ? { ...held, props: { ...held.props, ...props } } : item;
  });
  return { ...current, items } as unknown as QuestionProps;
};
