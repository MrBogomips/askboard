import { describe, expect, test } from "bun:test";
import type { AnswerEvent } from "@askboard/contract";
import {
  ATOM_TYPES,
  DATE_FIELD_FIXTURE_ITEMS,
  DIVIDER_FIXTURE_ITEM,
  MONEY_FIELD_FIXTURE_ITEMS,
  NUMBER_FIELD_FIXTURE_ITEMS,
  TEXT_FIELD_FIXTURE_ITEMS,
  TEXT_FIXTURE_ITEMS,
  TOGGLE_FIXTURE_ITEM,
  VALUE_FIXTURE_ITEMS,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { EventLog } from "../src/lifecycle/log.ts";
import { questionStatus } from "../src/lifecycle/states.ts";
import { widgetItemValue } from "../src/lifecycle/widget-fetch.ts";
import { answerAct, checked, type Item, type Json, modelOf } from "./probe-fakes.ts";

// Core spec: Answers of atoms (atoms, design decisions 1 and 10): ask-core takes an atom's result
// as any widget result, with no code of its own. `withWidgetTypes(...ATOM_TYPES)` gives the shipped
// registry the atoms whether or not they are registered yet.

const TYPES = withWidgetTypes(...ATOM_TYPES);
const [NAME] = TEXT_FIELD_FIXTURE_ITEMS;
const [DAYS] = NUMBER_FIELD_FIXTURE_ITEMS;
const [BUDGET] = MONEY_FIELD_FIXTURE_ITEMS;
const [START] = DATE_FIELD_FIXTURE_ITEMS;
const [INTRO] = TEXT_FIXTURE_ITEMS;
const [HEADCOUNT] = VALUE_FIXTURE_ITEMS;
const copy = <T>(value: T): T => structuredClone(value);
const items = (...list: readonly object[]): Item[] => copy(list) as Item[];

const input = () => items(NAME, DAYS, BUDGET, START, TOGGLE_FIXTURE_ITEM, INTRO) as Item[];
const run = (fields: Json, list: Item[] = input(), log = new EventLog()) => {
  const model = modelOf(list);
  return { model, ...checked(model, [answerAct(fields)], { types: TYPES, log }) };
};

const refusal = (fields: Json, list?: Item[]) => {
  const { log, outcome } = run(fields, list);
  if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
  // Nothing appended, nothing kept, nothing to publish.
  expect(log.latestSeq).toBe(0);
  expect(Object.keys(outcome).sort()).toEqual(["index", "ok", "problem"]);
  return outcome.problem;
};

describe("a question of atoms answered", () => {
  test("five set values are logged under their item IDs; unset and display items are absent", () => {
    const results = {
      name: "Ada Lovelace",
      days: 3.5,
      fee: { amount: "12480.50", currency: "EUR" },
      notify: false,
    };
    const { outcome } = run({ results });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const [event] = outcome.events as AnswerEvent[];
    expect(event?.results).toEqual(results);
    expect(event?.results).not.toHaveProperty("start");
    expect(event?.results).not.toHaveProperty("intro");
    expect(event?.results?.notify).toBe(false);
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
    expect([...outcome.kept.values()][0]?.results).toEqual(results);
  });
});

describe("a result past its bounds", () => {
  test("a NumberField result over its max is refused, naming the item", () => {
    const problem = refusal({ results: { days: 21 } });
    expect(problem.detail).toContain("days");
  });

  test("an empty TextField result is refused", () => {
    expect(refusal({ results: { name: "" } }).detail).toContain("name");
  });

  test("each input atom's out-of-bounds result is refused, appending nothing", () => {
    const cases: [string, unknown][] = [
      ["name", "x".repeat(41)],
      ["days", -1],
      ["days", 3.25],
      ["fee", { amount: "12.505", currency: "EUR" }],
      ["fee", { amount: "-1", currency: "EUR" }],
      ["fee", { amount: "1", currency: "USD" }],
      ["start", "2025-12-31"],
      ["start", "2026-02-30"],
      ["notify", "yes"],
      ["notify", null],
    ];
    for (const [id, result] of cases) {
      const problem = refusal({ results: { [id]: result } });
      expect(problem.detail).toContain(id);
    }
  });

  test("a refused result beside valid ones keeps none of them", () => {
    refusal({ results: { name: "Ada", days: 21 } });
  });
});

describe("a result for a display atom", () => {
  test("each display atom's result is refused, appending nothing", () => {
    const list = [...input(), ...items(HEADCOUNT, DIVIDER_FIXTURE_ITEM)];
    for (const [id, result] of [
      ["intro", "read"],
      ["headcount", 12],
      ["rule", true],
    ] as const) {
      expect(refusal({ results: { [id]: result } }, copy(list)).detail).toContain(id);
    }
  });
});

describe("large text answers", () => {
  test("five TextFields of 10,000 code points each are logged tooLarge, without results", () => {
    const fields = ["a", "b", "c", "d", "e"].map((id) => ({
      type: "text-field",
      id,
      props: { label: id, multiline: true },
    }));
    const results = Object.fromEntries(fields.map((f) => [f.id, "😀".repeat(10_000)]));
    const { outcome } = run({ results }, items(...fields));
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const [event] = outcome.events as AnswerEvent[];
    expect(event?.tooLarge).toBe(true);
    expect(event).not.toHaveProperty("results");
    expect([...outcome.kept.values()][0]?.results).toEqual(results);
  });
});

describe("fetch of atom items", () => {
  const answered = (fields: Json) => {
    const { model, log, outcome } = run(fields);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    model.noteEntries(log.append(outcome.events));
    return { model, log, kept: outcome.kept };
  };
  const fetched = (run: ReturnType<typeof answered>, id: string) => {
    const question = run.model.questions()[0];
    if (question === undefined) throw new Error("no question");
    const status = () => questionStatus(question.mark, run.log.ofItem(question.id));
    return widgetItemValue(
      run.model,
      id,
      status,
      { map: new Map(), source: undefined, kept: run.kept },
      TYPES,
    )?.item;
  };
  const results = { name: "Ada Lovelace", days: 3.5, notify: true };

  test("an input atom returns its result", () => {
    const run = answered({ results });
    expect(fetched(run, "name")?.result).toBe("Ada Lovelace");
    expect(fetched(run, "days")?.result).toBe(3.5);
    expect(fetched(run, "notify")?.result).toBe(true);
    expect(fetched(run, "start")).not.toHaveProperty("result");
  });

  test("a display atom returns as sent, with no result", () => {
    const run = answered({ results });
    const item = fetched(run, "intro");
    expect(item?.props).toEqual(INTRO.props);
    expect(item).not.toHaveProperty("result");
  });

  test("a revised answer replaces the results", () => {
    const model = modelOf(input());
    const log = new EventLog();
    const first = checked(model, [answerAct({ results })], { types: TYPES, log });
    if (!first.outcome.ok) throw new Error("first");
    model.noteEntries(log.append(first.outcome.events));
    const second = checked(
      model,
      [{ ...answerAct({ results: { name: "Grace Hopper" } }), rev: 1 }],
      { types: TYPES, log },
    );
    if (!second.outcome.ok) throw new Error(JSON.stringify(second.outcome.problem));
    model.noteEntries(log.append(second.outcome.events));
    const question = model.questions()[0];
    if (question === undefined) throw new Error("no question");
    const status = () => questionStatus(question.mark, log.ofItem(question.id));
    const kept = new Map([...first.outcome.kept, ...second.outcome.kept]);
    const at = (id: string) =>
      widgetItemValue(model, id, status, { map: new Map(), source: undefined, kept }, TYPES)?.item;
    expect(at("name")?.result).toBe("Grace Hopper");
    expect(at("days")).not.toHaveProperty("result");
  });
});
