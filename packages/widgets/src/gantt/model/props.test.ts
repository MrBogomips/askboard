import { describe, expect, test } from "bun:test";
import { ganttBoardDocument, ganttEditedValue } from "@askboard/contract/fixtures";
import { ownGanttOf, ownGanttProblems } from "./props.ts";
import type { GanttOwnProps } from "./tasks.ts";

const [question] = ganttBoardDocument.items;
const [release] = question.props.items;
// The fixture's Gantt lists its own tasks.
const sent = release.props as GanttOwnProps;
const [ux] = sent.tasks;

// The fixture Gantt with its first task, or its props, changed.
const withTask = (task: unknown): unknown => ({ ...sent, tasks: [task, ...sent.tasks.slice(1)] });
const withProps = (fields: Record<string, unknown>): unknown => ({ ...sent, ...fields });

describe("a Gantt's props, checked in the view as the agent's (gantt-widget design decision 9, AD-10)", () => {
  test("the fixture Gantt, and the edited value as an agent could send it, have none", () => {
    expect(ownGanttProblems(sent)).toEqual([]);
    expect(ownGanttProblems(ganttEditedValue)).toEqual([]);
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
    expect(ownGanttProblems(props)).toContainEqual({
      path,
      message: expect.stringContaining(message),
    });
  });

  test("a name of 200 characters counts characters, not UTF-16 units", () => {
    expect(ownGanttProblems(withTask({ ...ux, label: "𝔊".repeat(200) }))).toEqual([]);
  });

  test("the contract's checks come through: a reserved ID, a day that does not exist, an ID twice", () => {
    const problems = ownGanttProblems(
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

  test("a Gantt plan is refused until the view shows one (task group 7)", () => {
    const plan = { start: "2026-11-02", workPackages: "wbs", tasks: {} };
    expect(ownGanttProblems(plan)).toContainEqual({
      path: "/workPackages",
      message: expect.stringContaining("no Gantt plan"),
    });
  });
});

describe("the props the Gantt renders from", () => {
  test("are the item's own props once they have no problem", () => {
    expect(ownGanttOf(release) as unknown).toBe(sent);
  });

  test("an item whose props have a problem throws, naming the item and each problem", () => {
    const item = { type: "gantt", id: "release", props: withTask({ ...ux, duration: 0 }) };
    expect(() => ownGanttOf(item)).toThrow(
      'the Gantt "release" refuses its props: /tasks/0/duration: is not a whole number',
    );
  });
});
