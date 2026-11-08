import { describe, expect, test } from "bun:test";
import { TABLE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";
import { actionId, logOf, WHEN } from "./lifecycle-fakes.ts";

// Core spec: A Table's send-time warnings and Table answers through ask-core (table-widget, task 6.3,
// review S-2 of review-table-g2-4): through the shipped `AskCore`, whose registry holds the Table,
// with no `withWidgetTypes`. Before the Table joins `WIDGET_TYPES` the graph check skips the graph,
// since no registered type declares derived values, and every test here fails.

type Json = Record<string, unknown>;
type Props = { columns: Json[]; rows: Json[]; label: string };
type Act = Parameters<AskCore["act"]>[1];

const copy = <T>(value: T): T => structuredClone(value);
const sent = TABLE_FIXTURE_ITEM.props as unknown as Props;
const ASK_ID = "table-costs-t6k3";

// 200 rows of the Table of roles' shape.
const rows200 = (): Json[] =>
  Array.from({ length: 200 }, (_, at) => ({ id: `r${at}`, role: "x", days: at, rate: "1.00" }));

const columnsWith = (formula: string): Json[] =>
  copy(sent.columns).map((column) => (column.field === "amount" ? { ...column, formula } : column));

const request = (formula: string, rows: Json[] = rows200()) => ({
  askId: ASK_ID,
  items: [
    {
      type: "question",
      id: "plan",
      props: {
        text: "Costs",
        items: [
          {
            type: "group",
            id: "box",
            props: {
              title: "Box",
              items: [
                {
                  type: "table",
                  id: "costs",
                  props: { label: sent.label, columns: columnsWith(formula), rows },
                },
              ],
            },
          },
        ],
      },
    },
  ],
});

const created = async (formula: string) => {
  const core = new AskCore(fakePorts().ports);
  const outcome = await core.ask(request(formula) as unknown as Parameters<AskCore["ask"]>[0]);
  if (outcome.kind !== "created") throw new Error(`not created: ${JSON.stringify(outcome)}`);
  return { core, outcome };
};

describe("a Table asked through the shipped AskCore", () => {
  test("a 200-row Table in a Group whose formula reads [@rte] returns one formula warning at costs.*.amount", async () => {
    const { outcome } = await created("[@rte]");
    expect(outcome.warnings).toHaveLength(1);
    expect(outcome.warnings?.[0]).toMatchObject({
      code: "formula",
      itemId: "costs",
      address: "costs.*.amount",
      error: "missing-reference",
    });
  });

  test("an update changing the formula warns again, and a correct formula warns nothing", async () => {
    const { core } = await created("[@days] * [@rate]");
    const change = (formula: string) =>
      core.update({
        askId: ASK_ID,
        actions: [
          {
            action: "change",
            itemId: "costs",
            props: { columns: columnsWith(formula) },
          },
        ],
      });
    const wrong = await change("[@days] * [@rte]");
    expect(wrong).toMatchObject({ kind: "updated" });
    const warnings = wrong.kind === "updated" ? wrong.warnings : undefined;
    expect(warnings).toHaveLength(1);
    expect(warnings?.[0]).toMatchObject({ code: "formula", address: "costs.*.amount" });
    const right = await change("[@days] * [@rate]");
    expect(right.kind === "updated" ? right.warnings : "x").toBeUndefined();
  });

  test("one answer of a lowered rate is logged, with its change and the derived values", async () => {
    const core = new AskCore(fakePorts().ports);
    const small = request("[@days] * [@rate]", copy(sent.rows));
    const outcome = await core.ask(small as unknown as Parameters<AskCore["ask"]>[0]);
    expect(outcome.kind).toBe("created");
    const lowered = {
      ...copy(sent),
      rows: copy(sent.rows).map((row) => (row.id === "pm" ? { ...row, rate: "960.00" } : row)),
    };
    const result = core.act(ASK_ID, {
      actionId: actionId(1),
      acts: [
        {
          type: "answer",
          itemId: "plan",
          rev: 1,
          when: WHEN,
          values: { costs: lowered },
          derived: { "costs.pm.amount": "17280.00", "costs.amount": "69120.00", "costs.days": 90 },
        },
      ],
    } as unknown as Act);
    expect(result.ok).toBe(true);
    const [event] = logOf(core, ASK_ID);
    expect(logOf(core, ASK_ID)).toHaveLength(1);
    expect(event).toMatchObject({
      type: "answer",
      changes: [{ op: "set", target: "costs.pm.rate", value: "960.00" }],
      derived: { "costs.pm.amount": "17280.00", "costs.amount": "69120.00", "costs.days": 90 },
    });
  });
});
