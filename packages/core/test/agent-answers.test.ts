import { describe, expect, test } from "bun:test";
import type { UpdateAction } from "@askboard/contract";
import { answer as e1Answer, fakeClock } from "./fakes.ts";
import {
  answerAct,
  areasAsk,
  boardOf,
  command,
  created,
  FLAT_ID,
  flatAsk,
  LIFECYCLE_ID,
  logOf,
  statesOf,
  WHEN,
} from "./lifecycle-fakes.ts";

// Core spec: Recording an answer, Who and when (a recorded answer), Replies to follow-ups, Closing
// an ask (ask-lifecycle, task 3.2).

type Core = Awaited<ReturnType<typeof created>>["core"];

const update = (core: Core, askId: string, ...actions: UpdateAction[]) =>
  core.update({ askId, actions });

const record = (itemId: string, answer: Record<string, unknown>): UpdateAction => ({
  action: "answer",
  itemId,
  answer: answer as never,
});

describe("recording an answer", () => {
  test("the user answered in the terminal: answered, marked recorded, the log unchanged", async () => {
    const { core, heard } = await created(areasAsk());
    core.act(LIFECYCLE_ID, command([{ type: "postpone", itemId: "erp-export", rev: 1 }]));
    heard.length = 0;
    const outcome = await update(core, LIFECYCLE_ID, record("erp-export", { choice: ["Yes"] }));
    expect(outcome).toEqual({
      kind: "updated",
      askId: LIFECYCLE_ID,
      state: "partly-answered",
      applied: [
        {
          action: "answer",
          itemId: "erp-export",
          rev: 1,
          recorded: { who: "Sara Conti", when: "2026-10-31T14:20:03Z" },
        },
      ],
    });
    expect(statesOf(core, LIFECYCLE_ID)["erp-export"]).toBe("answered");
    expect(boardOf(core, LIFECYCLE_ID).questions.at(-1)?.answer).toEqual({
      choice: ["Yes"],
      who: "Sara Conti",
      when: "2026-10-31T14:20:03Z",
      recorded: true,
      delivered: true,
    });
    expect(logOf(core, LIFECYCLE_ID)).toHaveLength(1);
    expect(core.read(LIFECYCLE_ID, `${core.epoch}.1`)).toMatchObject({ events: [] });
    expect(heard).toEqual([{ type: "state", askId: LIFECYCLE_ID }]);
  });

  test("who follows FR-19 and when is the core's time of the update", async () => {
    const clock = fakeClock();
    const { core } = await created(flatAsk(), { git: "Paola Greco", clock });
    clock.advance(90_500);
    const outcome = await update(
      core,
      FLAT_ID,
      record("q1", { choice: ["main"], note: "On a call" }),
    );
    expect(outcome).toMatchObject({
      applied: [{ recorded: { who: "Paola Greco", when: "2026-10-31T14:21:33.500Z" } }],
    });
  });

  test("a recorded answer moves a waiting ask out of waiting, and can answer every question", async () => {
    const { core } = await created(flatAsk());
    await update(core, FLAT_ID, record("q1", { choice: ["main"] }));
    expect(boardOf(core, FLAT_ID).state).toBe("partly-answered");
    await update(
      core,
      FLAT_ID,
      record("q2", { choice: ["Linux", "WSL"] }),
      record("q3", { other: "Ines" }),
    );
    expect(boardOf(core, FLAT_ID).state).toBe("answered");
  });

  test.each([
    ["a label that is not an option", { choice: ["trunk"] }, "choice"],
    ["two labels on a single-choice question", { choice: ["main", "release"] }, "choice"],
    ["Other… text without allowOther", { other: "trunk" }, "content"],
    ["no label and no Other… text", { note: "Ask later" }, "content"],
  ])("a recorded answer with %s is refused", async (_, answer, refusal) => {
    const { core } = await created(flatAsk());
    expect(await update(core, FLAT_ID, record("q1", answer))).toMatchObject({
      kind: "refused",
      index: 0,
      itemId: "q1",
      refusal,
    });
    expect(statesOf(core, FLAT_ID).q1).toBe("open");
  });

  test("recording over an answer the log holds is refused, naming it", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([answerAct()]));
    expect(await update(core, FLAT_ID, record("q1", { choice: ["release"] }))).toMatchObject({
      kind: "refused",
      refusal: "answered",
      cursor: `${core.epoch}.1`,
    });
  });

  test("recording over a decline the log holds is refused, naming the decline's cursor", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([answerAct({ itemId: "q2", choice: ["Linux"] })]));
    core.act(FLAT_ID, command([{ type: "decline", itemId: "q1", rev: 1, when: WHEN }]));
    const outcome = await update(core, FLAT_ID, record("q1", { choice: ["release"] }));
    expect(outcome).toMatchObject({
      kind: "refused",
      index: 0,
      itemId: "q1",
      refusal: "answered",
      cursor: `${core.epoch}.2`,
    });
    expect(outcome.kind === "refused" && outcome.detail).toContain(`${core.epoch}.2`);
    expect(statesOf(core, FLAT_ID).q1).toBe("declined");
  });

  test("a recorded answer stops a change until reopened, and is kept as previous", async () => {
    const { core } = await created(flatAsk());
    await update(core, FLAT_ID, record("q1", { choice: ["main"] }));
    const changed = await update(core, FLAT_ID, {
      action: "change",
      itemId: "q1",
      props: { text: "x" },
    });
    expect(changed).toMatchObject({ kind: "refused", refusal: "answered", itemId: "q1" });
    expect(changed.kind === "refused" && "cursor" in changed).toBe(false);
    expect(changed.kind === "refused" && changed.detail).toContain("recorded");
    await update(core, FLAT_ID, { action: "reopen", itemId: "q1" });
    expect(boardOf(core, FLAT_ID).questions[0]).toMatchObject({
      rev: 2,
      state: "open",
      previous: { choice: ["main"], recorded: true },
    });
  });

  test("a later board answer to a recorded question is an event replacing nothing", async () => {
    const { core } = await created(flatAsk());
    await update(core, FLAT_ID, record("q1", { choice: ["main"] }));
    const outcome = core.act(FLAT_ID, command([answerAct({ choice: ["release"] })]));
    expect(outcome.ok && outcome.events[0]).toMatchObject({ choice: ["release"] });
    expect(outcome.ok && "replaces" in (outcome.events[0] ?? {})).toBe(false);
    expect(boardOf(core, FLAT_ID).questions[0]?.answer).toMatchObject({
      choice: ["release"],
      cursor: `${core.epoch}.1`,
    });
  });

  test("E1's answer without an action ID is refused on a recorded question", async () => {
    const { core } = await created(flatAsk());
    await update(core, FLAT_ID, record("q1", { choice: ["main"] }));
    expect(core.answer(FLAT_ID, e1Answer({ itemId: "q1", choice: ["main"] }))).toMatchObject({
      ok: false,
      refusal: "answered",
    });
  });
});

describe("replies to follow-ups", () => {
  const followed = async () => {
    const fixture = await created(flatAsk());
    fixture.core.act(
      FLAT_ID,
      command([
        { type: "follow-up", itemId: "q2", rev: 1, text: "Is WSL a platform?", when: WHEN },
        { type: "note", itemId: "q1", rev: 1, note: "x", when: WHEN },
      ]),
    );
    fixture.heard.length = 0;
    return fixture;
  };

  test("a reply goes under its follow-up, with the core's time; no event, the rev unchanged", async () => {
    const { core, heard } = await followed();
    await update(core, FLAT_ID, {
      action: "change",
      itemId: "q2",
      props: { text: "Platforms first?" },
    });
    heard.length = 0;
    const outcome = await update(core, FLAT_ID, {
      action: "reply",
      itemId: "q2",
      followUp: `${core.epoch}.1`,
      text: "Yes, through Linux.",
    });
    expect(outcome).toMatchObject({
      kind: "updated",
      applied: [{ action: "reply", itemId: "q2" }],
    });
    expect(outcome.kind === "updated" && "rev" in (outcome.applied[0] ?? {})).toBe(false);
    const q2 = boardOf(core, FLAT_ID).questions[1];
    expect(q2?.rev).toBe(2);
    expect(q2?.thread).toEqual([
      {
        cursor: `${core.epoch}.1`,
        who: "unknown user",
        when: WHEN,
        text: "Is WSL a platform?",
        replies: [{ text: "Yes, through Linux.", when: "2026-10-31T14:20:03Z" }],
      },
    ]);
    expect(logOf(core, FLAT_ID)).toHaveLength(2);
    expect(heard).toEqual([{ type: "state", askId: FLAT_ID }]);
  });

  test.each([
    ["a cursor that is not a follow-up", (epoch: string) => `${epoch}.2`, "q1"],
    ["a follow-up of another question", (epoch: string) => `${epoch}.1`, "q1"],
    ["a cursor of another epoch", () => "zz99yy88.1", "q2"],
    ["a cursor past the log", (epoch: string) => `${epoch}.9`, "q2"],
  ])("a reply to %s is refused, naming the cursor", async (_, cursorOf, itemId) => {
    const { core } = await followed();
    const followUp = cursorOf(core.epoch);
    const outcome = await update(core, FLAT_ID, { action: "reply", itemId, followUp, text: "?" });
    expect(outcome).toMatchObject({
      kind: "refused",
      index: 0,
      itemId,
      cursor: followUp,
      refusal: "follow-up",
    });
    expect(outcome.kind === "refused" && outcome.detail).toContain(followUp);
  });
});

describe("closing an ask", () => {
  test("the agent closes an ask with one question open: closed, its board told, later acts refused", async () => {
    const { core, heard } = await created(flatAsk());
    core.act(FLAT_ID, command([answerAct()]));
    heard.length = 0;
    expect(await update(core, FLAT_ID, { action: "close" })).toEqual({
      kind: "updated",
      askId: FLAT_ID,
      state: "closed",
      applied: [{ action: "close" }],
    });
    expect(heard).toEqual([{ type: "closed", askId: FLAT_ID, reason: "agent" }]);
    expect(boardOf(core, FLAT_ID)).toMatchObject({ state: "closed", closed: "agent" });
    expect(
      core.act(FLAT_ID, command([answerAct({ itemId: "q2", choice: ["WSL"] })])),
    ).toMatchObject({ ok: false, refusal: "closed" });
    expect(core.answer(FLAT_ID, e1Answer({ itemId: "q2", choice: ["WSL"] }))).toMatchObject({
      ok: false,
      refusal: "closed",
    });
    expect(logOf(core, FLAT_ID)).toHaveLength(1);
  });

  test("a closed ask refuses updates with the typed result closed", async () => {
    const { core } = await created(flatAsk());
    await update(core, FLAT_ID, { action: "close" });
    expect(await update(core, FLAT_ID, { action: "reopen", itemId: "q1" })).toEqual({
      kind: "closed",
      askId: FLAT_ID,
    });
  });

  test("an action after close in the same update is refused, and nothing applies", async () => {
    const { core } = await created(flatAsk());
    const outcome = await update(
      core,
      FLAT_ID,
      { action: "close" },
      { action: "change", itemId: "q1", props: { text: "x" } },
    );
    expect(outcome).toMatchObject({ kind: "refused", index: 1, refusal: "closed" });
    expect(boardOf(core, FLAT_ID).state).toBe("waiting");
  });

  test("close(reason) closes once; the ask keeps its log and board, and session exit leaves it", async () => {
    const { core, heard } = await created(flatAsk());
    core.act(FLAT_ID, command([answerAct()]));
    heard.length = 0;
    expect(core.close(FLAT_ID, "agent")).toEqual({ kind: "closed", askId: FLAT_ID });
    expect(core.close(FLAT_ID, "agent")).toEqual({ kind: "already-closed", askId: FLAT_ID });
    expect(heard).toEqual([{ type: "closed", askId: FLAT_ID, reason: "agent" }]);
    expect(core.discardAll("session-exit")).toBe(0);
    expect(core.read(FLAT_ID, `${core.epoch}.0`)).toMatchObject({
      state: "closed",
      events: [{ type: "answer" }],
    });
    expect(boardOf(core, FLAT_ID).document.items).toHaveLength(3);
    expect(core.board(FLAT_ID)?.state).toBe("closed");
  });

  test("closing an ask this epoch does not hold, or a discarded one, closes nothing", async () => {
    const { core } = await created(flatAsk());
    expect(core.close("never-asked", "agent")).toEqual({ kind: "unknown", askId: "never-asked" });
    core.discardAll("session-exit");
    expect(core.close(FLAT_ID, "agent")).toEqual({ kind: "discarded", askId: FLAT_ID });
  });
});
