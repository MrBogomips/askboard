// The Gantt's checks and validators (gantt-widget, task 2.2): the schema through the seams' shared
// widget validator, then what a schema cannot say, each problem naming the task or the operation
// and the field.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ganttChangesProblems, ganttPropsProblems } from "../src/index.ts";
import {
  type Problem,
  validateAgainst,
  validateGanttChanges,
  validateGanttProps,
} from "../src/validate.ts";

const EXAMPLES = join(
  import.meta.dir,
  "../../../openspec/changes/archive/2026-10-29-review-model-contract/examples",
);
const ask = await Bun.file(join(EXAMPLES, "asks/uj2-wbs-gantt.json")).json();
const data = ask.items[0].props.items[1].props.data as {
  workPackages: string;
  start: string;
  dependencies: Record<string, string[]>;
};

const OWN = {
  start: "2026-11-02",
  tasks: [
    { id: "ux", label: "UX design", duration: 6 },
    { id: "architecture", label: "Architecture", duration: 4 },
    { id: "prototype", label: "Clickable prototype", duration: 5, dependencies: ["ux"] },
    {
      id: "portal",
      label: "Customer portal",
      duration: 13,
      dependencies: ["architecture", "prototype"],
    },
  ],
};

const PLAN = {
  start: data.start,
  workPackages: data.workPackages,
  tasks: Object.fromEntries(
    Object.entries(data.dependencies).map(([task, dependencies]) => [task, { dependencies }]),
  ),
};

const own = (tasks: readonly Record<string, unknown>[]) => ({ ...OWN, tasks });
const task = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  label: id,
  duration: 1,
  ...extra,
});

const problemsOf = (checked: { ok: boolean; problems?: readonly Problem[] }) =>
  checked.ok ? [] : (checked.problems ?? []);

/** Whether some problem sits at `path` and says each of `words`. */
const says = (problems: readonly Problem[], path: string, ...words: string[]) =>
  problems.some((p) => p.path === path && words.every((word) => p.message.includes(word)));

describe("validateGanttProps", () => {
  test("accepts a Gantt with its own tasks, from the agent and as edited", () => {
    expect(validateGanttProps(OWN, "agent")).toEqual({ ok: true, value: OWN });
    expect(validateGanttProps(OWN, "edited")).toEqual({ ok: true, value: OWN });
  });

  test("accepts the UJ-2 plan, and its added package's entry only as an edited value", () => {
    expect(validateGanttProps(PLAN, "agent").ok).toBe(true);
    const edited = {
      ...PLAN,
      tasks: { ...PLAN.tasks, "u-1": { dependencies: ["architecture", "prototype"] } },
    };
    expect(validateGanttProps(edited, "edited").ok).toBe(true);
    const problems = problemsOf(validateGanttProps(edited, "agent"));
    expect(says(problems, "/tasks/u-1", "u-1", "reserved")).toBe(true);
  });

  test("leaves cycles, unknown predecessors and entries for no leaf to the compute graph", () => {
    const cycle = own([task("a", { dependencies: ["b"] }), task("b", { dependencies: ["a"] })]);
    expect(validateGanttProps(cycle, "agent").ok).toBe(true);
    expect(validateGanttProps(own([task("a", { dependencies: ["nope"] })]), "agent").ok).toBe(true);
    expect(validateGanttProps({ ...PLAN, tasks: { nope: {} } }, "agent").ok).toBe(true);
  });

  test.each([
    [
      "own tasks as a map",
      { ...OWN, tasks: { ux: {} } },
      "/tasks",
      ["without workPackages", "list"],
    ],
    ["a plan's tasks as a list", { ...PLAN, tasks: [] }, "/tasks", ["plan", "map by task ID"]],
    [
      "a plan entry with a label",
      { ...PLAN, tasks: { portal: { label: "Portal" } } },
      "/tasks/portal/label",
      ["portal", "names", "Tree"],
    ],
    [
      "a plan entry with a duration",
      { ...PLAN, tasks: { portal: { duration: 3 } } },
      "/tasks/portal/duration",
      ["portal", "durations", "estimates"],
    ],
    [
      "a day that does not exist",
      own([task("ux", { start: "2026-02-30" })]),
      "/tasks/0/start",
      ["ux", "2026-02-30"],
    ],
    [
      "a plan starting on 1900-03-01",
      { ...PLAN, start: "1900-03-01" },
      "/start",
      ["1900-03-01", "1900-03-02"],
    ],
    [
      "a request on 1900-03-01",
      { ...PLAN, tasks: { ux: { start: "1900-03-01" } } },
      "/tasks/ux/start",
      ["ux", "1900-03-02"],
    ],
    ["one ID twice", own([task("review"), task("review")]), "/tasks/1/id", ["review", "twice"]],
    ["the agent's view-made task", own([task("u-1")]), "/tasks/0/id", ["u-1", "reserved"]],
    [
      "the agent's view-made predecessor",
      own([task("a", { dependencies: ["u-1"] })]),
      "/tasks/0/dependencies",
      ["a", "u-1", "reserved"],
    ],
    [
      "a predecessor listed twice",
      own([task("ux", { dependencies: ["design", "design"] })]),
      "/tasks/0/dependencies",
      ["ux", "design", "twice"],
    ],
    [
      "a fractional duration",
      own([task("ux", { duration: 2.5 })]),
      "/tasks/0/duration",
      ["integer"],
    ],
  ])("refuses %s, naming the task and the field", (_, value, path, words) => {
    const problems = problemsOf(validateGanttProps(value, "agent"));
    expect({ problems, found: says(problems, path, ...words) }).toMatchObject({ found: true });
  });

  test("accepts what the agent may not send when it is an edited value", () => {
    expect(
      validateGanttProps(own([task("u-1", { dependencies: ["u-2"] }), task("u-2")]), "edited").ok,
    ).toBe(true);
  });

  test("refuses past the task, predecessor and dependent limits, naming each", () => {
    const tasks = Array.from({ length: 501 }, (_, i) => task(`t${i}`));
    expect(says(problemsOf(validateGanttProps(own(tasks), "agent")), "/tasks", "500")).toBe(true);
    const many = Array.from({ length: 51 }, (_, i) => `p${i}`);
    expect(
      says(
        problemsOf(validateGanttProps(own([task("a", { dependencies: many })]), "agent")),
        "/tasks/0/dependencies",
        "50",
      ),
    ).toBe(true);
    const dependents = [
      task("design"),
      ...Array.from({ length: 51 }, (_, i) => task(`d${i}`, { dependencies: ["design"] })),
    ];
    const problems = problemsOf(validateGanttProps(own(dependents), "agent"));
    expect(says(problems, "/tasks/0", "design", "51", "50")).toBe(true);
    const fifty = dependents.slice(0, 51);
    expect(validateGanttProps(own(fifty), "agent").ok).toBe(true);
  });

  test("refuses what is no object, and compiles nothing in the shared validator", () => {
    expect(problemsOf(validateGanttProps(3, "agent")).length).toBeGreaterThan(0);
    expect(ganttPropsProblems(null, "agent")).toEqual([]);
    expect(() => validateAgainst("urn:askboard:input:gantt-props", OWN)).toThrow(
      "the contract has no schema urn:askboard:input:gantt-props",
    );
  });
});

describe("validateGanttChanges", () => {
  const set = (target: string, value: unknown) => ({ op: "set", target, value });

  test("accepts the approved UJ-2 operation on the plan", () => {
    const changes = [set("schedule.u-1.dependencies", ["architecture", "prototype"])];
    const checked = validateGanttChanges("schedule", changes, PLAN);
    expect(checked.ok).toBe(true);
    const value: unknown = checked.ok ? checked.value : undefined;
    expect(value).toEqual(changes);
  });

  test("accepts each field of a Gantt's own task, null clearing a request and the predecessors", () => {
    const changes = [
      set("release.portal.duration", 15),
      set("release.portal.start", "2026-11-23"),
      set("release.ux.start", null),
      set("release.portal.dependencies", ["ux"]),
      set("release.prototype.dependencies", null),
    ];
    expect(validateGanttChanges("release", changes, OWN).ok).toBe(true);
  });

  test.each([
    [
      "a duration on a plan",
      "schedule",
      [set("schedule.portal.duration", 3)],
      PLAN,
      "/0/target",
      ["durations", "estimates"],
    ],
    [
      "a target in another item",
      "release",
      [set("other.ux.start", null)],
      OWN,
      "/0/target",
      ["other", "release"],
    ],
    [
      "a task the Gantt does not hold",
      "release",
      [set("release.nope.start", null)],
      OWN,
      "/0/target",
      ["nope"],
    ],
    [
      "an emptied duration",
      "release",
      [set("release.ux.duration", null)],
      OWN,
      "/0/value",
      ["ux", "duration"],
    ],
    [
      "a duration past the limit",
      "release",
      [set("release.ux.duration", 2_001)],
      OWN,
      "/0/value",
      ["ux", "2000"],
    ],
    [
      "a start that is no day",
      "release",
      [set("release.ux.start", "2026-02-30")],
      OWN,
      "/0/value",
      ["ux", "2026-02-30"],
    ],
    [
      "a start given as a number",
      "release",
      [set("release.ux.start", 6)],
      OWN,
      "/0/value",
      ["ux", "start"],
    ],
    [
      "a task given itself as a predecessor",
      "release",
      [set("release.ux.dependencies", ["ux"])],
      OWN,
      "/0/value",
      ["ux", "itself"],
    ],
    [
      "predecessors given as a date",
      "release",
      [set("release.ux.dependencies", "2026-11-02")],
      OWN,
      "/0/value",
      ["ux", "dependencies"],
    ],
  ])("refuses %s, naming the operation and the field", (_, item, changes, props, path, words) => {
    const problems = problemsOf(validateGanttChanges(item, changes, props));
    expect({ problems, found: says(problems, path, ...words) }).toMatchObject({ found: true });
  });

  test("refuses operations other than set through the schema", () => {
    const add = { op: "add", target: "schedule.u-1", value: {} };
    expect(validateGanttChanges("schedule", [add], PLAN).ok).toBe(false);
    expect(ganttChangesProblems("schedule", [add], PLAN)).toEqual([]);
  });
});
