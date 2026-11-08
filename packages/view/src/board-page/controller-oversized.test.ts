// The board page and the board's message limit (oversized-acts: view spec, An answer too large to
// send; design decisions 2 and 3): an act command over the contract's limit is refused with
// nothing sent or held, and a socket closed as too large never has its commands sent again.

import { describe, expect, test } from "bun:test";
import {
  type ActCommand,
  BOARD_MESSAGE_MAX_BYTES,
  type BoardState,
  boardMessageBytes,
  DRAFT_RECORD_MAX_CHARS,
  type DraftRecord,
  draftRecordChars,
  type HostMessage,
  MESSAGE_TOO_BIG_CLOSE,
} from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import {
  answer,
  board,
  commandOf,
  done,
  ID,
  opened,
  queued,
  sent,
  settled,
  setUp,
  stateOf,
  version,
  waiting,
} from "../../test/board-page/controller-harness.ts";

const WHEN = answer.when;
const noteAct = (itemId: string, note: string) =>
  ({ type: "note", itemId, rev: 1, note, when: WHEN }) as const;
const noteView = (itemId: string, note: string) =>
  ({ type: "act", acts: [noteAct(itemId, note)] }) as const;

// Characters of a note that make the command, with an action ID, measure `over` bytes past the limit.
const noteFor = (over: number): string => {
  const base = boardMessageBytes(commandOf(1, [noteAct("database", "")]));
  return "x".repeat(BOARD_MESSAGE_MAX_BYTES - base + over);
};

// A board of two questions, `database` and `cache`, both open.
const [question] = plainChoiceBoardDocument.items;
const twoQuestions = {
  ...plainChoiceBoardDocument,
  items: [question, { ...question, id: "cache" }],
} as unknown as typeof plainChoiceBoardDocument;
const twoBoard: HostMessage = { version, type: "board", document: twoQuestions };
const twoWaiting = {
  ask: "waiting",
  questions: [
    { itemId: "database", rev: 1, state: "open" },
    { itemId: "cache", rev: 1, state: "open" },
  ],
} as unknown as BoardState;

const openedTwo = async () => {
  const run = setUp();
  run.socket(1).receive(twoBoard, stateOf(twoWaiting));
  await settled();
  await run.view({ type: "ready", itemId: "database" });
  await run.view({ type: "ready", itemId: "cache" });
  return run;
};

describe("an act command over the message limit is refused by the board page", () => {
  test("one byte over: refused with its size, nothing sent, nothing held, the board stays live", async () => {
    const run = await openedTwo();
    const reply = await run.view(noteView("database", noteFor(1)));
    expect(reply).toMatchObject({
      outcome: "refused",
      size: { bytes: BOARD_MESSAGE_MAX_BYTES + 1, max: BOARD_MESSAGE_MAX_BYTES },
    });
    expect((reply as { detail: string }).detail).toContain(String(BOARD_MESSAGE_MAX_BYTES + 1));
    expect(run.acts(1)).toEqual([]);
    expect(run.updates.every((update) => update.pending === undefined)).toBe(true);
    expect(run.updates.at(-1)?.connection).toBeUndefined();
    expect(run.banner()).toBeUndefined();
    expect(run.pending()).toEqual([]);
  });

  test("a later act on another question is sent, and logged once the refusal is", async () => {
    const run = await openedTwo();
    await run.view(noteView("database", noteFor(1)));
    const reply = await run.view(noteView("cache", "after"));
    expect(reply).toMatchObject({ outcome: "sent" });
    expect(run.acts(1)).toHaveLength(1);
    expect((run.acts(1)[0] as ActCommand).acts[0]).toMatchObject({ itemId: "cache" });
  });

  test("exactly at the limit: sent", async () => {
    const run = await openedTwo();
    const reply = await run.view(noteView("database", noteFor(0)));
    expect(reply).toMatchObject({ outcome: "sent" });
    const [command] = run.acts(1);
    expect(boardMessageBytes(command)).toBe(BOARD_MESSAGE_MAX_BYTES);
  });

  test("the refusal is logged once, with sizes and no user text", async () => {
    const run = await openedTwo();
    await run.view(noteView("database", noteFor(1)));
    expect(run.logs).toHaveLength(1);
    expect(run.logs[0]).toContain(String(BOARD_MESSAGE_MAX_BYTES));
    expect(run.logs[0]).not.toContain("xxxx");
  });

  test("while the connection is lost the same act is refused too, never held", async () => {
    const run = await openedTwo();
    run.socket(1).close(1006);
    expect(await run.view(noteView("database", noteFor(1)))).toMatchObject({
      outcome: "refused",
    });
    run.tick();
    run.socket(2).receive(twoBoard, stateOf(twoWaiting));
    expect(run.acts(2)).toEqual([]);
  });

  test("an act over the limit made of several acts is refused whole", async () => {
    const run = await openedTwo();
    const half = noteFor(1).slice(0, Math.ceil(BOARD_MESSAGE_MAX_BYTES / 2));
    const reply = await run.view({
      type: "act",
      acts: [noteAct("database", half), noteAct("cache", half)],
    });
    expect(reply).toMatchObject({ outcome: "refused", size: { max: BOARD_MESSAGE_MAX_BYTES } });
    expect(run.acts(1)).toEqual([]);
  });
});

describe("a socket closed as too large never has its commands sent again (the reviewer's loop probe)", () => {
  test("after a 1009 close the same command is never resent, and a later answer on another question arrives", async () => {
    const run = await openedTwo();
    expect(await run.view(noteView("database", "first"))).toEqual(sent());
    run.socket(1).close(MESSAGE_TOO_BIG_CLOSE);
    // Six more sockets, as the review's probe ran them: the command goes on none.
    for (let n = 2; n <= 7; n += 1) {
      expect(run.pending()).toEqual([250]);
      run.tick();
      run.socket(n).receive(twoBoard, stateOf(twoWaiting));
      expect(run.acts(n)).toEqual([]);
      if (n < 7) run.socket(n).close(1006);
    }
    // The view hears it settled as refused and too large (each update repeats the latest
    // settlements, the view acting on each action ID once), and holds nothing.
    const once = new Map(
      run.updates.flatMap((update) => update.settled ?? []).map((act) => [act.actionId, act]),
    );
    expect([...once.values()]).toEqual([{ actionId: ID(1), outcome: "refused", tooLarge: true }]);
    expect(run.updates.at(-1)?.pending).toBeUndefined();
    expect(run.banner()).toBeUndefined();
    // A later answer on another question goes on the current socket.
    expect(await run.view(noteView("cache", "second"))).toEqual(sent(2));
    expect(run.acts(7)).toEqual([commandOf(2, [noteAct("cache", "second")])]);
  });

  test("the close is logged with the number of commands dropped and the board reconnects as after any drop", async () => {
    const run = await openedTwo();
    await run.view(noteView("database", "first"));
    run.socket(1).close(MESSAGE_TOO_BIG_CLOSE);
    expect(run.banner()?.variant).toBe("connection-lost");
    expect(run.updates.at(-1)).toMatchObject({
      connection: "lost",
      settled: [{ actionId: ID(1), outcome: "refused", tooLarge: true }],
    });
    expect(run.logs.some((line) => line.includes("1 command"))).toBe(true);
    expect(run.pending()).toEqual([250]);
  });

  test("a command queued at the time of the close is sent on the new socket", async () => {
    const run = await openedTwo();
    await run.view(noteView("database", "first"));
    // The socket stops taking messages before its close event arrives: the next act is held unsent.
    run.socket(1).open = false;
    expect(await run.view(noteView("cache", "second"))).toEqual(queued(2));
    run.socket(1).events.onClose(MESSAGE_TOO_BIG_CLOSE);
    run.tick();
    run.socket(2).receive(twoBoard, stateOf(twoWaiting));
    expect(run.acts(2)).toEqual([commandOf(2, [noteAct("cache", "second")])]);
  });

  test("a 1009 before the socket's state drops nothing: the sent command goes again on the next socket", async () => {
    const run = await openedTwo();
    await run.view(noteView("database", "first"));
    run.socket(1).close(1006);
    run.tick();
    run.socket(2).receive(twoBoard);
    run.socket(2).close(MESSAGE_TOO_BIG_CLOSE);
    expect(run.updates.flatMap((update) => update.settled ?? [])).toEqual([]);
    run.tick();
    run.socket(3).receive(twoBoard, stateOf(twoWaiting));
    expect(run.acts(3)).toEqual([commandOf(1, [noteAct("database", "first")])]);
  });

  test("a 1006 close still sends the command again, with the same action ID", async () => {
    const run = await openedTwo();
    await run.view(noteView("database", "first"));
    run.socket(1).close(1006);
    run.tick();
    run.socket(2).receive(twoBoard, stateOf(twoWaiting));
    expect(run.acts(2)).toEqual([commandOf(1, [noteAct("database", "first")])]);
    expect(run.updates.flatMap((update) => update.settled ?? [])).toEqual([]);
  });

  test("a command already acknowledged is not dropped by the close: the state that follows settles it done", async () => {
    const run = await openedTwo();
    await run.view(noteView("database", "first"));
    run.socket(1).receive(done());
    run.socket(1).close(MESSAGE_TOO_BIG_CLOSE);
    run.tick();
    run.socket(2).receive(twoBoard, stateOf(twoWaiting));
    expect(run.acts(2)).toEqual([]);
    expect(run.updates.at(-1)?.settled).toEqual([{ actionId: ID(1), outcome: "done" }]);
  });

  test("the view's answer on the plain board still goes (the shared harness is intact)", async () => {
    const run = await opened();
    expect(await run.view(answer)).toEqual(sent());
    expect(board).toBeDefined();
    expect(stateOf(waiting)).toBeDefined();
  });
});

// The draft mirror keeps whole questions that fit (design decision 4; view spec, Work too large to
// keep across a reload, Leave-page prompt).
describe("a draft record over the draft limit is mirrored without whole questions", () => {
  const large = (chars = DRAFT_RECORD_MAX_CHARS + 1) =>
    ({ rev: 1, results: { database: "x".repeat(chars) } }) as const;
  const small = { rev: 1, note: "keep me" } as const;
  const both: DraftRecord = {
    delivery: "immediate",
    questions: { database: large(), cache: small },
  };
  const onlyLarge: DraftRecord = { delivery: "immediate", questions: { database: large() } };

  test("the mirrored record holds the small question and none of the large one's work; the reply says which was left out", async () => {
    const run = await openedTwo();
    expect(draftRecordChars(both)).toBeGreaterThan(DRAFT_RECORD_MAX_CHARS);
    expect(await run.view({ type: "draft", record: both })).toEqual({ leftOut: ["database"] });
    run.fire(300);
    const [draft] = run.drafts(1);
    expect(draft).toEqual({
      version,
      type: "draft",
      record: { delivery: "immediate", questions: { cache: small } },
    });
    expect(run.logs.some((line) => line.includes("refused"))).toBe(false);
  });

  test("the leave-page prompt is armed when the only work is left out", async () => {
    const run = await openedTwo();
    expect(run.page.leavePromptArmed()).toBe(false);
    expect(await run.view({ type: "draft", record: onlyLarge })).toEqual({
      leftOut: ["database"],
    });
    expect(run.page.leavePromptArmed()).toBe(true);
    run.page.flushDraft();
    expect(run.drafts(1)).toEqual([
      { version, type: "draft", record: { delivery: "immediate", questions: {} } },
    ]);
  });

  test("Copy my unsent work holds the left-out question's work", async () => {
    const run = await openedTwo();
    await run.view({ type: "draft", record: both });
    await run.page.copyUnsentWork();
    const [text] = run.copies;
    expect(text).toContain('database: "xxxx');
    expect(text?.length).toBeGreaterThan(DRAFT_RECORD_MAX_CHARS);
    expect(text).toContain("Note for the agent: keep me");
  });

  test("the closed banner says the work was not sent, and a Snapshot request reports unsent work", async () => {
    const run = await openedTwo();
    await run.view({ type: "draft", record: onlyLarge });
    expect(run.page.takeSnapshot()).toEqual({
      outcome: "sent",
      requestId: ID(1),
      unsentWork: true,
    });
    run.socket(1).receive({ version, type: "closed", reason: "agent" });
    expect(run.banner()).toMatchObject({
      variant: "closed",
      detail: "Your unsent work was not sent",
      action: "Copy my unsent work",
    });
  });

  test("a later record that fits is mirrored whole, with no question left out", async () => {
    const run = await openedTwo();
    await run.view({ type: "draft", record: both });
    const fits: DraftRecord = {
      delivery: "immediate",
      questions: { database: { rev: 1, results: { database: "short" } }, cache: small },
    };
    expect(await run.view({ type: "draft", record: fits })).toEqual({});
    run.fire(300);
    expect(run.drafts(1).at(-1)).toEqual({ version, type: "draft", record: fits });
  });

  test("with two large questions the largest is left out first, and only as many as needed", async () => {
    const run = await openedTwo();
    const half = Math.floor(DRAFT_RECORD_MAX_CHARS * 0.6);
    const record: DraftRecord = {
      delivery: "immediate",
      questions: { database: large(half), cache: large(half + 1_000) },
    };
    expect(await run.view({ type: "draft", record })).toEqual({ leftOut: ["cache"] });
    run.fire(300);
    const [mirrored] = run.drafts(1);
    expect(Object.keys((mirrored as { record: DraftRecord }).record.questions)).toEqual([
      "database",
    ]);
  });

  test("a record that fails the protocol's schema, or names a question the board lacks, is still refused", async () => {
    const run = await openedTwo();
    const wrong = {
      delivery: "immediate",
      questions: { database: { rev: 0 } },
    } as unknown as DraftRecord;
    expect(await run.view({ type: "draft", record: wrong })).toMatchObject({ outcome: "refused" });
    const strange: DraftRecord = {
      delivery: "immediate",
      questions: { nowhere: large(), cache: small },
    };
    expect(await run.view({ type: "draft", record: strange })).toMatchObject({
      outcome: "refused",
      detail: '/questions/nowhere: "nowhere" names no question of the ask',
    });
    run.page.flushDraft();
    expect(run.drafts(1)).toEqual([]);
  });

  test("a record whose fields outside its questions pass the limit is refused, as before", async () => {
    const run = await openedTwo();
    const record = {
      delivery: "immediate",
      inView: "x".repeat(DRAFT_RECORD_MAX_CHARS + 1),
      questions: {},
    } as unknown as DraftRecord;
    expect(await run.view({ type: "draft", record })).toMatchObject({ outcome: "refused" });
  });

  test("a record the board restores is not replaced by one that was never mirrored", async () => {
    const run = await openedTwo();
    await run.view({ type: "draft", record: both });
    run
      .socket(1)
      .receive({ version, type: "draft", record: { delivery: "immediate", questions: {} } });
    expect(run.updates.some((update) => update.restore !== undefined)).toBe(false);
  });
});
