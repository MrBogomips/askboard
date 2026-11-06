// The widgets' own checks over the widget items of a request (widget-answers, design decision 4):
// each Tree and Gantt item goes through `widgetItemProblems` with the agent as origin, in the
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

const valueAt = (value: unknown, segments: Segments): unknown =>
  segments.reduce<unknown>(
    (node, segment) =>
      typeof node === "object" && node !== null
        ? (node as Record<string, unknown>)[segment]
        : undefined,
    value,
  );

const isWidget = ({ item, inQuestion }: Placed): boolean =>
  inQuestion === true && (item.type === "tree" || item.type === "gantt");

// Whether a problem lies at or under the item at `at`.
const lies = (problem: RequestProblem, at: Segments): boolean => {
  const where = pointer(at);
  return problem.path === where || problem.path.startsWith(`${where}/`);
};

/**
 * The problems of the Tree and Gantt items among `placed`, in the question each is in: those that
 * `schemaProblems` leaves clean. An item's problems read `item "wbs", props.nodes[0].id: node ux …`.
 */
export const widgetProblems = (
  wording: Wording,
  value: unknown,
  placed: readonly Placed[],
  schemaProblems: readonly RequestProblem[],
): RequestProblem[] =>
  placed.filter(isWidget).flatMap(({ item, at }) => {
    if (schemaProblems.some((problem) => lies(problem, at))) return [];
    const question = valueAt(value, at.slice(0, -3));
    return widgetItemProblems(item, question, "agent").map(({ path, message }) => {
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

const TASKS = "/props/tasks";

/**
 * The schema errors of a request, with those of a Gantt's `tasks` cleared of the choice between
 * its two forms: `tasks` is a list or a map by task ID, so that an `anyOf` error and the `type`
 * error of the form it is not would hide what is wrong with the form it is. A list or a map keeps
 * its own errors; any other value keeps the `anyOf` error alone.
 */
export const widgetSchemaErrors = (
  errors: readonly ErrorObject[],
  value: unknown,
): readonly ErrorObject[] =>
  errors.filter((error) => {
    const { instancePath, keyword } = error;
    if (!instancePath.endsWith(TASKS) || (keyword !== "anyOf" && keyword !== "type")) return true;
    const item = valueAt(value, segmentsOf(instancePath.slice(0, -TASKS.length)));
    if (
      typeof item !== "object" ||
      item === null ||
      (item as { type?: unknown }).type !== "gantt"
    ) {
      return true;
    }
    const tasks = valueAt(item, ["props", "tasks"]);
    return keyword === "anyOf" && (typeof tasks !== "object" || tasks === null);
  });
