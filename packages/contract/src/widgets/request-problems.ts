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

// Whether a problem lies at or under the item at `at`.
const lies = (problem: RequestProblem, at: Segments): boolean => {
  const where = pointer(at);
  return problem.path === where || problem.path.startsWith(`${where}/`);
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
): RequestProblem[] =>
  placed
    .filter((entry) => isWidget(entry, types))
    .flatMap(({ item, at }) => {
      if (schemaProblems.some((problem) => lies(problem, at))) return [];
      const question = valueAt(value, at.slice(0, -3));
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
