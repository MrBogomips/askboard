// A field's check through the registry (form-widget, design decision 2): the entry's own
// `fieldCheck` over the item's props and its result, `undefined` for a type that registers none.
// Apart from `field-checks.ts` so that the entries, which that module serves, import no registry.

import type { FieldCheckFailure } from "./field-checks.ts";
import { WIDGET_TYPES, type WidgetType, widgetTypeOf } from "./registry.ts";

/**
 * The failure of `item`'s field check for `result`, `undefined` when it passes or the type has none.
 * `result` is `undefined` when the item has no result.
 */
export const widgetFieldCheck = (
  item: { readonly type: string; readonly props?: unknown },
  result: unknown,
  types: readonly WidgetType[] = WIDGET_TYPES,
): FieldCheckFailure | undefined =>
  widgetTypeOf(item.type, types)?.fieldCheck?.(result, item.props);
