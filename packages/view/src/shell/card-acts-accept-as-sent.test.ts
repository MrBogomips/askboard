import { describe, expect, test } from "bun:test";
import type { ViewQuestion } from "../view-document.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createAnswerActs } from "./answer-acts.ts";
import { createBoardDraft, type Delivery } from "./board-draft.ts";
import { acceptAsSent, answer, pressAnswer, withDerived } from "./card-acts.ts";
import type { ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { sentMessageOf } from "./flow-messages.ts";
import { settle } from "./revision-confirm.ts";
import { createStatusMessages } from "./status-messages.ts";

// "Accept as is" takes "Answer"'s path (accept-as-sent, design decision 5): the field checks, the
// confirmation of a received verdict, immediate delivery sending at once, submitted delivery
// marking it ready, and the status message. The act carries `asSent`, the note and the derived
// values, never values, a choice or results.

const ACTION_ID = "AAAAAAAAAAAAAAAAAAAAAA";
const TREE = { nodes: [{ id: "ux", label: "UX" }] };
const plan = {
  type: "question",
  id: "plan",
  rev: 1,
  props: { text: "Is the plan right?", items: [{ type: "tree", id: "t", props: TREE }] },
} as unknown as ViewQuestion;

// A type whose field check refuses an empty value, as a required field does.
const requiring = (type: string) =>
  type === "text-field" ? { check: () => ({ code: "required" as const }) } : {};

const setUp = (delivery: Delivery = "immediate", facts: (type: string) => object = () => ({})) => {
  const sent: ViewMessage[] = [];
  const channel: ViewChannel = {
    send: async (message) => {
      sent.push(message);
      return { outcome: "sent", actionId: ACTION_ID };
    },
    onUpdate: () => () => {},
    onTheme: () => () => {},
  };
  const draft = createDraftStore();
  const results = createDraftStore();
  const board = createBoardDraft(delivery);
  const derived = createDerivedStore();
  const status = createStatusMessages();
  const log: unknown[] = [];
  status.subscribe(() => log.push(status.get().messages.at(-1)));
  return {
    sent,
    draft,
    board,
    derived,
    log,
    context: {
      channel,
      acts: createAnswerActs(),
      draft,
      results,
      board,
      derived,
      delivery,
      status,
      facts,
    } as Parameters<typeof answer>[1],
  };
};

describe("Accept as is in immediate delivery", () => {
  test("sends one answer act with asSent and the note, and no values, choice or results", () => {
    const { sent, board, context } = setUp();
    board.edit("plan", 1, () => ({ rev: 1, note: "Va bene così." }));
    expect(acceptAsSent(plan, context)).toBe("sent");
    expect(sent).toEqual([
      {
        type: "answer",
        itemId: "plan",
        rev: 1,
        asSent: true,
        note: "Va bene così.",
        when: expect.stringMatching(/Z$/),
      },
    ]);
  });

  test("with no note it still sends, which Answer would not", () => {
    const { sent, context } = setUp();
    expect(answer(plan, context)).toBeUndefined();
    expect(sent).toEqual([]);
    expect(acceptAsSent(plan, context)).toBe("sent");
    expect(sent).toEqual([expect.objectContaining({ type: "answer", asSent: true })]);
  });

  test("carries the derived values the items reported", () => {
    const { sent, derived, context } = setUp();
    derived.report("t", { "t.count": 1 });
    acceptAsSent(plan, context);
    expect(sent[0]).toMatchObject({ asSent: true, derived: { "t.count": 1 } });
  });

  test("a value equal to what was sent, held in the draft, is not carried", () => {
    const { sent, draft, context } = setUp();
    draft.set("t", structuredClone(TREE));
    acceptAsSent(plan, context);
    expect(sent[0]).toMatchObject({ asSent: true });
    expect(sent[0]).not.toHaveProperty("values");
    expect(sent[0]).not.toHaveProperty("choice");
    expect(sent[0]).not.toHaveProperty("results");
  });

  test("says the acceptance in the status region once the command is sent", async () => {
    const { log, context } = setUp();
    acceptAsSent(plan, context);
    expect(log).toEqual([]);
    await Bun.sleep(0);
    expect(log).toEqual([{ key: "status.acceptedAsIs" }]);
  });

  test("a failing field blocks it: nothing is sent", () => {
    const { sent, context } = setUp("immediate", requiring);
    const blocked = {
      ...plan,
      props: {
        ...plan.props,
        items: [{ type: "text-field", id: "who", props: { label: "Who", required: true } }],
      },
    } as unknown as ViewQuestion;
    expect(acceptAsSent(blocked, context)).toBeUndefined();
    expect(sent).toEqual([]);
  });
});

describe("Accept as is in submitted delivery", () => {
  test("marks the answer ready, with asSent on the hold, and sends nothing", () => {
    const { sent, board, log, context } = setUp("submitted");
    expect(acceptAsSent(plan, context)).toBe("held");
    expect(board.work("plan")?.held).toEqual({ act: "answer", order: 0, asSent: true });
    expect(sent).toEqual([]);
    expect(log).toEqual([{ key: "status.ready", params: { count: 1 } }]);
  });

  test("pressed again it takes the mark back", () => {
    const { board, context } = setUp("submitted");
    acceptAsSent(plan, context);
    expect(acceptAsSent(plan, context)).toBe("released");
    expect(board.work("plan")?.held).toBeUndefined();
  });
});

describe("a press of Accept as is", () => {
  test("goes through pressAnswer with the asSent option, and sends at once without a received verdict", () => {
    const { sent, context } = setUp();
    const outcomes: unknown[] = [];
    const pressed = pressAnswer(plan, context, undefined, (outcome) => outcomes.push(outcome), {
      asSent: true,
    });
    expect(pressed).toEqual({ kind: "done" });
    expect(outcomes).toEqual(["sent"]);
    expect(sent).toEqual([expect.objectContaining({ asSent: true })]);
  });

  test("on a question whose verdict the agent received, the confirmation asks first and sends nothing", () => {
    const { sent, context } = setUp("immediate", (type) =>
      type === "tree" ? { confirmsRevision: true as const } : {},
    );
    const status = {
      itemId: "plan",
      rev: 1,
      state: "answered",
      answer: { asSent: true, when: "2026-11-16T09:00:00Z", receipt: "delivered" },
    } as never;
    const pressed = pressAnswer(plan, context, status, () => {}, { asSent: true });
    expect(pressed.kind).toBe("waiting");
    expect(sent).toEqual([]);
    if (pressed.kind === "waiting") {
      expect(settle(pressed.waiting, true)).toBe("sent");
      expect(sent).toEqual([expect.objectContaining({ asSent: true })]);
    }
  });
});

describe("the derived values of an accepted answer", () => {
  test("withDerived counts asSent as answering content", () => {
    const reported = () => ({ "t.count": 2 });
    expect(withDerived({ asSent: true }, reported, ["t"])).toEqual({
      asSent: true,
      derived: { "t.count": 2 },
    });
  });
});

describe("the status of a command that accepts as sent", () => {
  test("is the acceptance's own message, with no option", () => {
    const act = {
      type: "answer",
      itemId: "plan",
      rev: 1,
      asSent: true,
      when: "2026-11-16T09:00:00Z",
    } as const;
    expect(sentMessageOf("answer", [act])).toEqual({ key: "status.acceptedAsIs" });
  });
});
