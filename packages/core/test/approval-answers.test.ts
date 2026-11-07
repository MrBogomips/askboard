import { describe, expect, test } from "bun:test";
import { type AnswerEvent, APPROVAL_WIDGET } from "@askboard/contract";
import {
  APPROVAL_FIXTURE_ITEM,
  APPROVAL_RESULTS,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { answerAct, checked, type Item, type Json, modelOf } from "./probe-fakes.ts";

// Core spec: A result's requirements on its answer (approval-scale-ranking, design decisions 2 and
// 3): ask-core runs each result's answer checks where the answer's changes exist, after the result
// checks, and a refusal appends and keeps nothing. The Approval is not registered yet, so every
// test passes the registry through `withWidgetTypes`.

const TYPES = withWidgetTypes(APPROVAL_WIDGET);
const TREE: Item = {
  type: "tree",
  id: "wbs",
  props: { nodes: [{ id: "ux", label: "UX" }] },
};
const EDITED = { nodes: [{ id: "ux", label: "UX design" }] };
const NOTE = "Show the training line as an optional extra.";

const model = () => modelOf([TREE, APPROVAL_FIXTURE_ITEM]);
const verdict = (decision: keyof typeof APPROVAL_RESULTS) => ({
  [APPROVAL_FIXTURE_ITEM.id]: APPROVAL_RESULTS[decision],
});
const run = (fields: Json, m = model()) => checked(m, [answerAct(fields)], { types: TYPES });

const refusal = (fields: Json, m = model()) => {
  const { log, outcome } = run(fields, m);
  if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
  expect(log.latestSeq).toBe(0);
  // Nothing kept: the model keeps an answer's widget content only from the `kept` of an accepted
  // outcome (`AskCore` copies `built.kept` after the append), so a refusal carries none and no events.
  expect(Object.keys(outcome).sort()).toEqual(["index", "ok", "problem"]);
  return outcome.problem;
};

describe("approving with changes and a reason", () => {
  test("is logged with the result, the note and the Tree's change", () => {
    const { outcome } = run({
      values: { wbs: EDITED },
      results: verdict("approveWithChanges"),
      note: NOTE,
    });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const [event] = outcome.events as AnswerEvent[];
    expect(event?.results).toEqual(verdict("approveWithChanges"));
    expect(event?.note).toBe(NOTE);
    expect(event?.changes?.length).toBe(1);
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
    expect([...outcome.kept.values()][0]?.results).toEqual(verdict("approveWithChanges"));
  });
});

describe("approving with changes and no reason", () => {
  test("no note is refused, naming the item and the missing reason", () => {
    const problem = refusal({ results: verdict("approveWithChanges") });
    expect(problem.refusal).toBe("content");
    expect(problem.detail).toContain("item verdict");
    expect(problem.detail).toContain("approving with changes needs the reason in the note");
    expect(problem.itemId).toBe("choose");
  });

  test("a note of white space only is refused", () => {
    for (const note of ["   ", "\n\t ", "  ", "\u0085", " \u0085\t"]) {
      const problem = refusal({ results: verdict("approveWithChanges"), note });
      expect(problem.detail).toContain("needs the reason in the note");
    }
  });

  test("an empty note is refused too, by the answer's own rule", () => {
    refusal({ results: verdict("approveWithChanges"), note: "" });
  });

  test("a note of white space refused beside an edit as well, nothing kept", () => {
    const problem = refusal({
      values: { wbs: EDITED },
      results: verdict("approveWithChanges"),
      note: "  ",
    });
    expect(problem.detail).toContain("item verdict");
  });

  test("a refused answer keeps no values, no results and no derived values: nothing kept", () => {
    const { log, outcome } = run({
      values: { wbs: EDITED },
      results: verdict("approveWithChanges"),
      derived: {},
      note: "  ",
    });
    expect(outcome.ok).toBe(false);
    expect("kept" in outcome).toBe(false);
    expect("events" in outcome).toBe(false);
    expect(log.latestSeq).toBe(0);
  });
});

describe("approving beside a change", () => {
  test("is refused, naming the item", () => {
    const problem = refusal({ values: { wbs: EDITED }, results: verdict("approve") });
    expect(problem.refusal).toBe("content");
    expect(problem.detail).toContain("item verdict");
    expect(problem.detail).toContain("an answer that changes the content approves with changes");
  });

  test("an edit that changes nothing is no change", () => {
    const { outcome } = run({ values: { wbs: TREE.props }, results: verdict("approve") });
    expect(outcome.ok).toBe(true);
  });
});

describe("approving with nothing changed", () => {
  test("approve alone is logged", () => {
    const { outcome } = run({ results: verdict("approve") });
    expect(outcome.ok).toBe(true);
  });

  test("approve-with-changes with nothing changed and a reason is logged", () => {
    const { outcome } = run({ results: verdict("approveWithChanges"), note: NOTE });
    expect(outcome.ok).toBe(true);
  });

  test("reject beside a change, with no note, is logged", () => {
    const { outcome } = run({ values: { wbs: EDITED }, results: verdict("reject") });
    expect(outcome.ok).toBe(true);
  });
});

describe("a decline", () => {
  test("a decline with a note runs no answer check", () => {
    const { log, outcome } = checked(
      model(),
      [{ type: "decline", itemId: "choose", rev: 1, when: answerAct({}).when, note: NOTE }],
      { types: TYPES },
    );
    expect(outcome.ok).toBe(true);
    expect(log.latestSeq).toBe(0);
  });

  test("a decline carrying a result is refused by the decline's own rule", () => {
    const { outcome } = checked(
      model(),
      [
        {
          type: "decline",
          itemId: "choose",
          rev: 1,
          when: answerAct({}).when,
          results: verdict("approve"),
        },
      ],
      { types: TYPES },
    );
    expect(outcome.ok).toBe(false);
  });
});

describe("the answer check runs after the result check", () => {
  test("a result keyed by an item the question does not hold gets the result check's wording", () => {
    const problem = refusal({ results: { elsewhere: APPROVAL_RESULTS.approve } });
    expect(problem.detail).toContain('results name "elsewhere"');
    expect(problem.detail).not.toContain("item elsewhere:");
    expect(problem.detail).not.toContain("the reason in the note");
  });

  test("a decision outside the three is refused by the schema, not by the answer check", () => {
    const problem = refusal({ results: { verdict: { decision: "maybe" } }, note: NOTE });
    expect(problem.detail).toContain("the result of item verdict");
  });

  test("a result no registry type holds is refused by the result check", () => {
    const { outcome } = checked(model(), [answerAct({ results: verdict("approveWithChanges") })], {
      types: withWidgetTypes(),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.problem.detail).toContain('results name "verdict"');
  });
});
