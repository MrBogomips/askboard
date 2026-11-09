// The send-time graph check (widget-answers design decision 5; AD-13, FR-14): the graph of the
// widget items a board document holds, built as the board builds it, and each node the build found
// in error returned as a `formula` warning in reference addressing. A graph problem never refuses a
// request, and the warnings it returns are bounded (wbs-gantt-consistency, AD-6). Plain ECMAScript
// (AD-1).

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

/**
 * The most characters the JSON text of an ask's or update's `formula` warnings may take: a third of
 * `RESULT_MAX_CHARS` (AD-6), which leaves the rest of a result its room (wbs-gantt-consistency).
 */
export const FORMULA_WARNINGS_MAX_CHARS = 10_000;

/**
 * The room kept for the closing warning: an `itemId` of at most 64 characters, an address of at most
 * 256 (the warning schema's limit, written twice), an error kind and a count take about 750.
 */
export const FORMULA_WARNING_CLOSING_MAX_CHARS = 1_000;

const jsonLength = (warning: FormulaWarning): number => JSON.stringify(warning).length;

/**
 * The warnings within `max` characters of JSON text, measured as `JSON.stringify` writes them,
 * escapes included. A list within `max` is returned as it is. Past it, the warnings kept in order
 * leave `FORMULA_WARNING_CLOSING_MAX_CHARS` free, and one closing warning stands for the first
 * warning left out, with its item, address and error, and counts the warnings after it, so that the
 * kept, the closing one and the count make up the list. Pure, plain ECMAScript.
 */
export const boundedFormulaWarnings = (
  warnings: readonly FormulaWarning[],
  max: number,
): readonly FormulaWarning[] => {
  const lengths = warnings.map(jsonLength);
  // "[" and "]", and a comma between two warnings.
  const total = lengths.reduce((sum, length) => sum + length, 2) + Math.max(0, lengths.length - 1);
  if (total <= max) return warnings;
  const budget = max - FORMULA_WARNING_CLOSING_MAX_CHARS;
  let used = 2;
  let kept = 0;
  while (kept < warnings.length) {
    const next = used + (lengths[kept] as number) + (kept === 0 ? 0 : 1);
    if (next > budget) break;
    used = next;
    kept += 1;
  }
  const first = warnings[kept] as FormulaWarning;
  const left = warnings.length - kept - 1;
  const { itemId, address, error } = first as FormulaWarning & { error: string };
  // Nothing after the closing warning: no count, only that its own detail is left out.
  const message =
    left === 0
      ? `The formula at ${address} is in error (${error}); its detail is left out.`
      : `The formula at ${address} is in error (${error}), and ${left} more formula ${left === 1 ? "warning is" : "warnings are"} left out.`;
  return [...warnings.slice(0, kept), { code: "formula", itemId, address, error, message }];
};

/** The part of an address before the first `.`: the item's ID. */
const itemOf = (address: string): string => address.split(".", 1)[0] ?? address;

/**
 * The `formula` warnings of the graph over `items`, the board document's items as stored (the
 * questions and areas of a board document), each named by the reference the agent sent, within
 * `FORMULA_WARNINGS_MAX_CHARS` of JSON text: past it, one closing warning counts the rest.
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
  const all: readonly FormulaWarning[] = buildGraph(boardGraphSource(widgets)).warnings.map(
    ({ error, address, detail }) => ({
      code: "formula",
      itemId: addressing.toReference(itemOf(address)),
      address: addressing.toReference(address),
      error,
      message: addressing.textToReference(
        `The formula at ${address} is in error (${error})${detail === undefined ? "" : `: ${detail}`}.`,
      ),
    }),
  );
  return boundedFormulaWarnings(all, FORMULA_WARNINGS_MAX_CHARS);
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
