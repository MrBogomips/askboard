import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  lifecycleUpdateResult,
  uj2WidgetAnswerAct,
  uj2WidgetAnsweredState,
  uj2WidgetFetchResult,
  uj2WidgetTooLargeEvent,
  widgetAnswerTranscript,
  widgetTranscripts,
} from "../src/fixtures/index.ts";
import { FORMULA_ERROR_KINDS } from "../src/formula/errors.ts";
import { ANSWER_EVENT_MAX_CHARS, COLLECT_ASKS_MAX, RESULT_MAX_CHARS } from "../src/index.ts";
import { RESULT_VERSIONS } from "../src/schemas/tool-envelopes/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import {
  type Checked,
  validateAgainst,
  validateAskRequest,
  validateBoardMessage,
} from "../src/validate.ts";

// The output format's and the tool envelopes' widget additions (widget-answers, task 1.5; contract
// spec: Answer event in the output format, Formula warnings, The largest answer event, Widget
// answers in fetch results, The approved UJ-2 example validates whole).
const read = async (path: string) =>
  (await Bun.file(join(import.meta.dir, "fixtures", path)).json()) as Record<string, unknown>;
const ok = (id: string, value: unknown) => validateAgainst(id, value).ok;
const paths = (result: Checked<unknown>): string[] =>
  result.ok ? [] : result.problems.map(({ path }) => path);

const EVENT = {
  cursor: "k3x9.1",
  type: "answer",
  itemId: "plan",
  rev: 1,
  who: "Sara Conti",
  when: "2026-11-02T09:30:00Z",
};

describe("an answer event too large for a result", () => {
  test("carries tooLarge with neither changes nor derived", () => {
    expect(ok(SCHEMA_IDS.answerEvent, { ...EVENT, tooLarge: true })).toBe(true);
    expect(ok(SCHEMA_IDS.answerEvent, { ...EVENT, choice: ["Yes"], tooLarge: true })).toBe(true);
  });

  test.each([
    ["changes", [{ op: "set", target: "wbs.ux.label", value: "UX" }]],
    ["derived", { "wbs.expected": 42 }],
  ])("is refused with %s beside tooLarge, naming the field", (field, value) => {
    const result = validateAgainst(SCHEMA_IDS.answerEvent, {
      ...EVENT,
      tooLarge: true,
      [field]: value,
    });
    expect(result.ok).toBe(false);
    expect(paths(result)).toContain(`/${field}`);
  });

  test("tooLarge is true or absent", () => {
    expect(ok(SCHEMA_IDS.answerEvent, { ...EVENT, tooLarge: false })).toBe(false);
  });

  test("the fixture validates, in a collect result too", () => {
    expect(ok(SCHEMA_IDS.answerEvent, uj2WidgetTooLargeEvent)).toBe(true);
    expect(uj2WidgetTooLargeEvent).toMatchObject({ tooLarge: true });
    expect(uj2WidgetTooLargeEvent).not.toHaveProperty("changes");
    expect(uj2WidgetTooLargeEvent).not.toHaveProperty("derived");
  });
});

describe("the formula warning", () => {
  const warning = {
    code: "formula",
    itemId: "schedule",
    address: "schedule.review",
    error: "missing-reference",
    message: "the plan schedule names the predecessor review, which is no task",
  };

  test("validates with the item, the address and the kind", () => {
    expect(ok(SCHEMA_IDS.warning, warning)).toBe(true);
  });

  test.each(["itemId", "address", "error"])("is refused without %s", (field) => {
    const { [field]: _, ...rest } = warning;
    expect(ok(SCHEMA_IDS.warning, rest)).toBe(false);
  });

  test.each([
    ["pointer", "docs/a.md#L1-L2"],
    ["reason", "not-found"],
  ])("takes none of the unresolved-pointer fields: %s", (field, value) => {
    expect(ok(SCHEMA_IDS.warning, { ...warning, [field]: value })).toBe(false);
  });

  test("an unresolved-pointer warning takes neither address nor error", () => {
    const pointer = {
      code: "unresolved-pointer",
      itemId: "note",
      pointer: "docs/a.md#L1-L2",
      reason: "not-found",
      message: "no such file",
    };
    expect(ok(SCHEMA_IDS.warning, pointer)).toBe(true);
    expect(ok(SCHEMA_IDS.warning, { ...pointer, address: "note.x" })).toBe(false);
    expect(ok(SCHEMA_IDS.warning, { ...pointer, error: "syntax" })).toBe(false);
  });

  test("a no-hooks warning takes no item fields", () => {
    expect(ok(SCHEMA_IDS.warning, { code: "no-hooks", message: "no hooks" })).toBe(true);
    expect(ok(SCHEMA_IDS.warning, { code: "no-hooks", message: "no hooks", address: "a" })).toBe(
      false,
    );
  });

  test("its kinds are the formula error kinds", () => {
    const kinds = ((warning as unknown as { error: string }) && FORMULA_ERROR_KINDS).filter(
      (kind) => ok(SCHEMA_IDS.warning, { ...warning, error: kind }),
    );
    expect(kinds).toEqual([...FORMULA_ERROR_KINDS]);
    expect(ok(SCHEMA_IDS.warning, { ...warning, error: "other" })).toBe(false);
  });

  test("validates in an ask result and in an update result", async () => {
    const ask = { ...(await read("results/uj2-wbs-gantt.json")), warnings: [warning] };
    const update = { ...lifecycleUpdateResult, warnings: [warning] };
    expect(validateAgainst(SCHEMA_IDS.askResult, ask)).toMatchObject({ ok: true });
    expect(validateAgainst(SCHEMA_IDS.updateResult, update)).toMatchObject({ ok: true });
  });
});

describe("the largest answer event", () => {
  test("is 24,000 characters, the budget of a fetch page", () => {
    expect(ANSWER_EVENT_MAX_CHARS).toBe(24_000);
  });

  test("with the most ask entries a collect takes, a result of one stays under the limit", () => {
    const event = {
      ...EVENT,
      choice: ["x".repeat(ANSWER_EVENT_MAX_CHARS - JSON.stringify(EVENT).length - 14)],
    };
    expect(JSON.stringify(event).length).toBe(ANSWER_EVENT_MAX_CHARS);
    // Ask IDs of 32 characters and a cursor of an 8-character epoch and a 6-digit sequence: the
    // arithmetic holds to ask IDs of about 56 characters; with 64-character IDs and 16-character
    // epochs it reaches 31,200, so `collect` pages such a result (`more`) before this one.
    const entry = (events: unknown[]) => ({
      askId: "a".repeat(32),
      state: "partly-answered",
      cursor: `${"z".repeat(8)}.${"9".repeat(6)}`,
      events,
      unchecked: true,
    });
    const asks = Array.from({ length: COLLECT_ASKS_MAX }, (_, index) =>
      entry(index === 0 ? [event] : []),
    );
    const result = {
      versions: RESULT_VERSIONS,
      epoch: "z".repeat(16),
      asks,
      more: true,
      outcome: "open",
    };
    expect(JSON.stringify(result).length).toBeLessThan(RESULT_MAX_CHARS);
  });
});

describe("widget answers in fetch results", () => {
  test("a fetch of the reference wbs returns a Tree under its ID", () => {
    expect(ok(SCHEMA_IDS.fetchResult, uj2WidgetFetchResult)).toBe(true);
    expect(uj2WidgetFetchResult.item).toMatchObject({
      type: "tree",
      id: "wbs",
      questionId: "plan",
    });
  });

  test("a Gantt is admitted as the item, its props checked as a Gantt's", () => {
    const gantt = {
      ...uj2WidgetFetchResult,
      item: {
        type: "gantt",
        id: "schedule",
        questionId: "plan",
        state: "answered",
        props: { start: "2026-11-02", workPackages: "wbs", tasks: { ux: { start: "2026-11-09" } } },
      },
    };
    expect(ok(SCHEMA_IDS.fetchResult, gantt)).toBe(true);
    const wrong = { ...gantt, item: { ...gantt.item, props: { tasks: [] } } };
    expect(ok(SCHEMA_IDS.fetchResult, wrong)).toBe(false);
  });

  test("a widget item names its question and its state", () => {
    const { questionId: _q, ...rest } = uj2WidgetFetchResult.item as unknown as Record<
      string,
      unknown
    >;
    expect(ok(SCHEMA_IDS.fetchResult, { ...uj2WidgetFetchResult, item: rest })).toBe(false);
    const { state: _s, ...noState } = uj2WidgetFetchResult.item as unknown as Record<
      string,
      unknown
    >;
    expect(ok(SCHEMA_IDS.fetchResult, { ...uj2WidgetFetchResult, item: noState })).toBe(false);
  });

  test("a question's answer holds its values and derived, in reference addressing", () => {
    const answered = {
      ...uj2WidgetFetchResult,
      item: {
        type: "question",
        id: "plan",
        rev: 1,
        state: "answered",
        props: {
          text: "Plan?",
          items: [{ type: "tree", id: "wbs", props: { nodes: [{ id: "ux", label: "UX" }] } }],
        },
        answer: {
          cursor: "k3x9.1",
          who: "Sara Conti",
          when: "2026-11-02T09:30:00Z",
          values: { wbs: { nodes: [{ id: "ux", label: "UX design" }] } },
          derived: { "wbs.expected": 4.83 },
        },
      },
    };
    expect(ok(SCHEMA_IDS.fetchResult, answered)).toBe(true);
    const bad = structuredClone(answered);
    (bad.item.answer as Record<string, unknown>).derived = { "a..b": 1 };
    expect(ok(SCHEMA_IDS.fetchResult, bad)).toBe(false);
  });

  test("a question with items and no options is a fetchable question", () => {
    const item = {
      type: "question",
      id: "plan",
      rev: 1,
      state: "open",
      props: {
        text: "Plan?",
        items: [{ type: "tree", id: "wbs", props: { nodes: [{ id: "a", label: "A" }] } }],
      },
    };
    expect(ok(SCHEMA_IDS.fetchResult, { ...uj2WidgetFetchResult, item })).toBe(true);
  });
});

describe("the approved UJ-2 example validates whole", () => {
  test("its ask passes the full contract", async () => {
    const ask = await read("asks/uj2-wbs-gantt.json");
    expect(validateAskRequest(ask)).toEqual({ ok: true, value: ask as never });
  });

  test("its ask result and its collect answer pass their envelopes", async () => {
    const result = await read("results/uj2-wbs-gantt.json");
    const answer = await read("answers/uj2-wbs-gantt.json");
    expect(validateAgainst(SCHEMA_IDS.askResult, result)).toEqual({ ok: true, value: result });
    expect(validateAgainst(SCHEMA_IDS.collectResult, answer)).toEqual({ ok: true, value: answer });
  });
});

describe("the widget answer fixtures", () => {
  test("the act and the state validate as board protocol messages", () => {
    expect(validateBoardMessage("toHost", uj2WidgetAnswerAct).ok).toBe(true);
    expect(validateBoardMessage("toPage", uj2WidgetAnsweredState).ok).toBe(true);
  });

  test("the transcript's every message validates, the refused act and the reconnect included", () => {
    const kinds = widgetAnswerTranscript.steps.flatMap((step) =>
      "message" in step ? [step.message.type] : [],
    );
    expect(kinds).toEqual([
      "connect",
      "board",
      "state",
      "act",
      "refused",
      "state",
      "act",
      "done",
      "state",
      "connect",
      "board",
      "state",
    ]);
    for (const step of widgetAnswerTranscript.steps) {
      if (!("message" in step)) continue;
      const direction = step.from === "page" ? "toHost" : "toPage";
      expect({
        type: step.message.type,
        ok: validateBoardMessage(direction, step.message).ok,
      }).toEqual({
        type: step.message.type,
        ok: true,
      });
    }
    expect(widgetTranscripts).toEqual({ widgetAnswer: widgetAnswerTranscript });
  });
});
