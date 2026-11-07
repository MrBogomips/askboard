import { describe, expect, test } from "bun:test";
import { type AnswerEvent, CHART_WIDGET, widgetResultProblems } from "@askboard/contract";
import { CHART_FIXTURE_ITEMS, CHART_RESULTS, withWidgetTypes } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { EventLog } from "../src/lifecycle/log.ts";
import { questionStatus } from "../src/lifecycle/states.ts";
import { widgetItemValue } from "../src/lifecycle/widget-fetch.ts";
import { answerAct, checked, type Item, modelOf } from "./probe-fakes.ts";

// Core spec: Chart results through ask-core (chart-widget, design decision 2): ask-core checks a
// Chart's result against the item's props in the revision the answer names, through the registry
// alone (no code of core names the type), and a refusal appends, keeps and publishes nothing. Every
// test passes the registry through `withWidgetTypes`, which gives the same registry before and
// after the Chart is registered.

const TYPES = withWidgetTypes(CHART_WIDGET);
const [BAR, , PIE] = CHART_FIXTURE_ITEMS as unknown as readonly [Item, Item, Item];

type Model = ReturnType<typeof modelOf>;

const run = (model: Model, fields: Record<string, unknown>, log?: EventLog) =>
  checked(model, [answerAct(fields)], { types: TYPES, ...(log === undefined ? {} : { log }) });

// A refusal: the log unchanged, and an outcome carrying nothing but the problem (an accepted
// outcome alone carries the events to publish and the content to keep).
const refusal = (model: Model, fields: Record<string, unknown>, log?: EventLog) => {
  const before = log?.latestSeq ?? 0;
  const result = run(model, fields, log);
  if (result.outcome.ok) throw new Error(`accepted: ${JSON.stringify(result.outcome.events)}`);
  expect(result.log.latestSeq).toBe(before);
  expect(Object.keys(result.outcome).sort()).toEqual(["index", "ok", "problem"]);
  return result.outcome.problem;
};

const barProps = BAR.props as {
  categories: { id: string; label: string }[];
  series: { id: string; label: string; values: (number | null)[] }[];
};

// The bar's props with a fourth category `q4`, and a revision of it without `fix-c`.
const withoutC = (): Item => ({
  ...BAR,
  props: {
    ...barProps,
    categories: barProps.categories.filter(({ id }) => id !== "fix-c"),
    series: barProps.series.map((one) => ({ ...one, values: one.values.slice(0, 2) })),
  },
});

describe("a Chart's result", () => {
  test("two points are logged under `results`, kept, and valid in the output format", () => {
    const { outcome } = run(modelOf([BAR]), { results: { failures: CHART_RESULTS.bar } });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const [event] = outcome.events as AnswerEvent[];
    expect(event?.results).toEqual({ failures: CHART_RESULTS.bar });
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
    expect([...outcome.kept.values()][0]?.results).toEqual({ failures: CHART_RESULTS.bar });
  });

  test("a pie's one slice is logged", () => {
    const { outcome } = run(modelOf([PIE]), { results: { share: CHART_RESULTS.pie } });
    expect(outcome.ok).toBe(true);
  });
});

describe("a point the revision does not hold", () => {
  test("a category the item lacks is refused, naming the item and the point", () => {
    const problem = refusal(modelOf([BAR]), {
      results: { failures: { points: [{ series: "fails", category: "fix-z" }] } },
    });
    expect(problem.refusal).toBe("content");
    expect(problem.detail).toContain("the result of item failures");
    expect(problem.detail).toContain('category "fix-z"');
  });

  test("a series the item lacks is refused", () => {
    const problem = refusal(modelOf([BAR]), {
      results: { failures: { points: [{ series: "ghost", category: "fix-a" }] } },
    });
    expect(problem.detail).toContain('series "ghost"');
  });

  test("a point with no value (null) is refused", () => {
    const problem = refusal(modelOf([BAR]), {
      results: { failures: { points: [{ series: "reruns", category: "fix-c" }] } },
    });
    expect(problem.detail).toContain("has no value");
  });

  test("a point named twice is refused", () => {
    const point = { series: "fails", category: "fix-a" };
    const problem = refusal(modelOf([BAR]), { results: { failures: { points: [point, point] } } });
    expect(problem.detail).toContain("named twice");
  });

  test("the names every object inherits are no points", () => {
    for (const name of ["__proto__", "constructor", "toString"]) {
      const problem = refusal(modelOf([BAR]), {
        results: { failures: { points: [{ series: "fails", category: name }] } },
      });
      expect(problem.detail).toContain("which the chart does not hold");
    }
  });

  test("a result for an item the question does not hold is refused", () => {
    const problem = refusal(modelOf([BAR]), { results: { elsewhere: CHART_RESULTS.bar } });
    expect(problem.detail).toContain('results name "elsewhere"');
  });

  test("a result of another shape is refused by the schema", () => {
    for (const result of [{ points: [{ series: "fails" }] }, { value: 3 }, { points: "all" }]) {
      const problem = refusal(modelOf([BAR]), { results: { failures: result } });
      expect(problem.detail).toContain("the result of item failures");
    }
  });

  test("an empty result is refused as holding nothing", () => {
    const problem = refusal(modelOf([BAR]), { results: { failures: { points: [] } } });
    expect(problem.detail).toContain("holds nothing");
  });
});

describe("highlights one and none", () => {
  const one = (highlights: string): Item => ({
    ...BAR,
    props: { ...barProps, highlights },
  });

  test("two points on `one` are refused, one point is logged", () => {
    const problem = refusal(modelOf([one("one")]), { results: { failures: CHART_RESULTS.bar } });
    expect(problem.detail).toContain("takes one point");
    const { outcome } = run(modelOf([one("one")]), {
      results: { failures: { points: [CHART_RESULTS.bar.points[0]] } },
    });
    expect(outcome.ok).toBe(true);
  });

  test("any result on `none` is refused, saying the chart takes no highlight", () => {
    const problem = refusal(modelOf([one("none")]), { results: { failures: CHART_RESULTS.bar } });
    expect(problem.detail).toContain("takes no highlight");
  });

  test("a Chart alone on `none` cannot answer: no result, so the answer is empty and refused", () => {
    const problem = refusal(modelOf([one("none")]), { note: "Looks right to me." });
    expect(problem.detail).toContain("gives no result");
    expect(problem.detail).toContain("Chart");
  });
});

describe("a refused result keeps nothing", () => {
  test("no events, no kept content and a log that did not move", () => {
    const { log, outcome } = run(modelOf([BAR]), {
      values: {},
      results: { failures: { points: [{ series: "fails", category: "fix-z" }] } },
    });
    expect(outcome.ok).toBe(false);
    expect("events" in outcome).toBe(false);
    expect("kept" in outcome).toBe(false);
    expect(log.latestSeq).toBe(0);
  });

  test("a refusal after an accepted answer leaves that answer alone", () => {
    const model = modelOf([BAR]);
    const log = new EventLog();
    const first = run(model, { results: { failures: CHART_RESULTS.bar } }, log);
    if (!first.outcome.ok) throw new Error(JSON.stringify(first.outcome.problem));
    model.noteEntries(log.append(first.outcome.events));
    const before = log.latestSeq;
    refusal(
      model,
      { results: { failures: { points: [{ series: "ghost", category: "x" }] } } },
      log,
    );
    expect(log.latestSeq).toBe(before);
    expect(log.ofItem("choose")).toHaveLength(1);
  });
});

describe("a decline", () => {
  test("a decline with a note carries no result and logs nothing as an answer", () => {
    const { log, outcome } = checked(
      modelOf([BAR]),
      [{ type: "decline", itemId: "choose", rev: 1, when: answerAct({}).when, note: "No." }],
      { types: TYPES },
    );
    expect(outcome.ok).toBe(true);
    expect(log.latestSeq).toBe(0);
  });

  test("a decline carrying a Chart's result is refused", () => {
    const { outcome } = checked(
      modelOf([BAR]),
      [
        {
          type: "decline",
          itemId: "choose",
          rev: 1,
          when: answerAct({}).when,
          results: { failures: CHART_RESULTS.bar },
        },
      ],
      { types: TYPES },
    );
    expect(outcome.ok).toBe(false);
  });
});

describe("a point removed by the agent", () => {
  // Revision 2 drops `fix-c` (and its values); the user keeps revision 1 ("Keep mine").
  const revised = () => {
    const model = modelOf([BAR]);
    const log = new EventLog();
    const question = model.question("choose");
    if (question === undefined) throw new Error("no question");
    model.revise(question, { text: "Which one?", items: [withoutC()] } as never);
    return { model, log };
  };
  const keepMine = (model: Model, log: EventLog) => {
    const choice = checked(
      model,
      [{ type: "edit-choice", itemId: "choose", rev: 2, edit: "ignore", keptRev: 1 }],
      { types: TYPES, log },
    );
    if (!choice.outcome.ok) throw new Error(JSON.stringify(choice.outcome.problem));
    model.noteEntries(log.append(choice.outcome.events));
  };
  const inC = { results: { failures: { points: [{ series: "fails", category: "fix-c" }] } } };

  test("an answer naming revision 2 with a point in the removed category is refused", () => {
    const { model, log } = revised();
    const problem = refusal(model, { rev: 2, ...inC }, log);
    expect(problem.detail).toContain("the result of item failures");
    expect(problem.detail).toContain('category "fix-c"');
  });

  test("an answer naming revision 1, after Keep mine, is logged against revision 1", () => {
    const { model, log } = revised();
    keepMine(model, log);
    const { outcome } = run(model, inC, log);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    expect((outcome.events[0] as AnswerEvent).rev).toBe(1);
  });

  test("revision 1's points are refused against revision 2 even after Keep mine", () => {
    const { model, log } = revised();
    keepMine(model, log);
    const before = log.latestSeq;
    const { outcome } = run(model, { rev: 2, ...inC }, log);
    expect(outcome.ok).toBe(false);
    expect(log.latestSeq).toBe(before);
  });
});

describe("a Chart fetched alone", () => {
  test("holds its latest answer's points as `result`, and they pass its props", () => {
    const model = modelOf([BAR]);
    const log = new EventLog();
    const { outcome } = run(model, { results: { failures: CHART_RESULTS.bar } }, log);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    model.noteEntries(log.append(outcome.events));
    const question = model.question("choose");
    if (question === undefined) throw new Error("no question");
    const status = questionStatus(question.mark, log.ofItem("choose"));
    const found = widgetItemValue(
      model,
      "failures",
      () => status,
      { map: new Map(), source: undefined, kept: outcome.kept },
      TYPES,
    );
    expect(found?.item).toMatchObject({
      type: "chart",
      id: "failures",
      questionId: "choose",
      state: "answered",
      result: CHART_RESULTS.bar,
    });
    if (found === undefined) throw new Error("no item");
    const result = (found.item as unknown as { result: unknown }).result;
    expect(widgetResultProblems(BAR as never, result, BAR.props, TYPES)).toEqual([]);
  });
});
