// What the graph says of a Gantt (design decision 8, AD-13): per task its start, finish, duration,
// critical flag and earliest start, or the formula error it reads as; the plan's finish; and the
// answer's derived values by `GANTT_ANSWER_DERIVED`, any value in error left out (proposal, open
// question 14). The model computes no date: every one comes from `compute`'s graph.

import { type FormulaError, isFormulaError, type NodeResult } from "@askboard/compute";
import { GANTT_ANSWER_DERIVED } from "@askboard/contract";
import type { BoardGraph } from "../../graph/board-graph.ts";

export type TaskSchedule =
  | {
      readonly kind: "scheduled";
      readonly startDate: string;
      readonly finishDate: string;
      /** In working days. */
      readonly duration: number;
      /** The earliest start the predecessors allow, which a requested start never moves. */
      readonly earliestDate: string;
      /** False too while the flag is in error, as when the plan's end is: no path is known. */
      readonly critical: boolean;
    }
  | { readonly kind: "error"; readonly error: FormulaError };

/** The answer's derived values, by reference: `<item>.finish` and `<item>.criticalPath`. */
export type GanttDerived = Readonly<Record<string, string | readonly string[]>>;

/** Reads a node as a value of one type; any other value reads as a value error. */
const readAs = <T extends NodeResult>(
  graph: BoardGraph,
  address: string,
  is: (value: NodeResult) => value is T,
  what: string,
): T | FormulaError => {
  const value = graph.read(address);
  if (isFormulaError(value) || is(value)) return value;
  return Object.freeze({ error: "value", address, detail: `not ${what}` });
};

const isText = (value: NodeResult): value is string => typeof value === "string";
const isNumber = (value: NodeResult): value is number => typeof value === "number";
const isBoolean = (value: NodeResult): value is boolean => typeof value === "boolean";

const readDate = (graph: BoardGraph, address: string) => readAs(graph, address, isText, "a date");

/** A task's schedule: its dates, duration and critical flag, or the first of them in error. */
export const taskSchedule = (graph: BoardGraph, itemId: string, taskId: string): TaskSchedule => {
  const at = (field: string) => `${itemId}.${taskId}.${field}`;
  const startDate = readDate(graph, at("startDate"));
  const finishDate = readDate(graph, at("finishDate"));
  const duration = readAs(graph, at("duration"), isNumber, "a number");
  const earliestDate = readDate(graph, at("earliestDate"));
  for (const field of [startDate, finishDate, duration, earliestDate]) {
    if (isFormulaError(field)) return Object.freeze({ kind: "error", error: field });
  }
  return Object.freeze({
    kind: "scheduled",
    startDate: startDate as string,
    finishDate: finishDate as string,
    duration: duration as number,
    earliestDate: earliestDate as string,
    critical: graph.read(at("critical")) === true,
  });
};

/** Each row's schedule, in the rows' order. */
export const scheduleOf = (
  graph: BoardGraph,
  itemId: string,
  rows: readonly { readonly id: string }[],
): readonly TaskSchedule[] => Object.freeze(rows.map((row) => taskSchedule(graph, itemId, row.id)));

/** The plan's finish, a `full-date`, or the error it reads as. */
export const planFinish = (graph: BoardGraph, itemId: string): string | FormulaError =>
  readDate(graph, `${itemId}.${GANTT_ANSWER_DERIVED.finish}`);

/**
 * The critical tasks' IDs in the rows' order, or undefined when any task's flag is in error: a
 * list missing a task would read as the whole path.
 */
const criticalPath = (
  graph: BoardGraph,
  itemId: string,
  rows: readonly { readonly id: string }[],
): readonly string[] | undefined => {
  const path: string[] = [];
  for (const row of rows) {
    const address = `${itemId}.${row.id}.${GANTT_ANSWER_DERIVED.criticalPath}`;
    const critical = readAs(graph, address, isBoolean, "a boolean");
    if (isFormulaError(critical)) return undefined;
    if (critical) path.push(row.id);
  }
  return Object.freeze(path);
};

/** The derived values the Gantt's answer carries, each one in error left out. */
export const answerDerived = (
  graph: BoardGraph,
  itemId: string,
  rows: readonly { readonly id: string }[],
): GanttDerived => {
  const finish = planFinish(graph, itemId);
  const path = criticalPath(graph, itemId, rows);
  const entries: [string, string | readonly string[]][] = [];
  if (!isFormulaError(finish)) entries.push([`${itemId}.finish`, finish]);
  if (path !== undefined) entries.push([`${itemId}.criticalPath`, path]);
  return Object.freeze(Object.fromEntries(entries));
};
