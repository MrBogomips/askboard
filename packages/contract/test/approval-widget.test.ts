// The Approval's entry (approval-scale-ranking, task 1.3; contract spec: Approval items, What a
// result requires of its answer, Teaching text of the three widgets), composed over the shipped
// registry with `withWidgetTypes` while the type is not yet registered (design decision 10).

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import {
  APPROVAL_FIXTURE_ITEM,
  APPROVAL_RESULTS,
  approvalAct,
  approvalAnswerEvent,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  APPROVAL_DECISIONS,
  APPROVAL_SCHEMA_IDS,
  APPROVAL_WIDGET,
  approvalNeedsReason,
  noteHoldsReason,
  WIDGET_TYPES,
  widgetAnswerProblems,
  widgetRegistryProblems,
} from "../src/index.ts";
import { RESULT_VERSIONS } from "../src/schemas/tool-envelopes/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { validateBoardMessage } from "../src/validate.ts";
import approvalResultSchema from "../src/widgets/approval/approval-result.json" with {
  type: "json",
};
import { ajvOver, errorsOf } from "./probe-ajv.ts";
import { askAccepted, askProblems, resultProblemsOf } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(APPROVAL_WIDGET);
const ITEM = APPROVAL_FIXTURE_ITEM;
const NOTHING = { note: undefined, changed: false } as const;

const answerProblems = (decision: unknown, note: string | undefined, changed: boolean) =>
  widgetAnswerProblems(ITEM, { decision }, { note, changed }, TYPES);

describe("Approval items", () => {
  test("an Approval in a question passes", () => {
    expect(askProblems(TYPES, ITEM)).toEqual([]);
    expect(askAccepted(TYPES, ITEM)).toBe(true);
    expect(ITEM).toEqual({ type: "approval", id: "verdict", props: {} });
  });

  test("props the Approval does not define fail, naming the item and the field", () => {
    const item = { ...ITEM, props: { summary: "Looks fine" } };
    const [problem, ...rest] = askProblems(TYPES, item);
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("verdict");
    expect(problem?.field).toBe("props.summary");
    expect(problem?.message).toContain('item "verdict"');
    expect(askAccepted(TYPES, item)).toBe(false);
  });

  test("props that are not an object fail", () => {
    expect(askAccepted(TYPES, { ...ITEM, props: [] })).toBe(false);
    expect(askProblems(TYPES, { ...ITEM, props: "yes" })).not.toEqual([]);
  });

  test("the shipped registry accepts the type exactly when it holds it", () => {
    const registered = WIDGET_TYPES.some(({ type }) => type === "approval");
    expect(askAccepted(WIDGET_TYPES, ITEM)).toBe(registered);
  });

  test("it declares no edit and no derived value, and an Approval's noun is its own", () => {
    expect(APPROVAL_WIDGET.edits).toBeUndefined();
    expect(APPROVAL_WIDGET.derived).toBeUndefined();
    expect(APPROVAL_WIDGET.noun).toBe("an Approval");
    expect(APPROVAL_WIDGET.props.$id).toBe(APPROVAL_SCHEMA_IDS.props);
    expect(APPROVAL_WIDGET.result?.schema.$id).toBe(APPROVAL_SCHEMA_IDS.result);
  });
});

describe("the Approval's result", () => {
  test("the three decisions pass", () => {
    for (const decision of APPROVAL_DECISIONS) {
      expect(resultProblemsOf(TYPES, ITEM, { decision })).toEqual([]);
    }
    expect(Object.values(APPROVAL_RESULTS)).toEqual(
      APPROVAL_DECISIONS.map((decision) => ({ decision })),
    );
  });

  test("the schema's decisions are the constant's", () => {
    expect(approvalResultSchema.properties.decision.enum).toEqual([...APPROVAL_DECISIONS]);
  });

  test("the approved UJ-3 answer's result passes", () => {
    const answer = JSON.parse(
      readFileSync(new URL("./fixtures/answers/uj3-sales-review.json", import.meta.url), "utf8"),
    ) as { asks: { events: { results: Record<string, unknown> }[] }[] };
    const result = answer.asks[0]?.events[0]?.results.estimate;
    expect(result).toEqual({ decision: "approve-with-changes" });
    expect(resultProblemsOf(TYPES, ITEM, result)).toEqual([]);
  });

  test("an unknown decision and a reason in the result fail, naming the field", () => {
    const maybe = resultProblemsOf(TYPES, ITEM, { decision: "maybe" });
    expect(maybe.map(({ path }) => path)).toEqual(["/decision"]);
    expect(maybe[0]?.message).toContain("item verdict");
    const reason = resultProblemsOf(TYPES, ITEM, { decision: "approve", reason: "ok" });
    expect(reason.map(({ path }) => path)).toEqual(["/reason"]);
  });

  test("nothing, a non-object and a missing decision fail", () => {
    for (const result of [{}, null, "approve", ["approve"], { decision: null }]) {
      expect(resultProblemsOf(TYPES, ITEM, result)).not.toEqual([]);
    }
  });

  test("the result is checked by the composed fetch and board schemas", () => {
    const ajv = ajvOver(TYPES);
    const fetched = (result: unknown) => ({
      versions: RESULT_VERSIONS,
      epoch: "k3x9",
      askId: "widgets-ask-a1b2",
      state: "answered",
      item: { ...ITEM, questionId: "q", state: "answered", result },
      unchecked: true,
    });
    expect(errorsOf(ajv, SCHEMA_IDS.fetchResult, fetched({ decision: "reject" }))).toEqual([]);
    expect(errorsOf(ajv, SCHEMA_IDS.fetchResult, fetched({ decision: "maybe" }))).not.toEqual([]);
  });
});

describe("what the Approval requires of its answer", () => {
  test("approving with changes needs the reason in the note, whatever else the answer holds", () => {
    for (const note of [undefined, "", "   ", "\n\t ", "\u0085", " \u0085\t"]) {
      const problems = answerProblems("approve-with-changes", note, false);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toBe("item verdict: approving with changes needs the reason in the note");
    }
    expect(answerProblems("approve-with-changes", "Show training as optional", true)).toEqual([]);
    expect(answerProblems("approve-with-changes", " x ", false)).toEqual([]);
  });

  test("noteHoldsReason refuses what is only white space, NEXT LINE included", () => {
    for (const note of [undefined, "", "\u0085", " \u0085\t", "\uFEFF", "\u00A0\u3000"]) {
      expect(noteHoldsReason(note)).toBe(false);
    }
    expect(noteHoldsReason("x")).toBe(true);
    expect(noteHoldsReason(" \u0085x")).toBe(true);
  });

  test("invisible format characters count as a reason (PO open question, default)", () => {
    for (const note of ["\u200B", "\u3164"]) {
      expect(noteHoldsReason(note)).toBe(true);
      expect(answerProblems("approve-with-changes", note, false)).toEqual([]);
    }
  });

  test("approving beside changes fails, and approving with nothing changed passes", () => {
    expect(answerProblems("approve", undefined, true)).toEqual([
      "item verdict: an answer that changes the content approves with changes",
    ]);
    expect(answerProblems("approve", "ok", true)).toHaveLength(1);
    expect(answerProblems("approve", undefined, false)).toEqual([]);
  });

  test("rejecting passes beside changes, with no note", () => {
    expect(answerProblems("reject", undefined, true)).toEqual([]);
    expect(answerProblems("reject", undefined, false)).toEqual([]);
  });

  test("a result that is no Approval's gives no problem: the schema refuses it", () => {
    for (const result of [null, "approve", 3, {}, { decision: "maybe" }]) {
      expect(widgetAnswerProblems(ITEM, result, { note: undefined, changed: true }, TYPES)).toEqual(
        [],
      );
    }
  });

  test("approvalNeedsReason is true for approving with changes alone", () => {
    expect(approvalNeedsReason({ decision: "approve-with-changes" })).toBe(true);
    for (const result of [
      { decision: "approve" },
      { decision: "reject" },
      {},
      null,
      3,
      undefined,
    ]) {
      expect(approvalNeedsReason(result)).toBe(false);
    }
  });

  test("the answer checks agree with approvalNeedsReason for every decision", () => {
    for (const decision of APPROVAL_DECISIONS) {
      const refused = answerProblems(decision, undefined, false).length > 0;
      expect({ decision, refused }).toEqual({
        decision,
        refused: approvalNeedsReason({ decision }),
      });
    }
  });

  test("the shipped registry asks for a note exactly when it holds the type", () => {
    const registered = WIDGET_TYPES.some(({ type }) => type === "approval");
    const found = widgetAnswerProblems(ITEM, { decision: "approve-with-changes" }, NOTHING);
    expect(found.length > 0).toBe(registered);
  });
});

describe("the Approval's fixtures", () => {
  test("the act answering with a verdict passes the board protocol", () => {
    expect(validateBoardMessage("toHost", approvalAct).ok).toBe(true);
    expect(approvalAct.acts[0]).toMatchObject({ type: "answer", results: { verdict: {} } });
  });

  test("the answer event carries the verdict, the note and a change the Approval counts", () => {
    const ajv = ajvOver(TYPES);
    expect(errorsOf(ajv, SCHEMA_IDS.answerEvent, approvalAnswerEvent)).toEqual([]);
    expect(approvalAnswerEvent.results).toEqual({ verdict: { decision: "approve-with-changes" } });
    expect(approvalAnswerEvent.note).toBeDefined();
    expect(approvalAnswerEvent.changes?.length).toBeGreaterThan(0);
  });
});

describe("the Approval's entry in the registry's own check", () => {
  test("passes over the registry holding it, result-empty included", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
  });

  test("its teaching text is within bounds and its example is accepted in an ask", () => {
    const { skill, example } = APPROVAL_WIDGET;
    expect(skill?.use.length).toBeGreaterThan(0);
    expect(skill?.use.length).toBeLessThanOrEqual(200);
    for (const note of skill?.notes ?? []) expect(note.length).toBeLessThanOrEqual(300);
    expect(skill?.use).toContain("approve");
    expect(askProblems(TYPES, example.item)).toEqual([]);
    expect(askAccepted(TYPES, example.item)).toBe(true);
  });
});

describe("the registry's other modules", () => {
  test("no module of src/widgets outside approval/ and registry.ts names the type", () => {
    const root = new URL("../src/widgets/", import.meta.url);
    const named: string[] = [];
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || entry.parentPath.includes("/approval")) continue;
      // The registry holds the registration lines of the three types.
      if (entry.name === "registry.ts") continue;
      const text = readFileSync(`${entry.parentPath}/${entry.name}`, "utf8");
      // The change's own name is how comments cite it; the type's name is what must not appear.
      if (/approval/i.test(text.replaceAll("approval-scale-ranking", ""))) named.push(entry.name);
    }
    expect(named).toEqual([]);
  });
});
