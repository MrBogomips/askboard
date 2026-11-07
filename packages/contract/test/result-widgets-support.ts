// What the three result widgets' tests share (approval-scale-ranking, group 1): a request's wording
// over a registry, an ask's problems over it, and a result's problems. Not a test file.

import { innerItemOf, itemExpected, itemKey, placedItems } from "../src/ask-items.ts";
import type { RequestProblem, Wording } from "../src/problems.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { elementOf } from "../src/widgets/paths.ts";
import type { WidgetType } from "../src/widgets/registry.ts";
import { widgetProblems } from "../src/widgets/request-problems.ts";
import { widgetResultProblems } from "../src/widgets/results.ts";
import { widgetExpected, widgetFields } from "../src/widgets/wording.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";

export type Item = { readonly type: string; readonly id: string; readonly props: unknown };

export const question = (...items: readonly Item[]): Item => ({
  type: "question",
  id: "q",
  props: { text: "Which?", items },
});

export const ask = (...items: readonly Item[]) => ({ askId: "widgets-ask-a1b2", items });

// A request's wording as the ask's is composed: tables, key by type, the item a path is in.
const wordingOf = (types: readonly WidgetType[]): Wording => ({
  root: "(the ask)",
  expected: { ...itemExpected(types), ...widgetExpected(types) },
  fields: widgetFields(types),
  keyOf: (value, segments) =>
    segments[0] === "items" && segments.length > 1
      ? itemKey(
          (value as { items: unknown[] }).items[Number(segments[1])],
          segments.slice(2),
          types,
        )
      : segments.join("."),
  itemOf: (value, segments) => {
    if (segments[0] !== "items" || segments.length < 3) return undefined;
    const inner = innerItemOf(
      (value as { items: unknown[] }).items[Number(segments[1])],
      segments.slice(2),
    );
    const element = elementOf(inner.item, inner.rest, types);
    return {
      itemId: (inner.item as { id?: string }).id as string,
      rest: inner.rest,
      ...(element === undefined ? {} : { element }),
    };
  },
});

/** The widgets' own problems of an ask holding `items` in one question, as the agent reads them. */
export const askProblems = (
  types: readonly WidgetType[],
  ...items: readonly Item[]
): readonly RequestProblem[] => {
  const value = ask(question(...items));
  return widgetProblems(wordingOf(types), value, placedItems(value.items, ["items"]), [], types);
};

/** Whether the ask's composed schema over `types` accepts an ask holding `items`. */
export const askAccepted = (types: readonly WidgetType[], ...items: readonly Item[]): boolean =>
  errorsOf(ajvOver(types), SCHEMA_IDS.ask, ask(question(...items))).length === 0;

/** The problems of a result for an item of `types`, as the paths and messages they carry. */
export const resultProblemsOf = (
  types: readonly WidgetType[],
  item: Item,
  result: unknown,
): readonly { readonly path: string; readonly message: string }[] =>
  widgetResultProblems(item, result, item.props, types);
