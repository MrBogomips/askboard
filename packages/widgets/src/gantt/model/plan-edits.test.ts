// The user's edits of a Gantt plan's entries (`edits.ts`; design decisions 3 and 8): an entry is
// created by its first field and deleted once it holds none, so that the plan diffs with
// `GANTT_PLAN_SHAPE` to `set`s only, and an edit undone by hand leaves no change.

import { describe, expect, test } from "bun:test";
import {
  applyElementChanges,
  elementChanges,
  GANTT_MAX_DEPENDENTS,
  GANTT_MAX_PREDECESSORS,
  GANTT_MAX_TASKS,
  GANTT_PLAN_SHAPE,
  type GanttPlanEntry,
} from "@askboard/contract";
import {
  ganttBoardDocument,
  ganttPlanBoardDocument,
  ganttPlanChanges,
  ganttPlanEditedValue,
  treeEditedValue,
} from "@askboard/contract/fixtures";
import { validateGanttChanges, validateGanttProps } from "@askboard/contract/validate";
import { clearStart, requestStart, sameGantt, setPredecessors } from "./edits.ts";
import { planChangeCount } from "./marks.ts";
import { type GanttOwnProps, type GanttPlanProps, planTaskRows } from "./tasks.ts";

const [question] = ganttPlanBoardDocument.items;
const [WBS, SCHEDULE] = question.props.items;
const PLAN = SCHEDULE.props as GanttPlanProps;

const entryOf = (value: GanttPlanProps, id: string): GanttPlanEntry | undefined =>
  Object.hasOwn(value.tasks, id) ? value.tasks[id] : undefined;

const changesOf = (value: GanttPlanProps, sent = PLAN) =>
  elementChanges("schedule", sent, value, GANTT_PLAN_SHAPE);

/**
 * What every edit's result must be: frozen when the edits made it, valid as edited, diffing to
 * `set`s that apply back, the same Gantt as the agent's exactly when the diff is empty, and
 * counted on the toolbar as the tasks the diff names.
 */
const expectSound = (value: GanttPlanProps, sent = PLAN) => {
  if (value !== sent) {
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.tasks)).toBe(true);
  }
  expect(validateGanttProps(value, "edited")).toMatchObject({ ok: true });
  const changes = changesOf(value, sent);
  expect(changes.every((change) => change.op === "set")).toBe(true);
  expect(validateGanttChanges("schedule", changes, sent)).toMatchObject({ ok: true });
  expect(applyElementChanges("schedule", sent, changes, GANTT_PLAN_SHAPE)).toEqual(value);
  expect(sameGantt(value, sent)).toBe(changes.length === 0);
  const tasks = new Set(changes.map((change) => change.target.split(".")[1]));
  expect(planChangeCount(value, sent)).toBe(tasks.size);
};

describe("a plan's entry", () => {
  test("is created by its first field: linking u-1 gives the approved answer's plan", () => {
    const value = setPredecessors(PLAN, PLAN, "u-1", ["architecture", "prototype"]);
    expect(value).toEqual(ganttPlanEditedValue);
    expect(changesOf(value)).toEqual([...ganttPlanChanges]);
    expect(Object.isFrozen(entryOf(value, "u-1"))).toBe(true);
    expect(Object.isFrozen(entryOf(value, "u-1")?.dependencies)).toBe(true);
    for (const id of Object.keys(PLAN.tasks)) expect(entryOf(value, id)).toBe(entryOf(PLAN, id));
    expectSound(value);
  });

  test("is created by a requested start for a task the plan said nothing about", () => {
    const value = requestStart(PLAN, PLAN, "ux", "2026-11-04");
    expect(entryOf(value, "ux")).toEqual({ start: "2026-11-04" });
    expect(changesOf(value)).toEqual([
      { op: "set", target: "schedule.ux.start", value: "2026-11-04" },
    ]);
    expectSound(value);
  });

  test("takes a field beside those it holds", () => {
    const value = requestStart(PLAN, PLAN, "reporting", "2026-12-09");
    expect(entryOf(value, "reporting")).toEqual({ start: "2026-12-09", dependencies: ["portal"] });
    expect(changesOf(value)).toEqual([
      { op: "set", target: "schedule.reporting.start", value: "2026-12-09" },
    ]);
    expectSound(value);
  });

  test("is deleted once it holds no field, giving the agent's plan back", () => {
    const value = clearStart(requestStart(PLAN, PLAN, "ux", "2026-11-04"), PLAN, "ux");
    expect(Object.hasOwn(value.tasks, "ux")).toBe(false);
    expect(sameGantt(value, PLAN)).toBe(true);
    expect(changesOf(value)).toEqual([]);
    expectSound(value);
  });

  test("the agent sent, emptied, is deleted: one set to null per field it held", () => {
    const sent = {
      ...PLAN,
      tasks: { ...PLAN.tasks, billing: { start: "2026-11-09", dependencies: ["architecture"] } },
    };
    const value = clearStart(setPredecessors(sent, sent, "billing", []), sent, "billing");
    expect(Object.hasOwn(value.tasks, "billing")).toBe(false);
    expect(changesOf(value, sent)).toEqual([
      { op: "set", target: "schedule.billing.dependencies", value: null },
      { op: "set", target: "schedule.billing.start", value: null },
    ]);
    expectSound(value, sent);
  });

  test("back to the agent's takes the agent's entry again", () => {
    const value = setPredecessors(PLAN, PLAN, "reporting", ["portal", "billing"]);
    const back = setPredecessors(value, PLAN, "reporting", ["portal"]);
    expect(entryOf(back, "reporting")).toBe(entryOf(PLAN, "reporting"));
    expect(sameGantt(back, PLAN)).toBe(true);
    const restored = setPredecessors(setPredecessors(PLAN, PLAN, "billing", []), PLAN, "billing", [
      "architecture",
    ]);
    expect(entryOf(restored, "billing")).toBe(entryOf(PLAN, "billing"));
    expectSound(restored);
  });

  test("the agent sent empty comes back when emptied again", () => {
    const sent = { ...PLAN, tasks: { ...PLAN.tasks, ux: {} } };
    const value = requestStart(sent, sent, "ux", "2026-11-04");
    expect(entryOf(value, "ux")).toEqual({ start: "2026-11-04" });
    const back = clearStart(value, sent, "ux");
    expect(entryOf(back, "ux")).toBe(entryOf(sent, "ux"));
    expect(sameGantt(back, sent)).toBe(true);
    expectSound(back, sent);
  });

  test("gives the same value when nothing changes", () => {
    expect(clearStart(PLAN, PLAN, "ux")).toBe(PLAN);
    expect(setPredecessors(PLAN, PLAN, "ux", [])).toBe(PLAN);
    expect(setPredecessors(PLAN, PLAN, "portal", ["prototype", "architecture"])).toBe(PLAN);
    const value = requestStart(PLAN, PLAN, "ux", "2026-11-04");
    expect(requestStart(value, PLAN, "ux", "2026-11-04")).toBe(value);
  });

  test("lives under its own key, whatever the task's ID", () => {
    const value = setPredecessors(PLAN, PLAN, "__proto__", ["ux"]);
    expect(Object.hasOwn(value.tasks, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(value.tasks)).toBe(Object.prototype);
    expect(entryOf(value, "__proto__")).toEqual({ dependencies: ["ux"] });
    expect(clearStart(PLAN, PLAN, "constructor")).toBe(PLAN);
    const started = requestStart(PLAN, PLAN, "toString", "2026-11-04");
    expect(entryOf(started, "toString")).toEqual({ start: "2026-11-04" });
    expectSound(value);
    expectSound(started);
  });

  test("leaves its inputs as they were", () => {
    const copy = structuredClone(PLAN);
    const value = setPredecessors(PLAN, PLAN, "reporting", ["billing"]);
    clearStart(requestStart(value, PLAN, "ux", "2026-11-09"), PLAN, "ux");
    expect(PLAN).toEqual(copy);
  });
});

describe("a plan's edit", () => {
  test.each([
    ["a task that is no ID", () => requestStart(PLAN, PLAN, "no way", "2026-11-04")],
    ["a day the Gantt may not name", () => requestStart(PLAN, PLAN, "ux", "2026-02-30")],
    ["the task before itself", () => setPredecessors(PLAN, PLAN, "ux", ["ux"])],
    ["a predecessor that is no ID", () => setPredecessors(PLAN, PLAN, "ux", ["no way"])],
  ])("refuses %s", (_, edit) => {
    expect(edit).toThrow(RangeError);
  });

  test("refuses more than the predecessor limit and a task past the dependents limit", () => {
    const many = Array.from({ length: GANTT_MAX_PREDECESSORS + 1 }, (_, n) => `t${n}`);
    expect(() => setPredecessors(PLAN, PLAN, "ux", many)).toThrow(RangeError);
    const tasks = Object.fromEntries(
      Array.from({ length: GANTT_MAX_DEPENDENTS }, (_, n) => [`d${n}`, { dependencies: ["hub"] }]),
    );
    const hub = { ...PLAN, tasks };
    expect(() => setPredecessors(hub, hub, "spare", ["hub"])).toThrow(RangeError);
    expectSound(setPredecessors(hub, hub, "spare", ["d0"]), hub);
  });

  test("refuses an entry past the plan's limit, and edits those it holds", () => {
    const tasks = Object.fromEntries(
      Array.from({ length: GANTT_MAX_TASKS }, (_, n) => [`t${n}`, { start: "2026-11-02" }]),
    );
    const full = { ...PLAN, tasks };
    expect(() => setPredecessors(full, full, "u-1", ["t0"])).toThrow(RangeError);
    expect(clearStart(full, full, "u-1")).toBe(full);
    expectSound(setPredecessors(full, full, "t1", ["t0"]), full);
  });

  test("refuses a plan beside the agent's Gantt with its own tasks, and the other way", () => {
    const own = ganttBoardDocument.items[0].props.items[0].props as GanttOwnProps;
    const mixed = own as unknown as GanttPlanProps;
    expect(() => requestStart(PLAN, mixed, "ux", "2026-11-04")).toThrow(RangeError);
    expect(() => clearStart(mixed, PLAN, "ux")).toThrow(RangeError);
  });

  // A small seeded generator, so that a failure names the seed that gives it again.
  const random = (seed: number) => {
    let state = seed >>> 0;
    return (n: number) => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4_294_967_296) * n);
    };
  };

  test("sequences, 500 seeded over the edited Tree, stay sound and come back by hand", () => {
    const ids = planTaskRows(PLAN, treeEditedValue.nodes, WBS.props.nodes).map((row) => row.id);
    for (let seed = 1; seed <= 500; seed++) {
      const next = random(seed);
      let value = PLAN;
      for (let step = 0; step < 8; step++) {
        const id = ids[next(ids.length)] as string;
        const before = value;
        switch (next(3)) {
          case 0:
            value = requestStart(
              value,
              PLAN,
              id,
              `2026-12-${String(1 + next(28)).padStart(2, "0")}`,
            );
            break;
          case 1:
            value = clearStart(value, PLAN, id);
            break;
          default:
            value = setPredecessors(
              value,
              PLAN,
              id,
              next(2)
                ? ids.filter((other) => other !== id && next(3) === 0)
                : [...(entryOf(PLAN, id)?.dependencies ?? [])],
            );
        }
        if (value !== before) {
          expect({ seed, step, same: sameGantt(value, before) }).toEqual({
            seed,
            step,
            same: false,
          });
        }
        expectSound(value);
      }
      // Undoing every field by hand gives the agent's plan again, with no draft value to hold.
      for (const id of ids) {
        value = setPredecessors(value, PLAN, id, [...(entryOf(PLAN, id)?.dependencies ?? [])]);
        value = clearStart(value, PLAN, id);
      }
      expect({ seed, same: sameGantt(value, PLAN) }).toEqual({ seed, same: true });
    }
  });
});
