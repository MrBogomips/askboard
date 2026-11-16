import { describe, expect, test } from "bun:test";
import { WIDGET_TYPES } from "@askboard/contract";
import type { ComponentFacts } from "../catalog/port.ts";
import type { ViewQuestion } from "../view-document.ts";
import { type AcceptInputs, acceptAsSentOffered } from "./accept-as-sent.ts";

// "Accept as is" is offered on a question with no options that holds an item whose widget edits
// agent content, while it is to do or in draft and nothing is edited or resulted (accept-as-sent,
// design decision 1; view-and-widgets spec: When Accept as is is offered).
const EDITING = WIDGET_TYPES.filter((entry) => entry.edits !== undefined);
const ITEMS = Object.fromEntries(
  EDITING.map((entry) => [entry.type, structuredClone(entry.example.item)]),
) as Record<string, { type: string; id: string; props: Record<string, unknown> }>;

// Each type's chunk registers its element shape with its component; the tests give the same
// lookup, built from the contract's registry, so that they register nothing in the shared one.
const FACTS = new Map<string, ComponentFacts>([
  ...EDITING.map((entry): [string, ComponentFacts] => [
    entry.type,
    { shape: (props) => (entry.edits as NonNullable<typeof entry.edits>).shape(props) },
  ]),
  // The input fields register a field check; the types that give a verdict or an order do not.
  ...WIDGET_TYPES.filter((entry) => entry.fieldCheck !== undefined).map(
    (entry): [string, ComponentFacts] => [
      entry.type,
      { check: entry.fieldCheck, inputField: true },
    ],
  ),
  ["approval", {}],
  ["ranking", {}],
  // The Document review registers a check (a detached annotation) and is no input field.
  ["document-review", { check: () => undefined, revisionBound: true }],
]);
const factsOf = (type: string): ComponentFacts | undefined => FACTS.get(type);

const questionOf = (items: readonly unknown[], extra: Record<string, unknown> = {}) =>
  ({
    type: "question",
    id: "plan",
    rev: 1,
    props: { text: "Is this right?", items, ...extra },
  }) as unknown as ViewQuestion;

const inputs = (question: ViewQuestion, more: Partial<AcceptInputs> = {}): AcceptInputs => ({
  question,
  currentRev: question.rev,
  namedRev: question.rev,
  readOnlyItems: new Set(),
  values: new Map(),
  results: new Map(),
  open: true,
  locked: false,
  opened: false,
  factsOf,
  ...more,
});

describe("Accept as is is offered on an untouched question with an editable item", () => {
  test("the registry's editing types are the six the design names", () => {
    expect(EDITING.map((entry) => entry.type).sort()).toEqual(
      ["gantt", "kanban", "latex", "table", "timeline", "tree"].sort(),
    );
  });

  test.each(EDITING.map((entry) => entry.type))("a %s", (type) => {
    expect(acceptAsSentOffered(inputs(questionOf([ITEMS[type]])))).toBe(true);
  });

  test("a molecule's Tree, whose ID carries the molecule's, inside a Group", () => {
    const tree = { ...structuredClone(ITEMS.tree), id: "wbs__tree" };
    const group = { type: "group", id: "side", props: { title: "Side", items: [tree] } };
    expect(acceptAsSentOffered(inputs(questionOf([group])))).toBe(true);
  });

  test.each([
    ["a TextField", { type: "text-field", id: "who", props: { label: "Who" } }, "Sara"],
    ["a NumberField", { type: "number-field", id: "n", props: { label: "N" } }, 3],
    ["a Toggle", { type: "toggle", id: "ok", props: { label: "OK" } }, true],
  ])("with a filled input field's result held for %s", (_, field, result) => {
    const tree = ITEMS.tree as { id: string };
    const results = new Map([[field.id, result]]);
    expect(acceptAsSentOffered(inputs(questionOf([tree, field]), { results }))).toBe(true);
  });

  test("a value moved and put back, equal to what was sent, counts as no change", () => {
    const tree = ITEMS.tree as { id: string; props: Record<string, unknown> };
    const values = new Map([[tree.id, structuredClone(tree.props)]]);
    expect(acceptAsSentOffered(inputs(questionOf([tree]), { values }))).toBe(true);
  });
});

describe("Accept as is is not offered", () => {
  const tree = ITEMS.tree as unknown as {
    id: string;
    props: { nodes: { id: string; label: string }[] };
  };

  test("on a question with options", () => {
    const question = questionOf([tree], { options: [{ label: "Yes" }] });
    expect(acceptAsSentOffered(inputs(question))).toBe(false);
  });

  test("on a question with no edit type", () => {
    const field = { type: "text-field", id: "who", props: { label: "Who" } };
    expect(acceptAsSentOffered(inputs(questionOf([field])))).toBe(false);
    expect(acceptAsSentOffered(inputs(questionOf([])))).toBe(false);
  });

  test("with a value moved", () => {
    const moved = structuredClone(tree.props);
    moved.nodes[0] = { ...(moved.nodes[0] as { id: string; label: string }), label: "Moved" };
    const values = new Map([[tree.id, moved]]);
    expect(acceptAsSentOffered(inputs(questionOf([tree]), { values }))).toBe(false);
  });

  test("with a result held for an item that is no input field (an Approval, a Ranking)", () => {
    const approval = { type: "approval", id: "verdict", props: {} };
    const ranking = { type: "ranking", id: "order", props: { items: [] } };
    for (const item of [approval, ranking]) {
      const results = new Map([[item.id, { decision: "reject" }]]);
      expect(acceptAsSentOffered(inputs(questionOf([tree, item]), { results }))).toBe(false);
    }
  });

  test("with annotations held for a Document review, whose chunk registers a check but is no input field", () => {
    const review = { type: "document-review", id: "doc", props: { document: "text" } };
    const results = new Map([[review.id, { annotations: [] }]]);
    expect(acceptAsSentOffered(inputs(questionOf([tree, review]), { results }))).toBe(false);
  });

  test("with a result held for a Tree, which gives none", () => {
    const results = new Map([[tree.id, { anything: true }]]);
    expect(acceptAsSentOffered(inputs(questionOf([tree]), { results }))).toBe(false);
  });

  test("when the card shows a revision other than the current one", () => {
    const question = { ...questionOf([tree]), rev: 1 } as ViewQuestion;
    expect(acceptAsSentOffered(inputs(question, { currentRev: 2, namedRev: 1 }))).toBe(false);
  });

  test("when the work names a revision other than the one the card shows", () => {
    const question = { ...questionOf([tree]), rev: 2 } as ViewQuestion;
    expect(acceptAsSentOffered(inputs(question, { currentRev: 2, namedRev: 1 }))).toBe(false);
  });

  test("while an item is read-only", () => {
    const readOnlyItems = new Set([tree.id]);
    expect(acceptAsSentOffered(inputs(questionOf([tree]), { readOnlyItems }))).toBe(false);
  });

  test("when the question is answered, ready or declined", () => {
    expect(acceptAsSentOffered(inputs(questionOf([tree]), { open: false }))).toBe(false);
  });

  test("when the board is locked, or the card is in a Snapshot", () => {
    expect(acceptAsSentOffered(inputs(questionOf([tree]), { locked: true }))).toBe(false);
    expect(acceptAsSentOffered(inputs(questionOf([tree]), { opened: true }))).toBe(false);
  });

  test("for a type whose chunk registered no shape, which waits for it (fail closed)", () => {
    const unknown = { type: "sketchpad", id: "pad", props: { rows: {} } };
    expect(acceptAsSentOffered(inputs(questionOf([unknown])))).toBe(false);
  });

  test("when the held value of an item cannot be compared, it counts as a change", () => {
    const values = new Map([[tree.id, "not an object"]]);
    expect(acceptAsSentOffered(inputs(questionOf([tree]), { values }))).toBe(false);
  });

  test("when the diff of a held value throws, it counts as a change", () => {
    const throwing = (type: string): ComponentFacts | undefined =>
      type === "thrower"
        ? {
            shape: () => {
              throw new Error("no shape for this value");
            },
          }
        : factsOf(type);
    const item = { type: "thrower", id: "t", props: { rows: {} } };
    const other = ITEMS.tree as { id: string };
    const values = new Map([["t", { rows: { a: 1 } }]]);
    expect(
      acceptAsSentOffered(inputs(questionOf([other, item]), { values, factsOf: throwing })),
    ).toBe(false);
  });
});
