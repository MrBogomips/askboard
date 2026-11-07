// A result against the props it would be answered for (approval-scale-ranking, pre-PR reviews,
// spec S-1 = security X-1; view-and-widgets: A draft holds only results its items accept): the
// one predicate the board page reads to hold or seed a result, which runs the type's own checks
// with no schema and no Ajv, as `ask-core` runs them on the answer.

import { describe, expect, test } from "bun:test";
import { WIDGET_TYPES, widgetResultFits, widgetResultProblems } from "../src/index.ts";

const ranking = (...ids: string[]) => ({
  type: "ranking",
  id: "priorities",
  props: { items: ids.map((id) => ({ id, label: id })) },
});
const scale = (props: object) => ({ type: "scale", id: "share", props });
const approval = { type: "approval", id: "verdict", props: {} };

describe("widgetResultFits", () => {
  test("a Ranking's order that holds each element once fits, in any order", () => {
    const item = ranking("speed", "cost", "comfort");
    expect(widgetResultFits(item, { order: ["cost", "speed", "comfort"] }, item.props)).toBe(true);
  });

  test("a Ranking's order fails when the props gained or lost an element", () => {
    const gained = ranking("speed", "cost", "comfort", "risk");
    const lost = ranking("speed", "comfort");
    const order = { order: ["cost", "speed", "comfort"] };
    expect(widgetResultFits(gained, order, gained.props)).toBe(false);
    expect(widgetResultFits(lost, order, lost.props)).toBe(false);
  });

  test("a Scale value fits while on the grid and fails above max, off the grid or for a range", () => {
    const grid = scale({ min: 0, max: 100, step: 5 });
    expect(widgetResultFits(grid, { value: 35 }, grid.props)).toBe(true);
    const lowered = scale({ min: 0, max: 50, step: 5 });
    expect(widgetResultFits(lowered, { value: 100 }, lowered.props)).toBe(false);
    const coarse = scale({ min: 0, max: 100, step: 10 });
    expect(widgetResultFits(coarse, { value: 35 }, coarse.props)).toBe(false);
    const range = scale({ min: 0, max: 100, step: 5, range: true });
    expect(widgetResultFits(range, { value: 35 }, range.props)).toBe(false);
    expect(widgetResultFits(range, { low: 5, high: 35 }, range.props)).toBe(true);
  });

  test("an Approval's decision fits, as its type has no check against props", () => {
    expect(widgetResultFits(approval, { decision: "approve" }, approval.props)).toBe(true);
  });

  test("an Approval's result of another shape, or with a decision it lacks, fits nothing", () => {
    for (const result of [
      { value: 50 },
      { order: ["a", "b"] },
      { low: 1, high: 2 },
      { decision: "maybe" },
      { decision: "approve", extra: 1 },
      {},
      [],
      null,
      "approve",
    ]) {
      expect(widgetResultFits(approval, result, approval.props)).toBe(false);
    }
  });

  test("a Scale's result of another shape, or of both forms, or off the schema's numbers, fits nothing", () => {
    const slider = scale({ min: 0, max: 100, step: 5 });
    const range = scale({ min: 0, max: 100, step: 5, range: true });
    for (const result of [
      { order: ["a", "b"] },
      { decision: "approve" },
      { value: "5" },
      { value: 5, extra: 1 },
      { value: 5, low: 5, high: 10 },
      { value: Number.NaN },
      { value: 5000000000 },
      {},
      [],
      null,
    ]) {
      expect(widgetResultFits(slider, result, slider.props)).toBe(false);
    }
    for (const result of [
      { order: ["a", "b"] },
      { decision: "approve" },
      { low: 5 },
      { high: 5 },
    ]) {
      expect(widgetResultFits(range, result, range.props)).toBe(false);
    }
  });

  test("a Ranking's result of another shape, or an order off the schema's, fits nothing", () => {
    const item = ranking("speed", "comfort");
    for (const result of [
      { value: 50 },
      { decision: "approve" },
      { order: "speed" },
      { order: [1, 2] },
      { order: ["speed"] },
      { order: ["speed", "comfort"], extra: 1 },
      {},
      [],
      null,
    ]) {
      expect(widgetResultFits(item, result, item.props)).toBe(false);
    }
  });

  test("a type that gives a result and no shape check fits no result, never any", () => {
    const shapeless = WIDGET_TYPES.map((entry) =>
      entry.type === "approval" && entry.result !== undefined
        ? { ...entry, result: { schema: entry.result.schema } }
        : entry,
    );
    expect(widgetResultFits(approval, { decision: "approve" }, approval.props, shapeless)).toBe(
      false,
    );
  });

  test("every registered type that gives a result has a shape check", () => {
    for (const entry of WIDGET_TYPES.filter(({ result }) => result !== undefined)) {
      expect(entry.result?.shape, entry.type).toBeFunction();
    }
  });

  test("a type the registry lacks, or one that gives no result, fits nothing", () => {
    expect(widgetResultFits({ type: "verdict", id: "v" }, { decision: "approve" }, {})).toBe(false);
    expect(widgetResultFits({ type: "tree", id: "wbs" }, { order: [] }, {})).toBe(false);
  });

  test("it agrees with widgetResultProblems on every result the schema accepts", () => {
    const item = ranking("speed", "comfort");
    for (const result of [
      { order: ["speed", "comfort"] },
      { order: ["cost", "speed", "comfort"] },
    ]) {
      expect(widgetResultFits(item, result, item.props)).toBe(
        widgetResultProblems(item, result, item.props).length === 0,
      );
    }
  });
});

describe("widgetResultFits and widgetResultProblems over every type and every shape (security X-1, 7b.6)", () => {
  // The review's probes: a result put to an item of another type, as when a revision turns a Scale
  // into an Approval under the same ID, and the results of each type put to each.
  const items = [
    approval,
    scale({ min: 0, max: 100, step: 5 }),
    scale({ min: 0, max: 100, step: 5, range: true }),
    ranking("speed", "comfort"),
  ];
  const results = [
    { decision: "approve" },
    { decision: "reject" },
    { value: 50 },
    { value: "5" },
    { low: 5, high: 50 },
    { order: ["speed", "comfort"] },
    { order: ["comfort", "speed"] },
    { order: ["speed"] },
    {},
  ];

  test("they agree on every pair, and both answers occur", () => {
    const seen = new Set<boolean>();
    for (const item of items) {
      for (const result of results) {
        const fits = widgetResultFits(item, result, item.props);
        expect(fits, `${item.type} ${JSON.stringify(item.props)} ${JSON.stringify(result)}`).toBe(
          widgetResultProblems(item, result, item.props).length === 0,
        );
        seen.add(fits);
      }
    }
    expect(seen.size).toBe(2);
  });
});
