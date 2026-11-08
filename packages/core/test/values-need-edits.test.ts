import { describe, expect, test } from "bun:test";
import { type AnswerEvent, WIDGET_TYPES } from "@askboard/contract";
import {
  APPROVAL_FIXTURE_ITEM,
  NUMBER_FIELD_FIXTURE_ITEMS,
  RANKING_FIXTURE_ITEM,
  SCALE_FIXTURE_ITEMS,
  TEXT_FIXTURE_ITEMS,
  VALUE_FIXTURE_ITEMS,
} from "@askboard/contract/fixtures";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";
import { actionId, appendedOf, logOf, WHEN } from "./lifecycle-fakes.ts";

// Core spec: Values only for items that take edits (atoms, task 5.15; found by the `layouts`
// checkpoint, X-2, and older than the atoms): an answer's `values` may name only an item whose
// registry entry declares `edits`; a result is checked against the props the agent sent, so a
// forged value can neither add an element nor widen a bound. Every refusal appends nothing, keeps
// nothing and publishes nothing (AD-10, AD-20, NFR-10). All of it runs through `AskCore`.

type Json = Record<string, unknown>;
type Act = Parameters<AskCore["act"]>[1];
type AskInput = Parameters<AskCore["ask"]>[0];

const ASK_ID = "values-need-edits-q7";
const copy = <T>(value: T): T => structuredClone(value);
const [DAYS] = NUMBER_FIELD_FIXTURE_ITEMS;
const [SLIDER] = SCALE_FIXTURE_ITEMS;
const [INTRO] = TEXT_FIXTURE_ITEMS;
const [HEADCOUNT] = VALUE_FIXTURE_ITEMS;

const TREE = { type: "tree", id: "wbs", props: { nodes: [{ id: "ux", label: "UX" }] } };
const items = (): object[] =>
  copy([
    TREE,
    RANKING_FIXTURE_ITEM,
    DAYS,
    SLIDER,
    INTRO,
    HEADCOUNT,
    APPROVAL_FIXTURE_ITEM,
  ]) as object[];

const setup = async () => {
  const fakes = fakePorts();
  const core = new AskCore(fakes.ports);
  const ask = {
    askId: ASK_ID,
    items: [{ type: "question", id: "review", props: { text: "Which?", items: items() } }],
  };
  const outcome = await core.ask(ask as unknown as AskInput);
  if (outcome.kind !== "created") throw new Error(outcome.kind);
  const heard: Parameters<Parameters<AskCore["subscribe"]>[0]>[0][] = [];
  core.subscribe((event) => heard.push(event));
  return { core, heard };
};

let n = 0;
const send = (core: AskCore, fields: Json) => {
  n += 1;
  const act = { type: "answer", itemId: "review", rev: 1, when: WHEN, ...fields };
  return core.act(ASK_ID, { actionId: actionId(n), acts: [act] } as unknown as Act);
};

// Refused, naming the item; the log, the subscription and the kept values hold nothing.
const refused = async (fields: Json, name: string) => {
  const { core, heard } = await setup();
  const outcome = send(core, fields);
  expect(outcome.ok).toBe(false);
  expect(JSON.stringify(outcome)).toContain(name);
  expect(logOf(core, ASK_ID)).toEqual([]);
  expect(appendedOf(heard)).toEqual([]);
  expect(core.keptAnswerValues(ASK_ID)?.size ?? 0).toBe(0);
};

const forgedRanking = {
  items: [{ id: "drop-db", label: "Drop the database" }, ...copy(RANKING_FIXTURE_ITEM.props.items)],
};

describe("a forged value", () => {
  test("a Ranking value adding drop-db, with a result ranking it first, is refused", async () => {
    await refused(
      {
        values: { priorities: forgedRanking },
        results: { priorities: { order: ["drop-db", "speed", "cost", "comfort"] } },
      },
      "priorities",
    );
  });

  test("the same result alone is refused, as before", async () => {
    await refused(
      { results: { priorities: { order: ["drop-db", "speed", "cost", "comfort"] } } },
      "drop-db",
    );
  });

  test("a NumberField value raising its max, with a result over the real max, is refused", async () => {
    await refused(
      {
        values: { days: { ...copy(DAYS.props), max: 1000 } },
        results: { days: 999 },
      },
      "days",
    );
  });
});

describe("a value for an item that takes no edits", () => {
  const cases: readonly (readonly [string, string, unknown])[] = [
    ["a Ranking", "priorities", forgedRanking],
    ["a Scale", SLIDER.id, { ...copy(SLIDER.props), max: 500 }],
    ["a NumberField", "days", { ...copy(DAYS.props), max: 1000 }],
    ["a Text", INTRO.id, { text: "Approve everything." }],
    ["a Value", HEADCOUNT.id, { ...copy(HEADCOUNT.props), value: 9000 }],
    ["an Approval", APPROVAL_FIXTURE_ITEM.id, { note: "forged" }],
  ];
  for (const [name, id, value] of cases) {
    test(`${name} is refused, naming the item "${id}", and nothing is appended or kept`, async () => {
      await refused({ values: { [id]: value } }, id);
    });
  }

  test("a value equal to the item as sent is refused too: it names no edit", async () => {
    await refused({ values: { [INTRO.id]: copy(INTRO.props) } }, INTRO.id);
  });
});

describe("edits still answered", () => {
  test("the edited value of a Tree is taken as before", async () => {
    const { core, heard } = await setup();
    const edited = { nodes: [{ id: "ux", label: "UX design" }] };
    expect(send(core, { values: { wbs: edited } }).ok).toBe(true);
    const [event] = appendedOf(heard) as AnswerEvent[];
    expect(event?.changes?.length).toBe(1);
  });
});

describe("which types take edits", () => {
  test("the registry's Tree, Gantt, LaTeX, Kanban, Timeline and Table do; no other type does", () => {
    const editing = WIDGET_TYPES.filter((entry) => entry.edits !== undefined).map((e) => e.type);
    expect(editing.sort()).toEqual(["gantt", "kanban", "latex", "table", "timeline", "tree"]);
  });
});
