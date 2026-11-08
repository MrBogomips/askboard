// `boardGraphSource` on a Tree with `pert` (molecules design decision 10; compute spec, modified
// "The board's graph source"): a Tree with `pert` is a WBS-with-PERT source on its own, as the Tree
// a plan names is, and once when it is both; a Tree without `pert` adds nothing on its own. And
// `roundNumber`, the evaluator's own ROUND, which the WBS rounds its answer's derived values with.

import { describe, expect, test } from "bun:test";
import { GANTT_ANSWER_DERIVED } from "@askboard/contract";
import { ganttPlanBoardDocument, uj2ExpandedDerived } from "@askboard/contract/fixtures";
import { createOwnEngine } from "../src/engine/own-engine.ts";
import { checkFormula, isProblem } from "../src/formula/check.ts";
import type { BoardSourceItem } from "../src/index.ts";
import * as compute from "../src/index.ts";
import {
  BOARD_SOURCE_FIXTURES,
  EXPANDED_SOURCE_FIXTURES,
  UJ2_EXPANDED,
  UJ2_EXPANDED_ANSWERED,
} from "./fixtures/board.ts";
import { Tally } from "./fixtures/suite.ts";

const { boardGraphSource, buildGraph, evaluateGraph, roundNumber } = compute;

type Json = Record<string, unknown>;
type Item = BoardSourceItem & { readonly props: Json };

const [TREE, PLAN] = UJ2_EXPANDED as readonly Item[] as readonly [Item, Item];
const [PLAIN_TREE] = ganttPlanBoardDocument.items[0].props.items;

const LEAVES = ["ux", "architecture", "prototype", "portal", "u-1", "billing", "reporting"];

/** The fixture named `name`, as the board source suite runs it. */
const fixture = (name: string) => {
  const found = [...BOARD_SOURCE_FIXTURES, ...EXPANDED_SOURCE_FIXTURES].find(
    (each) => each.name === name,
  );
  if (found === undefined) throw new Error(`no board source fixture ${name}`);
  return found;
};

/** The fixture's values, read from its graph, which holds no warning. */
const tallied = (name: string) => {
  const { items, expected } = fixture(name);
  const graph = buildGraph(boardGraphSource(items));
  const values = evaluateGraph(graph);
  const tally = new Tally();
  tally.values(name, expected, (address) => values.read(address));
  return { graph, values, tally, expected };
};

describe("the board's graph source, on a Tree with pert", () => {
  test("maps the expanded UJ-2 Tree alone onto a WBS source", () => {
    const [source] = boardGraphSource([TREE]).items;
    expect(source).toMatchObject({ kind: "wbs-pert", id: "wbs__tree" });
    expect(boardGraphSource([TREE]).items).toHaveLength(1);
  });

  test("gives every node's and the item's expected effort and spread, with no warning", () => {
    const { graph, values, tally, expected } = tallied("uj2-expanded-wbs");
    expect(graph.warnings).toEqual([]);
    expect(tally.failures).toEqual([]);
    expect(Object.keys(expected)).toHaveLength(18);
    expect(roundNumber(values.read("wbs__tree.expected") as number, 2)).toBe(40.67);
    expect(roundNumber(values.read("wbs__tree.spread") as number, 2)).toBe(3.21);
  });

  test("a Tree without pert whose columns declare the three estimates, alone, gives no item", () => {
    expect((PLAIN_TREE.props.columns ?? []).map(({ field }) => field)).toEqual(
      expect.arrayContaining(["optimistic", "mostLikely", "pessimistic"]),
    );
    expect(boardGraphSource([PLAIN_TREE]).items).toEqual([]);
  });

  test("a Tree with pert that a plan names is mapped once, before its plan", () => {
    const other = { ...PLAN, id: "other__plan" };
    const items = boardGraphSource([TREE, PLAN, other]).items;
    expect(items.map(({ kind, id }) => `${kind} ${id}`)).toEqual([
      "wbs-pert wbs__tree",
      "gantt-plan schedule__plan",
      "gantt-plan other__plan",
    ]);
  });
});

describe("the UJ-2 board's scenarios on the expanded question", () => {
  test("give every value the approved example's data give, with no warning", () => {
    const { graph, tally, expected } = tallied("uj2-expanded");
    expect(graph.warnings).toEqual([]);
    expect(tally.failures).toEqual([]);
    expect(expected["schedule__plan.finishDate"]).toBe("2026-12-11");
  });

  test("after the approved answer's edits, finish on 2026-12-02 with the approved derived values", () => {
    const graph = buildGraph(boardGraphSource(UJ2_EXPANDED_ANSWERED));
    expect(graph.warnings).toEqual([]);
    const values = evaluateGraph(graph);
    const critical = LEAVES.filter(
      (task) => values.read(`schedule__plan.${task}.${GANTT_ANSWER_DERIVED.criticalPath}`) === true,
    );
    expect(critical).toEqual(["ux", "prototype", "portal", "reporting"]);
    const finish: unknown = values.read(`schedule__plan.${GANTT_ANSWER_DERIVED.finish}`);
    expect(finish).toBe(uj2ExpandedDerived["schedule__plan.finish"]);
    for (const [key, value] of Object.entries(uj2ExpandedDerived)) {
      if (!key.startsWith("wbs__tree.")) continue;
      const read: unknown = roundNumber(values.read(key) as number, 2);
      expect({ key, value: read }).toEqual({ key, value });
    }
    expect(tallied("uj2-expanded-answered").tally.failures).toEqual([]);
  });

  // The core spec's "Warnings in reference addressing": `ask-core`'s test maps this warning to
  // `schedule` and `review` (`packages/core/test/addressing.test.ts`).
  test("a predecessor that names no task warns at the plan and at its dependent, naming the plan and the predecessor", () => {
    const tasks = { ...(PLAN.props.tasks as Json), billing: { dependencies: ["review"] } };
    const plan = { ...PLAN, props: { ...PLAN.props, tasks } };
    expect(buildGraph(boardGraphSource([TREE, plan])).warnings).toEqual([
      {
        error: "missing-reference",
        address: "schedule__plan.review",
        detail: "the plan names review, which is no work package of wbs__tree",
      },
      {
        error: "missing-reference",
        address: "schedule__plan.billing.es",
        detail: "reference [schedule__plan.review.ef] names no child review of schedule__plan",
      },
    ]);
  });
});

/** What a `ROUND` formula over an input holding `x` gives, through the engine. */
const roundFormula = (x: number, digits: number): unknown => {
  const checked = checkFormula(`ROUND([x.value],${digits})`);
  if (isProblem(checked)) throw new Error(checked.reason);
  const engine = createOwnEngine();
  engine.load([
    { kind: "input", value: x },
    { kind: "formula", expression: checked.expression, references: [{ list: false, name: 0 }] },
  ]);
  return engine.read(1);
};

describe("roundNumber", () => {
  test.each([
    [29 / 6, 4.83],
    [3.2998, 3.3],
    [3.659, 3.66],
    [2.675, 2.68],
    [1.005, 1.01],
    [-2.5, -2.5],
    [40.666666666666664, 40.67],
  ])("rounds %p to %p at two places, as a ROUND formula does", (x, rounded) => {
    expect(roundNumber(x, 2)).toBe(rounded);
    expect(roundFormula(x, 2)).toBe(rounded);
  });

  test("rounds half away from zero at any place, as ROUND does", () => {
    for (const [x, digits] of [
      [-2.5, 0],
      [1250, -2],
      [0, 400],
      [1e300, 10],
      [0.1 + 0.2, 20],
    ] as const) {
      const rounded: unknown = roundNumber(x, digits);
      expect({ x, digits, rounded }).toEqual({
        x,
        digits,
        rounded: roundFormula(x, digits),
      });
    }
  });

  test("gives NaN where a ROUND formula gives an error", () => {
    expect(roundFormula(1, 400)).toMatchObject({ kind: "value" });
    expect(roundNumber(1, 400)).toBeNaN();
    // At 15 significant digits the largest number is past every finite one.
    expect(roundFormula(Number.MAX_VALUE, 2)).toMatchObject({ kind: "value" });
    expect(roundNumber(Number.MAX_VALUE, 2)).toBeNaN();
  });
});
