// Whether a result fits the props it would be answered for (approval-scale-ranking, pre-PR reviews,
// spec S-1 = security X-1): the type's own checks of a result against an item's props, which
// `widgetResultProblems` runs after the schema and the board page runs alone, since it holds or
// seeds only results of an answer it can still send (AD-10, AD-20). Plain ECMAScript with no JSON
// and no Ajv, so the board page and the widget chunks may import it.

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
 * the registry lacks, or one that gives no result, takes none. The result's shape is the schema's
 * to check: a result put back from an answer or held from a component has passed it.
 */
export const widgetResultFits = (
  item: { readonly type: string; readonly id: string },
  result: unknown,
  props: unknown,
  types: readonly WidgetType[] = WIDGET_TYPES,
): boolean => {
  const entry = widgetTypeOf(item.type, types);
  return entry?.result !== undefined && resultFitProblems(entry, result, props).length === 0;
};
