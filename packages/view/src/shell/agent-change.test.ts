import { describe, expect, test } from "bun:test";
import { lifecycleBoardDocument } from "@askboard/contract/fixtures";
import type { ViewArea, ViewDocument, ViewQuestion } from "../view-document.ts";
import {
  changeCountOf,
  changePending,
  changesLabel,
  createRevisions,
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
