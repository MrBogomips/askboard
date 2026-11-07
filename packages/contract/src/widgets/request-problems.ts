// The widgets' own checks over the widget items of a request (widget-answers, design decision 4):
// each item of a registered type goes through `widgetItemProblems` with the agent as origin, in the
// question that holds it, so that a plan's link is checked against its own question and never the
// board's. A problem is located under its item with `problemAt`, which gives it the item's ID and
// the element it is in, and sorts it in document order. An item the request's schema already
// refused is left to the schema's problems, worded by the tables of `wording.ts`.

import type { ErrorObject } from "ajv/dist/2020";
import type { Placed } from "../ask-items.ts";
import {
  expectedAt,
  pointer,
  problemAt,
  type RequestProblem,
  type Segments,
  segmentsOf,
  type Wording,
} from "../problems.ts";
import { widgetItemProblems } from "./items.ts";
import { WIDGET_TYPES, type WidgetType, widgetTypeOf } from "./registry.ts";

const valueAt = (value: unknown, segments: Segments): unknown =>
  segments.reduce<unknown>(
    (node, segment) =>
      typeof node === "object" && node !== null
        ? (node as Record<string, unknown>)[segment]
        : undefined,
    value,
  );

const isWidget = ({ item, inQuestion }: Placed, types: readonly WidgetType[]): boolean =>
  inQuestion === true && widgetTypeOf(item.type, types) !== undefined;

// Each problem's path and every ancestor of it, as pointers: the item at `at` has a problem at or
// under it exactly when `pointer(at)` is among them. Built once for the request, so refusing many
// items takes time linear in them and not in their pairs (review X-2).
const pathsWithProblems = (problems: readonly RequestProblem[]): ReadonlySet<string> => {
  const held = new Set<string>();
  for (const { path } of problems) {
    for (let end = path.length; end > 0; end = path.lastIndexOf("/", end - 1)) {
      const prefix = path.slice(0, end);
      if (held.has(prefix)) break;
      held.add(prefix);
    }
  }
  return held;
};

/**
 * The problems of the widget items the registry holds among `placed`, in the question each is in:
 * those that `schemaProblems` leaves clean. An item's problems read `item "wbs", props.nodes[0].id: node ux …`.
 */
export const widgetProblems = (
  wording: Wording,
  value: unknown,
  placed: readonly Placed[],
  schemaProblems: readonly RequestProblem[],
  types: readonly WidgetType[] = WIDGET_TYPES,
): RequestProblem[] => {
  const refused = pathsWithProblems(schemaProblems);
  return placed
    .filter((entry) => isWidget(entry, types))
    .flatMap(({ item, at, questionAt }) => {
      if (refused.has(pointer(at))) return [];
      // The question that holds the item, at any depth of its layouts (review S-1).
      const question = valueAt(value, questionAt ?? []);
      return widgetItemProblems(item, question, "agent", types).map(({ path, message }) => {
        const segments = [...at, "props", ...segmentsOf(path)];
        return problemAt(
          wording,
          value,
          segments,
          `{where}: ${message}`,
          expectedAt(wording, segments, value),
        );
      });
    });
};

/**
 * The schema errors of a request, as each registered type's entry words them: a Gantt's `tasks`
 * cleared of the choice between its two forms, for one. A type that words none of its own leaves
 * the errors as they are.
 */
export const widgetSchemaErrors = (
  errors: readonly ErrorObject[],
  value: unknown,
  types: readonly WidgetType[] = WIDGET_TYPES,
): readonly ErrorObject[] =>
  types.reduce((kept, entry) => entry.wording.schemaErrors?.(kept, value) ?? kept, errors);
