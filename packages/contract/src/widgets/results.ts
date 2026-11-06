// Widget results (widget-registry, design decision 7; contract spec, "Widget result declarations"
// and "The annotation shape"): a result is what a widget gives that is no edit of its content, kept
// beside the edited value in an answer's `results`. `widgetResultProblems` is the generic check of
// one result: the type's schema by `$id`, then the type's checks of the result against the item's
// props; a type that declares no result takes none. `annotationProblems` adds what the annotation
// schema cannot say. Each function takes the registry as its last parameter, defaulting to the
// shipped one.

import { isRecord } from "../problems.ts";
import type { Problem } from "../validate.ts";
import { WIDGET_TYPES, type WidgetType, widgetTypeOf } from "./registry.ts";
import { schemaVerdict } from "./schema-verdict.ts";

/**
 * The problems of `result`, the result a widget item gave, where `props` are the item's props as
 * the answer leaves them (the edited ones, else those the agent sent). Every problem names the
 * item; a path points into the result, and `/` is the result as a whole. A type the registry does
 * not hold, or one that declares no result, is one problem naming the item and its type.
 */
export const widgetResultProblems = (
  item: { readonly type: string; readonly id: string },
  result: unknown,
  props: unknown,
  types: readonly WidgetType[] = WIDGET_TYPES,
): readonly Problem[] => {
  const entry = widgetTypeOf(item.type, types);
  const at = (message: string): Problem => ({ path: "/", message });
  if (entry === undefined) {
    return [
      at(`item ${item.id} has the type "${item.type}", which is no widget the contract defines`),
    ];
  }
  if (entry.result === undefined) {
    return [at(`item ${item.id} is ${entry.noun}, and ${entry.noun} gives no result`)];
  }
  const named = ({ path, message }: Problem): Problem => ({
    path,
    message: `the result of item ${item.id}: ${message}`,
  });
  const checked = schemaVerdict(entry.result.schema, result);
  if (!checked.ok) return checked.problems.map(named);
  return (entry.result.problems?.(result, props) ?? []).map(named);
};

const REGION = /^xywh=percent:([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)$/;

// The problems of a selector the schema accepted: a start after the end, a region outside 100 by 100.
const selectorProblems = (selector: Record<string, unknown>): readonly Problem[] => {
  const at = (field: string, message: string): Problem => ({
    path: `/target/selector/${field}`,
    message,
  });
  if (selector.type === "position") {
    const { start, end } = selector;
    return typeof start === "number" && typeof end === "number" && start > end
      ? [at("start", `the start ${start} is after the end ${end}`)]
      : [];
  }
  if (selector.type === "region" && typeof selector.value === "string") {
    const parts = REGION.exec(selector.value)?.slice(1).map(Number);
    if (parts === undefined) return [];
    const [x = 0, y = 0, w = 0, h = 0] = parts;
    return x + w > 100 || y + h > 100
      ? [at("value", `the region ${selector.value} reaches past 100 percent of the item`)]
      : [];
  }
  return [];
};

/**
 * What the annotation schema cannot say of an annotation that passed it: a `position` whose start
 * is after its end, and a `region` that does not lie inside 100 by 100 percent. A value that has
 * no selector gives nothing; the schema is the check of its shape.
 */
export const annotationProblems = (annotation: unknown): readonly Problem[] => {
  const target = isRecord(annotation) ? annotation.target : undefined;
  const selector = isRecord(target) ? target.selector : undefined;
  return isRecord(selector) ? selectorProblems(selector) : [];
};
