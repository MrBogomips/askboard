import { afterAll, describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { TIMELINE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import { freeRange, openSocket, removeViews, startHost } from "./helpers.ts";

// Board-host spec, Answers accepted as sent in the board state (accept-as-sent, task 3.1): an `act`
// whose answer carries `asSent` is logged as an answer accepted as sent, a reconnect shows it in
// the state with receipt `sent` and then `delivered`, and the same act on a question with options
// is refused (reason `act`, the action ID and the index) with the question still open.

const version = BOARD_PROTOCOL_VERSION;
const WHEN = "2026-11-16T09:30:00Z";
const TOKEN = "tkLkt6mPz9XtLw4nB8cYhA";
const ACTION = "kT7kQ2mPz9XtLw4nB8cYh1";

afterAll(removeViews);

const askOf = (askId: string, props: Record<string, unknown>) => ({
  askId,
  title: "Roadmap review",
  items: [
    {
      type: "question",
      id: "plan",
      props: { text: "Does the roadmap fit?", items: [TIMELINE_FIXTURE_ITEM], ...props },
    },
  ],
});

const started = async (ask: ReturnType<typeof askOf>) => {
  const fixture = startHost({ ports: await freeRange(1), tokens: [TOKEN] });
  const { port, askId } = await fixture.ask(undefined, ask);
  const connect = async () => {
    const tab = await openSocket(port, askId);
    tab.send({ version, type: "connect", token: TOKEN });
    await tab.next();
    const state = (await tab.next()) as StateMessage;
    return { tab, state };
  };
  const events = () => {
    const read = fixture.core.read(askId, `${fixture.core.epoch}.0`);
    if (read.kind !== "events") throw new Error(`read ${read.kind}`);
    return read;
  };
  return { fixture, askId, connect, events };
};

type StateMessage = {
  type: string;
  state: { questions: { itemId: string; state: string; answer?: Record<string, unknown> }[] };
};

const accept = (extra: Record<string, unknown> = {}) => ({
  version,
  type: "act",
  actionId: ACTION,
  acts: [{ type: "answer", itemId: "plan", rev: 1, asSent: true, when: WHEN, ...extra }],
});

describe("an accepted Timeline over the board protocol", () => {
  test("is logged as asSent, shown after a reconnect as sent and then as delivered", async () => {
    const { fixture, connect, events, askId } = await started(askOf("roadmap-review-t2v6", {}));
    try {
      const first = await connect();
      first.tab.send(accept({ note: "Va bene così." }));
      expect(await first.tab.next()).toEqual({ version, type: "done", actionId: ACTION });
      await first.tab.next();
      first.tab.socket.terminate();

      const logged = events().events;
      expect(logged.map((event) => event.type)).toEqual(["answer"]);
      expect(logged[0]).toMatchObject({ asSent: true, note: "Va bene così." });
      expect(logged[0]).not.toHaveProperty("changes");

      const again = await connect();
      expect(validateBoardMessage("toPage", { version, ...again.state }).ok).toBe(true);
      expect(again.state.state.questions[0]).toMatchObject({
        state: "answered",
        answer: { asSent: true, note: "Va bene così.", receipt: "sent" },
      });
      again.tab.socket.terminate();

      fixture.core.markRead(askId, events().cursor);
      const delivered = await connect();
      expect(delivered.state.state.questions[0]?.answer).toMatchObject({
        asSent: true,
        receipt: "delivered",
      });
      expect(validateBoardMessage("toPage", { version, ...delivered.state }).ok).toBe(true);
      delivered.tab.socket.terminate();
      expect(fixture.reported).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });
});

describe("an acceptance on a question with options", () => {
  test("is refused with reason act, the action ID and the index, the question still open", async () => {
    const { fixture, connect, events } = await started(
      askOf("roadmap-review-t2v7", { options: [{ label: "Yes" }, { label: "No" }] }),
    );
    try {
      const { tab } = await connect();
      tab.send(accept());
      const refused = (await tab.next()) as Record<string, unknown>;
      expect(validateBoardMessage("toPage", refused).ok).toBe(true);
      expect(refused).toMatchObject({
        type: "refused",
        reason: "act",
        actionId: ACTION,
        index: 0,
        itemId: "plan",
      });
      const state = (await tab.next()) as StateMessage;
      expect(state.state.questions[0]).toMatchObject({ itemId: "plan", state: "open" });
      expect(state.state.questions[0]?.answer).toBeUndefined();
      expect(events().events).toEqual([]);
      tab.socket.terminate();
      expect(fixture.reported).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });
});
