import { describe, expect, test } from "bun:test";
import {
  ganttBoardDocument,
  ganttEditedValue,
  ganttPlanBoardDocument,
} from "@askboard/contract/fixtures";
import { ganttProblems, ganttPropsOf } from "./props.ts";
import type { GanttOwnProps, GanttPlanProps } from "./tasks.ts";

const [question] = ganttBoardDocument.items;
const [release] = question.props.items;
// The fixture's Gantt lists its own tasks.
const sent = release.props as GanttOwnProps;
const [ux] = sent.tasks;

// The fixture Gantt with its first task, or its props, changed.
const withTask = (task: unknown): unknown => ({ ...sent, tasks: [task, ...sent.tasks.slice(1)] });
const withProps = (fields: Record<string, unknown>): unknown => ({ ...sent, ...fields });

const [planQuestion] = ganttPlanBoardDocument.items;
const [, schedule] = planQuestion.props.items;
// The fixture plan: its tasks map a task ID to its entry.
const plan = schedule.props as GanttPlanProps;

// The fixture plan with its entries, or its props, changed.
const withEntries = (tasks: unknown): unknown => ({ ...plan, tasks });
const withPlan = (fields: Record<string, unknown>): unknown => ({ ...plan, ...fields });

describe("a Gantt's props, checked in the view as the agent's (gantt-widget design decision 9, AD-10)", () => {
  test("the fixture Gantt, and the edited value as an agent could send it, have none", () => {
    expect(ganttProblems(sent)).toEqual([]);
    expect(ganttProblems(ganttEditedValue)).toEqual([]);
  });

  // What the props schema refuses, which the contract's checks skip: the view compiles no schema.
  test.each([
    ["props that are no object", [], "/", "are not an object"],
    ["props that are null", null, "/", "are not an object"],
    ["an unknown field", withProps({ calendar: "us" }), "/calendar", 'unknown field "calendar"'],
    ["no start", { tasks: sent.tasks }, "/start", 'missing field "start"'],
    ["a start that is no date", withProps({ start: "11/2/2026" }), "/start", "full-date"],
    ["a start that is a number", withProps({ start: 20261102 }), "/start", "full-date"],
    ["no tasks", { start: sent.start }, "/tasks", 'missing field "tasks"'],
    ["tasks that are no list", withProps({ tasks: "ux" }), "/tasks", "list of at most 500"],
    [
      "501 tasks",
      withProps({
        tasks: Array.from({ length: 501 }, (_, index) => ({ ...ux, id: `t${index}` })),
      }),
      "/tasks",
      "list of at most 500",
    ],
    ["a task that is no object", withTask("ux"), "/tasks/0", "is not a task"],
    [
      "a task with an unknown field",
      withTask({ ...ux, owner: "kim" }),
      "/tasks/0/owner",
      "unknown",
    ],
    ["a task with no ID", withTask({ label: "UX", duration: 6 }), "/tasks/0/id", "missing"],
    ["a task ID that is no ID", withTask({ ...ux, id: "u x" }), "/tasks/0/id", "is not an ID"],
    ["a task with no name", withTask({ id: "ux", duration: 6 }), "/tasks/0/label", "missing"],
    ["an empty name", withTask({ ...ux, label: "" }), "/tasks/0/label", "1 to 200"],
    ["a name of 201", withTask({ ...ux, label: "é".repeat(201) }), "/tasks/0/label", "1 to 200"],
    [
      "a task with no duration",
      withTask({ id: "ux", label: "UX" }),
      "/tasks/0/duration",
      "missing",
    ],
    ["a duration of 2.5", withTask({ ...ux, duration: 2.5 }), "/tasks/0/duration", "whole"],
    ["a duration of 0", withTask({ ...ux, duration: 0 }), "/tasks/0/duration", "from 1 to 2,000"],
    ["a duration of 2,001", withTask({ ...ux, duration: 2001 }), "/tasks/0/duration", "2,000"],
    ["a duration in text", withTask({ ...ux, duration: "6" }), "/tasks/0/duration", "whole"],
    [
      "a requested start of 12/9",
      withTask({ ...ux, start: "12/9" }),
      "/tasks/0/start",
      "full-date",
    ],
    [
      "predecessors that are no list",
      withTask({ ...ux, dependencies: "architecture" }),
      "/tasks/0/dependencies",
      "at most 50 task IDs",
    ],
    [
      "a predecessor that is no ID",
      withTask({ ...ux, dependencies: ["a b"] }),
      "/tasks/0/dependencies",
      "at most 50 task IDs",
    ],
    [
      "51 predecessors",
      withTask({ ...ux, dependencies: Array.from({ length: 51 }, (_, index) => `p${index}`) }),
      "/tasks/0/dependencies",
      "at most 50 task IDs",
    ],
  ])("refused: %s", (_, props, path, message) => {
    expect(ganttProblems(props)).toContainEqual({
      path,
      message: expect.stringContaining(message),
    });
  });

  test("a name of 200 characters counts characters, not UTF-16 units", () => {
    expect(ganttProblems(withTask({ ...ux, label: "𝔊".repeat(200) }))).toEqual([]);
  });

  test("the contract's checks come through: a reserved ID, a day that does not exist, an ID twice", () => {
    const problems = ganttProblems(
      withProps({
        tasks: [
          { ...ux, id: "u-1" },
          { ...ux, start: "2026-02-30" },
          { ...ux, label: "Again" },
        ],
      }),
    );
    expect(problems.map(({ path }) => path)).toEqual([
      "/tasks/0/id",
      "/tasks/1/start",
      "/tasks/2/id",
    ]);
    expect(problems.map(({ message }) => message)).toEqual([
      expect.stringContaining("reserved"),
      expect.stringContaining('"2026-02-30" is not a day'),
      expect.stringContaining("used twice"),
    ]);
  });
});

describe("a Gantt plan's props, checked in the view as the agent's (gantt-widget design decision 9, AD-10)", () => {
  test("the fixture plan has none, nor a plan with no entry", () => {
    expect(ganttProblems(plan)).toEqual([]);
    expect(ganttProblems(withEntries({}))).toEqual([]);
  });

  test("an entry may hold a requested start, predecessors, both or neither", () => {
    const entries = {
      ux: { start: "2026-11-04" },
      prototype: { dependencies: ["ux"] },
      portal: { start: "2026-11-23", dependencies: ["architecture", "prototype"] },
      billing: {},
    };
    expect(ganttProblems(withEntries(entries))).toEqual([]);
  });

  // What the props schema refuses of a plan, which the contract's checks skip.
  test.each([
    ["work packages that are no ID", withPlan({ workPackages: "w b" }), "/workPackages", "ID"],
    ["work packages that are a number", withPlan({ workPackages: 7 }), "/workPackages", "ID"],
    ["entries that are no map", withPlan({ tasks: "ux" }), "/tasks", "map of at most 500"],
    [
      "501 entries",
      withEntries(Object.fromEntries(Array.from({ length: 501 }, (_, at) => [`t${at}`, {}]))),
      "/tasks",
      "map of at most 500",
    ],
    ["a key that is no task ID", withEntries({ "u x": {} }), "/tasks/u x", "is not a task ID"],
    ["an entry that is no object", withEntries({ ux: "soon" }), "/tasks/ux", "plan entry"],
    ["an entry that is a list", withEntries({ ux: [] }), "/tasks/ux", "plan entry"],
    [
      "an entry with an unknown field",
      withEntries({ ux: { owner: "kim" } }),
      "/tasks/ux/owner",
      "unknown",
    ],
    ["an entry with a name", withEntries({ ux: { label: "UX" } }), "/tasks/ux/label", "unknown"],
    [
      "an entry with a duration",
      withEntries({ ux: { duration: 6 } }),
      "/tasks/ux/duration",
      "unknown",
    ],
    [
      "a requested start of 12/9",
      withEntries({ ux: { start: "12/9" } }),
      "/tasks/ux/start",
      "full-date",
    ],
    [
      "predecessors that are no list",
      withEntries({ portal: { dependencies: "ux" } }),
      "/tasks/portal/dependencies",
      "at most 50 task IDs",
    ],
    [
      "51 predecessors",
      withEntries({
        portal: { dependencies: Array.from({ length: 51 }, (_, at) => `p${at}`) },
      }),
      "/tasks/portal/dependencies",
      "at most 50 task IDs",
    ],
  ])("refused: %s", (_, props, path, message) => {
    expect(ganttProblems(props)).toContainEqual({
      path,
      message: expect.stringContaining(message),
    });
  });

  test("the contract's checks come through: a plan's names and durations, a reserved key, its tasks' form", () => {
    expect(
      ganttProblems(withEntries({ ux: { label: "UX", duration: 6 }, "u-1": {} })).map(
        ({ path }) => path,
      ),
    ).toEqual([
      "/tasks/ux/label",
      "/tasks/ux/duration",
      "/tasks/ux/label",
      "/tasks/ux/duration",
      "/tasks/u-1",
    ]);
    expect(ganttProblems(withPlan({ tasks: sent.tasks }))).toContainEqual({
      path: "/tasks",
      message: expect.stringContaining("a plan's tasks are a map by task ID"),
    });
    expect(ganttProblems(withProps({ tasks: plan.tasks }))).toContainEqual({
      path: "/tasks",
      message: expect.stringContaining("a Gantt without workPackages lists its tasks"),
    });
  });
});

describe("the props the Gantt renders from", () => {
  test("are the item's own props once they have no problem", () => {
    expect(ganttPropsOf(release) as unknown).toBe(sent);
  });

  test("are a plan's props too", () => {
    expect(ganttPropsOf(schedule) as unknown).toBe(plan);
  });

  test("an item whose props have a problem throws, naming the item and each problem", () => {
    const item = { type: "gantt", id: "release", props: withTask({ ...ux, duration: 0 }) };
    expect(() => ganttPropsOf(item)).toThrow(
      'the Gantt "release" refuses its props: /tasks/0/duration: is not a whole number',
    );
  });
});
