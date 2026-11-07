// The Approval's summary (view-and-widgets spec: The Approval summary; design decision 8): the
// changes the user made to the other widget items of the question, from the generic diff of each
// item's shown value against its props as sent. One line per change, naming the element by its
// `label` when that is a string, else its ID; at most 20 lines, then how many more. Pure: the shape
// lookup is passed in, the component counts and titles.

import { type Change, type ElementShape, elementChanges, type Locale } from "@askboard/contract";
import { formatValue, type ValueWords } from "./values.ts";

/** At most this many lines show; the rest are counted. */
export const SUMMARY_MAX_LINES = 20;

/** A widget item of the question: its props as sent and as shown, and its type. */
export type SummaryItem = {
  readonly id: string;
  readonly type: string;
  readonly sent: object;
  readonly shown: object;
};

/**
 * One change. `previous` and `next` are shown values, for a `set` only; `field` is the field set.
 * An element added shows its name from the shown value, a removed one from what was sent.
 */
export type SummaryLine = {
  readonly op: Change["op"];
  readonly itemId: string;
  readonly elementId: string;
  readonly name: string;
  readonly field?: string;
  readonly previous?: string;
  readonly next?: string;
};

export type Summary = {
  /** Every change, shown or not. */
  readonly count: number;
  readonly lines: readonly SummaryLine[];
  /** The changes beyond the lines shown. */
  readonly more: number;
};

type Json = Record<string, unknown>;

const isJson = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The element `id` of `props`: in a keyed shape the entry of that key, else the first element with
// that ID in the list, searching children.
const find = (props: object, shape: ElementShape, id: string): Json | undefined => {
  const top = (props as Json)[shape.elements];
  if (shape.keyed === true) {
    const entry = isJson(top) && Object.hasOwn(top, id) ? top[id] : undefined;
    return isJson(entry) ? { ...entry, id } : undefined;
  }
  const search = (list: unknown): Json | undefined => {
    if (!Array.isArray(list)) return undefined;
    for (const element of list) {
      if (!isJson(element)) continue;
      if (element.id === id) return element;
      const inner = shape.children === undefined ? undefined : search(element[shape.children]);
      if (inner !== undefined) return inner;
    }
    return undefined;
  };
  return search(top);
};

const nameOf = (element: Json | undefined, id: string): string =>
  typeof element?.label === "string" ? element.label : id;

const lineOf = (
  change: Change,
  item: SummaryItem,
  shape: ElementShape,
  locale: Locale,
  words: ValueWords,
): SummaryLine => {
  // `item.element` or `item.element.field`: an ID has no dot.
  const [, elementId = "", field] = change.target.split(".");
  const was = find(item.sent, shape, elementId);
  const now = find(item.shown, shape, elementId);
  const base = { op: change.op, itemId: item.id, elementId };
  if (change.op === "set" && field !== undefined) {
    return {
      ...base,
      name: nameOf(was ?? now, elementId),
      field,
      previous: formatValue(was?.[field], locale, words),
      next: formatValue(change.value, locale, words),
    };
  }
  const name = change.op === "remove" ? nameOf(was, elementId) : nameOf(now ?? was, elementId);
  return { ...base, name };
};

/**
 * The summary of `items`' changes in `locale`. `shapeOf` gives a type's `edits.shape` from the
 * registry, called with the item's props as sent. An item whose type it gives no shape for is
 * skipped; one whose value the diff cannot read throws, and the Approval's boundary fails it.
 */
export const summarise = (input: {
  readonly items: readonly SummaryItem[];
  readonly shapeOf: (type: string, props: object) => ElementShape | undefined;
  readonly locale: Locale;
  readonly words: ValueWords;
}): Summary => {
  const { items, shapeOf, locale, words } = input;
  const lines = items.flatMap((item) => {
    const shape = shapeOf(item.type, item.sent);
    if (shape === undefined) return [];
    return elementChanges(item.id, item.sent, item.shown, shape).map((change) =>
      lineOf(change, item, shape, locale, words),
    );
  });
  return {
    count: lines.length,
    lines: lines.slice(0, SUMMARY_MAX_LINES),
    more: Math.max(0, lines.length - SUMMARY_MAX_LINES),
  };
};
