// Whether a result fits the props it would be answered for (approval-scale-ranking, pre-PR reviews,
// spec S-1 = security X-1): the type's own shape check, which is its schema's rule in plain code,
// then its checks of the result against the item's props, which `widgetResultProblems` runs after
// the schema. The board page runs both alone, since it holds or seeds only results of an answer it
// can still send (AD-10, AD-20). Plain ECMAScript with no JSON and no Ajv, so the board page and
// the widget chunks may import it.

import type { Problem } from "../validate.ts";
import { WIDGET_TYPES, type WidgetType, widgetTypeOf } from "./registry.ts";

/** The problems the type's checks find in `result` against `props`; none for a type with no checks. */
export const resultFitProblems = (
  entry: WidgetType,
  result: unknown,
  props: unknown,
): readonly Problem[] => entry.result?.problems?.(result, props) ?? [];

/**
 * Whether the type of `item` takes `result` against `props`, as the item's current props. A type
 * the registry lacks, one that gives no result and one that gives a result and no shape check take
 * none. A result put back from an earlier answer may be another type's, when a revision changed
 * the item's type under its ID, so the shape is checked, as the schema does.
 */
export const widgetResultFits = (
  item: { readonly type: string; readonly id: string },
  result: unknown,
  props: unknown,
  types: readonly WidgetType[] = WIDGET_TYPES,
): boolean => {
  const entry = widgetTypeOf(item.type, types);
  return (
    entry?.result?.shape?.(result) === true && resultFitProblems(entry, result, props).length === 0
  );
};
