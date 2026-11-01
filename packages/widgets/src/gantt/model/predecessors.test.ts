import { describe, expect, test } from "bun:test";
import { GANTT_MAX_DEPENDENTS, GANTT_MAX_PREDECESSORS, type GanttProps } from "@askboard/contract";
import {
  ganttBoardDocument,
  ganttPlanBoardDocument,
  ganttPlanEditedValue,
  treeEditedValue,
} from "@askboard/contract/fixtures";
import { canPrecede, setPredecessors } from "./edits.ts";
import { panelBoxes, toggled } from "./predecessors.ts";
import {
  type GanttOwnProps,
  type GanttPlanProps,
  type GanttRow,
  ownTaskRows,
  planTaskRows,
} from "./tasks.ts";

const [question] = ganttBoardDocument.items;
const [release] = question.props.items;
const SENT = release.props as GanttOwnProps;

/** The panel's boxes over a Gantt's own tasks, its rows as the grid shows them. */
const boxesOf = (value: GanttOwnProps, taskId: string, held: readonly string[]) =>
  panelBoxes(value, ownTaskRows(value), taskId, held);

/** Fifty tasks after Source, Hub after the fifty, and X after nothing. */
const LIMITS: GanttOwnProps = {
  start: "2026-11-02",
  tasks: [
    { id: "src", label: "Source", duration: 1 },
    ...Array.from({ length: 50 }, (_, index) => ({
      id: `p${index + 1}`,
      label: `P ${index + 1}`,
      duration: 1,
      dependencies: ["src"],
    })),
    {
      id: "hub",
      label: "Hub",
      duration: 1,
      dependencies: Array.from({ length: 50 }, (_, index) => `p${index + 1}`),
    },
    { id: "x", label: "X", duration: 1 },
  ],
};

describe("the predecessors panel's boxes", () => {
  test("list every other task in order, checked as the panel holds them", () => {
    expect(boxesOf(SENT, "billing", ["architecture"])).toEqual([
      { id: "ux", label: "UX design", checked: false, reason: undefined },
      { id: "architecture", label: "Architecture", checked: true, reason: undefined },
      { id: "prototype", label: "Clickable prototype", checked: false, reason: undefined },
      { id: "portal", label: "Customer portal", checked: false, reason: undefined },
      { id: "reporting", label: "Reporting", checked: false, reason: undefined },
    ]);
  });

  test("give a task that would close a cycle its reason", () => {
    const reasons = boxesOf(SENT, "prototype", ["ux"]).map((box) => [box.id, box.reason]);
    expect(reasons).toEqual([
      ["ux", undefined],
      ["architecture", undefined],
      ["portal", "Customer portal already depends on Clickable prototype"],
      ["billing", undefined],
      ["reporting", "Reporting already depends on Clickable prototype"],
    ]);
  });

  test("count what is checked against the predecessor limit", () => {
    const all = LIMITS.tasks.find((task) => task.id === "hub")?.dependencies ?? [];
    const full = "Hub already has 50 predecessors, the most a task can have";
    const atLimit = boxesOf(LIMITS, "hub", all);
    expect(atLimit.filter((box) => box.reason !== undefined).map((box) => box.id)).toEqual([
      "src",
      "x",
    ]);
    expect(atLimit.find((box) => box.id === "x")?.reason).toBe(full);
    const fewer = boxesOf(LIMITS, "hub", toggled(all, "p50", false));
    expect(fewer.find((box) => box.id === "x")?.reason).toBeUndefined();
    expect(fewer.find((box) => box.id === "p50")).toMatchObject({ checked: false });
  });

  test("refuse a task that already has 50 dependents", () => {
    expect(boxesOf(LIMITS, "x", []).find((box) => box.id === "src")?.reason).toBe(
      "Source already has 50 dependent tasks, the most a task can have",
    );
  });
});

const [planQuestion] = ganttPlanBoardDocument.items;
const [WBS, SCHEDULE] = planQuestion.props.items;
const PLAN = SCHEDULE.props as GanttPlanProps;

/** A plan's rows over the Tree as the user left it in the approved answer, `u-1` added. */
const editedRows = (value: GanttPlanProps) =>
  planTaskRows(value, treeEditedValue.nodes, WBS.props.nodes);

describe("a plan's panel", () => {
  test("offers the Tree's other leaves in its order, a package added there among them", () => {
    expect(panelBoxes(PLAN, editedRows(PLAN), "u-1", [])).toEqual(
      (
        [
          ["ux", "UX design"],
          ["architecture", "Architecture"],
          ["prototype", "Clickable prototype"],
          ["portal", "Customer portal: accounts"],
          ["billing", "Billing integration"],
          ["reporting", "Reporting"],
        ] as const
      ).map(([id, label]) => ({ id, label, checked: false, reason: undefined })),
    );
    const checked = panelBoxes(PLAN, editedRows(PLAN), "u-1", ["architecture", "prototype"]);
    expect(checked.filter((box) => box.checked).map((box) => box.id)).toEqual([
      "architecture",
      "prototype",
    ]);
  });

  test("refuses the task's dependents, a package linked in the plan among them", () => {
    const value = ganttPlanEditedValue;
    const refused = panelBoxes(value, editedRows(value), "prototype", ["ux"]).flatMap((box) =>
      box.reason === undefined ? [] : [[box.id, box.reason]],
    );
    expect(refused).toEqual([
      ["portal", "Customer portal: accounts already depends on Clickable prototype"],
      ["u-1", "Customer portal: dashboards already depends on Clickable prototype"],
      ["reporting", "Reporting already depends on Clickable prototype"],
    ]);
  });

  test("counts what it holds against the predecessor limit, for a task the plan has no entry for", () => {
    const held = Array.from({ length: GANTT_MAX_PREDECESSORS }, (_, n) => `gone${n}`);
    const boxes = panelBoxes(PLAN, editedRows(PLAN), "u-1", held);
    expect(new Set(boxes.map((box) => box.reason))).toEqual(
      new Set([
        "Customer portal: dashboards already has 50 predecessors, the most a task can have",
      ]),
    );
  });

  test("counts what it holds against the dependents limit, every entry included", () => {
    // The portal, billing and 48 entries naming no leaf follow Architecture: 50 dependents.
    const tasks = {
      ...PLAN.tasks,
      ...Object.fromEntries(
        Array.from({ length: GANTT_MAX_DEPENDENTS - 2 }, (_, n) => [
          `gone${n}`,
          { dependencies: ["architecture"] },
        ]),
      ),
    };
    const full = { ...PLAN, tasks };
    const rows = editedRows(full);
    const architecture = (taskId: string, held: readonly string[]) =>
      panelBoxes(full, rows, taskId, held).find((box) => box.id === "architecture")?.reason;
    expect(architecture("u-1", [])).toBe(
      "Architecture already has 50 dependent tasks, the most a task can have",
    );
    // Billing's panel, Architecture unchecked: 49 left, so it may be checked again.
    expect(architecture("billing", [])).toBeUndefined();
    expect(architecture("billing", ["architecture"])).toBeUndefined();
  });
});

describe("the boxes against canPrecede", () => {
  /** Each box's reason, and `canPrecede`'s for its candidate over the Gantt holding `held`. */
  const compared = (
    value: GanttProps,
    rows: readonly GanttRow[],
    held: GanttProps,
    heldRows: readonly GanttRow[],
    taskId: string,
  ) => {
    const listed = heldRows.find((row) => row.id === taskId)?.dependencies ?? [];
    return panelBoxes(value, rows, taskId, listed).map((box) => {
      const verdict = canPrecede(held, heldRows, taskId, box.id);
      return [box.id, box.reason, verdict.ok ? undefined : verdict.reason];
    });
  };

  const expectSame = (pairs: readonly (readonly unknown[])[]) => {
    for (const [id, box, check] of pairs) expect({ id, box }).toEqual({ id, box: check });
  };

  test("agree box for box on a Gantt's own tasks, each panel as it opens and with boxes changed", () => {
    for (const value of [SENT, LIMITS]) {
      const rows = ownTaskRows(value);
      for (const row of rows) expectSame(compared(value, rows, value, rows, row.id));
    }
    const linked = setPredecessors(SENT, SENT, "billing", ["ux", "prototype"]);
    expectSame(compared(SENT, ownTaskRows(SENT), linked, ownTaskRows(linked), "billing"));
    const fewer = setPredecessors(LIMITS, LIMITS, "hub", ["p1", "p2"]);
    expectSame(compared(LIMITS, ownTaskRows(LIMITS), fewer, ownTaskRows(fewer), "hub"));
  });

  test("agree box for box on a plan, a package added in its Tree included", () => {
    for (const value of [PLAN, ganttPlanEditedValue]) {
      const rows = editedRows(value);
      for (const row of rows) expectSame(compared(value, rows, value, rows, row.id));
    }
    const linked = setPredecessors(PLAN, PLAN, "u-1", ["architecture", "prototype"]);
    expectSame(compared(PLAN, editedRows(PLAN), linked, editedRows(linked), "u-1"));
  });

  test("are counted once per panel: 500 tasks at the limits take well under the time of a frame", () => {
    // Ten layers of fifty, each task after the first layer after the fifty before it: fifty
    // predecessors and fifty dependents each. The panel opens for the last task, which has none.
    const tasks = Array.from({ length: 500 }, (_, index) => {
      const layer = index === 499 ? 0 : Math.floor(index / 50);
      const before = Array.from({ length: 50 }, (_, k) => `t${(layer - 1) * 50 + k}`);
      return {
        id: `t${index}`,
        label: `Task ${index}`,
        duration: 1,
        ...(layer === 0 ? {} : { dependencies: before }),
      };
    });
    const value: GanttOwnProps = { start: "2026-11-02", tasks };
    const rows = ownTaskRows(value);
    const from = performance.now();
    const boxes = panelBoxes(value, rows, "t499", []);
    const took = performance.now() - from;
    expect(boxes).toHaveLength(499);
    // The first eight layers are at the dependents limit; the ninth has 49, the last none.
    expect(boxes.filter((box) => box.reason !== undefined).map((box) => box.id)).toEqual(
      Array.from({ length: 400 }, (_, index) => `t${index}`),
    );
    // A bound far above what this machine gives (a few milliseconds): it catches a regression by
    // an order of magnitude, as a count per candidate was (about 350 ms), not a busy machine.
    expect(took).toBeLessThan(50);
  });
});

describe("a box checked or unchecked", () => {
  test("adds the task after those held, or takes it out, keeping each once", () => {
    expect(toggled(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggled(["a", "b"], "b", true)).toEqual(["a", "b"]);
    expect(toggled(["a", "b"], "a", false)).toEqual(["b"]);
    expect(toggled(["a"], "c", false)).toEqual(["a"]);
  });
});
