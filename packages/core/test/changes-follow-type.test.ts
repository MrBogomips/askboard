import { describe, expect, test } from "bun:test";
import {
  APPROVAL_WIDGET,
  KANBAN_WIDGET,
  LATEX_WIDGET,
  RANKING_WIDGET,
  TIMELINE_WIDGET,
  type WidgetType,
} from "@askboard/contract";
import {
  APPROVAL_FIXTURE_ITEM,
  APPROVAL_RESULTS,
  KANBAN_EDITED_PROPS,
  KANBAN_FIXTURE_ITEM,
  RANKING_FIXTURE_ITEM,
  RANKING_RESULT,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { answerAct, checked, type Item, type Json, modelOf } from "./probe-fakes.ts";

// Core spec: An answer's changes follow their type (latex-kanban-timeline design decisions 2 and 6):
// the changes computed for an edited item are checked against the type's changes schema, after the
// value's own checks and its round trip, for every registered type; a diff that throws (a fields
// shape's unnamed key) is a refusal naming the item and the key. Every refusal leaves the log as it
// was and keeps and publishes nothing: a refused act yields no events and no kept values.

const SHOWN_KEY_MAX = 80;

// A test-made type over the whole-field shape: it names the field `a`, and its props schema admits
// any other string key, so that a value changing one passes the value's checks and the diff throws.
const MEMO: WidgetType = {
  type: "memo",
  noun: "a Memo",
  props: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "urn:askboard:input:memo-props",
    type: "object",
    properties: { a: { type: "string" } },
    additionalProperties: { type: "string" },
  },
  propsProblems: () => [],
  edits: {
    changes: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "urn:askboard:output:memo-changes",
      type: "array",
      items: { $ref: "urn:askboard:output:answer-event#/$defs/change" },
    },
    shape: () => ({ fields: ["a"] }),
  },
  wording: { expected: {}, fields: {} },
  example: { item: { type: "memo", id: "memo", props: { a: "x" } } },
};

const TYPES = withWidgetTypes(
  LATEX_WIDGET,
  KANBAN_WIDGET,
  TIMELINE_WIDGET,
  APPROVAL_WIDGET,
  RANKING_WIDGET,
  MEMO,
);

const kanban: Item = structuredClone(KANBAN_FIXTURE_ITEM) as unknown as Item;
const memo = (props: Json): Item => ({ type: "memo", id: "memo", props });

const send = (items: readonly Item[], fields: Json, act = answerAct(fields)) =>
  checked(modelOf(items), [act], { types: TYPES });

// The refusal of an act: its problem, the log as it was and no event.
const refusal = (items: readonly Item[], fields: Json) => {
  const { log, outcome } = send(items, fields);
  if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
  expect(log.latestSeq).toBe(0);
  expect(outcome.problem.refusal).toBe("content");
  return outcome.problem;
};

const cardsOf = (cards: readonly unknown[]): Json => ({
  board: { ...KANBAN_EDITED_PROPS, cards },
});

describe("a diff that throws is a refusal", () => {
  test("a change to a key the fields shape does not name is refused naming the item and the key", () => {
    const problem = refusal([memo({ a: "x", note: "one" })], {
      values: { memo: { a: "x", note: "two" } },
    });
    expect(problem.detail).toContain('"memo"');
    expect(problem.detail).toContain('"note"');
    expect(problem.itemId).toBe("choose");
  });

  test("a key added or removed is refused the same way, nothing kept or published", () => {
    for (const [sent, edited] of [
      [{ a: "x" }, { a: "x", note: "new" }],
      [{ a: "x", note: "old" }, { a: "x" }],
    ] as const) {
      const problem = refusal([memo(sent)], { values: { memo: edited } });
      expect(problem.detail).toContain('"note"');
    }
  });

  test("the quoted key is cut at 80 characters", () => {
    const key = `k${"y".repeat(199)}`;
    const problem = refusal([memo({ a: "x", [key]: "one" })], {
      values: { memo: { a: "x", [key]: "two" } },
    });
    expect(problem.detail).toContain(`"${key.slice(0, SHOWN_KEY_MAX)}"`);
    expect(problem.detail).not.toContain(key.slice(0, SHOWN_KEY_MAX + 1));
  });

  test("a change to the named field is an answer, logged with its set", () => {
    const { outcome } = send([memo({ a: "x" })], { values: { memo: { a: "y" } } });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    expect(outcome.events[0]).toMatchObject({ changes: [{ op: "set", target: "memo.a" }] });
  });
});

describe("types with no shape", () => {
  const rankingEdit = (): Json => {
    const [first, ...rest] = RANKING_FIXTURE_ITEM.props.items;
    return { priorities: { items: [...rest, first] } };
  };

  test("a Ranking answer with its result alone is logged, with no changes", () => {
    const { outcome } = send([structuredClone(RANKING_FIXTURE_ITEM) as unknown as Item], {
      results: { priorities: RANKING_RESULT },
    });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const [event] = outcome.events;
    expect(event).toMatchObject({ results: { priorities: RANKING_RESULT } });
    expect(event).not.toHaveProperty("changes");
    expect([...outcome.kept.values()][0]?.values).toEqual({});
  });

  test("a Ranking answer with an edited value is refused: a Ranking takes no edits", () => {
    const problem = refusal([structuredClone(RANKING_FIXTURE_ITEM) as unknown as Item], {
      values: rankingEdit(),
      results: { priorities: RANKING_RESULT },
    });
    expect(problem.detail).toContain("priorities");
  });

  test("an Approval answer is logged as before", () => {
    const { outcome } = send([structuredClone(APPROVAL_FIXTURE_ITEM) as unknown as Item], {
      results: { [APPROVAL_FIXTURE_ITEM.id]: APPROVAL_RESULTS.approve },
    });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    expect(outcome.events[0]).not.toHaveProperty("changes");
  });
});

describe("Kanban changes follow the Kanban's changes schema", () => {
  test("the reversal of a Kanban with one card per column is refused by the round trip, naming the item", () => {
    // Each column's order is unchanged, so its changes are none and do not rebuild the reversed list.
    const cards = [...(kanban.props as { cards: unknown[] }).cards].reverse();
    const problem = refusal([kanban], { values: cardsOf(cards) });
    expect(problem.detail).toContain('item "board"');
    expect(problem.detail).toContain("changes more than elements");
  });

  test("a renamed card is refused naming the item and the set of its label", () => {
    const cards = (kanban.props as { cards: Json[] }).cards.map((card, at) =>
      at === 0 ? { ...card, label: "Fix the sign-in redirect" } : card,
    );
    const problem = refusal([kanban], { values: cardsOf(cards) });
    expect(problem.detail).toContain("item board");
    expect(problem.detail).toContain("(set of board.fix-login.label)");
  });

  test("a card moved to another column is logged with the set of its column", () => {
    const { outcome } = send([kanban], { values: { board: KANBAN_EDITED_PROPS } });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    expect(outcome.events[0]).toMatchObject({
      changes: [{ op: "set", target: "board.fix-login.column", value: "doing" }],
    });
  });
});

describe("a decline", () => {
  test("a decline reads no value and runs no check", () => {
    const { outcome } = send([kanban], {}, { ...answerAct({}), type: "decline" });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    expect(outcome.events[0]).toMatchObject({ declined: true });
    expect(outcome.events[0]).not.toHaveProperty("changes");
  });
});
