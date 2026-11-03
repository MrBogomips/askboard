import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  uj2ExpandedBoardDocument,
  uj2ExpandedDerived,
  uj2ExpandedEditedValues,
  uj2ExpandedQuestion,
} from "../src/fixtures/index.ts";
import { type Change, elementChanges } from "../src/index.ts";
import { elementShapeOf, widgetItemProblems } from "../src/validate.ts";

// The molecules' fixtures (molecules design decision 9; contract spec, "Molecule fixtures"): the
// UJ-2 question as the expansion gives it, its board document, both items' values after the
// approved answer's edits and its derived values, which agree with the approved answer once each
// expanded ID is put back under its reference's ID.

const FIXTURES = join(import.meta.dir, "fixtures");
const ask = await Bun.file(join(FIXTURES, "asks/uj2-wbs-gantt.json")).json();
const answers = await Bun.file(join(FIXTURES, "answers/uj2-wbs-gantt.json")).json();
const [event] = answers.asks[0].events as {
  readonly changes: readonly Change[];
  readonly derived: Readonly<Record<string, unknown>>;
}[];
if (event === undefined) throw new Error("the approved answer holds no event");

/** Each expanded ID's reference: the ask's references `wbs` and `schedule`. */
const REFERENCES: Readonly<Record<string, string>> = {
  wbs__tree: "wbs",
  schedule__plan: "schedule",
};

const referenceOf = (key: string): string => {
  const [head = "", ...rest] = key.split(".");
  return [REFERENCES[head] ?? head, ...rest].join(".");
};

/** Changes as a set: each operation once, in a stable order. */
const asSet = (changes: readonly unknown[]): string[] =>
  changes.map((change) => JSON.stringify(change, Object.keys(change as object).sort())).sort();

const items = uj2ExpandedQuestion.props.items;

describe("the molecule fixtures", () => {
  test("the expanded question is the approved ask's question plan with the expanded items", () => {
    const [plan] = ask.items;
    const { items: _references, ...props } = plan.props;
    expect({ ...uj2ExpandedQuestion, props: { ...uj2ExpandedQuestion.props, items: [] } }).toEqual({
      type: plan.type,
      id: plan.id,
      props: { ...props, items: [] },
    });
    expect(items.map((item) => [item.type, item.id])).toEqual([
      ["tree", "wbs__tree"],
      ["gantt", "schedule__plan"],
    ]);
    const [tree, schedule] = items;
    expect(tree.props.pert).toBe(true);
    expect(tree.props.openDepth).toBe(2);
    expect(tree.props.columns?.map((column) => column.label)).toEqual([
      "Optimistic",
      "Most likely",
      "Pessimistic",
    ]);
    expect(JSON.stringify(tree.props.nodes)).not.toContain("excerpt");
    expect(schedule.props.workPackages).toBe("wbs__tree");
  });

  test("both expanded items pass the widget item checks, in the question and the board document", () => {
    for (const item of items)
      expect(widgetItemProblems(item, uj2ExpandedQuestion, "agent")).toEqual([]);
    const [question] = uj2ExpandedBoardDocument.items;
    expect(question.rev).toBe(1);
    expect(question.props.items).toEqual(items);
    for (const item of question.props.items) {
      expect(widgetItemProblems(item, question, "agent")).toEqual([]);
    }
  });

  test("both edited values pass the widget item checks as edited", () => {
    const edited = items.map((item) => ({ ...item, props: uj2ExpandedEditedValues[item.id] }));
    const question = {
      ...uj2ExpandedQuestion,
      props: { ...uj2ExpandedQuestion.props, items: edited },
    };
    expect(Object.keys(uj2ExpandedEditedValues)).toEqual(["wbs__tree", "schedule__plan"]);
    for (const item of edited) expect(widgetItemProblems(item, question, "edited")).toEqual([]);
  });

  test("the diffs under the references' IDs are the approved answer's operations, as a set", () => {
    const changes = items.flatMap((item) => {
      const shape = elementShapeOf(item);
      if (shape === undefined) throw new Error(`no shape for ${item.id}`);
      const edited = uj2ExpandedEditedValues[item.id] as object;
      return elementChanges(REFERENCES[item.id] ?? item.id, item.props, edited, shape);
    });
    expect(asSet(changes)).toEqual(asSet(event.changes));
    expect(changes).toContainEqual({
      op: "set",
      target: "schedule.u-1.dependencies",
      value: ["architecture", "prototype"],
    });
  });

  test("the derived values under the references' IDs are the approved answer's fourteen", () => {
    const keys = Object.keys(uj2ExpandedDerived);
    expect(keys).toHaveLength(14);
    expect(
      keys.every((key) => key.startsWith("wbs__tree") || key.startsWith("schedule__plan")),
    ).toBe(true);
    const mapped = Object.fromEntries(
      Object.entries(uj2ExpandedDerived).map(([key, value]) => [referenceOf(key), value]),
    );
    expect(mapped).toEqual(event.derived);
  });
});
