import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewMessage } from "../view-protocol.ts";
import { createAnswerActs } from "./answer-acts.ts";
import { createBoardDraft } from "./board-draft.ts";
import { answer, sendActs } from "./card-acts.ts";
import type { ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { createSizeNotices } from "./size-notices.ts";

// What a refusal of a command as too large leaves on the cards (oversized-acts, design decisions 2
// and 3): a notice per question, the work and the held acts untouched.

const [database] = plainChoiceBoardDocument.items;
const when = "2026-10-30T10:00:00.250Z";
const size = { bytes: 6_800_000, max: 6_004_096 };
const noteOf = (itemId: string) => ({ type: "note", itemId, rev: 1, note: "n", when }) as const;

const setUp = (reply: Record<string, unknown> | undefined) => {
  const sent: ViewMessage[] = [];
  const channel: ViewChannel = {
    send: async (message) => {
      sent.push(message);
      return reply;
    },
    onUpdate: () => () => {},
    onTheme: () => () => {},
  };
  const draft = createDraftStore();
  const board = createBoardDraft("immediate");
  const acts = createAnswerActs();
  const notices = createSizeNotices(() => []);
  return {
    sent,
    draft,
    board,
    acts,
    notices,
    context: {
      channel,
      acts,
      notices,
      draft,
      board,
      derived: createDerivedStore(),
      delivery: "immediate" as const,
    },
  };
};

const refusedWithSize = { outcome: "refused", detail: "too big", size };

describe("a command the board page refused as too large", () => {
  test("sets an answer notice on each question its acts name, once", async () => {
    const { context, notices, acts } = setUp(refusedWithSize);
    sendActs(context, [noteOf("database"), noteOf("cache"), noteOf("database")]);
    await Bun.sleep(0);
    expect(notices.noticeOf("database")).toEqual({ kind: "answer", size });
    expect(notices.noticeOf("cache")).toEqual({ kind: "answer", size });
    expect(acts.of("database")).toBeUndefined();
  });

  test("sets a submit notice when Submit sent it", async () => {
    const { context, notices } = setUp(refusedWithSize);
    sendActs(context, [noteOf("database"), noteOf("cache")], "submit");
    await Bun.sleep(0);
    expect(notices.noticeOf("database")).toEqual({ kind: "submit", size });
    expect(notices.noticeOf("cache")).toEqual({ kind: "submit", size });
  });

  test("a card's own Answer sets the notice, and the draft and the held acts stay", async () => {
    const { context, notices, draft, board } = setUp(refusedWithSize);
    draft.set("database", ["PostgreSQL"]);
    board.edit("database", 1, () => ({ rev: 1, note: "Go.", held: { act: "decline", order: 0 } }));
    answer(database, context);
    await Bun.sleep(0);
    expect(notices.noticeOf("database")).toEqual({ kind: "answer", size });
    expect(draft.valueOf("database")).toEqual(["PostgreSQL"]);
    expect(board.work("database")).toMatchObject({ note: "Go.", held: { act: "decline" } });
  });

  test("a refusal with no size, or any other reply, sets no notice", async () => {
    for (const reply of [
      { outcome: "refused", detail: "the ask is closed" },
      { outcome: "sent", actionId: "AAAAAAAAAAAAAAAAAAAAAA", size },
      undefined,
    ]) {
      const { context, notices } = setUp(reply);
      sendActs(context, [noteOf("database")]);
      await Bun.sleep(0);
      expect(notices.noticeOf("database")).toBeUndefined();
    }
  });

  test("a later command of the question clears its notice as it is sent", async () => {
    const { context, notices } = setUp({ outcome: "sent", actionId: "AAAAAAAAAAAAAAAAAAAAAA" });
    notices.refused(["database", "cache"], size, "answer");
    sendActs(context, [noteOf("database")]);
    expect(notices.noticeOf("database")).toBeUndefined();
    expect(notices.noticeOf("cache")).toBeDefined();
  });

  test("a board with no notices store sends as before", async () => {
    const { context, sent } = setUp(refusedWithSize);
    const { notices: _, ...bare } = context;
    sendActs(bare, [noteOf("database")]);
    await Bun.sleep(0);
    expect(sent).toHaveLength(1);
  });
});
