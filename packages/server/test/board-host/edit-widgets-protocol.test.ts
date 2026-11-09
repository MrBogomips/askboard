import { afterAll, describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import {
  KANBAN_FIXTURE_ITEM,
  KANBAN_ORDER_ITEM,
  KANBAN_REORDER_CHANGES,
  KANBAN_REORDERED_PROPS,
  LATEX_FIXTURE_ITEM,
  TIMELINE_FIXTURE_ITEM,
} from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import { freeRange, openSocket, removeViews, startHost } from "./helpers.ts";

// Board-host spec and core spec (latex-kanban-timeline, task 6.2; An answer's changes follow their
// type, Answers of LaTeX, Kanban and Timeline): an `act` over the board protocol whose Kanban is
// reordered, and one whose Timeline milestone is given an `end`, are each refused (reason `act`,
// the action ID, the index), followed by the state with the question open and the log empty; a
// moved card is accepted and logs one answer, so the refusals are not a blanket. Since kanban-order
// (task 2.2) the Kanban's reversal is refused by `ask-core`'s round trip, not by the schema, and a
// Kanban whose column is reordered is accepted and logs one answer holding the `move`.

const version = BOARD_PROTOCOL_VERSION;
const WHEN = "2026-11-07T09:30:00Z";
const TOKEN = "tkLkt6mPz9XtLw4nB8cYhA";

afterAll(removeViews);

const planAskOf = (askId: string, items: readonly unknown[]) => ({
  askId,
  title: "Customer portal SOW plan",
  items: [
    {
      type: "question",
      id: "plan",
      props: { text: "Does this plan fit the SOW?", header: "Plan", items },
    },
  ],
});
const planAsk = planAskOf("portal-sow-plan-t2v6", [
  LATEX_FIXTURE_ITEM,
  KANBAN_FIXTURE_ITEM,
  TIMELINE_FIXTURE_ITEM,
]);
const orderAsk = planAskOf("portal-sow-order-t2v7", [KANBAN_ORDER_ITEM]);

const started = async (ask: typeof planAsk = planAsk) => {
  const fixture = startHost({ ports: await freeRange(1), tokens: [TOKEN] });
  const { port, askId } = await fixture.ask(undefined, ask);
  const tab = await openSocket(port, askId);
  tab.send({ version, type: "connect", token: TOKEN });
  await tab.next();
  await tab.next();
  const events = () => {
    const read = fixture.core.read(askId, `${fixture.core.epoch}.0`);
    if (read.kind !== "events") throw new Error(`read ${read.kind}`);
    return read.events;
  };
  return { fixture, tab, events };
};

const act = (actionId: string, values: Record<string, unknown>) => ({
  version,
  type: "act",
  actionId,
  acts: [{ type: "answer", itemId: "plan", rev: 1, values, when: WHEN }],
});

// The cards in the other order, no column's order changed: the one-card-per-column fixture's reversal.
const reordered = {
  ...KANBAN_FIXTURE_ITEM.props,
  cards: [...KANBAN_FIXTURE_ITEM.props.cards].reverse(),
};
const milestoneWithEnd = {
  ...TIMELINE_FIXTURE_ITEM.props,
  entries: TIMELINE_FIXTURE_ITEM.props.entries.map((entry) =>
    entry.id === "launch" ? { ...entry, end: "2026-03-09" } : entry,
  ),
};
const movedCard = {
  ...KANBAN_FIXTURE_ITEM.props,
  cards: KANBAN_FIXTURE_ITEM.props.cards.map((card) =>
    card.id === "fix-login" ? { ...card, column: "doing" } : card,
  ),
};

describe("Kanban and Timeline acts over the board protocol", () => {
  for (const [name, actionId, values] of [
    [
      "a Kanban whose cards change places and no column's order",
      "kT7kQ2mPz9XtLw4nB8cYh1",
      { board: reordered },
    ],
    ["a Timeline milestone given an end", "kT7kQ2mPz9XtLw4nB8cYh2", { roadmap: milestoneWithEnd }],
  ] as const) {
    test(`${name} is refused, then the state with the question open and the log empty`, async () => {
      const { fixture, tab, events } = await started();
      try {
        tab.send(act(actionId, values));
        const refused = (await tab.next()) as Record<string, unknown>;
        expect(validateBoardMessage("toPage", refused).ok).toBe(true);
        expect(refused).toMatchObject({ type: "refused", reason: "act", actionId, index: 0 });
        expect(typeof refused.detail).toBe("string");
        const state = (await tab.next()) as {
          type: string;
          state: { questions: { itemId: string; state: string; answer?: unknown }[] };
        };
        expect(validateBoardMessage("toPage", state).ok).toBe(true);
        expect(state.type).toBe("state");
        expect(state.state.questions[0]).toMatchObject({ itemId: "plan", state: "open" });
        expect(state.state.questions[0]?.answer).toBeUndefined();
        expect(events()).toEqual([]);
        tab.socket.terminate();
        expect(fixture.reported).toEqual([]);
      } finally {
        await fixture.host.close();
      }
    });
  }

  test("a moved card is accepted and logs one answer with one set", async () => {
    const { fixture, tab, events } = await started();
    try {
      tab.send(act("kT7kQ2mPz9XtLw4nB8cYh3", { board: movedCard }));
      await tab.next();
      await Bun.sleep(50);
      const logged = events() as readonly { type: string; changes?: unknown[] }[];
      expect(logged.map((event) => event.type)).toEqual(["answer"]);
      expect(logged[0]?.changes).toEqual([
        { op: "set", target: "board.fix-login.column", value: "doing" },
      ]);
      tab.socket.terminate();
      expect(fixture.reported).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });

  test("a Kanban column reordered is accepted: the answered state, and one answer holding the move", async () => {
    const { fixture, tab, events } = await started(orderAsk);
    try {
      const actionId = "kT7kQ2mPz9XtLw4nB8cYh4";
      tab.send(act(actionId, { board: KANBAN_REORDERED_PROPS }));
      const done = (await tab.next()) as Record<string, unknown>;
      expect(validateBoardMessage("toPage", done).ok).toBe(true);
      expect(done).toEqual({ version, type: "done", actionId });
      const state = (await tab.next()) as {
        type: string;
        state: { questions: { itemId: string; state: string }[] };
      };
      expect(validateBoardMessage("toPage", state).ok).toBe(true);
      expect(state.type).toBe("state");
      expect(state.state.questions[0]).toMatchObject({ itemId: "plan", state: "answered" });
      const logged = events() as readonly { type: string; changes?: unknown[] }[];
      expect(logged.map((event) => event.type)).toEqual(["answer"]);
      expect(logged[0]?.changes).toEqual([...KANBAN_REORDER_CHANGES]);
      tab.socket.terminate();
      expect(fixture.reported).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });
});
