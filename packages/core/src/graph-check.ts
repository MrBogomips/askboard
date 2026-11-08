// The send-time graph check (widget-answers design decision 5; AD-13, FR-14): the graph of the
// widget items a board document holds, built as the board builds it, and each node the build found
// in error returned as a `formula` warning in reference addressing. A graph problem never refuses a
// request. Plain ECMAScript (AD-1).

import {
  type BoardSourceItem,
  boardGraphSource,
  buildGraph,
  GraphSourceError,
} from "@askboard/compute";
import {
  type FormulaWarning,
  nestedItemsOf,
  WIDGET_TYPES,
  type WidgetType,
  widgetTypeOf,
} from "@askboard/contract";
import type { RequestProblem } from "@askboard/contract/validate";
import { referenceAddressing } from "./molecules/addressing.ts";
import type { ExpansionMap } from "./molecules/map.ts";

type Json = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const childrenOf = (item: unknown, type: string): readonly unknown[] => {
  if (!isObject(item) || item.type !== type || !isObject(item.props)) return [];
  return Array.isArray(item.props.items) ? item.props.items : [];
};

/**
 * The widget and context items of every question of the board's items, in board order, at every
 * depth of the question's layouts (layouts, design decision 5); the layouts are among them, and
 * the graph takes nothing from a type it has no source for.
 */
const questionItems = (items: readonly unknown[]): readonly BoardSourceItem[] => {
  const questions = items.flatMap((item) =>
    isObject(item) && item.type === "area" ? childrenOf(item, "area") : [item],
  );
  return questions.flatMap((question) =>
    nestedItemsOf(childrenOf(question, "question")).map(({ item }) => item),
  ) as BoardSourceItem[];
};

/** The part of an address before the first `.`: the item's ID. */
const itemOf = (address: string): string => address.split(".", 1)[0] ?? address;

/**
 * The `formula` warnings of the graph over `items`, the board document's items as stored (the
 * questions and areas of a board document), each named by the reference the agent sent.
 */
export const formulaWarnings = (
  items: readonly unknown[],
  map: ExpansionMap,
  types: readonly WidgetType[] = WIDGET_TYPES,
): readonly FormulaWarning[] => {
  const widgets = questionItems(items);
  // A graph is built only when a type that declares derived values is present (AD-13).
  if (!widgets.some(({ type }) => widgetTypeOf(type, types)?.derived !== undefined)) return [];
  const addressing = referenceAddressing(map);
  return buildGraph(boardGraphSource(widgets)).warnings.map(({ error, address, detail }) => ({
    code: "formula",
    itemId: addressing.toReference(itemOf(address)),
    address: addressing.toReference(address),
    error,
    message: addressing.textToReference(
      `The formula at ${address} is in error (${error})${detail === undefined ? "" : `: ${detail}`}.`,
    ),
  }));
};

export type GraphCheck =
  | { readonly ok: true; readonly warnings: readonly FormulaWarning[] }
  | { readonly ok: false; readonly detail: string };

/**
 * `formulaWarnings`, failing closed (AD-10): a board the graph cannot be built over, which the
 * contract's checks should have kept out, is a refusal with its reason, never a thrown error.
 */
export const checkedFormulaWarnings = (
  items: readonly unknown[],
  map: ExpansionMap,
  types: readonly WidgetType[] = WIDGET_TYPES,
): GraphCheck => {
  try {
    return { ok: true, warnings: formulaWarnings(items, map, types) };
  } catch (error) {
    if (!(error instanceof GraphSourceError)) throw error;
    return { ok: false, detail: error.message };
  }
};

/** The request problem a graph that cannot be built is refused with. */
export const graphProblem = (detail: string): RequestProblem => ({
  path: "/items",
  field: "items",
  expected: "widget items whose graph can be built",
  message: detail,
});
