// A result against the props it would be answered for (approval-scale-ranking, pre-PR reviews,
// spec S-1 = security X-1; view-and-widgets: A draft holds only results its items accept): the
// one predicate the board page reads to hold or seed a result, which runs the type's own checks
// with no schema and no Ajv, as `ask-core` runs them on the answer.

import { describe, expect, test } from "bun:test";
import { widgetResultFits, widgetResultProblems } from "../src/index.ts";

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
