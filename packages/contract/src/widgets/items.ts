// Widget item checks (molecules design decision 6; contract spec, "Widget item checks"): a widget
// item whose type the registry holds, checked in the question that holds it through its entry: the
// props schema, then the entry's checks, and the entry's checks against the question (a Gantt
// plan's link); nothing of their own. Each problem keeps the path the entry's checks give it,
// inside the item's props; an item of a type the registry does not hold is refused whole, at `/`.
// `elementShapeOf` gives the shape the one generic diff takes for an item (AD-20). Each function
// takes the registry as its last parameter, defaulting to the shipped one (widget-registry, design
// decision 2). The validators compile on their first call, not at import.

import { isRecord } from "../problems.ts";
import type { Problem } from "../validate.ts";
import type { ElementShape } from "./element-diff.ts";
import { WIDGET_TYPES, type WidgetOrigin, type WidgetType, widgetTypeOf } from "./registry.ts";
import { schemaVerdict } from "./schema-verdict.ts";

export type { WidgetOrigin };

// The schema's problems, then the entry's checks: after a passing schema only, or, for an entry
// that reads any value, beside the schema's, each problem once.
const propsProblems = (
  entry: WidgetType,
  props: unknown,
  origin: WidgetOrigin,
  types: readonly WidgetType[],
): readonly Problem[] => {
  const checked = schemaVerdict(entry.props, props, types);
  if (!checked.ok && entry.checksInvalidProps !== true) return checked.problems;
  const checks = entry.propsProblems(props, origin);
  const fromSchema = checked.ok ? [] : checked.problems;
  const seen = new Set(fromSchema.map(({ path, message }) => `${path}\n${message}`));
  return [...fromSchema, ...checks.filter(({ path, message }) => !seen.has(`${path}\n${message}`))];
};

/**
 * The problems of a widget item `{type, id, props}` in `question`, the question that holds it:
 * its entry's props schema and checks and, for an entry that has one, its checks against the
 * question; any type the registry does not hold one problem naming the item and its type.
 */
export const widgetItemProblems = (
  item: unknown,
  question: unknown,
  origin: WidgetOrigin,
  types: readonly WidgetType[] = WIDGET_TYPES,
): readonly Problem[] => {
  const type = isRecord(item) ? item.type : undefined;
  const entry = widgetTypeOf(type, types);
  if (entry !== undefined) {
    return [
      ...propsProblems(entry, isRecord(item) ? item.props : undefined, origin, types),
      ...(entry.itemProblems?.(item, question) ?? []),
    ];
  }
  const id = isRecord(item) && typeof item.id === "string" ? `item ${item.id}` : "an item";
  const named = typeof type === "string" ? `the type "${type}"` : "no type";
  return [{ path: "/", message: `${id} has ${named}, which is no widget the contract defines` }];
};

/** The element shape of a widget item for the generic diff; undefined for any other item. */
export const elementShapeOf = (
  item: unknown,
  types: readonly WidgetType[] = WIDGET_TYPES,
): ElementShape | undefined => {
  if (!isRecord(item)) return undefined;
  return widgetTypeOf(item.type, types)?.edits?.shape(isRecord(item.props) ? item.props : {});
};
