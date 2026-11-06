import { describe, expect, test } from "bun:test";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import type { ViewQuestionProps } from "../view-document.ts";
import { revisionDiff } from "./agent-change.ts";
import { widgetChanges } from "./widget-changes.ts";

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
