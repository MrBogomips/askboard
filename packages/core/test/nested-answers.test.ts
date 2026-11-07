import { describe, expect, test } from "bun:test";
import type { AnswerEvent } from "@askboard/contract";
import {
  ATOM_TYPES,
  ganttPlanBoardDocument,
  ganttPlanChanges,
  ganttPlanDerived,
  ganttPlanEditedValue,
  LATEX_CHANGES,
  LATEX_EDITED_PROPS,
  LATEX_FIXTURE_ITEM,
  LAYOUT_WIDGETS,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { formulaWarnings } from "../src/graph-check.ts";
import { EventLog } from "../src/lifecycle/log.ts";
import { answerAct, checked, type Item, type Json, modelOf } from "./probe-fakes.ts";

// Core spec: Answers of nested items (layouts, design decision 5): ask-core takes an answer's
// values, results and derived values for items inside a question's layouts, at any depth, as for its
// own items, keyed by item ID. A value or result keyed by a layout refuses the answer. The shipped
// `AskCore` holds the shipped registry, so the acts run over `withWidgetTypes` of the atoms and the
// layouts.

const TYPES = withWidgetTypes(...ATOM_TYPES, ...LAYOUT_WIDGETS);
const copy = <T>(value: T): T => structuredClone(value);

const number = (id: string, max = 40): Item => ({
  type: "number-field",
  id,
  props: { label: id, min: 0, max },
});

// A Tabs whose first tab holds a Group of a NumberField `days`, a LaTeX `formula` and a Row, and
// whose second tab holds a Stack of a TextField `owner`.
const arranged = (): Item[] =>
  copy([
    {
      type: "tabs",
      id: "sections",
      props: {
        tabs: [
          {
            id: "effort",
            title: "Effort",
            items: [
              {
                type: "group",
                id: "estimate",
                props: {
                  title: "Estimate",
                  items: [
                    number("days"),
                    LATEX_FIXTURE_ITEM,
                    { type: "row", id: "pair", props: { items: [number("hours")] } },
                  ],
                },
              },
            ],
          },
          {
            id: "who",
            title: "Who",
            items: [
              {
                type: "stack",
                id: "people",
                props: { items: [{ type: "text-field", id: "owner", props: { label: "Owner" } }] },
              },
            ],
          },
        ],
      },
    },
  ]) as Item[];

const run = (fields: Json, list: Item[] = arranged(), log = new EventLog()) => {
  const model = modelOf(list);
  return { model, ...checked(model, [answerAct(fields)], { types: TYPES, log }) };
};

// The refusal of an act: its problem, the log as it was, and nothing kept or to publish.
const refusal = (fields: Json, list?: Item[]) => {
  const { log, outcome } = run(fields, list);
  if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
  expect(log.latestSeq).toBe(0);
  expect(Object.keys(outcome).sort()).toEqual(["index", "ok", "problem"]);
  expect(outcome.problem.refusal).toBe("content");
  return outcome.problem;
};

const accepted = (fields: Json, list?: Item[]) => {
  const { outcome } = run(fields, list);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
  return { event: outcome.events[0] as AnswerEvent, kept: outcome.kept };
};

// An item is found and refused for what it is, never as "no item of the question".
const found = (detail: string, id: string) => {
  expect(detail).toContain(id);
  expect(detail).not.toMatch(/which is no|names no/);
};

describe("a result two layouts deep", () => {
  test("the answer event's results hold the nested IDs, and the answer is valid output", () => {
    const results = { days: 3.5, hours: 12, owner: "Ada" };
    const { event, kept } = accepted({ results });
    expect(event.results).toEqual(results);
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
    expect([...kept.values()][0]?.results).toEqual(results);
  });

  test("a result out of its bounds is refused naming the nested item, appending nothing", () => {
    for (const [id, result] of [
      ["days", 41],
      ["hours", -1],
      ["owner", ""],
    ] as const) {
      found(refusal({ results: { [id]: result } }).detail, id);
    }
  });

  test("a refused nested result beside valid ones keeps none of them", () => {
    refusal({ results: { owner: "Ada", days: 41 } });
  });
});

describe("a value or result keyed by a layout", () => {
  const layouts = ["sections", "estimate", "pair", "people"];
  // A value that is a valid layout of its own type.
  const whole = (id: string): unknown =>
    id === "sections"
      ? { tabs: [{ id: "one", title: "One", items: [number("x")] }] }
      : id === "estimate"
        ? { title: "T", items: [number("x")] }
        : { items: [number("x")] };

  test("a result keyed by each layout is refused, naming it, with nothing appended", () => {
    for (const id of layouts) found(refusal({ results: { [id]: { x: 1 } } }).detail, id);
  });

  test("a value keyed by each layout is refused even when it is a valid layout, nothing appended", () => {
    for (const id of layouts) found(refusal({ values: { [id]: whole(id) } }).detail, id);
  });

  test("a derived key under each layout is refused, naming it, with nothing appended", () => {
    for (const id of layouts) {
      found(refusal({ derived: { [`${id}.finish`]: "2026-01-01" } }).detail, id);
    }
  });

  test("a layout beside a valid nested result keeps the valid one out too", () => {
    refusal({ results: { days: 3, estimate: "x" } });
  });

  test("a key that is no item, nor a layout's prototype name, is refused", () => {
    for (const id of ["nowhere", "constructor", "__proto__"]) {
      refusal({ results: { [id]: 1 } });
    }
  });
});

describe("a nested value", () => {
  test("a corrected nested LaTeX is one set, and the full value is kept under its own ID", () => {
    const { event, kept } = accepted({ values: { formula: LATEX_EDITED_PROPS } });
    expect(event.changes).toEqual(LATEX_CHANGES);
    expect([...kept.values()][0]?.values).toEqual({ formula: LATEX_EDITED_PROPS });
  });

  test("a nested value the type refuses is refused in the question as edited", () => {
    const problem = refusal({ values: { formula: { expression: "x".repeat(2_001) } } });
    found(problem.detail, "formula");
  });

  test("a value for a nested item the question does not hold is refused", () => {
    expect(refusal({ values: { missing: LATEX_EDITED_PROPS } }).detail).toContain("missing");
  });

  test("a nested value equal to the item as sent drops out", () => {
    const { event, kept } = accepted({
      values: { formula: LATEX_FIXTURE_ITEM.props },
      results: { days: 2 },
    });
    expect(event).not.toHaveProperty("changes");
    expect([...kept.values()][0]?.values).toEqual({});
  });
});

describe("a plan and its Tree in two tabs", () => {
  const [question] = ganttPlanBoardDocument.items;
  const [wbs, schedule] = copy(question.props.items) as unknown as [Item, Item];
  const split = (): Item[] => [
    {
      type: "tabs",
      id: "views",
      props: {
        tabs: [
          { id: "breakdown", title: "Breakdown", items: [wbs] },
          { id: "schedule", title: "Schedule", items: [schedule] },
        ],
      },
    },
  ];
  const board = (items: readonly Item[]) => [{ type: "question", id: "plan", props: { items } }];

  test("the send-time graph check builds the plan over the Tree in the other tab", () => {
    expect(formulaWarnings(board(split()), new Map(), TYPES)).toEqual([]);
  });

  test("the answer carries the plan's derived values and its changes", () => {
    const { event } = accepted(
      {
        values: { schedule: copy(ganttPlanEditedValue) },
        derived: copy(ganttPlanDerived),
      },
      split(),
    );
    expect(event.changes).toEqual(ganttPlanChanges);
    expect(event.derived).toEqual(ganttPlanDerived);
  });

  test("a derived key naming no field of the nested plan is refused, appending nothing", () => {
    found(refusal({ derived: { "schedule.nothing": 1 } }, split()).detail, "schedule");
  });
});

describe("a formula warning for a nested item", () => {
  test("names the nested Gantt, found at depth two", () => {
    const broken = {
      type: "gantt",
      id: "plan",
      props: { start: "2026-01-05", tasks: [{ id: "a", duration: 1, dependencies: ["zz"] }] },
    };
    const group = { type: "group", id: "box", props: { title: "Box", items: [broken] } };
    const stack = { type: "stack", id: "all", props: { items: [group] } };
    const warnings = formulaWarnings(
      [{ type: "question", id: "q", props: { text: "Plan", items: [stack] } }],
      new Map(),
      TYPES,
    );
    expect(warnings[0]).toMatchObject({ code: "formula", itemId: "plan" });
  });

  test("a layout alone, or a layout of atoms, builds no graph and warns nothing", () => {
    expect(formulaWarnings(board(arranged()), new Map(), TYPES)).toEqual([]);
  });
});

const board = (items: readonly Item[]) => [{ type: "question", id: "q", props: { items } }];
