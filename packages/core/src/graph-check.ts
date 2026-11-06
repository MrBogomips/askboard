// The send-time graph check (widget-answers design decision 5; AD-13, FR-14): the graph of the
// widget items a board document holds, built as the board builds it, and each node the build found
// in error returned as a `formula` warning in reference addressing. A graph problem never refuses a
// request. Plain ECMAScript (AD-1).

import { type BoardSourceItem, boardGraphSource, buildGraph } from "@askboard/compute";
import type { FormulaWarning } from "@askboard/contract";
import { referenceAddressing } from "./molecules/addressing.ts";
import type { ExpansionMap } from "./molecules/map.ts";

type Json = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const childrenOf = (item: unknown, type: string): readonly unknown[] => {
  if (!isObject(item) || item.type !== type || !isObject(item.props)) return [];
  return Array.isArray(item.props.items) ? item.props.items : [];
};

/** The widget and context items of every question of the board's items, in board order. */
const questionItems = (items: readonly unknown[]): readonly BoardSourceItem[] => {
  const questions = items.flatMap((item) =>
    isObject(item) && item.type === "area" ? childrenOf(item, "area") : [item],
  );
  return questions.flatMap((question) => childrenOf(question, "question")) as BoardSourceItem[];
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
): readonly FormulaWarning[] => {
  const widgets = questionItems(items);
  if (!widgets.some(({ type }) => type === "tree" || type === "gantt")) return [];
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
