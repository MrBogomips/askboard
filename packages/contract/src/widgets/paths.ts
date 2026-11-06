// How a path in a widget item's props reads: the key of its wording (`tree.props.nodes[].label`)
// and the element it is in (`node "ux"`, `task "t1"`). Pure functions of the path, the item and the
// registry (widget-registry, design decision 5): each type's folding and element naming are in its
// entry, and this module imports no entry, only the registry, so that `ask-items.ts` can use it.

import { isRecord, type Segments } from "../problems.ts";
import { WIDGET_TYPES, type WidgetType, widgetTypeOf } from "./registry.ts";

/**
 * The path of a widget item's field as its wording key reads it: a map key of a plan's tasks is
 * `{task}`, a column field of a node is `{field}` and the levels of a Tree's children fold away,
 * each as its type's entry says. Any other item type keeps its path.
 */
export const widgetRest = (
  type: string,
  rest: Segments,
  types: readonly WidgetType[] = WIDGET_TYPES,
): Segments => widgetTypeOf(type, types)?.wording.rest?.(rest) ?? rest;

/**
 * The element of a widget item a path from the item is in, worded as `node "ux"` or `task "t1"`,
 * when the path enters one that has an ID; undefined otherwise.
 */
export const elementOf = (
  item: unknown,
  rest: Segments,
  types: readonly WidgetType[] = WIDGET_TYPES,
): string | undefined => {
  if (!isRecord(item) || rest[0] !== "props" || rest.length < 3) return undefined;
  return widgetTypeOf(item.type, types)?.wording.element?.(item, rest);
};
