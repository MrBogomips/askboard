import { describe, expect, test } from "bun:test";
import {
  type AnswerEvent,
  type FetchItem,
  type LifecycleBoardDocument,
  RESULT_VERSIONS,
} from "@askboard/contract";
import { PROBE_SESSION, PROBE_TYPES } from "@askboard/contract/fixtures";
import { validateAgainst, validateSnapshotData } from "@askboard/contract/validate";
import { questionStatus } from "../src/lifecycle/states.ts";
import { fullAnswer, questionValue, questionView } from "../src/lifecycle/views.ts";
import type { KeptAnswer } from "../src/lifecycle/widget-event.ts";
import { questionInReference, widgetItemValue } from "../src/lifecycle/widget-fetch.ts";
import type { ExpansionMap } from "../src/molecules/map.ts";
import type { MoleculeSource } from "../src/molecules/source.ts";
import { gatherSnapshot } from "../src/snapshot/gather.ts";
import { boardStateOf } from "../src/snapshot/state.ts";
import { boardOf, created, FLAT_ID, flatAsk, WHEN } from "./lifecycle-fakes.ts";
import { answerAct, checked, type Item, modelOf, PROBE_ITEM } from "./probe-fakes.ts";

// Core spec: Widget results logged and kept, Widget results in fetch and Snapshots (widget-registry
// design decision 6): a result in an expanded item is logged under its reference and read by the
// board under the expanded ID; `fetch` returns the kept results; a Snapshot holds those of an
// event logged `tooLarge`, and none for an event logged whole.

const ENTRY = { reference: "ref", molecule: "m", version: "1.0.0" };
const EXPANSION: ExpansionMap = new Map([["ref__item", ENTRY]]);
const ITEM: Item = { ...PROBE_ITEM, id: "ref__item" };
const RESULTS = { ref__item: { pick: "a" } };
// A source whose molecule has no `item` slot: the addressing reads nothing of it.
const SOURCE = {
  lookup: () => ({ found: true, definition: { fills: {} } }),
} as unknown as MoleculeSource;

// The probe ask answered with a result for the expanded item: the model, the log, the event and
// what ask-core kept.
const answered = () => {
  const model = modelOf([ITEM]);
  const { outcome, log } = checked(model, [answerAct({ results: RESULTS })], {
    expansion: EXPANSION,
  });
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
  const entries = log.append(outcome.events);
  model.noteEntries(entries);
  return { model, log, kept: outcome.kept, event: entries[0]?.event as AnswerEvent };
};

const factsOf = ({ model, log }: ReturnType<typeof answered>) => {
  const question = model.question(PROBE_SESSION.question);
  if (question === undefined) throw new Error("no question");
  const entries = log.ofItem(question.id);
  return { question, entries, status: questionStatus(question.mark, entries) };
};

describe("a result in an expanded item", () => {
  test("is logged under its reference, and kept under the expanded ID", () => {
    const { event, kept } = answered();
    expect(event.results).toEqual({ ref: { pick: "a" } });
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
    expect(kept.get(event.cursor)?.results).toEqual(RESULTS);
  });

  test("is given to the board state's current answer under the expanded ID", () => {
    const run = answered();
    const view = questionView(factsOf(run), 100, run.kept);
    expect(view.answer?.results).toEqual(RESULTS);
    const board = {
      askId: PROBE_SESSION.askId,
      state: "answered" as const,
      document: { items: [] } as unknown as LifecycleBoardDocument,
      questions: [view],
    };
    const state = boardStateOf(board);
    expect(state.questions[0]).toMatchObject({ state: "answered", answer: { results: RESULTS } });
  });

  test("is given to the previous answer too", () => {
    const run = answered();
    const facts = factsOf(run);
    facts.question.previous = fullAnswer(facts.question, facts.status.answer);
    const view = questionView(facts, 100, run.kept);
    expect(view.previous?.results).toEqual(RESULTS);
  });

  test("an answer that gave none gives the board none", () => {
    const run = answered();
    const view = questionView(factsOf(run), 100, new Map());
    expect(view.answer).not.toHaveProperty("results");
  });
});

describe("fetch with results", () => {
  test("a question's answer holds the kept results in reference addressing", () => {
    const run = answered();
    const facts = factsOf(run);
    const value = questionValue(facts, run.model) as Extract<FetchItem, { type: "question" }>;
    const fetched = questionInReference(value, {
      map: EXPANSION,
      source: SOURCE,
      kept: run.kept,
    });
    expect(fetched.answer).toMatchObject({
      cursor: run.event.cursor,
      results: { ref: { pick: "a" } },
    });
  });

  test("a widget item alone holds its latest answer's result", () => {
    const run = answered();
    const found = widgetItemValue(
      run.model,
      "ref",
      () => factsOf(run).status,
      { map: EXPANSION, source: SOURCE, kept: run.kept },
      PROBE_TYPES,
    );
    expect(found?.item).toMatchObject({ id: "ref", state: "answered", result: { pick: "a" } });
  });

  test("a widget item whose type declares no result carries none, whatever is kept", () => {
    const run = answered();
    const tree: Item = { type: "tree", id: "wbs", props: { nodes: [{ id: "n", label: "N" }] } };
    const model = modelOf([PROBE_ITEM, tree]);
    const held: KeptAnswer = {
      itemId: "choose",
      values: {},
      results: { wbs: { x: 1 } },
      derived: {},
    };
    const status = { ...factsOf(run).status };
    const found = widgetItemValue(
      model,
      "wbs",
      () => status,
      { map: new Map(), source: undefined, kept: new Map([[run.event.cursor, held]]) },
      PROBE_TYPES,
    );
    expect(found?.item).not.toHaveProperty("result");
  });

  test("an answer's results validate against the tool envelopes", async () => {
    const { core } = await created(flatAsk());
    const value = core.fullValue(FLAT_ID, "q1");
    if (value.kind !== "item") throw new Error(value.kind);
    const cursor = `${core.epoch}.1`;
    const item = {
      ...value.item,
      state: "answered",
      answer: { choice: ["main"], who: "Sara Conti", when: WHEN, cursor },
    } as Extract<FetchItem, { type: "question" }>;
    const kept = new Map([
      [cursor, { itemId: "q1", values: {}, results: { pick: { pick: "a" } }, derived: {} }],
    ]);
    const fetched = questionInReference(item, { map: new Map(), source: undefined, kept });
    expect(fetched.answer).toMatchObject({ results: { pick: { pick: "a" } } });
    const result = {
      versions: RESULT_VERSIONS,
      epoch: core.epoch,
      askId: FLAT_ID,
      state: "answered",
      item: fetched,
      unchecked: true,
    };
    expect(validateAgainst("urn:askboard:tool-envelopes:fetch-result", result).ok).toBe(true);
  });
});

describe("a Snapshot with results", () => {
  const tooLarge = (cursor: string): AnswerEvent => ({
    cursor,
    type: "answer",
    itemId: "q1",
    rev: 1,
    who: "Sara Conti",
    when: WHEN,
    choice: ["main"],
    tooLarge: true,
  });

  const gathered = async (events: AnswerEvent[], results: Map<string, Record<string, unknown>>) => {
    const { core } = await created(flatAsk());
    const data = gatherSnapshot({
      epoch: core.epoch,
      board: boardOf(core, FLAT_ID),
      kept: core.keptRevisions(FLAT_ID) ?? [],
      log: events.map((event) => ({ ...event, cursor: `${core.epoch}.${event.cursor}` })),
      takenAt: "2026-11-06T10:00:00Z",
      taker: { takenBy: "agent" },
      keptAnswerResults: new Map(
        [...results].map(([key, value]) => [`${core.epoch}.${key}`, value]),
      ),
    });
    const checkedData = validateSnapshotData(data);
    expect(checkedData.ok ? [] : checkedData.problems).toEqual([]);
    return data;
  };

  test("a tooLarge event's kept results are in its entry's results", async () => {
    const data = await gathered([tooLarge("1")], new Map([["1", { pick: { pick: "a" } }]]));
    expect(data.events[0]).toMatchObject({ results: { pick: { pick: "a" } } });
  });

  test("an event logged whole holds none there, whatever is kept", async () => {
    const whole = { ...tooLarge("1"), tooLarge: undefined, results: { pick: { pick: "a" } } };
    const data = await gathered([whole as AnswerEvent], new Map([["1", { pick: { pick: "b" } }]]));
    expect(data.events[0]).not.toHaveProperty("results");
    expect(data.events[0]?.event).toMatchObject({ results: { pick: { pick: "a" } } });
  });

  test("a tooLarge event with nothing kept holds none", async () => {
    const data = await gathered([tooLarge("1")], new Map());
    expect(data.events[0]).not.toHaveProperty("results");
  });
});
