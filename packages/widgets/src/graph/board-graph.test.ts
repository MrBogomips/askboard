import { describe, expect, test } from "bun:test";
import { GraphSourceError } from "@askboard/compute";
import { ganttBoardDocument, ganttEditedValue } from "@askboard/contract/fixtures";
import { type BoardContent, type BoardContentItem, liveGraph, sentGraph } from "./board-graph.ts";

// The board's widget items as sent, every question's items flattened, as the port will give them.
const ITEMS = ganttBoardDocument.items.flatMap((question) => question.props.items);
const NOTHING: ReadonlyMap<string, unknown> = new Map();
const EDITED: ReadonlyMap<string, unknown> = new Map([["release", ganttEditedValue]]);

const board = (
  draft: ReadonlyMap<string, unknown>,
  items: readonly BoardContentItem[] = ITEMS,
): BoardContent => ({
  items,
  draft,
});

describe("the board's graph", () => {
  test("schedules the Gantt as sent", () => {
    const graph = sentGraph(board(NOTHING));
    expect(graph?.read("release.reporting.startDate")).toBe("2026-12-04");
    expect(graph?.read("release.reporting.finishDate")).toBe("2026-12-11");
    expect(graph?.read("release.finishDate")).toBe("2026-12-11");
    expect(graph?.warnings).toEqual([]);
  });

  test("schedules the live Gantt with the draft's value in place of its props", () => {
    const live = liveGraph(board(EDITED));
    expect(live?.read("release.reporting.startDate")).toBe("2026-12-09");
    expect(live?.read("release.reporting.earliestDate")).toBe("2026-12-04");
    expect(live?.read("release.billing.duration")).toBe(11);
    expect(live?.read("release.finishDate")).toBe("2026-12-16");
    // The sent graph of the same board still reads the agent's props.
    const sent = sentGraph(board(EDITED));
    expect(sent?.read("release.reporting.startDate")).toBe("2026-12-04");
    expect(sent?.read("release.billing.duration")).toBe(9);
  });

  test("ignores draft values of items the board does not hold", () => {
    const draft = new Map([["elsewhere", ganttEditedValue]]);
    expect(liveGraph(board(draft))).toBe(sentGraph(board(draft)));
  });

  test("builds the sent graph once per items list, whatever the draft", () => {
    const first = sentGraph(board(NOTHING));
    expect(sentGraph(board(EDITED))).toBe(first);
    expect(sentGraph(board(new Map()))).toBe(first);
    // A new items list is a new board revision, even with the same content.
    expect(sentGraph(board(NOTHING, [...ITEMS]))).not.toBe(first);
  });

  test("builds the live graph once per items list and draft record", () => {
    const first = liveGraph(board(EDITED));
    expect(liveGraph(board(EDITED))).toBe(first);
    expect(liveGraph(board(EDITED, [...ITEMS]))).not.toBe(first);
    // A new record holding the same values leaves nothing to recalculate: the same graph; a
    // changed value gives a new one.
    expect(liveGraph(board(new Map(EDITED)))).toBe(first);
    const tasks = ganttEditedValue.tasks.map((task) =>
      task.id === "billing" ? { ...task, duration: 12 } : task,
    );
    const other = liveGraph(board(new Map([["release", { ...ganttEditedValue, tasks }]])));
    expect(other).not.toBe(first);
    expect(other?.read("release.billing.duration")).toBe(12);
  });

  test("shares the sent graph while the draft holds nothing for the board's items", () => {
    expect(liveGraph(board(NOTHING))).toBe(sentGraph(board(NOTHING)));
    expect(liveGraph(board(new Map([["release", undefined]])))).toBe(sentGraph(board(NOTHING)));
  });

  test("builds nothing for a board with no Gantt", () => {
    const items = [
      { type: "tree", id: "wbs", props: { columns: [], nodes: [] } },
      { type: "question", id: "plain", props: { text: "Which?" } },
    ];
    const draft = new Map([["wbs", { columns: [], nodes: [] }]]);
    expect(sentGraph(board(draft, items))).toBeUndefined();
    expect(liveGraph(board(draft, items))).toBeUndefined();
    expect(liveGraph(board(NOTHING, []))).toBeUndefined();
  });

  test("gives a frozen, read-only graph", () => {
    const graph = sentGraph(board(NOTHING));
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.keys(graph ?? {}).sort()).toEqual(["read", "warnings"]);
  });

  test("lists the graph's warnings, as for a cycle from the agent", () => {
    const tasks = [
      { id: "a", label: "A", duration: 1, dependencies: ["b"] },
      { id: "b", label: "B", duration: 1, dependencies: ["a"] },
    ];
    const cyclic = [{ type: "gantt", id: "release", props: { start: "2026-11-02", tasks } }];
    const graph = sentGraph(board(NOTHING, cyclic));
    const warnings = graph?.warnings.map((warning) => `${warning.error}@${warning.address}`);
    expect(warnings).toContain("cycle@release.a.es");
    expect(warnings).toContain("cycle@release.b.es");
    expect(graph?.read("release.a.startDate")).toMatchObject({ error: "cycle" });
  });

  test("refuses malformed props each time, keeping no failed build", () => {
    const broken = [{ type: "gantt", id: "release", props: { start: "2026-11-02", tasks: 3 } }];
    expect(() => sentGraph(board(NOTHING, broken))).toThrow(GraphSourceError);
    expect(() => sentGraph(board(NOTHING, broken))).toThrow(GraphSourceError);
    const draft = new Map([["release", { start: "2026-11-02", tasks: [{ id: "a" }] }]]);
    expect(() => liveGraph(board(draft))).toThrow(GraphSourceError);
    expect(() => liveGraph(board(draft))).toThrow(GraphSourceError);
  });
});

// The fallback of the design's "Risks / Trade-offs" (task 6.8): a duration, or the start of a
// task that holds a request before and after, goes through `set` and `recalc` on the live graph
// built before; anything else rebuilds. Both paths must give what a rebuild gives.
describe("the live graph's recalculation", () => {
  type Task = Record<string, unknown> & { readonly id: string };
  const SENT = ITEMS[0]?.props as { readonly start: string; readonly tasks: readonly Task[] };
  const withTasks = (tasks: readonly Task[]) => new Map([["release", { ...SENT, tasks }]]);
  const edit = (tasks: readonly Task[], id: string, fields: Record<string, unknown>) =>
    tasks.map((task) => {
      if (task.id !== id) return task;
      const next: Task = { ...task, ...fields };
      for (const [key, value] of Object.entries(fields)) if (value === undefined) delete next[key];
      return next;
    });

  const TASK_FIELDS = [
    "duration",
    "earliest",
    "es",
    "ef",
    "lf",
    "ls",
    "slack",
    "critical",
    "startDate",
    "finishDate",
    "earliestDate",
    "startOffset",
  ];

  /** Every node of the Gantt as a graph reads it. */
  const readAll = (graph: ReturnType<typeof liveGraph>, tasks: readonly Task[]) =>
    Object.fromEntries([
      ...["start", "firstDay", "finish", "finishDate"].map((field) => [
        field,
        graph?.read(`release.${field}`),
      ]),
      ...tasks.flatMap((task) =>
        TASK_FIELDS.map((field) => [
          `${task.id}.${field}`,
          graph?.read(`release.${task.id}.${field}`),
        ]),
      ),
    ]);

  /** A graph built from nothing for the same tasks: a new items list is a new build. */
  const rebuilt = (tasks: readonly Task[]) =>
    sentGraph(board(NOTHING, [{ type: "gantt", id: "release", props: { ...SENT, tasks } }]));

  test("takes a moved request and a changed duration through recalc, giving what a rebuild gives", () => {
    const items = [...ITEMS];
    const requested = edit(SENT.tasks, "reporting", { start: "2026-12-09" });
    const first = liveGraph(board(withTasks(requested), items));
    const moved = edit(requested, "reporting", { start: "2026-12-14" });
    const second = liveGraph(board(withTasks(moved), items));
    const longer = edit(moved, "billing", { duration: 30 });
    const third = liveGraph(board(withTasks(longer), items));
    // A recalculation keeps the build's warnings, the very list; a rebuild makes its own.
    expect(second?.warnings).toBe(first?.warnings);
    expect(third?.warnings).toBe(first?.warnings);
    expect(second?.read("release.reporting.startDate")).toBe("2026-12-14");
    expect(third?.read("release.billing.finishDate")).toBe("2026-12-17");
    expect(readAll(second, moved)).toEqual(readAll(rebuilt(moved), moved));
    expect(readAll(third, longer)).toEqual(readAll(rebuilt(longer), longer));
  });

  test("keeps each draft record's graph as it was once the live graph moved on", () => {
    const items = [...ITEMS];
    const longer = edit(SENT.tasks, "billing", { duration: 11 });
    const first = liveGraph(board(withTasks(longer), items));
    const before = readAll(first, longer);
    liveGraph(board(withTasks(edit(longer, "billing", { duration: 30 })), items));
    expect(readAll(first, longer)).toEqual(before);
    expect(first?.read("release.billing.duration")).toBe(11);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first?.read("release.nowhere")).toMatchObject({ error: "missing-reference" });
  });

  test("rebuilds for a first or a cleared request and for changed predecessors", () => {
    const items = [...ITEMS];
    const steps = [
      edit(SENT.tasks, "billing", { duration: 11 }),
      edit(SENT.tasks, "reporting", { start: "2026-12-09" }),
      edit(SENT.tasks, "reporting", { start: undefined }),
      edit(SENT.tasks, "billing", { dependencies: ["ux"] }),
    ];
    let previous = liveGraph(board(withTasks(steps[0] ?? []), items));
    for (const tasks of steps.slice(1)) {
      const next = liveGraph(board(withTasks(tasks), items));
      expect(next?.warnings).not.toBe(previous?.warnings);
      expect(readAll(next, tasks)).toEqual(readAll(rebuilt(tasks), tasks));
      previous = next;
    }
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

  test("gives what a rebuild gives after each of 200 seeded sequences of 10 edits", () => {
    const ids = SENT.tasks.map((task) => task.id);
    for (let seed = 1; seed <= 200; seed++) {
      const next = random(seed);
      const items = [...ITEMS];
      let tasks = SENT.tasks;
      for (let step = 0; step < 10; step++) {
        const id = ids[next(ids.length)] as string;
        const kind = next(10);
        if (kind < 4) tasks = edit(tasks, id, { duration: 1 + next(15) });
        else if (kind < 8) {
          tasks = edit(tasks, id, {
            start: `2026-${11 + next(2)}-${String(1 + next(28)).padStart(2, "0")}`,
          });
        } else if (kind < 9) tasks = edit(tasks, id, { start: undefined });
        else
          tasks = edit(tasks, id, {
            dependencies: ids.filter((other) => other !== id && next(3) === 0),
          });
        const live = liveGraph(board(withTasks(tasks), items));
        expect({ seed, step, values: readAll(live, tasks) }).toEqual({
          seed,
          step,
          values: readAll(rebuilt(tasks), tasks),
        });
      }
    }
  });

  test("times a rebuild and a recalculation at the limits: 500 tasks, each with 50 predecessors and 50 dependents", () => {
    const dense: Task[] = Array.from({ length: 500 }, (_, index) => {
      const layer = Math.floor(index / 50);
      const before = Array.from({ length: 50 }, (_, k) => `t${(layer - 1) * 50 + k + 1}`);
      return {
        id: `t${index + 1}`,
        label: `Task ${index + 1}`,
        duration: (index % 5) + 1,
        ...(layer === 0 ? {} : { dependencies: before }),
      };
    });
    const items = [{ type: "gantt", id: "release", props: { ...SENT, tasks: dense } }];
    const from = performance.now();
    const built = liveGraph(board(withTasks(edit(dense, "t2", { duration: 3 })), items));
    const rebuild = performance.now() - from;
    const longer = edit(dense, "t2", { duration: 9 });
    const at = performance.now();
    const recalculated = liveGraph(board(withTasks(longer), items));
    const recalc = performance.now() - at;
    expect(recalculated?.warnings).toBe(built?.warnings);
    expect(readAll(recalculated, longer)).toEqual(readAll(rebuilt(longer), longer));
    // Bounds far above what this machine gives (about 60 ms and 5 ms): they catch a regression
    // by an order of magnitude, not a busy machine.
    expect(rebuild).toBeLessThan(2_000);
    expect(recalc).toBeLessThan(500);
  });
});
