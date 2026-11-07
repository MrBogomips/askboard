// The Ranking's entry (approval-scale-ranking, task 1.5; contract spec: Ranking items, Ranking
// results, Teaching text of the three widgets), composed over the shipped registry with
// `withWidgetTypes`, which gives the same registry before and after the type is registered (design
// decision 10).

import { describe, expect, test } from "bun:test";
import {
  RANKING_FIXTURE_ITEM,
  RANKING_RESULT,
  rankingFetchItemResult,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  RANKING_MAX_ITEMS,
  RANKING_SCHEMA_IDS,
  RANKING_WIDGET,
  widgetRegistryProblems,
} from "../src/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";
import { askAccepted, askProblems, resultProblemsOf } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(RANKING_WIDGET);
const ITEM = RANKING_FIXTURE_ITEM;
const ranking = (items: unknown, id = "priorities") => ({
  type: "ranking",
  id,
  props: { items },
});
const elements = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `e${index}`, label: `Element ${index}` }));
const problems = (items: unknown) => askProblems(TYPES, ranking(items));
const fieldsOf = (items: unknown) => problems(items).map(({ field }) => field);

describe("Ranking items", () => {
  test("a Ranking of three items with distinct IDs passes", () => {
    expect(askProblems(TYPES, ITEM)).toEqual([]);
    expect(askAccepted(TYPES, ITEM)).toBe(true);
    expect(ITEM.props.items.map(({ id }) => id)).toEqual(["speed", "cost", "comfort"]);
  });

  test("a repeated ID fails, naming the item and the element", () => {
    const [problem, ...rest] = problems([
      { id: "speed", label: "Speed" },
      { id: "cost", label: "Cost" },
      { id: "speed", label: "Speed again" },
    ]);
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("priorities");
    expect(problem?.field).toBe("props.items[2].id");
    expect(problem?.message).toContain('item "priorities"');
    expect(problem?.message).toContain('"speed"');
    expect(problem?.message).toContain('element "speed"');
  });

  test("a single item fails, naming items", () => {
    const [problem] = problems([{ id: "speed", label: "Speed" }]);
    expect(problem?.itemId).toBe("priorities");
    expect(problem?.field).toBe("props.items");
    expect(askAccepted(TYPES, ranking([{ id: "speed", label: "Speed" }]))).toBe(false);
  });

  test("2 items pass, 50 items pass and 51 fail", () => {
    expect(RANKING_MAX_ITEMS).toBe(50);
    expect(problems(elements(2))).toEqual([]);
    expect(problems(elements(50))).toEqual([]);
    expect(askAccepted(TYPES, ranking(elements(50)))).toBe(true);
    expect(fieldsOf(elements(51))).toEqual(["props.items"]);
    expect(askAccepted(TYPES, ranking(elements(51)))).toBe(false);
  });

  test("a label of 200 characters passes and of 201 or none fails", () => {
    const one = (label: unknown) => [
      { id: "a", label },
      { id: "b", label: "B" },
    ];
    expect(problems(one("l".repeat(200)))).toEqual([]);
    expect(fieldsOf(one("l".repeat(201)))).toEqual(["props.items[0].label"]);
    expect(fieldsOf(one(""))).toEqual(["props.items[0].label"]);
    expect(fieldsOf([{ id: "a" }, { id: "b", label: "B" }])).toEqual(["props.items[0].label"]);
  });

  test("a description of 500 characters passes and of 501 or none fails", () => {
    const one = (description: unknown) => [
      { id: "a", label: "A", description },
      { id: "b", label: "B" },
    ];
    expect(problems(one("d".repeat(500)))).toEqual([]);
    expect(fieldsOf(one("d".repeat(501)))).toEqual(["props.items[0].description"]);
    expect(fieldsOf(one(""))).toEqual(["props.items[0].description"]);
  });

  test("an ID outside the ID pattern and a field an element does not define fail", () => {
    const base = [{ id: "b", label: "B" }];
    expect(fieldsOf([{ id: "a b", label: "A" }, ...base])).toEqual(["props.items[0].id"]);
    expect(fieldsOf([{ id: "a", label: "A", rank: 1 }, ...base])).toEqual(["props.items[0].rank"]);
    expect(fieldsOf([{ label: "A" }, ...base])).toEqual(["props.items[0].id"]);
  });

  test("props with no items, other fields or another type fail", () => {
    expect(askProblems(TYPES, { type: "ranking", id: "r", props: {} })[0]?.field).toBe(
      "props.items",
    );
    expect(
      askProblems(TYPES, { type: "ranking", id: "r", props: { items: elements(2), sort: 1 } })[0]
        ?.field,
    ).toBe("props.sort");
    expect(askProblems(TYPES, { type: "ranking", id: "r", props: { items: "ab" } })).not.toEqual(
      [],
    );
  });

  test("a check never throws on props it cannot read", () => {
    for (const props of [null, 3, "x", [], { items: null }, { items: [null, 3, {}] }]) {
      expect(() => RANKING_WIDGET.propsProblems(props, "agent")).not.toThrow();
    }
  });
});

describe("Ranking results", () => {
  const check = (result: unknown) => resultProblemsOf(TYPES, ITEM, result);

  test("a result naming each of the three items once, in another order, passes", () => {
    expect(check({ order: ["comfort", "speed", "cost"] })).toEqual([]);
    expect(check(RANKING_RESULT)).toEqual([]);
    expect(RANKING_RESULT.order).toHaveLength(3);
  });

  test("a result that leaves out an element fails, naming the item and the element", () => {
    const problems = check({ order: ["speed", "comfort"] });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.path).toBe("/order");
    expect(problems[0]?.message).toContain("item priorities");
    expect(problems[0]?.message).toContain('element "cost"');
  });

  test("a result that names an element the item does not hold fails, naming it", () => {
    const problems = check({ order: ["speed", "cost", "color"] });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.map(({ message }) => message).join("\n")).toContain('element "color"');
    expect(problems.map(({ message }) => message).join("\n")).toContain('element "comfort"');
  });

  test("a result that names an element twice fails, naming it", () => {
    const problems = check({ order: ["speed", "cost", "speed"] });
    expect(problems.map(({ message }) => message).join("\n")).toContain('element "speed"');
    expect(problems.every(({ path }) => path.startsWith("/order"))).toBe(true);
  });

  test("a result that is not a list of IDs, nothing or an extra field fails by the schema", () => {
    for (const result of [
      {},
      null,
      [],
      "speed",
      { order: [] },
      { order: "speed" },
      { order: [1, 2, 3] },
      { order: ["a b", "cost", "speed"] },
      { order: ["speed", "cost", "comfort"], moved: 1 },
    ]) {
      expect(check(result)).not.toEqual([]);
    }
  });

  test("50 elements in order pass, and the 51st name fails the schema", () => {
    const item = ranking(elements(50));
    const ids = elements(50).map(({ id }) => id);
    expect(resultProblemsOf(TYPES, item, { order: [...ids].reverse() })).toEqual([]);
    expect(resultProblemsOf(TYPES, item, { order: [...ids, "e50"] })).not.toEqual([]);
  });

  test("a result is checked without throwing against props it cannot read", () => {
    for (const props of [null, undefined, {}, { items: 3 }, { items: [null] }]) {
      const item = { type: "ranking", id: "priorities", props };
      expect(() => resultProblemsOf(TYPES, item, { order: ["a", "b"] })).not.toThrow();
    }
  });

  test("a Ranking fetched alone validates with its order, and fails with a Scale's result", () => {
    const ajv = ajvOver(TYPES);
    expect(errorsOf(ajv, SCHEMA_IDS.fetchResult, rankingFetchItemResult)).toEqual([]);
    const item = (rankingFetchItemResult as { item: object }).item;
    const withResult = (result: unknown) => ({
      ...rankingFetchItemResult,
      item: { ...item, result },
    });
    const errors = errorsOf(ajv, SCHEMA_IDS.fetchResult, withResult({ value: 3 }));
    expect(errors.map((error) => error.instancePath)).toContain("/item/result");
  });
});

describe("the Ranking's entry in the registry's own check", () => {
  test("passes over the registry holding it, result-empty included", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    expect(RANKING_WIDGET.props.$id).toBe(RANKING_SCHEMA_IDS.props);
    expect(RANKING_WIDGET.result?.schema.$id).toBe(RANKING_SCHEMA_IDS.result);
    expect(RANKING_WIDGET.edits).toBeUndefined();
    expect(RANKING_WIDGET.derived).toBeUndefined();
  });

  test("its teaching text is within bounds and its example is accepted in an ask", () => {
    const { skill, example } = RANKING_WIDGET;
    expect(skill?.use.length).toBeLessThanOrEqual(200);
    for (const note of skill?.notes ?? []) expect(note.length).toBeLessThanOrEqual(300);
    expect(skill?.notes?.join(" ")).toContain("order");
    expect(askProblems(TYPES, example.item)).toEqual([]);
    expect(askAccepted(TYPES, example.item)).toBe(true);
  });
});
