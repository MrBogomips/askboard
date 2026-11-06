// The Gantt on the seams' one generic diff (gantt-widget, task 2.3): it declares only its shapes,
// a flat list for its own tasks and a keyed map for a plan, and writes no diff of its own.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ganttBoardDocument, ganttEditedValue } from "../src/fixtures/index.ts";
import {
  applyElementChanges,
  elementChanges,
  GANTT_PLAN_SHAPE,
  GANTT_SHAPE,
  ganttShape,
} from "../src/index.ts";
import { validateGanttChanges, validateGanttProps } from "../src/validate.ts";

const EXAMPLES = join(
  import.meta.dir,
  "../../../openspec/changes/archive/2026-10-29-review-model-contract/examples",
);
const ask = await Bun.file(join(EXAMPLES, "asks/uj2-wbs-gantt.json")).json();
const answer = await Bun.file(join(EXAMPLES, "answers/uj2-wbs-gantt.json")).json();
const data = ask.items[0].props.items[1].props.data as {
  workPackages: string;
  start: string;
  dependencies: Record<string, string[]>;
};

type Json = Record<string, unknown>;

const release = ganttBoardDocument.items[0].props.items[0];
const RELEASE = release.props as unknown as Json & { tasks: Json[] };

const PLAN = {
  start: data.start,
  workPackages: data.workPackages,
  tasks: Object.fromEntries(
    Object.entries(data.dependencies).map(([task, dependencies]) => [task, { dependencies }]),
  ),
};

const withTask = (props: Json & { tasks: Json[] }, id: string, change: (task: Json) => Json) => ({
  ...props,
  tasks: props.tasks.map((task) => (task.id === id ? change(task) : task)),
});

const without = (task: Json, field: string): Json =>
  Object.fromEntries(Object.entries(task).filter(([key]) => key !== field));

describe("the Gantt's shapes", () => {
  test("are a flat list for its own tasks and a keyed map for a plan", () => {
    expect(GANTT_SHAPE).toEqual({ elements: "tasks" });
    expect(GANTT_PLAN_SHAPE).toEqual({ elements: "tasks", keyed: true });
    expect(ganttShape(RELEASE)).toBe(GANTT_SHAPE);
    expect(ganttShape(PLAN)).toBe(GANTT_PLAN_SHAPE);
  });
});

describe("a Gantt's own tasks on the generic diff", () => {
  const diff = (edited: object) => elementChanges("release", RELEASE, edited, GANTT_SHAPE);

  test("give no operation for a Gantt that ends as it was sent", () => {
    expect(diff(structuredClone(RELEASE))).toEqual([]);
  });

  test("give one set per changed field", () => {
    const edited = withTask(
      withTask(RELEASE, "portal", (task) => ({ ...task, duration: 15, start: "2026-11-23" })),
      "billing",
      (task) => ({ ...task, dependencies: ["architecture", "ux"] }),
    );
    expect(diff(edited)).toEqual([
      { op: "set", target: "release.portal.duration", value: 15 },
      { op: "set", target: "release.portal.start", value: "2026-11-23" },
      { op: "set", target: "release.billing.dependencies", value: ["architecture", "ux"] },
    ]);
  });

  test("give one set for a changed predecessor list", () => {
    const edited = withTask(RELEASE, "reporting", (task) => ({
      ...task,
      dependencies: ["portal", "billing"],
    }));
    expect(diff(edited)).toEqual([
      { op: "set", target: "release.reporting.dependencies", value: ["portal", "billing"] },
    ]);
  });

  test("give a set to null for a cleared request and an emptied list", () => {
    const requested = withTask(RELEASE, "ux", (task) => ({ ...task, start: "2026-11-04" }));
    const edited = withTask(
      withTask(requested, "ux", (task) => without(task, "start")),
      "prototype",
      (task) => without(task, "dependencies"),
    );
    expect(elementChanges("release", requested, edited, GANTT_SHAPE)).toEqual([
      { op: "set", target: "release.ux.start", value: null },
      { op: "set", target: "release.prototype.dependencies", value: null },
    ]);
  });

  test("hold the standalone fixture: two sets, in task order", () => {
    expect(validateGanttProps(RELEASE, "agent").ok).toBe(true);
    expect(validateGanttProps(ganttEditedValue, "edited").ok).toBe(true);
    const changes = diff(ganttEditedValue);
    expect(changes).toEqual([
      { op: "set", target: "release.billing.duration", value: 11 },
      { op: "set", target: "release.reporting.start", value: "2026-12-09" },
    ]);
    expect(validateGanttChanges("release", changes, ganttEditedValue).ok).toBe(true);
    expect(applyElementChanges("release", RELEASE, changes, GANTT_SHAPE)).toEqual(ganttEditedValue);
  });

  test("give a valid set for a task that names itself and gains a predecessor (task 9.1)", () => {
    // The agent may send a self-loop, a cycle compute reports; the diff of the user's edit holds it.
    const sent = withTask(RELEASE, "ux", (task) => ({ ...task, dependencies: ["ux"] }));
    const edited = withTask(sent, "ux", (task) => ({
      ...task,
      dependencies: ["ux", "architecture"],
    }));
    expect(validateGanttProps(sent, "agent").ok).toBe(true);
    const changes = elementChanges("release", sent, edited, GANTT_SHAPE);
    expect(changes).toEqual([
      { op: "set", target: "release.ux.dependencies", value: ["ux", "architecture"] },
    ]);
    expect(validateGanttChanges("release", changes, edited).ok).toBe(true);
  });
});

describe("a plan's entries on the generic diff", () => {
  const diff = (edited: object) => elementChanges("schedule", PLAN, edited, GANTT_PLAN_SHAPE);

  test("give the approved UJ-2 operation for the package the user added", () => {
    const approved = answer.asks[0].events[0].changes.filter((change: { target: string }) =>
      change.target.startsWith("schedule."),
    );
    const edited = {
      ...PLAN,
      tasks: { ...PLAN.tasks, "u-1": { dependencies: ["architecture", "prototype"] } },
    };
    expect(diff(edited)).toEqual(approved);
    expect(approved).toEqual([
      { op: "set", target: "schedule.u-1.dependencies", value: ["architecture", "prototype"] },
    ]);
  });

  test("give no operation for an unchanged plan", () => {
    expect(diff(structuredClone(PLAN))).toEqual([]);
  });

  test("give one set per field of a new entry, and a null per field of a cleared one", () => {
    const requested = {
      ...PLAN,
      tasks: { ...PLAN.tasks, ux: { start: "2026-11-04", dependencies: ["architecture"] } },
    };
    expect(diff(requested)).toEqual([
      { op: "set", target: "schedule.ux.dependencies", value: ["architecture"] },
      { op: "set", target: "schedule.ux.start", value: "2026-11-04" },
    ]);
    expect(elementChanges("schedule", requested, PLAN, GANTT_PLAN_SHAPE)).toEqual([
      { op: "set", target: "schedule.ux.dependencies", value: null },
      { op: "set", target: "schedule.ux.start", value: null },
    ]);
  });

  test("give a set for an added, a changed and a cleared requested duration (input 1.5)", () => {
    const sent: Json = {
      ...PLAN,
      tasks: { ...PLAN.tasks, portal: { ...PLAN.tasks.portal, duration: 21 } },
    };
    const edited: Json = {
      ...PLAN,
      tasks: {
        ...PLAN.tasks,
        ux: { duration: 8 },
        billing: { ...PLAN.tasks.billing, duration: 12 },
      },
    };
    const forward = elementChanges("schedule", PLAN, sent, GANTT_PLAN_SHAPE);
    expect(forward).toEqual([{ op: "set", target: "schedule.portal.duration", value: 21 }]);
    const changes = elementChanges("schedule", sent, edited, GANTT_PLAN_SHAPE);
    expect(changes).toEqual([
      { op: "set", target: "schedule.billing.duration", value: 12 },
      { op: "set", target: "schedule.portal.duration", value: null },
      { op: "set", target: "schedule.ux.duration", value: 8 },
    ]);
    expect(validateGanttProps(sent, "agent").ok).toBe(true);
    expect(validateGanttProps(edited, "edited").ok).toBe(true);
    for (const [base, value, list] of [
      [PLAN, sent, forward],
      [sent, edited, changes],
    ] as const) {
      expect(validateGanttChanges("schedule", list, value).ok).toBe(true);
      expect(applyElementChanges("schedule", base, list, GANTT_PLAN_SHAPE)).toEqual(value);
    }
  });
});

// A small seeded generator, so that a failure names the seed that gives it again.
const random = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const IDS = ["ux", "architecture", "prototype", "portal", "billing", "reporting", "u-1", "u-2"];

const pick = (next: () => number, ids: readonly string[], not: string): string[] =>
  ids.filter((id) => id !== not && next() < 0.3);

const someDay = (next: () => number): string =>
  `2026-${11 + Math.floor(next() * 2)}-1${Math.floor(next() * 9)}`;

const fields = (next: () => number, id: string): Json => {
  const entry: Json = {};
  if (next() < 0.5) entry.start = someDay(next);
  if (next() < 0.4) entry.duration = 1 + Math.floor(next() * 30);
  const predecessors = pick(next, IDS, id);
  if (predecessors.length > 0 && next() < 0.7) entry.dependencies = predecessors;
  return entry;
};

describe("the Gantt's edits, at random", () => {
  test("diff to valid changes that rebuild the edited value, in each shape", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const next = random(seed);
      const own = {
        ...RELEASE,
        tasks: RELEASE.tasks.map((task) => {
          const id = task.id as string;
          const base = { id, label: task.label, duration: 1 + Math.floor(next() * 20) };
          return { ...base, ...fields(next, id) };
        }),
      };
      const ownChanges = elementChanges("release", RELEASE, own, GANTT_SHAPE);
      expect({ seed, ok: validateGanttChanges("release", ownChanges, own).ok }).toEqual({
        seed,
        ok: true,
      });
      expect(applyElementChanges("release", RELEASE, ownChanges, GANTT_SHAPE)).toEqual(own);

      const entries = Object.fromEntries(
        IDS.map((id) => [id, fields(next, id)] as const).filter(
          ([, entry]) => Object.keys(entry).length > 0,
        ),
      );
      const plan = { ...PLAN, tasks: entries };
      const planChanges = elementChanges("schedule", PLAN, plan, GANTT_PLAN_SHAPE);
      expect(planChanges.every((change) => change.op === "set")).toBe(true);
      expect({ seed, ok: validateGanttChanges("schedule", planChanges, plan).ok }).toEqual({
        seed,
        ok: true,
      });
      const applied: object = applyElementChanges("schedule", PLAN, planChanges, GANTT_PLAN_SHAPE);
      expect(applied).toEqual(plan);
    }
  });
});
