// The board page's controller against fakes of its socket, its view, its timers and its chrome:
// what design decision 8 and AD-21 ask of it, without a browser; since the ask lifecycle, act
// commands with action IDs, the draft mirror, the closed ask and the leave-page prompt
// (ask-lifecycle, design decision 6).

import { describe, expect, test } from "bun:test";
import {
  BOARD_CLOSE_CODES,
  type BoardState,
  DRAFT_RECORD_MAX_DEPTH,
  type DraftRecord,
  type HostMessage,
  JSON_MAX_DEPTH,
} from "@askboard/contract";
import {
  contextBoardDocument,
  ganttEditedValue,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import {
  answer,
  answerAct,
  answered,
  board,
  command,
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

describe("the board page opens its board (design decision 8)", () => {
  test("opens one socket at once and loads the view with the board document and the state", async () => {
    const run = setUp();
    expect(run.sockets).toHaveLength(1);
    run.socket(1).receive(board);
    expect(run.titles).toEqual(["Which database should the order service use? · AskBoard"]);
    expect(run.loads).toEqual([]);
    run.socket(1).receive(stateOf(waiting));
    await settled();
    expect(run.loads).toEqual([{ document: plainChoiceBoardDocument, state: waiting }]);
    expect(run.updates).toEqual([{ type: "state", state: waiting }]);
    expect(run.banner()).toBeUndefined();
    expect(run.loadErrors).toEqual([undefined]);
  });

  test("each later state, and a receipt, reach the view (FR-22)", async () => {
    const run = await opened();
    run.socket(1).receive(stateOf(answered("sent")));
    run.socket(1).receive({ version, type: "receipt", itemId: "database", receipt: "delivered" });
    expect(run.updates.slice(-2)).toEqual([
      { type: "state", state: answered("sent") },
      { type: "state", state: answered("delivered") },
    ]);
    expect(run.loads).toHaveLength(1);
  });

  test("a message the protocol refuses, or a state that is not the board's, is never acted on", async () => {
    const run = await opened();
    run.socket(1).events.onInvalid([{ path: "/type", message: "no" }]);
    const other: BoardState = {
      ask: "waiting",
      questions: [{ itemId: "cache", rev: 1, state: "open" }],
    };
    run.socket(1).receive(stateOf(other));
    expect(run.updates).toEqual([{ type: "state", state: waiting }]);
    expect(run.logs).toEqual([
      "board-host sent a message the board protocol refuses",
      'board-host sent a state the board page cannot act on: the state names "cache", which the board document does not hold at revision 1',
    ]);
  });

  test("the view's ready and item-error messages are recorded, an item error logged", async () => {
    const run = await opened();
    expect(await run.view({ type: "item-error", itemId: "database", error: "boom" })).toEqual({});
    expect(run.logs).toEqual(['the item "database" failed in the view: boom']);
    expect(await run.view(answer)).toEqual({
      outcome: "refused",
      detail: "the question's item failed in the view",
    });
    expect(run.acts(1)).toEqual([]);
  });

  test("a view that fails to load is shown, and loads again on the next socket", async () => {
    const run = await opened({ failLoads: 1 });
    expect(run.loadErrors).toEqual(["The board could not be loaded: /m answered 503"]);
    expect(run.logs).toEqual(["the view did not load"]);
    run.socket(1).receive(stateOf(waiting));
    await settled();
    expect(run.loads).toHaveLength(1);
    run.socket(1).close(1006);
    run.tick();
    run.socket(2).receive(board, stateOf(waiting));
    await settled();
    expect(run.loads).toHaveLength(2);
    expect(run.loadErrors).toEqual(["The board could not be loaded: /m answered 503", undefined]);
  });
});

describe("answers, as act commands with action IDs (FR-22, AD-10, AD-20)", () => {
  test("an answer while connected goes at once as one act command; the reply names its action ID", async () => {
    const run = await opened();
    expect(await run.view(answer)).toEqual(sent());
    expect(run.acts(1)).toEqual([command]);
  });

  test("an answer the board page cannot send is refused, saying why, and nothing goes", async () => {
    const run = setUp();
    run.socket(1).receive(board, stateOf(waiting));
    await settled();
    expect(await run.view(answer)).toEqual({
      outcome: "refused",
      detail: "the question never counted as visible",
    });
    expect(run.acts(1)).toEqual([]);
  });

  const foreign = (itemId: string) => ({
    outcome: "refused",
    detail: `the answer carries a value for "${itemId}", which is not a widget item of the question`,
  });

  test("an answer with a value for an item its question does not hold is refused, saying why, and nothing goes (design decision 8)", async () => {
    const run = await opened();
    // A test-only `probe` widget item's value (design decision 12).
    const values = { sketch: { size: 4 } };
    const { choice: _, ...widgetOnly } = answer;
    for (const message of [
      { ...answer, values },
      { ...widgetOnly, values },
    ]) {
      expect(await run.view(message)).toEqual(foreign("sketch"));
    }
    expect(await run.view({ type: "act", acts: [{ ...answerAct, values }] })).toEqual(
      foreign("sketch"),
    );
    expect(run.acts(1)).toEqual([]);
    expect(run.updates.every((update) => update.pending === undefined)).toBe(true);
    expect(await run.view(answer)).toEqual(sent());
    expect(run.acts(1)).toEqual([command]);
  });

  test("an answer or answer act carrying a Gantt's value for an item of another question is refused, saying why, and nothing goes (design decision 8)", async () => {
    const run = await opened();
    const gantt = {
      values: { release: ganttEditedValue },
      derived: { "release.finish": "2026-12-16", "release.criticalPath": ["reporting"] },
    };
    const { choice: _, ...widgetOnly } = answer;
    const { choice: _act, ...widgetOnlyAct } = answerAct;
    for (const message of [
      { ...answer, ...gantt },
      { ...widgetOnly, ...gantt },
      { type: "act", acts: [{ ...answerAct, ...gantt }] } as const,
      { type: "act", acts: [{ ...widgetOnlyAct, ...gantt }] } as const,
    ]) {
      expect(await run.view(message)).toEqual(foreign("release"));
    }
    expect(run.acts(1)).toEqual([]);
    expect(run.updates.every((update) => update.pending === undefined)).toBe(true);
  });

  test("an act command from the view goes whole, in the user's order, under one action ID", async () => {
    const run = await opened();
    const acts = [
      { type: "note", itemId: "database", rev: 1, note: "Ask ops.", when: answer.when },
      answerAct,
    ] as const;
    expect(await run.view({ type: "act", acts })).toEqual(sent());
    expect(run.acts(1)).toEqual([commandOf(1, acts)]);
  });

  test("while disconnected an act is queued, then sent with its action ID once the new socket's state shows its question as it was", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    expect(await run.view(answer)).toEqual(queued());
    run.tick();
    run.socket(2).receive(board);
    expect(run.acts(2)).toEqual([]);
    run.socket(2).receive(stateOf(waiting));
    expect(run.acts(2)).toEqual([command]);
    run.socket(2).receive(stateOf(waiting));
    expect(run.acts(2)).toEqual([command]);
    run.socket(2).receive(done(), stateOf(answered("sent")));
    expect(run.updates.at(-1)).toEqual({
      type: "state",
      state: answered("sent"),
      settled: [{ actionId: ID(1), outcome: "done" }],
    });
  });

  test("a command sent on a socket that dropped before its acknowledgement goes again, with the same action ID", async () => {
    const run = await opened();
    await run.view(answer);
    run.socket(1).close(1006);
    run.tick();
    run.socket(2).receive(board, stateOf(answered("sent")));
    expect(run.acts(2)).toEqual([command]);
    run.socket(2).receive(done(), stateOf(answered("sent")));
    run.socket(2).close(1006);
    run.tick();
    run.socket(3).receive(board, stateOf(answered("sent")));
    expect(run.acts(3)).toEqual([]);
  });

  test("a queued act whose question the new state shows changed is dropped, never sent (AD-10)", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    await run.view(answer);
    run.tick();
    run.socket(2).receive(board, stateOf(answered("delivered")));
    expect(run.acts(2)).toEqual([]);
    expect(run.logs.at(-1)).toBe(
      `the command ${ID(1)} was not sent: the board changed while it was not live`,
    );
    expect(run.updates.at(-1)?.settled).toEqual([{ actionId: ID(1), outcome: "dropped" }]);
    run.socket(2).close(1006);
    run.tick();
    run.socket(3).receive(board, stateOf(waiting));
    expect(run.acts(3)).toEqual([]);
  });

  test("a queued act the board page would refuse by the time it reconnects is dropped, saying why", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    await run.view(answer);
    await run.view({ type: "item-error", itemId: "database", error: "boom" });
    run.tick();
    run.socket(2).receive(board, stateOf(waiting));
    expect(run.acts(2)).toEqual([]);
    expect(run.logs.at(-1)).toBe(
      `the command ${ID(1)} was not sent: the question's item failed in the view`,
    );
  });

  test("a command board-host refuses is not held any more, and settles as refused", async () => {
    const run = await opened();
    await run.view(answer);
    run.socket(1).receive({
      version,
      type: "refused",
      reason: "act",
      actionId: ID(1),
      index: 0,
      itemId: "database",
      detail: "the question is at revision 2",
    });
    expect(run.logs).toEqual([
      `board-host refused the command ${ID(1)} (act 1, "database"): the question is at revision 2`,
    ]);
    run.socket(1).receive(stateOf(waiting));
    expect(run.updates.at(-1)).toEqual({
      type: "state",
      state: waiting,
      settled: [{ actionId: ID(1), outcome: "refused" }],
    });
    run.socket(1).close(1006);
    run.tick();
    run.socket(2).receive(board, stateOf(waiting));
    expect(run.acts(2)).toEqual([]);
  });

  test("an act the socket would not take is queued", async () => {
    const run = await opened();
    run.socket(1).open = false;
    expect(await run.view(answer)).toEqual(queued());
  });

  test("no act on a moved, discarded or closed board", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "closed", reason: "agent" });
    expect(await run.view(answer)).toEqual({ outcome: "refused", detail: "the ask is closed" });
    run.socket(1).receive({ version, type: "moved" });
    expect(await run.view(answer)).toEqual({
      outcome: "refused",
      detail: "the board moved to another tab",
    });
    run.socket(1).receive({ version, type: "discarded", reason: "session-exit" });
    expect(await run.view(answer)).toEqual({ outcome: "refused", detail: "the ask was discarded" });
    expect(run.acts(1)).toEqual([]);
  });
});

describe("the commands the view hears the board page holds", () => {
  test("a command shows as held before its reply, sent or queued, until the state after its done", async () => {
    const run = await opened();
    const reply = run.view(answer);
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting, pending: [sent()] });
    expect(await reply).toEqual(sent());
    run.socket(1).close(1006);
    expect(run.updates.at(-1)).toEqual({
      type: "state",
      state: waiting,
      connection: "lost",
      pending: [sent()],
    });
    run.tick();
    run.socket(2).receive(board, stateOf(waiting));
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting, pending: [sent()] });
    run.socket(2).receive(done());
    run.socket(2).receive(stateOf(answered("sent")));
    expect(run.updates.at(-1)).toEqual({
      type: "state",
      state: answered("sent"),
      settled: [{ actionId: ID(1), outcome: "done" }],
    });
  });

  test("a queued command shows as queued, then sent on the new socket", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    await run.view(answer);
    expect(run.updates.at(-1)?.pending).toEqual([queued()]);
    run.tick();
    run.socket(2).receive(board, stateOf(waiting));
    expect(run.updates.at(-1)?.pending).toEqual([sent()]);
  });

  test("a discard drops what was held", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    await run.view(answer);
    run.tick();
    run.socket(2).receive({ version, type: "refused", reason: "token", detail: "no" });
    expect(run.updates.at(-1)).toEqual({
      type: "state",
      state: waiting,
      lock: "discarded",
      settled: [{ actionId: ID(1), outcome: "dropped" }],
    });
  });
});

describe("the connection (design decision 5, AD-21)", () => {
  for (const code of [1006, 1013]) {
    test(`a close with ${code} shows Connection lost, retrying, and reconnects with backoff`, async () => {
      const run = await opened();
      run.socket(1).close(code);
      expect(run.banner()?.variant).toBe("connection-lost");
      expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting, connection: "lost" });
      expect(run.pending()).toEqual([250]);
      run.tick();
      expect(run.sockets).toHaveLength(2);
      run.socket(2).close(1006);
      expect(run.pending()).toEqual([500]);
      run.tick();
      run.socket(3).receive(board);
      expect(run.banner()?.variant).toBe("connection-lost");
      run.socket(3).receive(stateOf(answered("sent")));
      expect(run.banner()).toBeUndefined();
      expect(run.updates.at(-1)).toEqual({ type: "state", state: answered("sent") });
      run.socket(3).close(1006);
      expect(run.pending()).toEqual([250]);
    });
  }

  test("after 4403, 4409 or 4410 it does not reconnect on its own", async () => {
    for (const code of Object.values(BOARD_CLOSE_CODES)) {
      const run = await opened();
      run.socket(1).close(code);
      expect(run.pending()).toEqual([]);
      expect(run.sockets).toHaveLength(1);
    }
  });

  test("the session ends: Discarded takes the focus and locks the view", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "discarded", reason: "session-exit" });
    run.socket(1).close(BOARD_CLOSE_CODES.discarded);
    expect(run.banner()).toMatchObject({ variant: "discarded", takesFocus: true });
    expect(run.banner()?.detail).toBeUndefined();
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting, lock: "discarded" });
    expect(run.banners.filter((banner) => banner?.variant === "discarded")).toHaveLength(1);
  });

  test("no board came back within the grace period: the same Discarded banner (AD-21)", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "discarded", reason: "board-closed" });
    expect(run.banner()).toMatchObject({ variant: "discarded", takesFocus: true });
    expect(run.updates.at(-1)?.lock).toBe("discarded");
  });

  test("a token refused on reconnect discards the board; a queued act was not sent", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    await run.view(answer);
    run.tick();
    run.socket(2).receive({
      version,
      type: "refused",
      reason: "token",
      detail: "the token does not open a board of this session",
    });
    expect(run.banner()).toEqual({
      variant: "discarded",
      text: "This ask was discarded. The board is read-only.",
      detail: "Your unsent work was not sent",
      action: "Copy my unsent work",
      takesFocus: true,
    });
    run.socket(2).close(BOARD_CLOSE_CODES.refused);
    expect(run.pending()).toEqual([]);
    expect(run.acts(2)).toEqual([]);
  });

  test("other refusals are only logged", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "refused", reason: "message", detail: "no draft" });
    expect(run.logs).toEqual(["board-host refused a message: no draft"]);
    expect(run.banner()).toBeUndefined();
  });

  test("moved locks the view; Continue here reconnects, which takes the board back", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "moved" });
    run.socket(1).close(BOARD_CLOSE_CODES.moved);
    expect(run.banner()).toMatchObject({ variant: "moved", action: "Continue here" });
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting, lock: "moved" });
    expect(run.pending()).toEqual([]);
    run.page.continueHere();
    expect(run.sockets).toHaveLength(2);
    expect(run.banner()).toBeUndefined();
    run.socket(2).receive(board, stateOf(waiting));
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting });
    run.page.continueHere();
    expect(run.sockets).toHaveLength(2);
  });

  test("Continue here before the close arrives closes the old socket, whose events are then ignored", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "moved" });
    run.page.continueHere();
    expect(run.socket(1).closed).toBe(true);
    run.socket(1).close(BOARD_CLOSE_CODES.moved);
    run.socket(1).receive({ version, type: "discarded", reason: "session-exit" });
    run.socket(1).events.onInvalid([]);
    expect(run.banner()).toBeUndefined();
    expect(run.logs).toEqual([]);
    run.socket(2).receive(board, stateOf(waiting));
    expect(await run.view(answer)).toEqual(sent());
  });

  test("a page going away stops reconnecting; coming back reconnects", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    run.page.suspend();
    expect(run.pending()).toEqual([]);
    run.page.resume();
    expect(run.sockets).toHaveLength(2);
    run.page.suspend();
    run.socket(2).close(1001);
    expect(run.pending()).toEqual([]);
    run.page.resume();
    expect(run.sockets).toHaveLength(3);
    run.page.resume();
    expect(run.sockets).toHaveLength(3);
  });
});

const noted = (note: string): DraftRecord => ({
  delivery: "immediate",
  questions: { database: { rev: 1, values: { database: ["SQLite"] }, note } },
});
const draftOf = (record: DraftRecord) => ({ version, type: "draft", record }) as const;

describe("the draft mirror and its restore (ask-lifecycle, design decision 6; AD-20, FR-25)", () => {
  test("the view's record goes 300 ms after its last change, as a draft message", async () => {
    const run = await opened();
    expect(await run.view({ type: "draft", record: noted("a") })).toEqual({});
    expect(await run.view({ type: "draft", record: noted("ab") })).toEqual({});
    expect(run.drafts(1)).toEqual([]);
    expect(run.pending()).toEqual([300]);
    run.tick();
    expect(run.drafts(1)).toEqual([{ version, type: "draft", record: noted("ab") }]);
  });

  test("hidden or going away, the page sends its record at once", async () => {
    const run = await opened();
    await run.view({ type: "draft", record: noted("a") });
    run.page.flushDraft();
    expect(run.drafts(1)).toEqual([{ version, type: "draft", record: noted("a") }]);
    run.page.flushDraft();
    expect(run.drafts(1)).toHaveLength(1);
  });

  test("a record the protocol or the board refuses is refused, never mirrored", async () => {
    const run = await opened();
    const strange = { delivery: "immediate", questions: { cache: { rev: 1, note: "x" } } } as const;
    const reply = await run.view({ type: "draft", record: strange });
    expect(reply).toEqual({
      outcome: "refused",
      detail: '/questions/cache: "cache" names no question of the ask',
    });
    const wrong = { delivery: "immediate", questions: { database: { rev: 0 } } } as const;
    expect((await run.view({ type: "draft", record: wrong })).outcome).toBe("refused");
    run.page.flushDraft();
    expect(run.drafts(1)).toEqual([]);
  });

  test("a record nested past the contract's draft depth bound is refused, never mirrored (S-11)", async () => {
    const run = await opened();
    const nested = (levels: number): unknown => {
      let value: unknown = 1;
      for (let at = 0; at < levels; at += 1) value = [value];
      return value;
    };
    const deep = (levels: number): DraftRecord =>
      ({
        delivery: "immediate",
        questions: { database: { rev: 1, results: { pick: nested(levels) } } },
      }) as unknown as DraftRecord;
    for (const levels of [JSON_MAX_DEPTH + 1, 1_000_000]) {
      const reply = await run.view({ type: "draft", record: deep(levels) });
      expect(reply.outcome).toBe("refused");
      expect(reply.detail).toContain(String(DRAFT_RECORD_MAX_DEPTH));
    }
    run.page.flushDraft();
    expect(run.drafts(1)).toEqual([]);
    expect(await run.view({ type: "draft", record: deep(JSON_MAX_DEPTH) })).toEqual({});
  });

  test("told the board moved, it sends its last record at once, before it locks", async () => {
    const run = await opened();
    await run.view({ type: "draft", record: noted("a") });
    run.page.flushDraft();
    run.socket(1).receive({ version, type: "moved" });
    expect(run.drafts(1)).toEqual([draftOf(noted("a")), draftOf(noted("a"))]);
    expect(run.banner()?.variant).toBe("moved");
  });

  test("on a new socket its own record goes again, and the one board-host holds is not restored", async () => {
    const run = await opened();
    await run.view({ type: "draft", record: noted("mine") });
    expect(run.tick()).toBe(300);
    run.socket(1).close(1006);
    run.tick();
    run.socket(2).receive(board, stateOf(waiting), draftOf(noted("older")));
    expect(run.drafts(2)).toEqual([draftOf(noted("mine"))]);
    expect(run.updates.at(-1)?.restore).toBeUndefined();
  });

  test("a page with no record of its own hands board-host's to the view, once, as a numbered restore", async () => {
    const run = setUp();
    run.socket(1).receive(board, stateOf(waiting), draftOf(noted("kept")));
    await settled();
    expect(run.updates.at(-1)).toEqual({
      type: "state",
      state: waiting,
      restore: { id: 1, record: noted("kept") },
    });
    await run.view({ type: "draft", record: noted("kept") });
    run.socket(1).receive(stateOf(waiting));
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting });
  });

  test("a later board document reaches the view with the state", async () => {
    const run = await opened();
    const [question] = plainChoiceBoardDocument.items;
    const changed = {
      ...plainChoiceBoardDocument,
      items: [{ ...question, rev: 2 }],
    } as typeof plainChoiceBoardDocument;
    run
      .socket(1)
      .receive(
        { version, type: "board", document: changed },
        stateOf({ ask: "waiting", questions: [{ itemId: "database", rev: 2, state: "open" }] }),
      );
    expect(run.updates.at(-1)?.document).toEqual(changed);
  });

  describe("the document goes to the view only when it differs from the last one sent (form-widget 5.8)", () => {
    const revised = (rev: number, items: readonly unknown[] = plainChoiceBoardDocument.items) =>
      ({ ...plainChoiceBoardDocument, items }) as unknown as typeof plainChoiceBoardDocument & {
        rev: number;
      };
    const stateAt = (rev: number) =>
      stateOf({ ask: "waiting", questions: [{ itemId: "database", rev, state: "open" }] });
    const reviseTo = (rev: number) => {
      const [question] = plainChoiceBoardDocument.items;
      return revised(rev, [{ ...question, rev }]);
    };

    test("after an agent update, a receipt, an agent status and a settled act carry no document", async () => {
      const run = await opened();
      const changed = reviseTo(2);
      run.socket(1).receive({ version, type: "board", document: changed }, stateAt(2));
      expect(run.updates.at(-1)?.document).toEqual(changed);
      const before = run.updates.length;
      run.socket(1).receive({ version, type: "receipt", itemId: "database", receipt: "delivered" });
      run.socket(1).receive(stateAt(2));
      await run.view(answer);
      await settled();
      expect(run.updates.length).toBeGreaterThan(before);
      for (const update of run.updates.slice(before)) expect(update.document).toBeUndefined();
    });

    test("every change the agent makes reaches the view, once each", async () => {
      const run = await opened();
      const [question] = plainChoiceBoardDocument.items;
      const second = reviseTo(2);
      const third = revised(3, [{ ...question, rev: 3 }]);
      const added = revised(4, [
        { ...question, rev: 3 },
        { ...question, id: "cache", rev: 1 },
      ]);
      run.socket(1).receive({ version, type: "board", document: second }, stateAt(2));
      run.socket(1).receive({ version, type: "receipt", itemId: "database", receipt: "delivered" });
      run.socket(1).receive({ version, type: "board", document: third }, stateAt(3));
      run.socket(1).receive(
        { version, type: "board", document: added },
        stateOf({
          ask: "waiting",
          questions: [
            { itemId: "database", rev: 3, state: "open" },
            { itemId: "cache", rev: 1, state: "open" },
          ],
        } as unknown as BoardState),
      );
      const sentDocuments = run.updates.flatMap((update) =>
        update.document === undefined ? [] : [update.document],
      );
      expect(sentDocuments).toEqual([second, third, added]);
    });

    test("a document received before the view loads is the one it boots with, and not sent again", async () => {
      const run = setUp();
      const changed = reviseTo(2);
      run.socket(1).receive({ version, type: "board", document: changed }, stateAt(2));
      await settled();
      expect(run.loads[0]?.document).toEqual(changed);
      expect(run.updates.every((update) => update.document === undefined)).toBe(true);
    });
  });
});

describe("a closed ask (ask-lifecycle: FR-6; Board banner, Closed and Unsent work)", () => {
  test("closed locks the view and takes the focus; the socket stays and acts are refused", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "closed", reason: "agent" });
    expect(run.banner()).toEqual({
      variant: "closed",
      text: "This ask was closed. The board is read-only.",
      snapshot: true,
      copyPath: "Copy path",
      takesFocus: true,
    });
    expect(run.updates.at(-1)?.lock).toBe("closed");
    expect(run.socket(1).closed).toBe(false);
  });

  test("with unsent work, the banner says so and its copy puts the work on the clipboard as text", async () => {
    const run = await opened();
    await run.view({ type: "draft", record: noted("Use the replica.") });
    run.socket(1).receive({ version, type: "closed", reason: "agent" });
    expect(run.banner()).toMatchObject({
      variant: "closed",
      detail: "Your unsent work was not sent",
      action: "Copy my unsent work",
    });
    await run.page.copyUnsentWork();
    expect(run.copies).toEqual([
      [
        plainChoiceBoardDocument.title,
        "",
        plainChoiceBoardDocument.items[0].props.text,
        "Options: SQLite",
        "Note for the agent: Use the replica.",
        "",
      ].join("\n"),
    ]);
  });

  test("a state of a closed ask closes the board as the closed message does", async () => {
    const run = await opened();
    run.socket(1).receive(stateOf({ ...waiting, ask: "closed" } as unknown as BoardState));
    expect(run.banner()?.variant).toBe("closed");
  });

  test("a closed board reconnects after a drop and stays closed", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "closed", reason: "agent" });
    run.socket(1).close(1006);
    expect(run.banner()?.variant).toBe("closed");
    run.tick();
    run.socket(2).receive(board, stateOf(waiting), { version, type: "closed", reason: "agent" });
    expect(run.banner()?.variant).toBe("closed");
  });
});

describe("the leave-page prompt (ask-lifecycle: Close and reload; FR-25)", () => {
  const postponed = {
    ask: "partly-answered",
    questions: [{ itemId: "database", rev: 1, state: "postponed" }],
  } as unknown as BoardState;

  test("armed while the mirrored draft holds unsent work, disarmed once it holds none", async () => {
    const run = await opened();
    expect(run.page.leavePromptArmed()).toBe(false);
    await run.view({ type: "draft", record: noted("x") });
    expect(run.page.leavePromptArmed()).toBe(true);
    await run.view({ type: "draft", record: { delivery: "immediate", questions: {} } });
    expect(run.page.leavePromptArmed()).toBe(false);
  });

  test("armed while a command is held, and while a postponed question is open on an open ask", async () => {
    const run = await opened();
    run.socket(1).open = false;
    await run.view(answer);
    expect(run.page.leavePromptArmed()).toBe(true);
    const later = await opened();
    later.socket(1).receive(stateOf(postponed));
    expect(later.page.leavePromptArmed()).toBe(true);
    later.socket(1).receive({ version, type: "closed", reason: "agent" });
    expect(later.page.leavePromptArmed()).toBe(false);
  });

  test("disarmed once the board moved: the other tab holds the work", async () => {
    const run = await opened();
    await run.view({ type: "draft", record: noted("x") });
    run.socket(1).receive({ version, type: "moved" });
    expect(run.page.leavePromptArmed()).toBe(false);
  });
});

describe("opening a reference from the view (excerpts, task 6.5; AD-8)", () => {
  const inset = { top: 64, bottom: 48 };
  const contextBoard: HostMessage = {
    version,
    type: "board",
    document: contextBoardDocument as unknown as typeof plainChoiceBoardDocument,
  };
  const contextState: BoardState = {
    ask: "waiting",
    questions: ["fix", "rollout", "settings"].map((itemId) => ({
      itemId,
      rev: 1,
      state: "open",
    })) as unknown as BoardState["questions"],
  };
  const openedContext = async () => {
    const run = setUp();
    run.socket(1).receive(contextBoard, stateOf(contextState));
    await settled();
    return run;
  };

  test("a web reference of the board document opens its own URL, once, and nothing is sent to the agent", async () => {
    const run = await openedContext();
    const reply = await run.view({ type: "open-reference", itemId: "pr", inset });
    expect(reply).toEqual({});
    expect(run.opened).toEqual(["https://github.com/acme/pay/pull/12"]);
    expect(run.acts(1)).toEqual([]);
  });

  test("a reference whose URL a later revision changed opens the board document's current URL, never one from the message", async () => {
    const run = await openedContext();
    const changed = {
      ...contextBoardDocument,
      items: contextBoardDocument.items.map((question) => ({
        ...question,
        props: {
          ...question.props,
          items: question.props.items?.map((item) =>
            item.id === "pr"
              ? {
                  ...item,
                  props: { ...(item.props as object), url: "https://github.com/acme/pay/pull/99" },
                }
              : item,
          ),
        },
      })),
    };
    run.socket(1).receive({
      version,
      type: "board",
      document: changed as unknown as typeof plainChoiceBoardDocument,
    });
    await run.view({ type: "open-reference", itemId: "pr", inset });
    expect(run.opened).toEqual(["https://github.com/acme/pay/pull/99"]);
  });

  test("an image, an excerpt, a FILE reference, a question and an unknown item open nothing", async () => {
    const run = await openedContext();
    for (const itemId of ["shot", "retry-adr", "retry-src", "fix", "no-such-item"]) {
      expect(await run.view({ type: "open-reference", itemId, inset })).toEqual({});
    }
    expect(run.opened).toEqual([]);
  });
});

describe("the reading panel on the board page (excerpts, task 6.6; AD-8)", () => {
  const inset = { top: 64, bottom: 48 };
  const contextBoard: HostMessage = {
    version,
    type: "board",
    document: contextBoardDocument as unknown as typeof plainChoiceBoardDocument,
  };
  const contextState: BoardState = {
    ask: "waiting",
    questions: ["fix", "rollout", "settings"].map((itemId) => ({
      itemId,
      rev: 1,
      state: "open",
    })) as unknown as BoardState["questions"],
  };
  const openedContext = async () => {
    const run = setUp();
    run.socket(1).receive(contextBoard, stateOf(contextState));
    await settled();
    return run;
  };
  const sentOnSocket = (run: Awaited<ReturnType<typeof openedContext>>) =>
    run.socket(1).sent.filter((message) => message.type !== "draft");

  test("a FILE reference opens the panel with the file's path and sends open-source naming the item", async () => {
    const run = await openedContext();
    await run.view({ type: "open-reference", itemId: "retry-src", inset });
    expect(run.panel.events).toEqual(["open retry-src"]);
    expect(run.panel.shown()?.request).toEqual({
      itemId: "retry-src",
      path: "src/retry.ts",
      inset,
    });
    expect(sentOnSocket(run)).toEqual([{ version, type: "open-source", itemId: "retry-src" }]);
    expect(run.opened).toEqual([]);
  });

  test("an excerpt with a pointer opens the panel too", async () => {
    const run = await openedContext();
    await run.view({ type: "open-reference", itemId: "retry-adr", inset });
    expect(run.panel.shown()?.request.path).toBe("docs/adr/0012-payment-retries.md");
    expect(sentOnSocket(run)).toEqual([{ version, type: "open-source", itemId: "retry-adr" }]);
  });

  test("an excerpt the agent wrote, an image, a web reference, a question and an unknown item open no panel", async () => {
    const run = await openedContext();
    for (const itemId of ["settings-note", "shot", "pr", "fix", "no-such-item"]) {
      await run.view({ type: "open-reference", itemId, inset });
    }
    expect(run.panel.events).toEqual([]);
    expect(sentOnSocket(run)).toEqual([]);
  });

  test("source state and the editor's outcome reach the panel", async () => {
    const run = await openedContext();
    await run.view({ type: "open-reference", itemId: "retry-src", inset });
    run.socket(1).receive({
      version,
      type: "source-state",
      itemId: "retry-src",
      status: "available",
      editor: false,
    });
    run.socket(1).receive({
      version,
      type: "editor-outcome",
      itemId: "retry-src",
      outcome: "no-editor",
    });
    expect(run.panel.events).toEqual([
      "open retry-src",
      "state retry-src available",
      "outcome retry-src no-editor",
    ]);
  });

  test("Open in editor sends open-editor naming the item, only for the item the panel shows", async () => {
    const run = await openedContext();
    await run.view({ type: "open-reference", itemId: "retry-src", inset });
    run.panel.shown()?.actions.openEditor();
    expect(sentOnSocket(run).at(-1)).toEqual({ version, type: "open-editor", itemId: "retry-src" });
  });

  test("closing the panel tells the view, once, with the item that opened it", async () => {
    const run = await openedContext();
    await run.view({ type: "open-reference", itemId: "retry-src", inset });
    run.panel.shown()?.actions.closed();
    expect(run.updates.at(-1)?.panelClosed).toEqual({ id: 1, itemId: "retry-src" });
    await run.view({ type: "open-reference", itemId: "retry-adr", inset });
    run.panel.shown()?.actions.closed();
    expect(run.updates.at(-1)?.panelClosed).toEqual({ id: 2, itemId: "retry-adr" });
  });

  test("a board that moved or was discarded closes the panel; a closed ask keeps it", async () => {
    const moved = await openedContext();
    await moved.view({ type: "open-reference", itemId: "retry-src", inset });
    moved.socket(1).receive({ version, type: "moved" });
    expect(moved.panel.events.at(-1)).toBe("close");
    const discarded = await openedContext();
    await discarded.view({ type: "open-reference", itemId: "retry-src", inset });
    discarded.socket(1).receive({ version, type: "discarded", reason: "session-exit" });
    expect(discarded.panel.events.at(-1)).toBe("close");
    const closed = await openedContext();
    await closed.view({ type: "open-reference", itemId: "retry-src", inset });
    closed.socket(1).receive({ version, type: "closed", reason: "agent" });
    expect(closed.panel.events).toEqual(["open retry-src"]);
  });

  test("with no live connection the panel does not open", async () => {
    const run = await openedContext();
    run.socket(1).close(1006);
    await run.view({ type: "open-reference", itemId: "retry-src", inset });
    expect(run.panel.events).toEqual([]);
  });
});

describe("the board page speaks the ask's language (settings-languages, task 7.2)", () => {
  const italian: HostMessage = {
    version,
    type: "board",
    // The E1 type predates board document 1.2; the protocol's schema takes the language.
    document: { ...plainChoiceBoardDocument, language: "it-IT" } as typeof plainChoiceBoardDocument,
  };

  test("an it-IT board sets the page's lang to it, and its banners are Italian", async () => {
    const run = setUp();
    run.socket(1).receive(italian, stateOf(waiting));
    await settled();
    expect(run.languages).toEqual(["it"]);
    run.socket(1).receive({ version, type: "moved" });
    expect(run.banner()).toMatchObject({
      text: "Questa board si è spostata in un'altra scheda.",
      action: "Continua qui",
    });
  });

  test("a board without a language reads as en-US", async () => {
    const run = await opened();
    expect(run.languages).toEqual(["en"]);
    run.socket(1).close(1006);
    expect(run.banner()?.text).toBe("Connection lost, retrying");
  });

  test("a banner shown before the first board is English", () => {
    const run = setUp();
    run.socket(1).close(1006);
    expect(run.banner()?.text).toBe("Connection lost, retrying");
    expect(run.languages).toEqual([]);
  });
});
