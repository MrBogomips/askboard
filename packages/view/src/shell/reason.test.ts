// A reason the answer requires (approval-scale-ranking, design decisions 5 and 6): which pair of
// strings the open prompt uses, read from the facts a chunk registered for an item's type. Plain
// data, with a lookup of facts for test types in place of the registry.

import { describe, expect, test } from "bun:test";
import { noteHoldsReason } from "@askboard/contract";
import type { ComponentFacts } from "../catalog/port.ts";
import type { ViewQuestion } from "../view-document.ts";
import { reasonAskedAfter, reasonOf } from "./reason.ts";

const PAIR = { label: "question.reasonRequired", missing: "question.reasonMissing" } as const;
const OTHER = { label: "question.note", missing: "question.explain" } as const;

// A test-only `verdict` type whose result `{decision}` requires a reason for "revise" only, and a
// `grade` type that always requires one of its own; `plain` has facts with no reason.
const FACTS: Readonly<Record<string, ComponentFacts>> = {
  verdict: {
    reason: (result) =>
      (result as { decision?: string } | undefined)?.decision === "revise" ? PAIR : undefined,
  },
  grade: { reason: () => OTHER },
  plain: { name: "change.widgetTree" },
};
const factsOf = (type: string): ComponentFacts | undefined =>
  Object.hasOwn(FACTS, type) ? FACTS[type] : undefined;

const questionOf = (...items: readonly [type: string, id: string][]): ViewQuestion =>
  ({
    type: "question",
    id: "plan",
    rev: 1,
    props: {
      text: "Plan?",
      items: items.map(([type, id]) => ({ type, id, props: {} })),
    },
  }) as unknown as ViewQuestion;

const held = (...entries: [string, unknown][]): ReadonlyMap<string, unknown> => new Map(entries);

describe("the reason an item's held result requires", () => {
  test("an item whose facts give a pair for its held result requires it", () => {
    const question = questionOf(["verdict", "v"]);
    expect(reasonOf(question, held(["v", { decision: "revise" }]), undefined, factsOf)).toEqual(
      PAIR,
    );
  });

  test("a held result the facts give no pair for requires nothing", () => {
    const question = questionOf(["verdict", "v"]);
    expect(
      reasonOf(question, held(["v", { decision: "accept" }]), undefined, factsOf),
    ).toBeUndefined();
  });

  test("the first item, in the question's order, whose facts give a pair wins", () => {
    const question = questionOf(["plain", "p"], ["grade", "g"], ["verdict", "v"]);
    const results = held(["v", { decision: "revise" }], ["g", 1], ["p", 1]);
    expect(reasonOf(question, results, undefined, factsOf)).toEqual(OTHER);
    expect(
      reasonOf(questionOf(["verdict", "v"], ["grade", "g"]), results, undefined, factsOf),
    ).toEqual(PAIR);
  });

  test("an item with no held result is not asked", () => {
    const question = questionOf(["grade", "g"]);
    expect(reasonOf(question, held(), undefined, factsOf)).toBeUndefined();
  });

  test("a type with no facts, with facts but no reason, or unknown requires nothing", () => {
    const question = questionOf(["plain", "p"], ["unknown", "u"], ["constructor", "c"]);
    expect(reasonOf(question, held(["p", 1], ["u", 1], ["c", 1]), undefined, factsOf)).toBe(
      undefined,
    );
  });

  test("a question with no items requires nothing", () => {
    const question = { ...questionOf(), props: { text: "Plan?" } } as unknown as ViewQuestion;
    expect(reasonOf(question, held(["v", 1]), undefined, factsOf)).toBeUndefined();
  });
});

describe("the reason an answer the card shows requires", () => {
  const question = questionOf(["verdict", "v"]);
  const shown = { results: { v: { decision: "revise" } } };

  test("the shown result gives the pair while the user holds none", () => {
    expect(reasonOf(question, held(), shown, factsOf)).toEqual(PAIR);
  });

  test("held results come before shown ones", () => {
    const grading = questionOf(["verdict", "v"], ["grade", "g"]);
    const both = { results: { v: { decision: "revise" } } };
    // The user holds a pair for "g" (second item); the shown "v" (first item) would give another:
    // the held one wins, as the held result is what "Answer" would send.
    expect(reasonOf(grading, held(["g", 1]), both, factsOf)).toEqual(OTHER);
  });

  test("a shown answer with no results, or a result for an item the question does not hold, requires nothing", () => {
    expect(reasonOf(question, held(), {}, factsOf)).toBeUndefined();
    expect(
      reasonOf(question, held(), { results: { other: { decision: "revise" } } }, factsOf),
    ).toBeUndefined();
  });

  test("a shown result is read as an own property: an item named after a prototype member has none", () => {
    expect(reasonOf(questionOf(["grade", "toString"]), held(), { results: {} }, factsOf)).toBe(
      undefined,
    );
    const own = JSON.parse('{"constructor": 1}') as Record<string, unknown>;
    expect(
      reasonOf(questionOf(["grade", "constructor"]), held(), { results: own }, factsOf),
    ).toEqual(OTHER);
  });
});

describe("a note as a reason", () => {
  // The page reads the rule the core reads (design decision 2): the list holds what `\s` omits.
  const NOTES = [
    undefined,
    "",
    "   ",
    "\n\t",
    "\u00a0",
    "\u2003\u2009",
    "\u0085",
    " \u0085\t",
    "\uFEFF",
    "\u00A0\u3000",
    "Cheaper.",
    " x ",
    "0",
    " \u0085x",
  ];

  test.each(NOTES)("%j: the open prompt's error agrees with noteHoldsReason", (note) => {
    expect(reasonAskedAfter(true, PAIR, note)).toBe(!noteHoldsReason(note));
  });
});

describe("the field error under the open prompt", () => {
  test("shows while it was asked for, a pair applies and the note is no reason", () => {
    expect(reasonAskedAfter(true, PAIR, "")).toBe(true);
    expect(reasonAskedAfter(true, PAIR, "  ")).toBe(true);
  });

  test("clears once the note holds text", () => {
    expect(reasonAskedAfter(true, PAIR, "a")).toBe(false);
  });

  test("clears when no item requires a reason any more", () => {
    expect(reasonAskedAfter(true, undefined, "")).toBe(false);
  });

  test("is never shown before it was asked for", () => {
    expect(reasonAskedAfter(false, PAIR, "")).toBe(false);
  });
});

describe("the reason error stays cleared once the reason is written (design decision 6)", () => {
  // The card keeps the flag a press of "Answer" sets and replaces it by this helper's result on
  // every render; the steps below replay that.
  const replay = (steps: readonly (readonly [pair: typeof PAIR | undefined, note: string])[]) => {
    let asked = true; // a press that asked
    const shown: boolean[] = [];
    for (const [pair, note] of steps) {
      asked = reasonAskedAfter(asked, pair, note);
      shown.push(asked);
    }
    return shown;
  };

  test("gives false once the note holds a reason, and stays false when the text is deleted", () => {
    expect(
      replay([
        [PAIR, ""],
        [PAIR, "a"],
        [PAIR, ""],
        [PAIR, "  "],
      ]),
    ).toEqual([true, false, false, false]);
  });

  test("gives false once no pair applies, and stays false when one applies again", () => {
    expect(
      replay([
        [PAIR, ""],
        [undefined, ""],
        [PAIR, ""],
      ]),
    ).toEqual([true, false, false]);
  });

  test("only a press that asks sets it again", () => {
    let asked = reasonAskedAfter(true, PAIR, "a");
    asked = reasonAskedAfter(asked, PAIR, "");
    expect(asked).toBe(false);
    asked = true; // the next press of "Answer" finds the note empty and asks
    expect(reasonAskedAfter(asked, PAIR, "")).toBe(true);
  });
});
