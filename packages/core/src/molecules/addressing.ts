// Reference addressing (AD-9, AD-20; molecules design decision 7; F15): answers, warnings and
// problems name a molecule's content through the reference's ID and the child IDs of its data,
// never through the expanded IDs. An address whose part before the first `.` is an expanded ID
// takes the reference's ID instead and keeps the rest; any other address stays. A change's
// `parent` and `after` are element IDs and stay (F3); derived values keep their values. A warning
// or problem has its address fields mapped so, and every expanded ID its texts name, as a whole
// ID, replaced. `answerInReferenceAddressing` folds an answer's widget values into its `changes`
// and `derived` in reference addressing, the fold the widening calls when it appends an answer.
// Pure: nothing is changed in place. Plain ECMAScript (AD-1).

import { type Change, elementChanges, WIDGET_TYPES, type WidgetType } from "@askboard/contract";
import { elementShapeOf } from "@askboard/contract/validate";
import type { ExpansionMap } from "./map.ts";

/** The fields of a warning or problem that hold an address, not a text. */
const ADDRESS_FIELDS: ReadonlySet<string> = new Set(["address", "target", "itemId"]);
const ESCAPED = /[.*+?^${}()|[\]\\-]/g;

type Json = Readonly<Record<string, unknown>>;

export type ReferenceAddressing = {
  /** `wbs__tree.portal.label` as `wbs.portal.label`; an address of no expanded item unchanged. */
  readonly toReference: (address: string) => string;
  /** A text with every expanded ID it names, as a whole ID, replaced by its reference's. */
  readonly textToReference: (text: string) => string;
  /** An answer's changes, each `target` in reference addressing. */
  readonly changes: (changes: readonly Change[]) => readonly Change[];
  /** An answer's derived values, each key in reference addressing, in the same order. */
  readonly derived: (derived: Json) => Json;
  /**
   * An answer's results, each key (an item ID) in reference addressing, in the same order. A
   * result's content is the widget's and names no item ID, so it is left as it is.
   */
  readonly results: (results: Json) => Json;
  /** A warning or problem, its address fields and texts in reference addressing, at any depth. */
  readonly warning: <T>(warning: T) => T;
};

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Reference addressing over one board document's expansion map. */
export const referenceAddressing = (map: ExpansionMap): ReferenceAddressing => {
  const toReference = (address: string): string => {
    const dot = address.indexOf(".");
    const head = dot === -1 ? address : address.slice(0, dot);
    const entry = map.get(head);
    return entry === undefined ? address : `${entry.reference}${address.slice(head.length)}`;
  };
  // A whole ID: neither preceded nor followed by a character an ID may hold.
  const ids = [...map.keys()].map((id) => id.replace(ESCAPED, "\\$&"));
  const named =
    ids.length === 0
      ? undefined
      : new RegExp(`(?<![A-Za-z0-9_-])(?:${ids.join("|")})(?![A-Za-z0-9_-])`, "g");
  const textToReference = (text: string): string =>
    named === undefined ? text : text.replace(named, (id) => map.get(id)?.reference ?? id);
  const mapped = (value: unknown, key?: string): unknown => {
    if (typeof value === "string") {
      return key !== undefined && ADDRESS_FIELDS.has(key)
        ? toReference(value)
        : textToReference(value);
    }
    if (Array.isArray(value)) return value.map((child) => mapped(child));
    if (!isObject(value)) return value;
    return Object.fromEntries(
      Object.entries(value).map(([field, child]) => [field, mapped(child, field)]),
    );
  };
  return {
    toReference,
    textToReference,
    changes: (changes) =>
      changes.map((change) => ({ ...change, target: toReference(change.target) })),
    derived: (derived) =>
      Object.fromEntries(Object.entries(derived).map(([key, value]) => [toReference(key), value])),
    results: (results) =>
      Object.fromEntries(Object.entries(results).map(([key, value]) => [toReference(key), value])),
    warning: <T>(warning: T): T => mapped(warning) as T,
  };
};

/** An item of a board document, as sent: its type, its ID and its props. */
type SentItem = { readonly type: string; readonly id: string; readonly props: unknown };

/** An answer's changes and derived values, in reference addressing. */
export type AddressedAnswer = { readonly changes: readonly Change[]; readonly derived: Json };

const itemsOf = (question: { readonly props: object }): readonly SentItem[] => {
  const { items } = question.props as { readonly items?: readonly SentItem[] };
  return items ?? [];
};

/**
 * An answer to `question` in reference addressing (AD-9, AD-20; F15): for each widget item of the
 * question that has a value in `editedValues`, in the question's order, the generic diff of its
 * props as sent (`sentItems`, by ID, else the question's own item) and its edited value, with its
 * element shape; then every change's target and every derived key under its reference's ID. An
 * item with no edited value, or of no widget the contract defines, gives no change.
 */
export const answerInReferenceAddressing = (
  map: ExpansionMap,
  question: { readonly props: object },
  sentItems: readonly SentItem[],
  editedValues: Json,
  derived: Json,
  types: readonly WidgetType[] = WIDGET_TYPES,
): AddressedAnswer => {
  const addressing = referenceAddressing(map);
  const changes = itemsOf(question).flatMap((item) => {
    if (!Object.hasOwn(editedValues, item.id)) return [];
    const shape = elementShapeOf(item, types);
    const edited = editedValues[item.id];
    if (shape === undefined || !isObject(edited)) return [];
    const sent = sentItems.find((each) => each.id === item.id) ?? item;
    return elementChanges(item.id, isObject(sent.props) ? sent.props : {}, edited, shape);
  });
  return { changes: addressing.changes(changes), derived: addressing.derived(derived) };
};

/**
 * The results kept for each answer event, by the event's cursor, in reference addressing and
 * copied (AD-9, AD-20): the mapping `AskCore.keptAnswerResults` applies, so that an expanded item
 * ID never reaches a Snapshot. An event that kept no result is left out.
 */
export const keptResultsInReferenceAddressing = (
  map: ExpansionMap,
  kept: ReadonlyMap<string, { readonly results: Json }>,
): ReadonlyMap<string, Json> => {
  const addressing = referenceAddressing(map);
  return new Map(
    [...kept].flatMap(([cursor, { results }]) =>
      Object.keys(results).length === 0
        ? []
        : [[cursor, JSON.parse(JSON.stringify(addressing.results(results))) as Json] as const],
    ),
  );
};
