import { describe, expect, test } from "bun:test";
import {
  applyElementChanges,
  elementChanges,
  GANTT_MAX_DEPENDENTS,
  GANTT_MAX_PREDECESSORS,
  GANTT_SHAPE,
  type GanttOwnTask,
} from "@askboard/contract";
import { ganttBoardDocument, ganttEditedValue } from "@askboard/contract/fixtures";
import { validateGanttChanges, validateGanttProps } from "@askboard/contract/validate";
import {
  canPrecede,
  clearStart,
  requestStart,
  sameGantt,
  setDuration,
  setPredecessors,
} from "./edits.ts";
import { type GanttOwnProps, ownTaskRows } from "./tasks.ts";

const SENT = ganttBoardDocument.items[0].props.items[0].props as GanttOwnProps;

const taskOf = (value: GanttOwnProps, id: string) => value.tasks.find((task) => task.id === id);

const changesOf = (value: GanttOwnProps, sent = SENT) =>
  elementChanges("release", sent, value, GANTT_SHAPE);

/**
 * What every edit's result must be: frozen when the edits made it (the agent's value is the
 * fixture's own), valid as edited, diffing to `set`s that apply back.
 */
const expectSound = (value: GanttOwnProps, sent = SENT) => {
  if (value !== sent) {
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.tasks)).toBe(true);
  }
  expect(validateGanttProps(value, "edited")).toMatchObject({ ok: true });
  const changes = changesOf(value, sent);
  expect(changes.every((change) => change.op === "set")).toBe(true);
  expect(validateGanttChanges("release", changes, sent)).toMatchObject({ ok: true });
  expect(applyElementChanges("release", sent, changes, GANTT_SHAPE)).toEqual(value);
  expect(sameGantt(value, sent)).toBe(changes.length === 0);
};

describe("a requested start", () => {
  test("is set on the task, the other tasks kept as they were", () => {
    const value = requestStart(SENT, SENT, "reporting", "2026-12-09");
    expect(taskOf(value, "reporting")?.start).toBe("2026-12-09");
    expect(Object.isFrozen(taskOf(value, "reporting"))).toBe(true);
    value.tasks.forEach((task, index) => {
      if (task.id !== "reporting") expect(task).toBe(SENT.tasks[index] as GanttOwnTask);
    });
    expect(changesOf(value)).toEqual([
      { op: "set", target: "release.reporting.start", value: "2026-12-09" },
    ]);
    expectSound(value);
  });

  test("gives the same value when it changes nothing", () => {
    const value = requestStart(SENT, SENT, "reporting", "2026-12-09");
    expect(requestStart(value, SENT, "reporting", "2026-12-09")).toBe(value);
  });

  test("cleared, leaves the field out when the agent sent none: the task the agent sent", () => {
    const value = requestStart(SENT, SENT, "reporting", "2026-12-09");
    const cleared = clearStart(value, SENT, "reporting");
    expect(taskOf(cleared, "reporting")).toBe(taskOf(SENT, "reporting") as GanttOwnTask);
    expect("start" in (taskOf(cleared, "reporting") ?? {})).toBe(false);
    expect(sameGantt(cleared, SENT)).toBe(true);
    expect(changesOf(cleared)).toEqual([]);
    expectSound(cleared);
  });

  test("cleared when there is none, changes nothing", () => {
    expect(clearStart(SENT, SENT, "ux")).toBe(SENT);
  });

  test("the agent asked for is cleared as a set to null, and restored when asked for again", () => {
    const sent = requestStart(SENT, SENT, "reporting", "2026-12-09");
    const cleared = clearStart(sent, sent, "reporting");
    expect(changesOf(cleared, sent)).toEqual([
      { op: "set", target: "release.reporting.start", value: null },
    ]);
    expectSound(cleared, sent);
    const again = requestStart(cleared, sent, "reporting", "2026-12-09");
    expect(taskOf(again, "reporting")).toBe(taskOf(sent, "reporting") as GanttOwnTask);
    expect(sameGantt(again, sent)).toBe(true);
  });

  test.each(["2026-02-30", "12/9/2026", "1900-03-01", "10000-01-01", ""])(
    "refuses %j, no day the Gantt may name",
    (date) => {
      expect(() => requestStart(SENT, SENT, "reporting", date)).toThrow(RangeError);
    },
  );
});

describe("a duration", () => {
  test("is set on the task", () => {
    const value = setDuration(SENT, SENT, "billing", 11);
    expect(taskOf(value, "billing")?.duration).toBe(11);
    expect(changesOf(value)).toEqual([
      { op: "set", target: "release.billing.duration", value: 11 },
    ]);
    expectSound(value);
  });

  test("with a requested start, gives the fixture's edited value", () => {
    const value = requestStart(
      setDuration(SENT, SENT, "billing", 11),
      SENT,
      "reporting",
      "2026-12-09",
    );
    expect(value).toEqual(ganttEditedValue);
    expectSound(value);
  });

  test("gives the same value when it changes nothing, and the agent's task when back to it", () => {
    expect(setDuration(SENT, SENT, "billing", 9)).toBe(SENT);
    const value = setDuration(SENT, SENT, "billing", 11);
    const back = setDuration(value, SENT, "billing", 9);
    expect(taskOf(back, "billing")).toBe(taskOf(SENT, "billing") as GanttOwnTask);
    expect(sameGantt(back, SENT)).toBe(true);
  });

  test.each([0, 2.5, 2001, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses %p, no whole number of days from 1 to 2,000",
    (duration) => {
      expect(() => setDuration(SENT, SENT, "billing", duration)).toThrow(RangeError);
    },
  );
});

describe("predecessors", () => {
  test("are set on the task as one list", () => {
    const value = setPredecessors(SENT, SENT, "reporting", ["portal", "billing"]);
    expect(taskOf(value, "reporting")?.dependencies).toEqual(["portal", "billing"]);
    expect(Object.isFrozen(taskOf(value, "reporting")?.dependencies)).toBe(true);
    expect(changesOf(value)).toEqual([
      { op: "set", target: "release.reporting.dependencies", value: ["portal", "billing"] },
    ]);
    expectSound(value);
  });

  test("in another order change nothing, and back to the agent's take its list", () => {
    const value = setPredecessors(SENT, SENT, "reporting", ["portal", "billing"]);
    expect(setPredecessors(value, SENT, "reporting", ["billing", "portal"])).toBe(value);
    expect(setPredecessors(SENT, SENT, "portal", ["prototype", "architecture"])).toBe(SENT);
    const back = setPredecessors(value, SENT, "reporting", ["portal"]);
    expect(taskOf(back, "reporting")).toBe(taskOf(SENT, "reporting") as GanttOwnTask);
  });

  test("emptied are left out, a set to null", () => {
    const value = setPredecessors(SENT, SENT, "reporting", []);
    expect("dependencies" in (taskOf(value, "reporting") ?? {})).toBe(false);
    expect(changesOf(value)).toEqual([
      { op: "set", target: "release.reporting.dependencies", value: null },
    ]);
    expectSound(value);
    expect(setPredecessors(SENT, SENT, "ux", [])).toBe(SENT);
  });

  test("emptied go back to the agent's empty list when it sent one", () => {
    const sent = {
      ...SENT,
      tasks: SENT.tasks.map((task) => (task.id === "ux" ? { ...task, dependencies: [] } : task)),
    };
    const linked = setPredecessors(sent, sent, "ux", ["architecture"]);
    const back = setPredecessors(linked, sent, "ux", []);
    expect(taskOf(back, "ux")).toBe(taskOf(sent, "ux") as GanttOwnTask);
    expect(sameGantt(back, sent)).toBe(true);
    expect(setPredecessors(sent, sent, "ux", [])).toBe(sent);
  });

  test("listed twice are kept once", () => {
    const value = setPredecessors(SENT, SENT, "reporting", ["portal", "billing", "portal"]);
    expect(taskOf(value, "reporting")?.dependencies).toEqual(["portal", "billing"]);
  });

  test("keep a predecessor that names no task, as the agent may send one", () => {
    const value = setPredecessors(SENT, SENT, "reporting", ["portal", "u-7"]);
    expect(taskOf(value, "reporting")?.dependencies).toEqual(["portal", "u-7"]);
    expectSound(value);
  });

  test.each([
    [["reporting"], "the task itself"],
    [["no way"], "a name that is no ID"],
    [[3], "a number"],
  ])("refuse %j, %s", (predecessors) => {
    expect(() =>
      setPredecessors(SENT, SENT, "reporting", predecessors as unknown as string[]),
    ).toThrow(RangeError);
  });

  test("refuse more than the predecessor limit and a task past the dependents limit", () => {
    const many = Array.from({ length: GANTT_MAX_PREDECESSORS + 1 }, (_, n) => `t${n}`);
    expect(() => setPredecessors(SENT, SENT, "reporting", many)).toThrow(RangeError);
    const hub = wide(GANTT_MAX_DEPENDENTS);
    expect(() => setPredecessors(hub, hub, "spare", ["hub"])).toThrow(RangeError);
    expectSound(setPredecessors(hub, hub, "spare", ["d0"]), hub);
  });
});

describe("an edit", () => {
  test("of an unknown task is refused", () => {
    expect(() => requestStart(SENT, SENT, "nope", "2026-12-09")).toThrow(RangeError);
    expect(() => clearStart(SENT, SENT, "nope")).toThrow(RangeError);
    expect(() => setDuration(SENT, SENT, "nope", 3)).toThrow(RangeError);
    expect(() => setPredecessors(SENT, SENT, "nope", [])).toThrow(RangeError);
  });

  test("leaves its inputs as they were", () => {
    const copy = structuredClone(SENT);
    const value = setPredecessors(SENT, SENT, "reporting", ["billing"]);
    setDuration(requestStart(value, SENT, "ux", "2026-11-09"), SENT, "ux", 3);
    expect(SENT).toEqual(copy);
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

  test("sequences, 500 seeded, stay sound and come back to the agent's value by hand", () => {
    const ids = SENT.tasks.map((task) => task.id);
    for (let seed = 1; seed <= 500; seed++) {
      const next = random(seed);
      let value = SENT;
      for (let step = 0; step < 8; step++) {
        const id = ids[next(ids.length)] as string;
        const sentTask = taskOf(SENT, id) as GanttOwnTask;
        const before = value;
        switch (next(4)) {
          case 0:
            value = requestStart(
              value,
              SENT,
              id,
              `2026-12-${String(1 + next(28)).padStart(2, "0")}`,
            );
            break;
          case 1:
            value = clearStart(value, SENT, id);
            break;
          case 2:
            value = setDuration(value, SENT, id, next(2) ? 1 + next(20) : sentTask.duration);
            break;
          default:
            value = setPredecessors(
              value,
              SENT,
              id,
              next(2)
                ? ids.filter((other) => other !== id && next(3) === 0)
                : [...(sentTask.dependencies ?? [])],
            );
        }
        if (value !== before)
          expect({ seed, step, sound: sameGantt(value, before) }).toEqual({
            seed,
            step,
            sound: false,
          });
        expectSound(value);
      }
      // Undoing every field by hand gives the agent's value again, with no draft value to hold.
      for (const task of SENT.tasks) {
        value = setDuration(value, SENT, task.id, task.duration);
        value = setPredecessors(value, SENT, task.id, [...(task.dependencies ?? [])]);
        value = clearStart(value, SENT, task.id);
      }
      expect({ seed, same: sameGantt(value, SENT) }).toEqual({ seed, same: true });
    }
  });
});

describe("sameGantt", () => {
  test("holds for an equal copy and fails on any difference", () => {
    expect(sameGantt(structuredClone(SENT), SENT)).toBe(true);
    expect(sameGantt({ ...SENT, start: "2026-11-03" }, SENT)).toBe(false);
    expect(sameGantt({ ...SENT, tasks: SENT.tasks.slice(1) }, SENT)).toBe(false);
    expect(sameGantt({ ...SENT, tasks: [...SENT.tasks].reverse() }, SENT)).toBe(false);
    const reordered = SENT.tasks.map((task) =>
      task.id === "portal" ? { ...task, dependencies: ["prototype", "architecture"] } : task,
    );
    expect(sameGantt({ ...SENT, tasks: reordered }, SENT)).toBe(false);
  });
});

/** A Gantt whose task `hub` precedes `count` tasks, with one more task, `spare`. */
const wide = (count: number): GanttOwnProps => ({
  start: "2026-11-02",
  tasks: [
    { id: "hub", label: "Hub", duration: 1 },
    ...Array.from({ length: count }, (_, n) => ({
      id: `d${n}`,
      label: `Dependent ${n}`,
      duration: 1,
      dependencies: ["hub"],
    })),
    { id: "spare", label: "Spare", duration: 1 },
  ],
});

/** `canPrecede` over a Gantt's own tasks, its rows as the grid shows them. */
const precedes = (value: GanttOwnProps, taskId: string, candidateId: string) =>
  canPrecede(value, ownTaskRows(value), taskId, candidateId);

describe("canPrecede", () => {
  test.each([
    ["ux", true],
    ["architecture", true],
    ["billing", true],
    ["portal", "Customer portal already depends on Clickable prototype"],
    ["reporting", "Reporting already depends on Clickable prototype"],
    ["prototype", "Clickable prototype cannot come before itself"],
  ])("offers %s to the prototype's predecessors: %p", (candidate, verdict) => {
    expect(precedes(SENT, "prototype", candidate)).toEqual(
      verdict === true ? { ok: true } : { ok: false, reason: verdict as string },
    );
  });

  test("ends its walk on a cycle the agent sent", () => {
    const tasks = [
      { id: "a", label: "A", duration: 1, dependencies: ["b"] },
      { id: "b", label: "B", duration: 1, dependencies: ["a"] },
      { id: "c", label: "C", duration: 1 },
    ];
    const value = { start: "2026-11-02", tasks };
    expect(precedes(value, "c", "a")).toEqual({ ok: true });
    expect(precedes(value, "a", "c")).toEqual({ ok: true });
    expect(precedes(value, "a", "b")).toEqual({ ok: true });
  });

  test("takes no more predecessors past the limit, but keeps those listed", () => {
    const tasks = [
      ...Array.from({ length: GANTT_MAX_PREDECESSORS + 1 }, (_, n) => ({
        id: `p${n}`,
        label: `P${n}`,
        duration: 1,
      })),
      {
        id: "full",
        label: "Full",
        duration: 1,
        dependencies: Array.from({ length: GANTT_MAX_PREDECESSORS }, (_, n) => `p${n}`),
      },
    ];
    const value = { start: "2026-11-02", tasks };
    expect(precedes(value, "full", `p${GANTT_MAX_PREDECESSORS}`)).toEqual({
      ok: false,
      reason: "Full already has 50 predecessors, the most a task can have",
    });
    expect(precedes(value, "full", "p0")).toEqual({ ok: true });
  });

  test("offers no task that has as many dependents as the limit", () => {
    const value = wide(GANTT_MAX_DEPENDENTS);
    expect(precedes(value, "spare", "hub")).toEqual({
      ok: false,
      reason: "Hub already has 50 dependent tasks, the most a task can have",
    });
    expect(precedes(value, "d0", "hub")).toEqual({ ok: true });
    expect(precedes(wide(GANTT_MAX_DEPENDENTS - 1), "spare", "hub")).toEqual({ ok: true });
  });

  test("refuses a task or a candidate that is no row", () => {
    expect(() => precedes(SENT, "nope", "ux")).toThrow(RangeError);
    expect(() => precedes(SENT, "ux", "nope")).toThrow(RangeError);
  });

  test("gives frozen verdicts", () => {
    expect(Object.isFrozen(precedes(SENT, "prototype", "ux"))).toBe(true);
    expect(Object.isFrozen(precedes(SENT, "prototype", "portal"))).toBe(true);
  });
});
