import { describe, expect, test } from "bun:test";
import { KANBAN_WIDGET, LATEX_WIDGET, TIMELINE_WIDGET } from "@askboard/contract";
import {
  KANBAN_EDITED_PROPS,
  KANBAN_FIXTURE_ITEM,
  kanbanFetchItemResult,
  LATEX_CHANGES,
  LATEX_EDITED_PROPS,
  LATEX_FIXTURE_ITEM,
  latexFetchItemResult,
  TIMELINE_EDITED_PROPS,
  TIMELINE_FIXTURE_ITEM,
  timelineFetchItemResult,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { questionStatus } from "../src/lifecycle/states.ts";
import { widgetItemValue } from "../src/lifecycle/widget-fetch.ts";
import { answerAct, checked, type Item, type Json, modelOf } from "./probe-fakes.ts";

// Core spec: Answers of LaTeX, Kanban and Timeline (latex-kanban-timeline design decisions 3 to 5
// and 6): ask-core logs each type's answer with the changes the one generic diff computes, keeps the
// full edited value, and refuses what the type's checks refuse, with the log unchanged. The shipped
// `AskCore` holds the shipped registry, so the acts run over `withWidgetTypes` of the three types.

const TYPES = withWidgetTypes(LATEX_WIDGET, KANBAN_WIDGET, TIMELINE_WIDGET);
const copy = <T>(value: T): T => structuredClone(value);
const item = (fixture: unknown): Item => copy(fixture) as Item;
const LATEX = item(LATEX_FIXTURE_ITEM);
const KANBAN = item(KANBAN_FIXTURE_ITEM);
const TIMELINE = item(TIMELINE_FIXTURE_ITEM);

const send = (items: readonly Item[], values: Json) =>
  checked(modelOf(items), [answerAct({ values })], { types: TYPES });

// The logged answer of an act that is accepted: its event and what is kept apart from the log.
const logged = (items: readonly Item[], values: Json) => {
  const { log, outcome } = send(items, values);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
  return { log, events: outcome.events, kept: outcome.kept, model: modelOf(items) };
};

// The refusal of an act: its problem, the log as it was and nothing kept.
const refusal = (items: readonly Item[], values: Json) => {
  const { log, outcome } = send(items, values);
  if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
  expect(log.latestSeq).toBe(0);
  expect(outcome.problem.refusal).toBe("content");
  expect(outcome).not.toHaveProperty("kept");
  return outcome.problem;
};

const withCards = (change: (card: Json) => Json): Json => ({
  board: {
    ...KANBAN_FIXTURE_ITEM.props,
    cards: KANBAN_FIXTURE_ITEM.props.cards.map((card) => change(copy(card) as Json)),
  },
});

const withEntries = (change: (entry: Json) => Json): Json => ({
  roadmap: {
    ...TIMELINE_FIXTURE_ITEM.props,
    entries: TIMELINE_FIXTURE_ITEM.props.entries.map((entry) => change(copy(entry) as Json)),
  },
});

describe("a LaTeX answer", () => {
  test("a corrected expression is one set of the expression, and the full value is kept", () => {
    const { events, kept } = logged([LATEX], { formula: LATEX_EDITED_PROPS });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "answer", changes: LATEX_CHANGES });
    expect([...kept.values()][0]?.values).toEqual({ formula: LATEX_EDITED_PROPS });
  });

  test("a value gaining a second key is refused by the schema, naming the item and the key", () => {
    const problem = refusal([LATEX], { formula: { ...LATEX_EDITED_PROPS, display: true } });
    expect(problem.detail).toContain('"formula"');
    expect(problem.detail).toContain("display");
    expect(problem.detail).toContain("the value of item");
    expect(problem.detail).not.toContain("not described by its changes");
  });

  test("an expression over the limit is refused, with the log unchanged", () => {
    const problem = refusal([LATEX], { formula: { expression: "x".repeat(2_001) } });
    expect(problem.detail).toContain('"formula"');
  });
});

describe("a Kanban answer", () => {
  test("a card moved from todo to done is one set of its column", () => {
    const { events } = logged(
      [KANBAN],
      withCards((card) => (card.id === "fix-login" ? { ...card, column: "done" } : card)),
    );
    expect(events[0]).toMatchObject({
      changes: [{ op: "set", target: "board.fix-login.column", value: "done" }],
    });
  });

  test("a card put in a column the item does not hold is refused naming the item and the card", () => {
    const problem = refusal(
      [KANBAN],
      withCards((card) => (card.id === "fix-login" ? { ...card, column: "blocked" } : card)),
    );
    expect(problem.detail).toContain('"board"');
    expect(problem.detail).toContain('card "fix-login"');
    expect(problem.detail).toContain("blocked");
  });
});

describe("a Timeline answer", () => {
  test("a range moved three days later is the sets of its start and end", () => {
    const { events } = logged(
      [TIMELINE],
      withEntries((entry) =>
        entry.id === "checkout" ? { ...entry, start: "2026-01-08", end: "2026-03-02" } : entry,
      ),
    );
    expect(events[0]).toMatchObject({
      changes: [
        { op: "set", target: "roadmap.checkout.end", value: "2026-03-02" },
        { op: "set", target: "roadmap.checkout.start", value: "2026-01-08" },
      ],
    });
  });

  test("a milestone given an end is refused naming the item and the milestone", () => {
    const problem = refusal(
      [TIMELINE],
      withEntries((entry) => (entry.id === "launch" ? { ...entry, end: "2026-03-09" } : entry)),
    );
    expect(problem.detail).toContain('"roadmap"');
    expect(problem.detail).toContain('entry "launch"');
  });
});

describe("fetch of an item answered", () => {
  // The item `fetch` returns for each type is the full edited value; the contract's tests validate
  // each fixture's whole result against the tool envelopes composed over the same registry.
  const fetched = (items: readonly Item[], values: Json, id: string) => {
    const { log, events, kept, model } = logged(items, values);
    const entries = log.append(events);
    const status = questionStatus(undefined, entries);
    return widgetItemValue(
      model,
      id,
      () => status,
      { map: new Map(), source: undefined, kept },
      TYPES,
    )?.item;
  };
  const cases = [
    ["formula", [LATEX], { formula: LATEX_EDITED_PROPS }, latexFetchItemResult],
    ["board", [KANBAN], { board: KANBAN_EDITED_PROPS }, kanbanFetchItemResult],
    ["roadmap", [TIMELINE], { roadmap: TIMELINE_EDITED_PROPS }, timelineFetchItemResult],
  ] as const;

  for (const [id, items, values, fixture] of cases) {
    test(`${id} comes back with its full edited value`, () => {
      const found = fetched(items, copy(values) as Json, id);
      expect(found as unknown).toEqual({ ...(fixture.item as object), questionId: "choose" });
    });
  }
});
