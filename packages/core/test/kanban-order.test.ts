import { describe, expect, test } from "bun:test";
import { type AnswerEvent, KANBAN_WIDGET } from "@askboard/contract";
import {
  KANBAN_BOTH_CHANGES,
  KANBAN_BOTH_PROPS,
  KANBAN_ORDER_ITEM,
  KANBAN_PLACED_CHANGES,
  KANBAN_PLACED_PROPS,
  KANBAN_REORDER_CHANGES,
  KANBAN_REORDERED_PROPS,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { EventLog } from "../src/lifecycle/log.ts";
import type { BoardModel } from "../src/lifecycle/model.ts";
import { questionStatus } from "../src/lifecycle/states.ts";
import { widgetItemValue } from "../src/lifecycle/widget-fetch.ts";
import { answerAct, checked, type Item, type Json, modelOf } from "./probe-fakes.ts";

// Core spec, "Answers that order a Kanban" and "An answer's changes follow their type"
// (kanban-order, task 2.1; design decision 2): ask-core takes a Kanban answer that orders cards
// through the registry alone. The changes are the generic diff's, group by group; the round trip
// refuses a value they do not rebuild, as it refused every reorder before the change, appending,
// keeping and publishing nothing. No product code of core is part of the change: each case here
// held in core once the contract's group 1 was in, and the ones the contract's group made
// possible (a `move`, which the old schema refused) failed before it.

const TYPES = withWidgetTypes(KANBAN_WIDGET);
const copy = <T>(value: T): T => structuredClone(value);
const KANBAN = copy(KANBAN_ORDER_ITEM) as unknown as Item;

const run = (values: Json, model: BoardModel = modelOf([copy(KANBAN)]), log?: EventLog) => ({
  model,
  ...checked(model, [answerAct({ values })], {
    types: TYPES,
    ...(log === undefined ? {} : { log }),
  }),
});

const accepted = (values: Json) => {
  const result = run(values);
  if (!result.outcome.ok) throw new Error(JSON.stringify(result.outcome.problem));
  return { ...result, outcome: result.outcome, event: result.outcome.events[0] as AnswerEvent };
};

// The refusal of an act: its problem, the log as it was, and nothing kept or to publish.
const refusal = (values: Json) => {
  const { log, outcome } = run(values);
  if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
  expect(log.latestSeq).toBe(0);
  expect(Object.keys(outcome).sort()).toEqual(["index", "ok", "problem"]);
  expect(outcome.problem.refusal).toBe("content");
  return outcome.problem;
};

const answer = (props: unknown): Json => ({ board: copy(props) as Json });

describe("a Kanban answer that orders cards", () => {
  test("a card reordered in its column is logged with one move and nothing for the other columns", () => {
    const { event, outcome } = accepted(answer(KANBAN_REORDERED_PROPS));
    expect(event.changes).toEqual(KANBAN_REORDER_CHANGES);
    expect(outcome.events).toHaveLength(1);
    expect([...outcome.kept.values()][0]?.values).toEqual(answer(KANBAN_REORDERED_PROPS));
  });

  test("a card placed in another column is its set, then its move, and no card of an untouched column is named", () => {
    const { event } = accepted(answer(KANBAN_PLACED_PROPS));
    expect(event.changes).toEqual(KANBAN_PLACED_CHANGES);
    expect(JSON.stringify(event.changes)).not.toContain("release-notes");
  });

  test("both at once come column by column", () => {
    expect(accepted(answer(KANBAN_BOTH_PROPS)).event.changes).toEqual(KANBAN_BOTH_CHANGES);
  });

  test("fetch of the item returns the edited cards in their order", () => {
    const { log, model, outcome } = accepted(answer(KANBAN_REORDERED_PROPS));
    const status = questionStatus(undefined, log.append(outcome.events));
    const found = widgetItemValue(
      model,
      "board",
      () => status,
      { map: new Map(), source: undefined, kept: outcome.kept },
      TYPES,
    )?.item as { props: { cards: readonly { id: string }[] } } | undefined;
    expect(found?.props).toEqual(KANBAN_REORDERED_PROPS);
    expect(found?.props.cards.map(({ id }) => id)).toEqual(
      KANBAN_REORDERED_PROPS.cards.map(({ id }) => id),
    );
  });
});

describe("a Kanban answer whose list its changes do not rebuild", () => {
  test("the same column orders in another interleaving are refused naming the item, the log unchanged", () => {
    // Each column's order is the reorder's (todo: add-sso, fix-login, audit), but `write-docs`
    // stands before `add-sso`, where the one `move` of the reorder does not put it.
    const [first, second, third, ...rest] = KANBAN_REORDERED_PROPS.cards;
    const interleaved = { ...copy(KANBAN_REORDERED_PROPS), cards: [third, first, second, ...rest] };
    const problem = refusal(answer(interleaved));
    expect(problem.detail).toContain('item "board"');
    expect(problem.detail).toContain("changes more than elements");
  });

  test("the reversal of a Kanban whose columns hold one card each is refused too", () => {
    const one = {
      columns: KANBAN_ORDER_ITEM.props.columns,
      cards: [
        { id: "a", label: "A", column: "todo" },
        { id: "b", label: "B", column: "doing" },
        { id: "c", label: "C", column: "done" },
      ],
    };
    const model = modelOf([{ type: "kanban", id: "board", props: one } as unknown as Item]);
    const { log, outcome } = run(answer({ ...one, cards: [...one.cards].reverse() }), model);
    if (outcome.ok) throw new Error("accepted");
    expect(log.latestSeq).toBe(0);
    expect(outcome.problem.detail).toContain('item "board"');
  });

  test("a renamed card is still refused naming the item and the set of its label", () => {
    const cards = KANBAN_ORDER_ITEM.props.cards.map((card, at) =>
      at === 0 ? { ...card, label: "Fix the sign-in redirect" } : card,
    );
    const problem = refusal(answer({ ...KANBAN_ORDER_ITEM.props, cards }));
    expect(problem.detail).toContain("item board");
    expect(problem.detail).toContain("(set of board.fix-login.label)");
  });
});

describe("a Kanban answer after Keep mine", () => {
  // Revision 2 holds the order the user gave in revision 1 already (the agent put `add-sso` first);
  // the user keeps revision 1 and answers it with that same order.
  const revised = () => {
    const model = modelOf([copy(KANBAN)]);
    const log = new EventLog();
    const question = model.question("choose");
    if (question === undefined) throw new Error("no question");
    const second = { ...copy(KANBAN), props: copy(KANBAN_REORDERED_PROPS) };
    model.revise(question, { text: "Which one?", items: [second] } as never);
    const keep = checked(
      model,
      [{ type: "edit-choice", itemId: "choose", rev: 2, edit: "ignore", keptRev: 1 }],
      { types: TYPES, log },
    );
    if (!keep.outcome.ok) throw new Error(JSON.stringify(keep.outcome.problem));
    model.noteEntries(log.append(keep.outcome.events));
    return { model, log };
  };

  test("an answer naming revision 1 has its changes computed against revision 1's cards", () => {
    const { model, log } = revised();
    const { outcome } = run(answer(KANBAN_REORDERED_PROPS), model, log);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const event = outcome.events[0] as AnswerEvent;
    expect(event.rev).toBe(1);
    expect(event.changes).toEqual(KANBAN_REORDER_CHANGES);
  });

  test("the same value answered against revision 2 changes nothing and is refused as an empty answer", () => {
    const { model, log } = revised();
    const before = log.latestSeq;
    const { outcome } = checked(
      model,
      [{ ...answerAct({ values: answer(KANBAN_REORDERED_PROPS) }), rev: 2 }],
      { types: TYPES, log },
    );
    if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
    expect(outcome.problem.detail).toContain("changes no");
    expect(log.latestSeq).toBe(before);
  });
});
