import { describe, expect, test } from "bun:test";
import { ganttBoardDocument, type ganttEditedValue } from "@askboard/contract/fixtures";
import type { BoardWidgetItem } from "@askboard/view/catalog";
import { inputChanges, startOffset } from "./recalc.ts";

const ITEMS: readonly BoardWidgetItem[] = ganttBoardDocument.items.flatMap(
  (question) => question.props.items,
);
const [RELEASE] = ITEMS as [BoardWidgetItem];
const PROPS = RELEASE.props as typeof ganttEditedValue;

/** The board's items with the Gantt's tasks edited. */
const edited = (
  edit: (task: Record<string, unknown>) => Record<string, unknown>,
  props: { readonly start?: string } = {},
): readonly BoardWidgetItem[] => [
  {
    ...RELEASE,
    props: { ...PROPS, ...props, tasks: PROPS.tasks.map((task) => edit({ ...task })) },
  },
];

const only = (id: string, fields: Record<string, unknown>) => (task: Record<string, unknown>) =>
  task.id === id ? { ...task, ...fields } : task;

describe("a request's offset, as compute's startOffset", () => {
  test("counts the working days from the plan's first working day to the request's", () => {
    expect(startOffset("2026-11-02", "2026-12-09")).toBe(27);
    expect(startOffset("2026-11-02", "2026-11-02")).toBe(0);
    // A weekend request counts to the Monday after it; a weekend plan start from its Monday.
    expect(startOffset("2026-11-02", "2026-11-07")).toBe(5);
    expect(startOffset("2026-10-31", "2026-11-03")).toBe(1);
  });

  test("is 0 for a request before the plan's first working day", () => {
    expect(startOffset("2026-11-02", "2026-10-20")).toBe(0);
  });

  test("is undefined for what is no day, which only a rebuild may refuse", () => {
    expect(startOffset("2026-11-02", "2026-02-30")).toBeUndefined();
    expect(startOffset("someday", "2026-11-03")).toBeUndefined();
  });
});

describe("the input changes that take a built graph to the next draft", () => {
  test("are none for the same items, or the same props", () => {
    expect(inputChanges(ITEMS, ITEMS)).toEqual([]);
    expect(inputChanges(ITEMS, [{ ...RELEASE }])).toEqual([]);
  });

  test("set a changed duration", () => {
    expect(inputChanges(ITEMS, edited(only("billing", { duration: 11 })))).toEqual([
      ["release.billing.duration", 11],
    ]);
  });

  test("set the offset of a request that moves", () => {
    const before = edited(only("reporting", { start: "2026-12-09" }));
    const after = edited(only("reporting", { start: "2026-12-14" }));
    expect(inputChanges(before, after)).toEqual([["release.reporting.startOffset", 30]]);
  });

  test("take several changes, in the tasks' order", () => {
    const before = edited(only("reporting", { start: "2026-12-09" }));
    const after = edited((task) =>
      task.id === "ux"
        ? { ...task, duration: 8 }
        : task.id === "reporting"
          ? { ...task, start: "2026-12-10" }
          : task,
    );
    expect(inputChanges(before, after)).toEqual([
      ["release.ux.duration", 8],
      ["release.reporting.startOffset", 28],
    ]);
  });

  test.each([
    ["a first request", ITEMS, edited(only("reporting", { start: "2026-12-09" }))],
    ["a cleared request", edited(only("reporting", { start: "2026-12-09" })), ITEMS],
    ["changed predecessors", ITEMS, edited(only("billing", { dependencies: ["ux"] }))],
    [
      "predecessors in another order",
      ITEMS,
      edited(only("portal", { dependencies: ["prototype", "architecture"] })),
    ],
    ["a changed plan start", ITEMS, edited((task) => task, { start: "2026-11-03" })],
    ["a duration that is not whole", ITEMS, edited(only("billing", { duration: 2.5 }))],
    ["a duration of 0", ITEMS, edited(only("billing", { duration: 0 }))],
    [
      "a request that is no day",
      edited(only("reporting", { start: "2026-12-09" })),
      edited(only("reporting", { start: "2026-02-30" })),
    ],
    [
      "tasks in another order",
      ITEMS,
      [{ ...RELEASE, props: { ...PROPS, tasks: [...PROPS.tasks].reverse() } }],
    ],
    ["one task fewer", ITEMS, [{ ...RELEASE, props: { ...PROPS, tasks: PROPS.tasks.slice(1) } }]],
    ["one item more", ITEMS, [...ITEMS, { type: "gantt", id: "other", props: PROPS }]],
    ["another item", ITEMS, [{ ...RELEASE, id: "other" }]],
    ["another type", ITEMS, [{ ...RELEASE, type: "tree" }]],
    [
      "a plan",
      ITEMS,
      [{ ...RELEASE, props: { start: "2026-11-02", workPackages: "wbs", tasks: {} } }],
    ],
    ["props that are no Gantt", ITEMS, [{ ...RELEASE, props: { start: "2026-11-02", tasks: 3 } }]],
    [
      "a task that is no object",
      ITEMS,
      [{ ...RELEASE, props: { ...PROPS, tasks: [7, ...PROPS.tasks.slice(1)] } }],
    ],
  ] as const)("are undefined for %s: only a rebuild gives it", (_, before, after) => {
    expect(inputChanges(before, after)).toBeUndefined();
  });

  test("leave a tree's changed props to a rebuild", () => {
    const tree = { type: "tree", id: "wbs", props: { nodes: [] } };
    expect(inputChanges([tree], [{ ...tree, props: { nodes: [{ id: "a" }] } }])).toBeUndefined();
    expect(inputChanges([tree], [tree])).toEqual([]);
  });
});
