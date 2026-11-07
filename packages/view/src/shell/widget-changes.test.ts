import { describe, expect, test } from "bun:test";
import { ganttShape, TREE_SHAPE } from "@askboard/contract";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import { componentFacts, register } from "../catalog/port.ts";
import { t } from "../strings/index.ts";
import type { ViewQuestionProps } from "../view-document.ts";
import { revisionDiff } from "./agent-change.ts";
import { widgetChanges, widgetTypeLabel } from "./widget-changes.ts";

// The Tree's and the Gantt's chunks register their facts with their components (widget-registry,
// design decision 8); the shell holds none, so these tests register what the chunks do.
const noComponent = () => null;
if (componentFacts("tree") === undefined) {
  register("tree", noComponent, { shape: () => TREE_SHAPE, name: "change.widgetTree" });
}
if (componentFacts("gantt") === undefined) {
  register("gantt", noComponent, {
    shape: (props) => ganttShape(props as object),
    name: "change.widgetGantt",
  });
}

const [{ props: before }] = ganttPlanBoardDocument.items;
const [tree, plan] = before.items;

const withItems = (items: readonly unknown[]): ViewQuestionProps =>
  ({ ...before, items }) as unknown as ViewQuestionProps;

const planWith = (tasks: Record<string, unknown>) =>
  withItems([tree, { ...plan, props: { ...plan.props, tasks } }]);

describe("the agent's change to a question's widget items", () => {
  test("names the changed Gantt plan with its element operations, and nothing for the Tree it left alone", () => {
    const after = planWith({
      ...plan.props.tasks,
      prototype: { dependencies: ["ux", "architecture"] },
      billing: { dependencies: [] },
    });
    expect(widgetChanges(before as ViewQuestionProps, after)).toEqual([
      { itemId: plan.id, type: "gantt", operations: 2 },
    ]);
  });

  test("lists nothing when the items are the same, are new, or the question has none", () => {
    expect(widgetChanges(before as ViewQuestionProps, before as ViewQuestionProps)).toEqual([]);
    expect(widgetChanges(undefined, before as ViewQuestionProps)).toEqual([]);
    expect(widgetChanges(withItems([tree]), withItems([tree, plan]))).toEqual([]);
    expect(widgetChanges(before as ViewQuestionProps, { text: "t", header: "h" })).toEqual([]);
  });

  test("the revision diff carries them, and omits the field without a change", () => {
    const changed = planWith({ ...plan.props.tasks, billing: { dependencies: [] } });
    expect(revisionDiff(before as ViewQuestionProps, changed).widgets).toEqual([
      { itemId: plan.id, type: "gantt", operations: 1 },
    ]);
    expect(
      "widgets" in revisionDiff(before as ViewQuestionProps, before as ViewQuestionProps),
    ).toBe(false);
  });
});

describe("a widget type's facts come from its chunk, not from the shell (widget-registry, design decision 8)", () => {
  // A test-only type whose elements are the entries of `rows`, with no registry entry anywhere.
  const rowsShape = { elements: "rows", keyed: true } as const;
  const sketch = (rows: Record<string, unknown>) => ({
    type: "sketchpad",
    id: "pad",
    props: { rows },
  });
  const withSketch = (rows: Record<string, unknown>) =>
    ({ ...before, items: [sketch(rows)] }) as unknown as ViewQuestionProps;

  test("an item whose type registered a shape is listed, its type as sent", () => {
    register("sketchpad", noComponent, { shape: () => rowsShape });
    const changes = widgetChanges(withSketch({ a: { x: 1 } }), withSketch({ a: { x: 2 } }));
    expect(changes).toEqual([{ itemId: "pad", type: "sketchpad", operations: 1 }]);
  });

  test("an item whose type registered no facts is not listed", () => {
    const other = (rows: Record<string, unknown>) =>
      ({
        ...before,
        items: [{ type: "unregistered", id: "pad", props: { rows } }],
      }) as unknown as ViewQuestionProps;
    expect(widgetChanges(other({ a: { x: 1 } }), other({ a: { x: 2 } }))).toEqual([]);
    register("shapeless", noComponent, { name: "change.widgetTree" });
    const shapeless = (rows: Record<string, unknown>) =>
      ({ ...before, items: [{ type: "shapeless", id: "pad", props: { rows } }] }) as never;
    expect(widgetChanges(shapeless({ a: { x: 1 } }), shapeless({ a: { x: 2 } }))).toEqual([]);
  });
});

describe("the label the notice gives a changed widget's type", () => {
  const say = (key: Parameters<typeof t>[1]) => t("en-US", key);

  test("is the name its chunk registered, looked up in the strings", () => {
    expect(widgetTypeLabel("tree", say)).toBe("Tree");
    expect(widgetTypeLabel("gantt", say)).toBe("Gantt");
  });

  test("is the type as sent when its chunk registered no name, or no chunk registered it", () => {
    register("nameless", noComponent, { shape: () => TREE_SHAPE });
    expect(widgetTypeLabel("nameless", say)).toBe("nameless");
    expect(widgetTypeLabel("kanban", say)).toBe("kanban");
  });
});
