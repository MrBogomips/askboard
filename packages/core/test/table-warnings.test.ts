import { describe, expect, test } from "bun:test";
import {
  LAYOUT_WIDGETS,
  TABLE_FIXTURE_ITEM,
  TABLE_TYPES,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { checkedFormulaWarnings, formulaWarnings } from "../src/graph-check.ts";
import { EventLog } from "../src/lifecycle/log.ts";
import { BoardModel } from "../src/lifecycle/model.ts";
import { applyActions, type UpdateContext } from "../src/lifecycle/updates.ts";
import type { ExpansionMap } from "../src/molecules/map.ts";
import type { Item, Json } from "./probe-fakes.ts";

// Core spec: A Table's send-time warnings (table-widget, design decision 4): the graph check builds
// the Table's graph through the registry's derived declarations and `compute`'s `BOARD_SOURCES`, at
// any depth of the question's layouts, and returns one `formula` warning per column formula and
// kind, never refusing the request. The shipped `AskCore` holds the shipped registry, in which the
// Table is not registered yet, so the checks run over `withWidgetTypes(...TABLE_TYPES)`.

const TYPES = withWidgetTypes(...TABLE_TYPES, ...LAYOUT_WIDGETS);
const copy = <T>(value: T): T => structuredClone(value);
type Props = { columns: Json[]; rows: Json[]; label: string };
const sent = TABLE_FIXTURE_ITEM.props as unknown as Props;

// The Table of roles, its `amount` column's formula replaced.
const withFormula = (formula: string, rows: Json[] = copy(sent.rows)): Item => ({
  type: "table",
  id: "costs",
  props: {
    ...copy(sent),
    rows,
    columns: sent.columns.map((column) =>
      column.field === "amount" ? { ...column, formula } : column,
    ),
  },
});

const rows200 = (): Json[] =>
  Array.from({ length: 200 }, (_, at) => ({ id: `r${at}`, role: "x", days: at, rate: "1.00" }));

const question = (items: readonly unknown[]) => ({
  type: "question",
  id: "q",
  props: { text: "Costs", items },
});

const warn = (items: readonly unknown[], map: ExpansionMap = new Map()) =>
  formulaWarnings([question(items)], map, TYPES);

describe("a Table's send-time warnings", () => {
  test("the Table of roles warns nothing", () => {
    expect(warn([TABLE_FIXTURE_ITEM])).toEqual([]);
  });

  test("a misspelt field in a Group, over 200 rows, is one warning naming costs and costs.*.amount", () => {
    const table = withFormula("[@rte]", rows200());
    const group = { type: "group", id: "box", props: { title: "Box", items: [table] } };
    const warnings = warn([group]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: "formula",
      itemId: "costs",
      address: "costs.*.amount",
      error: "missing-reference",
    });
    expect(warnings[0]?.message).toContain("[@rte]");
  });

  test("nested two layouts deep, inside a Tabs, the warning is the same", () => {
    const table = withFormula("[@days] * [@rte]");
    const group = { type: "group", id: "box", props: { title: "Box", items: [table] } };
    const tabs = {
      type: "tabs",
      id: "sections",
      props: { tabs: [{ id: "t", title: "T", items: [group] }] },
    };
    const [only, ...more] = warn([tabs]);
    expect(more).toEqual([]);
    expect(only).toMatchObject({ itemId: "costs", address: "costs.*.amount" });
  });

  test("a formula that does not parse over 200 rows is one warning", () => {
    const warnings = warn([withFormula("[@days] *", rows200())]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ address: "costs.*.amount", error: "syntax" });
  });

  test("two columns in error warn once each", () => {
    const table = withFormula("[@rte]", rows200());
    const props = table.props as Props;
    props.columns = [
      ...props.columns,
      { field: "tax", label: "Tax", type: "number", formula: "[@nothing]" },
    ];
    const addresses = warn([table]).map((warning) =>
      warning.code === "formula" ? warning.address : "",
    );
    expect(addresses.sort()).toEqual(["costs.*.amount", "costs.*.tax"]);
  });

  test("a wildcard in a column formula is one over-limit warning, and the request is not refused", () => {
    const checkedWarnings = checkedFormulaWarnings(
      [question([withFormula("SUM([costs.*.days])", rows200())])],
      new Map(),
      TYPES,
    );
    if (!checkedWarnings.ok) throw new Error(checkedWarnings.detail);
    expect(checkedWarnings.warnings).toHaveLength(1);
    expect(checkedWarnings.warnings[0]).toMatchObject({
      address: "costs.*.amount",
      error: "over-limit",
    });
  });

  test("a value error that depends on a row's values gives no warning", () => {
    expect(warn([withFormula("[@days] / 0")])).toEqual([]);
  });
});

describe("a warning's * address under molecule addressing", () => {
  test("an expanded Table's address takes the reference's ID and keeps the *", () => {
    const table = { ...withFormula("[@rte]"), id: "estimate__costs" };
    const map: ExpansionMap = new Map([
      ["estimate__costs", { reference: "estimate", molecule: "sales", version: "1.0.0" }],
    ]);
    const [warning] = warn([table], map);
    expect(warning).toMatchObject({
      itemId: "estimate",
      address: "estimate.*.amount",
      error: "missing-reference",
    });
    expect(warning?.message).toContain("estimate.*.amount");
    expect(warning?.message).not.toContain("estimate__costs");
  });
});

describe("an update that changes a column formula", () => {
  const setup = () => {
    const model = BoardModel.of([question([withFormula("[@days] * [@rate]")])] as never);
    const context: UpdateContext = {
      askId: "ask",
      epoch: "e1",
      who: "Sara Conti",
      now: "2026-11-08T10:00:00Z",
      model,
      log: new EventLog(),
      widgets: {
        source: undefined,
        expansion: new Map(),
        references: new Map(),
        expanded: new Map(),
      },
      types: TYPES,
    };
    return { model, context };
  };
  const columnsWith = (formula: string) =>
    sent.columns.map((column) => (column.field === "amount" ? { ...column, formula } : column));
  const update = (formula: string) => {
    const { model, context } = setup();
    const result = applyActions(context, [
      { action: "change", itemId: "costs", props: { columns: columnsWith(formula) } } as never,
    ]);
    expect(result.ok).toBe(true);
    return checkedFormulaWarnings(model.items(), new Map(), TYPES);
  };

  test("a misspelt formula warns again, and a corrected one warns nothing", () => {
    const bad = update("[@days] * [@rte]");
    if (!bad.ok) throw new Error(bad.detail);
    expect(bad.warnings).toHaveLength(1);
    expect(bad.warnings[0]).toMatchObject({ itemId: "costs", address: "costs.*.amount" });
    const fixed = update("[@days] * [@rate]");
    expect(fixed).toEqual({ ok: true, warnings: [] });
  });

  // Re-review 3.13 X-2: a closing warning with nothing after it counts nothing.
  test("two formula columns of escape-heavy errors: the closing warning has no count after the error", () => {
    const formula = `[a.${"\u0001".repeat(496)}]`;
    const table = {
      type: "table",
      id: "costs",
      props: {
        label: "Costs",
        columns: [
          { field: "a", label: "A", type: "number" },
          { field: "f1", label: "F1", type: "number", formula },
          { field: "f2", label: "F2", type: "number", formula },
        ],
        rows: [{ id: "r1", a: 1 }],
      },
    };
    const checked = checkedFormulaWarnings([question([table])], new Map(), TYPES);
    expect(checked.ok).toBe(true);
    const warnings = checked.ok ? checked.warnings : [];
    expect(warnings).toHaveLength(2);
    const closing = warnings[1];
    expect(closing?.address).toBe("costs.*.f2");
    expect(closing?.message).toMatch(/^The formula at costs\.\*\.f2 is in error \(syntax\); /);
    expect(closing?.message).not.toMatch(/more formula warning/);
    expect(closing?.message).not.toMatch(/\b0\b/);
  });
});
