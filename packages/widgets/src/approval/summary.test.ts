import { describe, expect, test } from "bun:test";
import { type ElementShape, ganttShape, TREE_SHAPE } from "@askboard/contract";
import { SUMMARY_MAX_LINES, type SummaryItem, summarise } from "./summary.ts";
import type { ValueWords } from "./values.ts";

// The Approval's summary (view-and-widgets spec: The Approval summary; design decision 8): the
// generic diff of each other widget item's shown value against its props as sent, one line per
// change, named by label else ID, the values in the ask's locale, at most 20 lines.
const words: ValueWords = { on: "on", off: "off", none: "—" };

const sentTree = {
  nodes: [
    { id: "a", label: "Design", effort: 12 },
    { id: "b", label: "Build", effort: 5, children: [{ id: "c", label: "Test", effort: 2 }] },
  ],
};

const shapeOf = (type: string, props: object): ElementShape | undefined =>
  type === "tree" ? TREE_SHAPE : type === "gantt" ? ganttShape(props) : undefined;

const run = (items: readonly SummaryItem[], locale: "en-US" | "it-IT" = "en-US") =>
  summarise({ items, shapeOf, locale, words });

const tree = (shown: object, sent: object = sentTree): SummaryItem => ({
  id: "plan",
  type: "tree",
  sent,
  shown,
});

describe("summarise", () => {
  test("a changed field and a renamed node give two lines with names and values", () => {
    const shown = {
      nodes: [
        { id: "a", label: "Design", effort: 10 },
        { id: "b", label: "Construction", effort: 5, children: sentTree.nodes[1]?.children },
      ],
    };
    const result = run([tree(shown)]);
    expect(result.count).toBe(2);
    expect(result.more).toBe(0);
    expect(result.lines).toEqual([
      {
        op: "set",
        itemId: "plan",
        elementId: "a",
        name: "Design",
        field: "effort",
        previous: "12",
        next: "10",
      },
      {
        op: "set",
        itemId: "plan",
        elementId: "b",
        name: "Build",
        field: "label",
        previous: "Build",
        next: "Construction",
      },
    ]);
  });

  test("an added node is named from the shown value, a removed one from what was sent", () => {
    const shown = {
      nodes: [
        { id: "a", label: "Design", effort: 12 },
        { id: "d", label: "Ship" },
      ],
    };
    const result = run([tree(shown)]);
    const ops = result.lines.map((line) => [line.op, line.elementId, line.name]);
    expect(ops).toContainEqual(["add", "d", "Ship"]);
    expect(ops).toContainEqual(["remove", "b", "Build"]);
    expect(ops).not.toContainEqual(["remove", "c", "Test"]);
  });

  test("a moved node is a line of its own", () => {
    const shown = { nodes: [sentTree.nodes[1], sentTree.nodes[0]] };
    const result = run([tree(shown)]);
    expect(result.lines.map((line) => [line.op, line.elementId])).toEqual([["move", "b"]]);
  });

  test("a keyed Gantt plan entry is named by its ID", () => {
    const sent = { start: "2026-11-02", workPackages: "plan", tasks: { a: { duration: 3 } } };
    const shown = { start: "2026-11-02", workPackages: "plan", tasks: { a: { duration: 5 } } };
    const result = run([{ id: "gantt", type: "gantt", sent, shown }]);
    expect(result.lines).toEqual([
      {
        op: "set",
        itemId: "gantt",
        elementId: "a",
        name: "a",
        field: "duration",
        previous: "3",
        next: "5",
      },
    ]);
  });

  test("an item whose type gives no shape is skipped", () => {
    const result = run([{ id: "n", type: "note", sent: { x: 1 }, shown: { x: 2 } }]);
    expect(result).toEqual({ count: 0, lines: [], more: 0 });
  });

  test("an absent previous field and an emptied field read as nothing", () => {
    const shown = {
      nodes: [{ id: "a", label: "Design", effort: null, owner: "Ann" }, sentTree.nodes[1]],
    };
    const lines = run([tree(shown)]).lines;
    expect(lines).toContainEqual(
      expect.objectContaining({ field: "effort", previous: "12", next: "—" }),
    );
    expect(lines).toContainEqual(
      expect.objectContaining({ field: "owner", previous: "—", next: "Ann" }),
    );
  });

  test("values follow the ask's locale", () => {
    const sent = { nodes: [{ id: "a", label: "A", budget: 1000.5 }] };
    const shown = { nodes: [{ id: "a", label: "A", budget: 2000.5 }] };
    const [line] = run([tree(shown, sent)], "it-IT").lines;
    expect(line).toMatchObject({ previous: "1.000,5", next: "2.000,5" });
  });

  test("an element without a string label is named by its ID", () => {
    const sent = { nodes: [{ id: "a", label: 7 }] };
    const shown = { nodes: [{ id: "a", label: 8 }] };
    expect(run([tree(shown, sent)]).lines[0]?.name).toBe("a");
  });

  test("25 changes give 20 lines and 5 more", () => {
    const sentMany = {
      nodes: Array.from({ length: 25 }, (_, i) => ({ id: `n${i}`, label: `N${i}`, v: 1 })),
    };
    const shownMany = { nodes: sentMany.nodes.map((node) => ({ ...node, v: 2 })) };
    const result = run([tree(shownMany, sentMany)]);
    expect(SUMMARY_MAX_LINES).toBe(20);
    expect(result.count).toBe(25);
    expect(result.lines).toHaveLength(20);
    expect(result.more).toBe(5);
  });

  test("changes of several items add up in item order", () => {
    const shown = { nodes: [{ id: "a", label: "Design", effort: 1 }, sentTree.nodes[1]] };
    const other = {
      id: "g",
      type: "gantt",
      sent: { workPackages: "plan", tasks: { a: { duration: 1 } } },
      shown: { workPackages: "plan", tasks: { a: { duration: 2 } } },
    };
    const result = run([tree(shown), other]);
    expect(result.lines.map((line) => line.itemId)).toEqual(["plan", "g"]);
    expect(result.count).toBe(2);
  });

  test("an unchanged question gives none", () => {
    expect(run([tree(sentTree)])).toEqual({ count: 0, lines: [], more: 0 });
    expect(run([])).toEqual({ count: 0, lines: [], more: 0 });
  });
});
