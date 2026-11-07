import { describe, expect, test } from "bun:test";
import { type Change, elementChanges } from "@askboard/contract";
import {
  NOT_A_WIDGET,
  uj2ExpandedDerived,
  uj2ExpandedEditedValues,
  uj2ExpandedQuestion,
} from "@askboard/contract/fixtures";
import { elementShapeOf } from "@askboard/contract/validate";
import { answerInReferenceAddressing, type ExpansionMap } from "../src/index.ts";
import { deepFreeze, uj2Ask } from "./molecules.ts";

// An answer's changes and derived values in reference addressing (molecules design decision 7;
// core spec, "Answers in reference addressing"): the diff of each widget item the user changed,
// in the question's order, and the derived values, each under its reference's ID.

const EXAMPLES = `${import.meta.dir}/../../contract/test/fixtures`;
const answers = await Bun.file(`${EXAMPLES}/answers/uj2-wbs-gantt.json`).json();
const [event] = answers.asks[0].events as {
  readonly changes: readonly Change[];
  readonly derived: Readonly<Record<string, unknown>>;
}[];
if (event === undefined) throw new Error("the approved answer holds no event");

const map: ExpansionMap = new Map([
  ["wbs__tree", deepFreeze({ reference: "wbs", molecule: "wbs-pert", version: "1.0.0" })],
  [
    "schedule__plan",
    deepFreeze({ reference: "schedule", molecule: "gantt-plan", version: "1.0.0" }),
  ],
]);
const question = deepFreeze(structuredClone(uj2ExpandedQuestion));
const sent = question.props.items;

/** Changes as a set: each operation once, in a stable order. */
const asSet = (changes: readonly unknown[]): string[] =>
  changes.map((change) => JSON.stringify(change, Object.keys(change as object).sort())).sort();

describe("answerInReferenceAddressing", () => {
  const answer = answerInReferenceAddressing(
    map,
    question,
    sent,
    uj2ExpandedEditedValues,
    uj2ExpandedDerived,
  );

  test("gives the approved answer's eight operations, as a set", () => {
    expect(answer.changes).toHaveLength(8);
    expect(asSet(answer.changes)).toEqual(asSet(event.changes));
  });

  test("gives them in the diff's own order, item by item in the question's order", () => {
    const own = sent.flatMap((item) => {
      const shape = elementShapeOf(item);
      if (shape === undefined) return [];
      const reference = map.get(item.id)?.reference ?? item.id;
      return elementChanges(
        reference,
        item.props,
        uj2ExpandedEditedValues[item.id] as object,
        shape,
      );
    });
    expect(answer.changes).toEqual(own);
    expect(answer.changes.at(-1)?.target).toBe("schedule.u-1.dependencies");
  });

  test("gives the approved answer's fourteen derived values, as a map", () => {
    expect(answer.derived).toEqual(event.derived);
    expect(Object.keys(answer.derived)).toHaveLength(14);
  });

  test("names no expanded ID and holds no molecule field", () => {
    const text = JSON.stringify(answer);
    expect(text).not.toContain("wbs__tree");
    expect(text).not.toContain("schedule__plan");
    expect(text).not.toContain('"molecule"');
  });

  test("an item with no edited value gives no change", () => {
    const treeOnly = { wbs__tree: uj2ExpandedEditedValues.wbs__tree };
    const changes = answerInReferenceAddressing(map, question, sent, treeOnly, {}).changes;
    expect(changes.every((change) => change.target.startsWith("wbs."))).toBe(true);
    expect(answerInReferenceAddressing(map, question, sent, {}, {})).toEqual({
      changes: [],
      derived: {},
    });
  });

  test("diffs against the items as sent, and leaves its inputs unchanged", () => {
    const [tree, plan] = sent;
    const renamed = { ...tree, props: { ...tree.props, nodes: [] } };
    const changes = answerInReferenceAddressing(
      map,
      question,
      [renamed, plan],
      uj2ExpandedEditedValues,
      {},
    ).changes;
    expect(
      changes.filter((change) => change.target.startsWith("wbs.")).every((c) => c.op === "add"),
    ).toBe(true);
    expect(question).toEqual(uj2ExpandedQuestion);
  });

  test("a plain item of the question is left out, and an address of another item kept", () => {
    const plain = {
      ...question,
      props: { ...question.props, items: [...sent, { type: NOT_A_WIDGET, id: "k", props: {} }] },
    };
    const values = { ...uj2ExpandedEditedValues, k: { cards: [] } };
    expect(
      answerInReferenceAddressing(map, plain, plain.props.items, values, { "k.count": 1 }),
    ).toEqual({
      changes: answer.changes,
      derived: { "k.count": 1 },
    });
    expect(uj2Ask.items[0]?.id).toBe("plan");
  });
});
