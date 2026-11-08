import { describe, expect, test } from "bun:test";
import { lifecycleBoardDocument } from "@askboard/contract/fixtures";
import type { ComponentFacts } from "../catalog/port.ts";
import type { ViewArea, ViewDocument, ViewQuestion } from "../view-document.ts";
import {
  changeCountOf,
  changePending,
  changesLabel,
  createRevisions,
  readOnlyItemsOf,
  revisionDiff,
  workingQuestion,
} from "./agent-change.ts";
import { createDraftStore } from "./draft-store.ts";

const document = lifecycleBoardDocument as unknown as ViewDocument;
const area = document.items[0] as ViewArea;
const payment = area.props.items[1] as ViewQuestion;
const at = (rev: number, props: Partial<ViewQuestion["props"]> = {}): ViewQuestion => ({
  ...payment,
  rev,
  props: { ...payment.props, ...props },
});

describe("the agent-change notice (FR-6; task 6.7)", () => {
  test("raised when the agent changed a question holding work made on an earlier revision; not without work, nor on the same revision", () => {
    const none = new Map();
    expect(changePending(at(2), undefined, none)).toBe(false);
    expect(changePending(at(2), { rev: 2, note: "x" }, none)).toBe(false);
    expect(changePending(at(2), { rev: 1, note: "x" }, none)).toBe(true);
  });

  test("Keep mine settles it for that revision; a later change raises it again", () => {
    const kept = new Map([["payment", { rev: 2, keptRev: 1 }]]);
    expect(changePending(at(2), { rev: 1, note: "x" }, kept)).toBe(false);
    expect(changePending(at(3), { rev: 1, note: "x" }, kept)).toBe(true);
  });

  test("it counts the user's changes: the choice, Other text, each option note, the note, the composer and each widget value", () => {
    const values = createDraftStore();
    expect(changeCountOf(payment, values.record(), undefined)).toBe(0);
    values.set("payment", ["Stripe"]);
    const work = {
      rev: 1,
      other: "Mollie",
      optionNotes: { Adyen: "Costly.", Stripe: "Fast." },
      note: "Go.",
      composer: "Why?",
      held: { act: "answer" as const, order: 0 },
    };
    expect(changeCountOf(payment, values.record(), work)).toBe(6);
    const widget = {
      ...payment,
      props: { ...payment.props, items: [{ type: "tree", id: "plan", props: {} }] },
    };
    values.set("plan", { nodes: [] });
    expect(changeCountOf(widget, values.record(), { rev: 1 })).toBe(2);
    // A result the user holds is a change too (widget-registry, design decision 9).
    const results = new Map<string, unknown>([["plan", { pick: "a" }]]);
    expect(changeCountOf(widget, values.record(), { rev: 1 }, results)).toBe(3);
    expect(changesLabel(1)).toBe("Your 1 change on this question");
    expect(changesLabel(17)).toBe("Your 17 changes on this question");
  });

  test("the card works on the revision the work was made on while it is earlier, when the view has seen it; else the current", () => {
    const revisions = createRevisions();
    const first = at(1, { text: "Which provider?" });
    revisions.record({
      ...document,
      items: [{ ...area, props: { ...area.props, items: [first] } }],
    } as ViewDocument);
    expect(workingQuestion(at(2), { rev: 1 }, revisions)).toBe(first);
    expect(workingQuestion(at(2), { rev: 2 }, revisions).rev).toBe(2);
    expect(workingQuestion(at(2), undefined, revisions).rev).toBe(2);
    expect(workingQuestion(at(3), { rev: 2 }, revisions).rev).toBe(3);
  });
});

// Edit widgets on a revision the board cannot show (keep-mine-shown-revision, design decision 1):
// the facts of four stub types, one registering `shape`, and the others each some other fact or none.
const SHAPE = () => ({ kind: "keyed" as const, path: ["rows"] }) as never;
const stubFacts: Readonly<Record<string, ComponentFacts>> = {
  editing: { shape: SHAPE, valueFits: () => true, name: "change.widgetTree" },
  holding: { valueFits: () => true },
  fitting: { fits: () => true },
};
const factsOf = (type: string): ComponentFacts | undefined => stubFacts[type];
const withItems = (question: ViewQuestion, items: unknown): ViewQuestion =>
  ({ ...question, props: { ...question.props, items } }) as ViewQuestion;
const mixed = (rev: number): ViewQuestion =>
  withItems(at(rev), [
    { type: "editing", id: "top", props: {} },
    { type: "holding", id: "held", props: {} },
    { type: "fitting", id: "fitted", props: {} },
    { type: "bare", id: "plain", props: {} },
    {
      type: "group",
      id: "box",
      props: {
        title: "Box",
        items: [
          { type: "editing", id: "inner", props: {} },
          { type: "fitting", id: "inner-fitted", props: {} },
        ],
      },
    },
  ]);

describe("the items an edit widget makes read-only on a revision the board cannot show", () => {
  test("the items whose type registers a shape, at the top level and inside a layout, when the work is on an earlier revision than the card shows", () => {
    const question = mixed(2);
    const read = readOnlyItemsOf(question, question, { rev: 1 }, factsOf);
    expect([...read].sort()).toEqual(["inner", "top"]);
  });

  test("none while the card shows the revision the work was made on, there is no work, or the work is on the current revision", () => {
    const current = mixed(2);
    const earlier = mixed(1);
    // The page saw revision 1: the card shows it and the answer names it.
    expect(readOnlyItemsOf(current, earlier, { rev: 1 }, factsOf).size).toBe(0);
    expect(readOnlyItemsOf(current, current, undefined, factsOf).size).toBe(0);
    expect(readOnlyItemsOf(current, current, { rev: 2 }, factsOf).size).toBe(0);
    // A work that names a later revision than the question's names the question's (revisionFor).
    expect(readOnlyItemsOf(current, current, { rev: 3 }, factsOf).size).toBe(0);
  });

  test("a type with no facts registered at all makes no item read-only, and the default reads the registered facts", () => {
    const question = withItems(at(2), [{ type: "unregistered", id: "x", props: {} }]);
    expect(readOnlyItemsOf(question, question, { rev: 1 }, factsOf).size).toBe(0);
    expect(readOnlyItemsOf(question, question, { rev: 1 }).size).toBe(0);
  });
});

// A result that points into the agent's content (document-review, design decision 15): a type
// that registers `revisionBound` and no `shape` is read-only on a revision the board cannot show
// too, since its result means nothing on another revision's text.
const boundFacts: Readonly<Record<string, ComponentFacts>> = {
  ...stubFacts,
  pointing: { fits: () => true, revisionBound: true },
  both: { shape: SHAPE, revisionBound: true },
  unbound: { fits: () => true, valueFits: () => true },
};
const boundFactsOf = (type: string): ComponentFacts | undefined => boundFacts[type];
const pointing = (rev: number): ViewQuestion =>
  withItems(at(rev), [
    { type: "pointing", id: "review", props: {} },
    { type: "unbound", id: "free", props: {} },
    { type: "editing", id: "tree", props: {} },
    { type: "bare", id: "plain", props: {} },
    {
      type: "group",
      id: "box",
      props: {
        title: "Box",
        items: [
          { type: "pointing", id: "inner-review", props: {} },
          { type: "both", id: "inner-both", props: {} },
          { type: "unbound", id: "inner-free", props: {} },
        ],
      },
    },
  ]);

describe("the items a result that points into the agent's content makes read-only (document-review, decision 15)", () => {
  test("a type registering revisionBound and no shape is read-only at the top level and nested, beside the edit widgets, when the work names an earlier revision than the card shows", () => {
    const question = pointing(2);
    const read = readOnlyItemsOf(question, question, { rev: 1 }, boundFactsOf);
    expect([...read].sort()).toEqual(["inner-both", "inner-review", "review", "tree"]);
  });

  test("none while the card shows the work's revision, with no work, or with a work naming a later revision", () => {
    const current = pointing(2);
    const earlier = pointing(1);
    expect(readOnlyItemsOf(current, earlier, { rev: 1 }, boundFactsOf).size).toBe(0);
    expect(readOnlyItemsOf(current, current, undefined, boundFactsOf).size).toBe(0);
    expect(readOnlyItemsOf(current, current, { rev: 2 }, boundFactsOf).size).toBe(0);
    expect(readOnlyItemsOf(current, current, { rev: 3 }, boundFactsOf).size).toBe(0);
  });

  test("a type with neither fact is never read-only, and keep-mine's cases are unchanged", () => {
    const question = pointing(2);
    const read = readOnlyItemsOf(question, question, { rev: 1 }, boundFactsOf);
    expect(read.has("free")).toBe(false);
    expect(read.has("inner-free")).toBe(false);
    expect(read.has("plain")).toBe(false);
    const mixedQuestion = mixed(2);
    expect(
      [...readOnlyItemsOf(mixedQuestion, mixedQuestion, { rev: 1 }, boundFactsOf)].sort(),
    ).toEqual(["inner", "top"]);
  });
});

describe("Show the agent's change: the new revision with its differences marked", () => {
  test("its text fields and options, marked against the revision the work was made on", () => {
    const before = at(1).props;
    const after = at(2, {
      text: "Which payment provider should the new checkout use first?",
      options: [
        { label: "Stripe", preview: "Fees: 1.4% + 0.25 EUR per European card payment." },
        { label: "Mollie", description: "iDEAL and Bancontact." },
      ],
    }).props;
    expect(revisionDiff(before, after)).toEqual({
      header: { now: "Payments", changed: false },
      text: {
        now: "Which payment provider should the new checkout use first?",
        before: "Which payment provider should the new checkout use?",
        changed: true,
      },
      options: [
        {
          label: "Stripe",
          change: "changed",
          description: { changed: false },
          annotation: { changed: false },
          preview: {
            now: "Fees: 1.4% + 0.25 EUR per European card payment.",
            before: "Fees: 1.5% + 0.25 EUR per European card payment.",
            changed: true,
          },
          recommended: false,
        },
        {
          label: "Mollie",
          change: "added",
          description: { now: "iDEAL and Bancontact.", changed: false },
          annotation: { changed: false },
          preview: { changed: false },
          recommended: false,
        },
        {
          label: "Adyen",
          change: "removed",
          description: { changed: false },
          annotation: { now: "The shop team runs it already for refunds.", changed: false },
          preview: { changed: false },
          recommended: false,
        },
      ],
    });
  });

  test("without the earlier revision, the new one shows with nothing marked", () => {
    const diff = revisionDiff(undefined, at(2).props);
    expect(diff.text).toEqual({ now: payment.props.text, changed: false });
    expect(diff.options.map((option) => option.change)).toEqual(["same", "same"]);
  });
});
