import { describe, expect, test } from "bun:test";
import {
  type ElementShape,
  ganttShape,
  KANBAN_SHAPE,
  LATEX_SHAPE,
  TREE_SHAPE,
} from "@askboard/contract";
import {
  KANBAN_EDITED_PROPS,
  KANBAN_FIXTURE_ITEM,
  KANBAN_ORDER_ITEM,
  KANBAN_PLACED_PROPS,
  KANBAN_REORDERED_PROPS,
  LATEX_EDITED_PROPS,
  LATEX_FIXTURE_ITEM,
} from "@askboard/contract/fixtures";
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

const shapeOf = (type: string, props: object): ElementShape | undefined => {
  if (type === "tree") return TREE_SHAPE;
  if (type === "gantt") return ganttShape(props);
  if (type === "latex") return LATEX_SHAPE;
  if (type === "kanban") return KANBAN_SHAPE;
  return undefined;
};

// What the component gives: the widget's name from the view's string tables.
const widgetName = (type: string): string => (type === "latex" ? "LaTeX" : type);

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

  test("a node renamed and moved has one name on its move line and its set line", () => {
    const shown = {
      nodes: [
        { id: "b", label: "Construction", effort: 5, children: sentTree.nodes[1]?.children },
        sentTree.nodes[0],
      ],
    };
    const lines = run([tree(shown)]).lines;
    expect(lines.map((line) => [line.op, line.elementId, line.name])).toEqual(
      expect.arrayContaining([
        ["move", "b", "Build"],
        ["set", "b", "Build"],
      ]),
    );
    expect(new Set(lines.filter((line) => line.elementId === "b").map((l) => l.name))).toEqual(
      new Set(["Build"]),
    );
  });

  test("an added node is named from the shown element, there being no sent one", () => {
    const shown = { nodes: [...sentTree.nodes, { id: "e", label: "Launch" }] };
    expect(run([tree(shown)]).lines.map((line) => [line.op, line.elementId, line.name])).toEqual([
      ["add", "e", "Launch"],
    ]);
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

// A whole-field change (view-and-widgets spec: The Approval summary of a whole-field change; design
// decision 11): one line naming the item's widget and the field, with the previous and new values.
describe("summarise, a whole-field change", () => {
  const latex = (shown: object, sent: object = LATEX_FIXTURE_ITEM.props): SummaryItem => ({
    id: LATEX_FIXTURE_ITEM.id,
    type: "latex",
    sent,
    shown,
  });
  const named = (items: readonly SummaryItem[], locale: "en-US" | "it-IT" = "en-US") =>
    summarise({ items, shapeOf, locale, words, widgetName });

  test("a set of formula.expression is one line naming the LaTeX's widget and the field, the sent expression before the new one", () => {
    expect(named([latex(LATEX_EDITED_PROPS)])).toEqual({
      count: 1,
      lines: [
        {
          op: "set",
          itemId: "formula",
          elementId: "",
          name: "LaTeX",
          field: "expression",
          previous: "a^2+b^2",
          next: "a^2+b^2=c^2",
        },
      ],
      more: 0,
    });
  });

  test("an expression emptied, and one the agent sent empty, are shown as the text they are", () => {
    const [emptied] = named([latex({ expression: "" })]).lines;
    expect(emptied).toMatchObject({ previous: "a^2+b^2", next: "" });
    const [filled] = named([latex({ expression: "x" }, { expression: "" })]).lines;
    expect(filled).toMatchObject({ previous: "", next: "x" });
  });

  test("both values are cut at 80 characters with an ellipsis, by code point", () => {
    const long = "\\alpha".repeat(40);
    const astral = "\u{1F600}".repeat(90);
    const [line] = named([latex({ expression: astral }, { expression: long })]).lines;
    expect(line?.previous).toBe(`${Array.from(long).slice(0, 80).join("")}…`);
    expect(line?.next).toBe(`${"\u{1F600}".repeat(80)}…`);
    const [exact] = named([
      latex({ expression: "x".repeat(80) }, { expression: "y".repeat(80) }),
    ]).lines;
    expect(exact).toMatchObject({ previous: "y".repeat(80), next: "x".repeat(80) });
  });

  test("an unchanged expression gives no line, and the widget's type names it when no name is given", () => {
    expect(named([latex(LATEX_FIXTURE_ITEM.props)])).toEqual({ count: 0, lines: [], more: 0 });
    const [line] = run([latex(LATEX_EDITED_PROPS)]).lines;
    expect(line).toMatchObject({ name: "latex", field: "expression" });
  });

  test("it sits beside the lines of an element shape, in item order, and counts with them", () => {
    const shown = { nodes: [{ id: "a", label: "Design", effort: 1 }, sentTree.nodes[1]] };
    const result = named([latex(LATEX_EDITED_PROPS), tree(shown)]);
    expect(result.count).toBe(2);
    expect(result.lines.map((line) => [line.itemId, line.name])).toEqual([
      ["formula", "LaTeX"],
      ["plan", "Design"],
    ]);
  });

  test("a Kanban move is one line naming the card, as before", () => {
    const result = named([
      {
        id: KANBAN_FIXTURE_ITEM.id,
        type: "kanban",
        sent: KANBAN_FIXTURE_ITEM.props,
        shown: KANBAN_EDITED_PROPS,
      },
    ]);
    expect(result.count).toBe(1);
    expect(result.lines[0]).toMatchObject({
      op: "set",
      name: "Fix the login redirect",
      field: "column",
      previous: "todo",
      next: "doing",
    });
  });

  test("a card placed in its column is one `moved` line naming it", () => {
    const result = named([
      {
        id: KANBAN_ORDER_ITEM.id,
        type: "kanban",
        sent: KANBAN_ORDER_ITEM.props,
        shown: KANBAN_REORDERED_PROPS,
      },
    ]);
    expect(result.count).toBe(1);
    expect(result.lines[0]).toMatchObject({ op: "move", name: "Add single sign-on" });
  });

  test("a card placed in another column elsewhere than its sent place is a set line then a move line", () => {
    const result = named([
      {
        id: KANBAN_ORDER_ITEM.id,
        type: "kanban",
        sent: KANBAN_ORDER_ITEM.props,
        shown: KANBAN_PLACED_PROPS,
      },
    ]);
    expect(result.lines.map(({ op, name }) => [op, name])).toEqual([
      ["set", "Audit the access log"],
      ["move", "Audit the access log"],
    ]);
    expect(result.lines[0]).toMatchObject({ field: "column", previous: "todo", next: "doing" });
  });
});
