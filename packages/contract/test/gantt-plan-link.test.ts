// The Gantt plan's link and its props and changes (gantt-widget, task 7.2): a plan's work packages
// name a Tree in its question with the three estimate columns, and the approved UJ-2 data and
// answer pass as a plan's props and changes.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { treeBoardDocument } from "../src/fixtures/index.ts";
import { type Change, ganttPlanLinkProblems } from "../src/index.ts";
import { type Problem, validateGanttChanges, validateGanttProps } from "../src/validate.ts";

// The approved examples, as E1's task 3.1 copied them; `approved-examples.test.ts` holds the copy
// to the archive.
const FIXTURES = join(import.meta.dir, "fixtures");
const ask = await Bun.file(join(FIXTURES, "asks/uj2-wbs-gantt.json")).json();
const answers = await Bun.file(join(FIXTURES, "answers/uj2-wbs-gantt.json")).json();
const data = ask.items[0].props.items[1].props.data as {
  workPackages: string;
  start: string;
  dependencies: Record<string, string[]>;
};
const approved = answers.asks[0].events[0].changes as readonly Change[];

// The approved data as a plan: each task's predecessors in an entry of its own.
const PLAN = {
  start: data.start,
  workPackages: data.workPackages,
  tasks: Object.fromEntries(
    Object.entries(data.dependencies).map(([task, dependencies]) => [task, { dependencies }]),
  ),
};
const SCHEDULE = { type: "gantt", id: "schedule", props: PLAN };
const EDITED = {
  ...PLAN,
  tasks: { ...PLAN.tasks, "u-1": { dependencies: ["architecture", "prototype"] } },
};

const [QUESTION] = treeBoardDocument.items;
const [WBS] = QUESTION.props.items;

/** The Tree's question holding `items` in place of its own. */
const holding = (...items: readonly unknown[]) => ({
  ...QUESTION,
  props: { ...QUESTION.props, items },
});

/** The Tree `wbs` with `columns` in place of its own. */
const treeWith = (columns: readonly unknown[]) => ({ ...WBS, props: { ...WBS.props, columns } });

/** Whether some problem sits at `path` and says each of `words`. */
const says = (problems: readonly Problem[], path: string, ...words: string[]) =>
  problems.some((p) => p.path === path && words.every((word) => p.message.includes(word)));

describe("ganttPlanLinkProblems (spec, Gantt plan link)", () => {
  test("passes the UJ-2 plan against the question of the Tree it names", () => {
    expect(ganttPlanLinkProblems(SCHEDULE, QUESTION)).toEqual([]);
    expect(ganttPlanLinkProblems(SCHEDULE, holding(WBS, SCHEDULE))).toEqual([]);
    expect(ganttPlanLinkProblems({ ...SCHEDULE, props: EDITED }, QUESTION)).toEqual([]);
  });

  test.each([
    ["nothing", holding(), ["schedule", "wbs", "no item"]],
    ["nothing, in a question with no items", { ...QUESTION, props: { text: "?" } }, ["wbs"]],
    [
      "a Choice",
      holding({ type: "choice", id: "wbs", props: { options: [{ label: "Yes" }] } }),
      ["schedule", "wbs", "choice", "Tree"],
    ],
    [
      "a Tree without columns",
      holding(treeWith([])),
      ["schedule", "wbs", "optimistic", "mostLikely", "pessimistic"],
    ],
    [
      "a Tree whose most likely estimate is text",
      holding(
        treeWith([
          { field: "optimistic", label: "Optimistic", type: "number" },
          { field: "mostLikely", label: "Most likely", type: "text" },
          { field: "pessimistic", label: "Pessimistic", type: "number" },
        ]),
      ),
      ["schedule", "wbs", "mostLikely"],
    ],
  ])("refuses a link to %s, naming the plan and the item", (_, question, words) => {
    const problems = ganttPlanLinkProblems(SCHEDULE, question);
    expect({ problems, found: says(problems, "/workPackages", ...words) }).toMatchObject({
      found: true,
    });
    expect(problems).toHaveLength(1);
  });

  test("names only the estimates a Tree lacks", () => {
    const columns = [{ field: "mostLikely", label: "Most likely", type: "number" }];
    const [problem] = ganttPlanLinkProblems(SCHEDULE, holding(treeWith(columns)));
    expect(problem?.message).toContain("optimistic, pessimistic");
    expect(problem?.message).not.toContain("mostLikely");
  });

  test("checks no link for a Gantt with its own tasks, nor for what the schema refuses", () => {
    const own = { type: "gantt", id: "release", props: { start: "2026-11-02", tasks: [] } };
    expect(ganttPlanLinkProblems(own, holding())).toEqual([]);
    expect(
      ganttPlanLinkProblems({ ...SCHEDULE, props: { ...PLAN, workPackages: 3 } }, holding()),
    ).toEqual([]);
    expect(ganttPlanLinkProblems(null, QUESTION)).toEqual([]);
    expect(ganttPlanLinkProblems({ ...SCHEDULE, props: "plan" }, QUESTION)).toEqual([]);
  });

  test("reads a malformed question as one that holds nothing", () => {
    for (const question of [null, { props: null }, { props: { items: "wbs" } }]) {
      expect(says(ganttPlanLinkProblems(SCHEDULE, question), "/workPackages", "wbs")).toBe(true);
    }
    expect(ganttPlanLinkProblems(SCHEDULE, holding(null, WBS))).toEqual([]);
  });
});

describe("the plan's props and changes (spec, Gantt item props, Gantt changes)", () => {
  test("the approved data passes as the agent's plan, and with u-1 only as an edited one", () => {
    expect(validateGanttProps(PLAN, "agent")).toEqual({ ok: true, value: PLAN });
    expect(validateGanttProps(EDITED, "edited")).toEqual({ ok: true, value: EDITED });
    expect(validateGanttProps(EDITED, "agent").ok).toBe(false);
  });

  test("the approved answer's schedule operation passes as the plan's changes", () => {
    const schedule = approved.filter(({ target }) => target.startsWith("schedule."));
    expect(schedule).toEqual([
      { op: "set", target: "schedule.u-1.dependencies", value: ["architecture", "prototype"] },
    ]);
    const checked = validateGanttChanges("schedule", schedule, PLAN);
    expect(checked.ok).toBe(true);
    expect(checked.ok ? (checked.value as unknown) : undefined).toEqual(schedule);
    expect(validateGanttChanges("schedule", schedule, EDITED).ok).toBe(true);
  });

  test("a plan's duration fails, saying that it follows the estimates", () => {
    const duration = [{ op: "set", target: "schedule.portal.duration", value: 13 }];
    const checked = validateGanttChanges("schedule", duration, PLAN);
    const problems = checked.ok ? [] : checked.problems;
    expect(says(problems, "/0/target", "portal", "estimates")).toBe(true);
  });
});
