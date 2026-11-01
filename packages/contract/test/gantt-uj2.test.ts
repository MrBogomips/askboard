// The UJ-2 check of design decision 4 for the Gantt plan (gantt-widget, task 7.3): the plan's
// fixtures agree with the approved example's `schedule` data and its answer's `schedule.`
// operation and derived values. `compute`'s tests check that the derived values come out of the
// edited Tree and plan.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  ganttPlanBoardDocument,
  ganttPlanChanges,
  ganttPlanDerived,
  ganttPlanEditedValue,
  treeAnswer,
  treeBoardDocument,
  treeEditedValue,
} from "../src/fixtures/index.ts";
import {
  type AnswerEvent,
  applyElementChanges,
  elementChanges,
  GANTT_ANSWER_DERIVED,
  GANTT_PLAN_SHAPE,
  ganttPlanLinkProblems,
  ganttShape,
  SCHEMA_IDS,
} from "../src/index.ts";
import {
  validateAgainst,
  validateBoardDocument,
  validateGanttChanges,
  validateGanttProps,
} from "../src/validate.ts";

// The approved examples, as E1's task 3.1 copied them; `approved-examples.test.ts` holds the copy
// to the archive.
const FIXTURES = join(import.meta.dir, "fixtures");
const ask = await Bun.file(join(FIXTURES, "asks/uj2-wbs-gantt.json")).json();
const answers = await Bun.file(join(FIXTURES, "answers/uj2-wbs-gantt.json")).json();
const reference = ask.items[0].props.items[1] as {
  id: string;
  props: {
    molecule: string;
    data: { workPackages: string; start: string; dependencies: Record<string, string[]> };
  };
};
const event = answers.asks[0].events[0] as AnswerEvent;
const scheduleChanges = (event.changes ?? []).filter(({ target }) =>
  target.startsWith("schedule."),
);
const scheduleDerived = Object.fromEntries(
  Object.entries(event.derived ?? {}).filter(([key]) => key.startsWith("schedule.")),
);

const [question] = ganttPlanBoardDocument.items;
const [wbs, schedule] = question.props.items;

describe("the Gantt plan fixtures (spec, Gantt fixtures)", () => {
  test("the board document is the Tree's question with the plan schedule appended", () => {
    const [treeQuestion] = treeBoardDocument.items;
    const { items: _, ...rest } = ganttPlanBoardDocument;
    const { items: __, ...treeRest } = treeBoardDocument;
    expect(rest).toEqual(treeRest);
    const withoutPlan: unknown = { ...question, props: { ...question.props, items: [wbs] } };
    expect(withoutPlan).toEqual(treeQuestion);
    expect(schedule).toMatchObject({ type: "gantt", id: reference.id });
    expect(reference.props.molecule).toBe("gantt-plan");
  });

  test("the plan is the approved data, each task's predecessors in an entry of its own", () => {
    const { workPackages, start, dependencies } = reference.props.data;
    expect(schedule.props).toEqual({
      start,
      workPackages,
      tasks: {
        prototype: { dependencies: dependencies.prototype },
        portal: { dependencies: dependencies.portal },
        billing: { dependencies: dependencies.billing },
        reporting: { dependencies: dependencies.reporting },
      },
    });
    expect(Object.keys(dependencies).sort()).toEqual(Object.keys(schedule.props.tasks).sort());
  });

  test("the plan validates as the agent's, linked to the Tree in its question", () => {
    expect(validateGanttProps(schedule.props, "agent")).toEqual({
      ok: true,
      value: schedule.props,
    });
    expect(ganttPlanLinkProblems(schedule, question)).toEqual([]);
  });

  test("E1's board document refuses it: no Gantt reaches the board page yet", () => {
    expect(validateBoardDocument(ganttPlanBoardDocument)).toMatchObject({
      ok: false,
      reason: "schema",
    });
  });

  test("the edited plan links the added package u-1, and validates only as an edited value", () => {
    const value: unknown = ganttPlanEditedValue;
    expect(value).toEqual({
      ...schedule.props,
      tasks: { ...schedule.props.tasks, "u-1": { dependencies: ["architecture", "prototype"] } },
    });
    expect(validateGanttProps(ganttPlanEditedValue, "edited")).toEqual({
      ok: true,
      value: ganttPlanEditedValue,
    });
    expect(validateGanttProps(ganttPlanEditedValue, "agent").ok).toBe(false);
    const edited = {
      ...question,
      props: { ...question.props, items: [{ ...wbs, props: treeEditedValue }] },
    };
    expect(ganttPlanLinkProblems({ ...schedule, props: ganttPlanEditedValue }, edited)).toEqual([]);
  });

  test("the plan's changes are the approved answer's schedule operation, and validate", () => {
    const changes: unknown = ganttPlanChanges;
    expect(changes).toEqual(scheduleChanges);
    expect(ganttPlanChanges).toHaveLength(1);
    for (const props of [schedule.props, ganttPlanEditedValue]) {
      const checked = validateGanttChanges("schedule", ganttPlanChanges, props);
      expect(checked.ok).toBe(true);
    }
  });

  test("the diff of the sent and the edited plan is exactly those changes, and applies back", () => {
    expect(ganttShape(schedule.props)).toBe(GANTT_PLAN_SHAPE);
    expect(
      elementChanges("schedule", schedule.props, ganttPlanEditedValue, GANTT_PLAN_SHAPE),
    ).toEqual(ganttPlanChanges);
    expect(
      applyElementChanges("schedule", schedule.props, ganttPlanChanges, GANTT_PLAN_SHAPE),
    ).toEqual(ganttPlanEditedValue);
  });
});

describe("the Gantt plan's derived values (spec, Gantt answer derived values)", () => {
  test("are the approved answer's schedule values, one per declared key", () => {
    expect(ganttPlanDerived).toEqual(scheduleDerived);
    expect(Object.keys(ganttPlanDerived).sort()).toEqual(
      Object.keys(GANTT_ANSWER_DERIVED)
        .map((key) => `schedule.${key}`)
        .sort(),
    );
    expect(ganttPlanDerived).toEqual({
      "schedule.finish": "2026-12-02",
      "schedule.criticalPath": ["ux", "prototype", "portal", "reporting"],
    });
  });

  test("validate in an answer event with the Tree's changes and the plan's", () => {
    const answer: AnswerEvent = {
      ...treeAnswer,
      changes: [...(treeAnswer.changes ?? []), ...ganttPlanChanges],
      derived: ganttPlanDerived,
    };
    expect(validateAgainst(SCHEMA_IDS.answerEvent, answer)).toEqual({ ok: true, value: answer });
  });
});
