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
const FACTS = new Map<string, ComponentFacts>(
  EDITING.map((entry) => [
    entry.type,
    { shape: (props) => (entry.edits as NonNullable<typeof entry.edits>).shape(props) },
  ]),
);
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

  test("with a result held for any item", () => {
    const results = new Map([[tree.id, { anything: true }]]);
    expect(acceptAsSentOffered(inputs(questionOf([tree]), { results }))).toBe(false);
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
