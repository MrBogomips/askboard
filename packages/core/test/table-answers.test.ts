import { describe, expect, test } from "bun:test";
import {
  type AnswerEvent,
  FETCH_PAGE_MAX_CHARS,
  type LifecycleAskInput,
  TABLE_WIDGET,
  type WidgetType,
} from "@askboard/contract";
import {
  LAYOUT_WIDGETS,
  TABLE_FIXTURE_ITEM,
  TABLE_TYPES,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { EventLog } from "../src/lifecycle/log.ts";
import { BoardModel } from "../src/lifecycle/model.ts";
import { questionStatus } from "../src/lifecycle/states.ts";
import { widgetItemValue } from "../src/lifecycle/widget-fetch.ts";
import { answerAct, checked, type Item, type Json, modelOf } from "./probe-fakes.ts";

// Core spec: Table answers through ask-core (table-widget, design decisions 6 and 7): ask-core takes
// a Table's edited value through the registry alone, with no code of its own (no product code in
// core names the type), computes its changes with the rows' shape and refuses what the contract's
// cell check refuses, appending, keeping and publishing nothing. The shipped `AskCore` holds the
// shipped registry, so the acts run over `withWidgetTypes(...TABLE_TYPES)`.

const TYPES = withWidgetTypes(...TABLE_TYPES, ...LAYOUT_WIDGETS);
const copy = <T>(value: T): T => structuredClone(value);
const TABLE = TABLE_FIXTURE_ITEM as unknown as Item;
type Props = { rows: Json[]; columns: Json[]; label: string };
const sent = TABLE_FIXTURE_ITEM.props as unknown as Props;

// The Table of roles as the user left it, with `change` applied to its rows.
const edited = (change: (rows: Json[]) => Json[]): Props => ({
  ...copy(sent),
  rows: change(copy(sent.rows)),
});
const lowered = (): Props =>
  edited((rows) => rows.map((row) => (row.id === "pm" ? { ...row, rate: "960.00" } : row)));

const run = (
  fields: Json,
  list: readonly Item[] = [TABLE],
  options: { log?: EventLog; types?: readonly WidgetType[] } = {},
) => {
  const model = modelOf(copy(list) as Item[]);
  const types = options.types ?? TYPES;
  return {
    model,
    ...checked(model, [answerAct(fields)], {
      types,
      ...(options.log === undefined ? {} : { log: options.log }),
    }),
  };
};

const accepted = (fields: Json, list?: readonly Item[]) => {
  const result = run(fields, list);
  if (!result.outcome.ok) throw new Error(JSON.stringify(result.outcome.problem));
  return { ...result, outcome: result.outcome, event: result.outcome.events[0] as AnswerEvent };
};

// The refusal of an act: its problem, the log as it was, and nothing kept or to publish.
const refusal = (fields: Json, list?: readonly Item[], types?: readonly WidgetType[]) => {
  const { log, outcome } = run(fields, list, types === undefined ? {} : { types });
  if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
  expect(log.latestSeq).toBe(0);
  expect(Object.keys(outcome).sort()).toEqual(["index", "ok", "problem"]);
  expect(outcome.problem.refusal).toBe("content");
  return outcome.problem;
};

// What the board gives for the lowered rate: the formula cell of `pm` and the two totals.
const DERIVED = { "costs.pm.amount": 17280, "costs.amount": 69120, "costs.days": 90 };

describe("a lowered rate answered", () => {
  test("the answer's change is one set of costs.pm.rate and its derived values are the board's", () => {
    const { event, outcome } = accepted({ values: { costs: lowered() }, derived: DERIVED });
    expect(event.changes).toEqual([{ op: "set", target: "costs.pm.rate", value: "960.00" }]);
    expect(event.derived).toEqual(DERIVED);
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
    expect([...outcome.kept.values()][0]?.values).toEqual({ costs: lowered() });
  });

  test("fetch of costs returns the edited rows", () => {
    const { model, log, outcome } = accepted({ values: { costs: lowered() }, derived: DERIVED });
    model.noteEntries(log.append(outcome.events));
    const question = model.questions()[0];
    if (question === undefined) throw new Error("no question");
    const status = questionStatus(question.mark, log.ofItem(question.id));
    const found = widgetItemValue(
      model,
      "costs",
      () => status,
      { map: new Map(), source: undefined, kept: outcome.kept },
      TYPES,
    );
    const item = found?.item as unknown as { props: Props } | undefined;
    expect(item?.props.rows).toEqual(lowered().rows);
    expect(item?.props.rows[0]?.rate).toBe("960.00");
  });

  test("a row added by the user is one add, a row deleted one remove", () => {
    const added = accepted({
      values: { costs: edited((rows) => [...rows, { id: "u-1", role: "Tester", days: 10 }]) },
    });
    expect(added.event.changes).toEqual([
      expect.objectContaining({ op: "add", target: "costs.u-1" }),
    ]);
    const removed = accepted({ values: { costs: edited((rows) => rows.slice(0, 1)) } });
    expect(removed.event.changes).toEqual([{ op: "remove", target: "costs.dev" }]);
  });

  test("costs.u-1.amount is accepted as a derived address when u-1 is in the edited value", () => {
    const values = {
      costs: edited((rows) => [...rows, { id: "u-1", role: "Tester", days: 10, rate: "600.00" }]),
    };
    const { event } = accepted({ values, derived: { "costs.u-1.amount": 6000 } });
    expect(event.derived).toEqual({ "costs.u-1.amount": 6000 });
  });

  test("costs.u-1.amount is refused when the answer holds no row u-1", () => {
    const problem = refusal({ derived: { "costs.u-1.amount": 6000 } });
    expect(problem.detail).toContain("costs.u-1.amount");
  });
});

describe("a Table answered inside layouts", () => {
  const nested = (): Item[] =>
    copy([
      {
        type: "tabs",
        id: "sections",
        props: {
          tabs: [
            {
              id: "money",
              title: "Money",
              items: [{ type: "group", id: "budget", props: { title: "Budget", items: [TABLE] } }],
            },
          ],
        },
      },
    ]) as Item[];

  test("the change and the derived values are those of the Table at the top level", () => {
    const { event } = accepted({ values: { costs: lowered() }, derived: DERIVED }, nested());
    expect(event.changes).toEqual([{ op: "set", target: "costs.pm.rate", value: "960.00" }]);
    expect(event.derived).toEqual(DERIVED);
  });

  test("a cell out of its bounds is refused as at the top level, nothing appended", () => {
    const value = edited((rows) => rows.map((row) => ({ ...row, days: -1 })));
    expect(refusal({ values: { costs: value } }, nested()).detail).toContain('"costs"');
  });
});

describe("a cell out of bounds", () => {
  test("days -1 under a min of 0 is refused naming the item, the row and days; nothing appended", () => {
    const value = edited((rows) =>
      rows.map((row) => (row.id === "dev" ? { ...row, days: -1 } : row)),
    );
    const problem = refusal({ values: { costs: value } });
    expect(problem.detail).toContain('"costs"');
    expect(problem.detail).toContain("dev");
    expect(problem.detail).toContain("days");
  });

  test("each kind of cell fault is refused with the log unchanged", () => {
    const faults: [string, Json][] = [
      ["a text for a number", { days: "ten" }],
      ["a money cell with the wrong decimals", { rate: "960.001" }],
      ["a money cell that is a number", { rate: 960 }],
      ["a text past its limit", { role: "x".repeat(501) }],
      ["a key that is no column", { colour: "red" }],
    ];
    for (const [, cells] of faults) {
      const value = edited((rows) =>
        rows.map((row) => (row.id === "pm" ? { ...row, ...cells } : row)),
      );
      expect(refusal({ values: { costs: value } }).detail).toContain('"costs"');
    }
  });

  test("a refusal beside a valid act keeps none of the answer's other parts", () => {
    const value = edited((rows) => rows.map((row) => ({ ...row, days: -1 })));
    refusal({ values: { costs: value }, derived: DERIVED, note: "lower rate" });
  });
});

describe("columns changed", () => {
  test("a value that drops the rate column is refused naming the item", () => {
    const value = {
      ...copy(sent),
      columns: sent.columns.filter((column) => column.field !== "rate"),
    };
    const problem = refusal({ values: { costs: value } });
    expect(problem.detail).toContain('"costs"');
  });

  test("a value with another label, a column's bound or a reordered row is refused", () => {
    const values = [
      { ...copy(sent), label: "Other" },
      {
        ...copy(sent),
        columns: sent.columns.map((column) =>
          column.field === "days" ? { ...column, min: -5 } : column,
        ),
      },
      { ...copy(sent), rows: copy(sent.rows).reverse() },
    ];
    for (const value of values) {
      expect(refusal({ values: { costs: value } }).detail).toMatch(/costs/);
    }
  });
});

describe("a formula column's field", () => {
  // Review S-1: `costs.pm.amount` is a computed cell; the changes schema cannot see columns, so the
  // rows' check on the edited value refuses it, through ask-core, with nothing appended.
  test("a row holding amount in the edited value is refused, nothing appended or published", () => {
    const value = edited((rows) =>
      rows.map((row) => (row.id === "pm" ? { ...row, amount: "1.00" } : row)),
    );
    const problem = refusal({ values: { costs: value } });
    expect(problem.detail).toContain('"costs"');
    expect(problem.detail).toContain("amount");
  });

  test("a derived key naming a field the Table does not declare is refused", () => {
    for (const key of ["costs.nothing", "costs.pm.rate", "costs.pm.nothing", "costs.pm.amount.x"]) {
      expect(refusal({ derived: { [key]: 1 } }).detail).toContain(key);
    }
  });
});

describe("an untouched Table beside a choice", () => {
  test("the answer holds no change of costs and its derived values hold the Table's totals", () => {
    const totals = { "costs.amount": 70560, "costs.days": 90 };
    const model = BoardModel.of([
      {
        type: "question",
        id: "choose",
        props: {
          text: "Which scope?",
          options: [{ label: "Small" }, { label: "Large" }],
          items: [copy(TABLE)],
        },
      },
    ] as unknown as LifecycleAskInput["items"]);
    const act = { ...answerAct({ choice: ["Small"], derived: totals }, "choose") };
    const { outcome } = checked(model, [act], { types: TYPES });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const event = outcome.events[0] as AnswerEvent;
    expect(event.choice).toEqual(["Small"]);
    expect(event).not.toHaveProperty("changes");
    expect(event.derived).toEqual(totals);
  });
});

describe("prototype names in rows and cells", () => {
  const named = (id: string) => ({ ...copy(TABLE), id });
  test("rows __proto__ and constructor are answered as any other rows", () => {
    const table = {
      ...copy(TABLE),
      props: {
        ...copy(sent),
        rows: [
          { id: "__proto__", role: "A", days: 1, rate: "1.00" },
          { id: "constructor", role: "B", days: 2, rate: "2.00" },
        ],
      },
    } as Item;
    const props = table.props as Props;
    const value = {
      ...props,
      rows: props.rows.map((row) => (row.id === "constructor" ? { ...row, days: 3 } : row)),
    };
    const { event } = accepted({ values: { costs: value } }, [table]);
    expect(event.changes).toEqual([{ op: "set", target: "costs.constructor.days", value: 3 }]);
  });

  test("an item named constructor keeps its value as data", () => {
    const item = named("constructor");
    const { event } = accepted({ values: { constructor: lowered() } }, [item]);
    expect(event.changes).toEqual([{ op: "set", target: "constructor.pm.rate", value: "960.00" }]);
  });
});

describe("a Table at its bounds answered", () => {
  const long = "😀".repeat(500);
  const big = (): Item => {
    const rows = Array.from({ length: 200 }, (_, at) => ({ id: `r${at}`, role: "x", days: 1 }));
    return {
      type: "table",
      id: "big",
      props: {
        label: "Big",
        columns: [
          { field: "role", label: "Role", type: "text" },
          { field: "days", label: "Days", type: "number" },
        ],
        rows,
      },
    };
  };

  test("200 changed rows of 500-character texts are logged tooLarge, and fetch holds them all", () => {
    const table = big();
    const props = table.props as Props;
    const value = { ...props, rows: props.rows.map((row) => ({ ...row, role: long })) };
    const { event, outcome, model, log } = accepted({ values: { big: value } }, [table]);
    expect(event.tooLarge).toBe(true);
    expect(event).not.toHaveProperty("changes");
    expect(event).not.toHaveProperty("derived");
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
    model.noteEntries(log.append(outcome.events));
    const question = model.questions()[0];
    if (question === undefined) throw new Error("no question");
    const status = questionStatus(question.mark, log.ofItem(question.id));
    const found = widgetItemValue(
      model,
      "big",
      () => status,
      { map: new Map(), source: undefined, kept: outcome.kept },
      TYPES,
    );
    const item = found?.item as unknown as { props: Props } | undefined;
    expect(item?.props.rows).toHaveLength(200);
    expect(item?.props.rows.every((row) => row.role === long)).toBe(true);
    // More than one page of `fetch`, so the agent reads it in pages.
    expect(JSON.stringify(item).length).toBeGreaterThan(FETCH_PAGE_MAX_CHARS);
  });

  test("a 201st row is refused, nothing appended", () => {
    const table = big();
    const props = table.props as Props;
    const value = { ...props, rows: [...props.rows, { id: "u-1", role: "x", days: 1 }] };
    expect(refusal({ values: { big: value } }, [table]).detail).toContain('"big"');
  });
});

describe("the Table's own check is what refuses", () => {
  // The refusal tests above must fail when the Table's `propsProblems` returns none.
  const deaf: WidgetType = { ...TABLE_WIDGET, propsProblems: () => [] };
  const DEAF_TYPES = withWidgetTypes(deaf);

  test("with the check replaced by one that finds nothing, a cell out of bounds is accepted", () => {
    const value = edited((rows) => rows.map((row) => ({ ...row, days: -1 })));
    const { outcome } = run({ values: { costs: value } }, [TABLE], { types: DEAF_TYPES });
    expect(outcome.ok).toBe(true);
    // And it is refused through the real entry.
    refusal({ values: { costs: value } });
  });

  test("the same holds for a formula field in a row", () => {
    const withAmount = edited((rows) => rows.map((row) => ({ ...row, amount: "1.00" })));
    expect(run({ values: { costs: withAmount } }, [TABLE], { types: DEAF_TYPES }).outcome.ok).toBe(
      true,
    );
    refusal({ values: { costs: withAmount } });
  });
});

describe("an agent revision, then Keep mine", () => {
  // Revision 2 adds a row; the user keeps revision 1 ("Keep mine") and answers it.
  const revised = () => {
    const model = modelOf([copy(TABLE)]);
    const log = new EventLog();
    const question = model.question("choose");
    if (question === undefined) throw new Error("no question");
    const revisedTable = {
      ...copy(TABLE),
      props: {
        ...copy(sent),
        rows: [...copy(sent.rows), { id: "qa", role: "QA", days: 5, rate: "500.00" }],
      },
    };
    model.revise(question, { text: "Which one?", items: [revisedTable] } as never);
    return { model, log };
  };
  const keepMine = (model: BoardModel, log: EventLog) => {
    const choice = checked(
      model,
      [{ type: "edit-choice", itemId: "choose", rev: 2, edit: "ignore", keptRev: 1 }],
      { types: TYPES, log },
    );
    if (!choice.outcome.ok) throw new Error(JSON.stringify(choice.outcome.problem));
    model.noteEntries(log.append(choice.outcome.events));
  };

  test("an answer naming revision 1 is logged against revision 1, its changes against revision 1's rows", () => {
    const { model, log } = revised();
    keepMine(model, log);
    const { outcome } = checked(model, [answerAct({ values: { costs: lowered() } })], {
      types: TYPES,
      log,
    });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const event = outcome.events[0] as AnswerEvent;
    expect(event.rev).toBe(1);
    expect(event.changes).toEqual([{ op: "set", target: "costs.pm.rate", value: "960.00" }]);
  });

  test("a value answered against revision 2 has its changes computed against revision 2's rows", () => {
    const { model, log } = revised();
    keepMine(model, log);
    const { outcome } = checked(
      model,
      [{ ...answerAct({ values: { costs: lowered() } }), rev: 2 }],
      { types: TYPES, log },
    );
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    // Revision 2 holds the row `qa`, which the value lacks: the user deleted it.
    expect((outcome.events[0] as AnswerEvent).changes).toEqual([
      { op: "set", target: "costs.pm.rate", value: "960.00" },
      { op: "remove", target: "costs.qa" },
    ]);
  });

  test("a revision 2 row in an answer to revision 1 is an added row, and the log only grows by the act's events", () => {
    const { model, log } = revised();
    keepMine(model, log);
    const before = log.latestSeq;
    const withQa = {
      ...copy(sent),
      rows: [...copy(sent.rows), { id: "qa", role: "QA", days: 5, rate: "500.00" }],
    };
    const { outcome } = checked(model, [answerAct({ values: { costs: withQa } })], {
      types: TYPES,
      log,
    });
    // Against revision 1 the row `qa` is an added row: accepted as an add, never as a cell of `qa`.
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    expect((outcome.events[0] as AnswerEvent).changes).toEqual([
      expect.objectContaining({ op: "add", target: "costs.qa" }),
    ]);
    expect(log.latestSeq).toBe(before);
  });
});
