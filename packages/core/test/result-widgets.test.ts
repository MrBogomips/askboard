import { describe, expect, test } from "bun:test";
import {
  type AnswerEvent,
  APPROVAL_WIDGET,
  RANKING_WIDGET,
  SCALE_WIDGET,
  widgetResultProblems,
} from "@askboard/contract";
import {
  RANKING_FIXTURE_ITEM,
  RANKING_RESULT,
  SCALE_FIXTURE_ITEMS,
  SCALE_RESULTS,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { EventLog } from "../src/lifecycle/log.ts";
import { questionStatus } from "../src/lifecycle/states.ts";
import { widgetItemValue } from "../src/lifecycle/widget-fetch.ts";
import { answerAct, checked, type Item, modelOf } from "./probe-fakes.ts";

// Core spec: Results of the shipped result widgets (approval-scale-ranking, design decisions 1 and
// 3): ask-core checks a Scale's and a Ranking's result against the item's props in the revision the
// answer names, through the registry alone (no code of core names a type). Every test passes the
// registry through `withWidgetTypes`, which gives the same registry before and after the three types
// are registered.

const TYPES = withWidgetTypes(APPROVAL_WIDGET, SCALE_WIDGET, RANKING_WIDGET);
const SHARE = SCALE_FIXTURE_ITEMS[0] as Item;
const RANKING = RANKING_FIXTURE_ITEM as unknown as Item;
const ORDER = RANKING_RESULT.order;

const run = (model: ReturnType<typeof modelOf>, fields: Record<string, unknown>, log?: EventLog) =>
  checked(model, [answerAct(fields)], { types: TYPES, ...(log === undefined ? {} : { log }) });

const refusal = (model: ReturnType<typeof modelOf>, fields: Record<string, unknown>) => {
  const { log, outcome } = run(model, fields);
  if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
  expect(log.latestSeq).toBe(0);
  return outcome.problem;
};

describe("a Scale's result", () => {
  test("a value on its step is logged and kept", () => {
    const { outcome } = run(modelOf([SHARE]), { results: { share: SCALE_RESULTS.slider } });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    expect((outcome.events[0] as AnswerEvent).results).toEqual({ share: { value: 35 } });
    expect([...outcome.kept.values()][0]?.results).toEqual({ share: { value: 35 } });
  });

  test("a value off its step is refused, naming the item, with the log unchanged", () => {
    const problem = refusal(modelOf([SHARE]), { results: { share: { value: 37 } } });
    expect(problem.refusal).toBe("content");
    expect(problem.detail).toContain("the result of item share");
  });

  test("a value outside the bounds is refused", () => {
    const problem = refusal(modelOf([SHARE]), { results: { share: { value: 105 } } });
    expect(problem.detail).toContain("the result of item share");
  });
});

describe("a Ranking's result", () => {
  test("an order holding each element once is logged", () => {
    const { outcome } = run(modelOf([RANKING]), { results: { priorities: { order: ORDER } } });
    expect(outcome.ok).toBe(true);
  });

  test("an order missing an element is refused, naming the item and the element", () => {
    const problem = refusal(modelOf([RANKING]), {
      results: { priorities: { order: ["cost", "speed"] } },
    });
    expect(problem.detail).toContain("the result of item priorities");
    expect(problem.detail).toContain("comfort");
  });

  test("an order naming an element the item does not hold is refused", () => {
    const problem = refusal(modelOf([RANKING]), {
      results: { priorities: { order: [...ORDER, "ghost"] } },
    });
    expect(problem.detail).toContain("ghost");
  });
});

describe("a decision outside the three", () => {
  test("is refused with the log unchanged", () => {
    const approval = { type: "approval", id: "verdict", props: {} };
    const problem = refusal(modelOf([approval]), {
      results: { verdict: { decision: "maybe" } },
    });
    expect(problem.detail).toContain("the result of item verdict");
  });
});

describe("an order for an earlier revision", () => {
  const without = (id: string) => ({
    ...RANKING,
    props: {
      items: (RANKING.props as { items: { id: string }[] }).items.filter((it) => it.id !== id),
    },
  });

  // Revision 2 drops `cost`; the user keeps revision 1 ("Keep mine") and answers it.
  const kept = () => {
    const model = modelOf([RANKING]);
    const log = new EventLog();
    const question = model.question("choose");
    if (question === undefined) throw new Error("no question");
    model.revise(question, { text: "Which one?", items: [without("cost")] } as never);
    const choice = checked(
      model,
      [{ type: "edit-choice", itemId: "choose", rev: 2, edit: "ignore", keptRev: 1 }],
      { types: TYPES, log },
    );
    if (!choice.outcome.ok) throw new Error(JSON.stringify(choice.outcome.problem));
    model.noteEntries(log.append(choice.outcome.events));
    return { model, log };
  };

  test("is checked against revision 1, and logged", () => {
    const { model, log } = kept();
    const { outcome } = run(model, { results: { priorities: { order: ORDER } } }, log);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    expect((outcome.events[0] as AnswerEvent).rev).toBe(1);
  });

  test("an order of revision 2's elements fails against revision 1 and the log stays", () => {
    const { model, log } = kept();
    const before = log.latestSeq;
    const { outcome } = run(
      model,
      { results: { priorities: { order: ["speed", "comfort"] } } },
      log,
    );
    expect(outcome.ok).toBe(false);
    expect(log.latestSeq).toBe(before);
  });

  test("the current revision refuses an order that still names the removed element", () => {
    const { model, log } = kept();
    const { outcome } = run(model, { rev: 2, results: { priorities: { order: ORDER } } }, log);
    expect(outcome.ok).toBe(false);
  });
});

describe("a Ranking fetched alone", () => {
  test("holds its latest answer's order as `result`, and the order passes its props", () => {
    const model = modelOf([RANKING]);
    const log = new EventLog();
    const { outcome } = run(model, { results: { priorities: { order: ORDER } } }, log);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    model.noteEntries(log.append(outcome.events));
    const question = model.question("choose");
    if (question === undefined) throw new Error("no question");
    const status = questionStatus(question.mark, log.ofItem("choose"));
    const found = widgetItemValue(
      model,
      "priorities",
      () => status,
      { map: new Map(), source: undefined, kept: outcome.kept },
      TYPES,
    );
    expect(found?.item).toMatchObject({
      type: "ranking",
      id: "priorities",
      questionId: "choose",
      state: "answered",
      result: { order: ORDER },
    });
    if (found === undefined) throw new Error("no item");
    const result = (found.item as unknown as { result: unknown }).result;
    expect(widgetResultProblems(RANKING as never, result, RANKING.props, TYPES)).toEqual([]);
  });
});
