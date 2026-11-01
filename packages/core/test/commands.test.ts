import { describe, expect, test } from "bun:test";
import { answer as e1Answer } from "./fakes.ts";
import {
  actionId,
  answerAct,
  appendedOf,
  areasAsk,
  command,
  created,
  FLAT_ID,
  flatAsk,
  LIFECYCLE_ID,
  logOf,
  statesOf,
  WHEN,
} from "./lifecycle-fakes.ts";

// Core spec: One command, applied once; Atomic commands (ask-lifecycle, task 2.4).

const submit = [
  answerAct(),
  answerAct({ itemId: "q2", choice: ["macOS", "Linux"] }),
  { type: "decline", itemId: "q3", rev: 1, note: "Ask Marco", when: WHEN },
] as const;

describe("atomic commands", () => {
  test("a submit appends its events in order with consecutive seqs, in one publication", async () => {
    const { core, heard } = await created(flatAsk());
    core.act(FLAT_ID, command([{ type: "note", itemId: "q1", rev: 1, note: "first", when: WHEN }]));
    heard.length = 0;
    const outcome = core.act(FLAT_ID, command(submit as never));
    expect(outcome.ok && outcome.events.map((event) => event.cursor)).toEqual([
      `${core.epoch}.2`,
      `${core.epoch}.3`,
      `${core.epoch}.4`,
    ]);
    expect(heard).toHaveLength(1);
    expect(heard[0]).toMatchObject({ type: "appended", askId: FLAT_ID });
    expect(appendedOf(heard).map((event) => event.cursor)).toEqual([
      `${core.epoch}.2`,
      `${core.epoch}.3`,
      `${core.epoch}.4`,
    ]);
    expect(statesOf(core, FLAT_ID)).toEqual({ q1: "answered", q2: "answered", q3: "declined" });
  });

  test("a refused third act leaves nothing of the first two, naming the act and its question", async () => {
    const { core, heard } = await created(flatAsk());
    const outcome = core.act(
      FLAT_ID,
      command([submit[0], submit[1], { ...submit[2], when: "2026-02-30T00:00:00Z" }] as never),
    );
    expect(outcome).toMatchObject({ ok: false, refusal: "when", index: 2, itemId: "q3" });
    expect(logOf(core, FLAT_ID)).toEqual([]);
    expect(heard).toEqual([]);
    expect(statesOf(core, FLAT_ID)).toEqual({ q1: "open", q2: "open", q3: "open" });
  });

  test("a submit whose second act names a revision the agent has just replaced appends nothing", async () => {
    const { core } = await created(flatAsk());
    const changed = core.update({
      askId: FLAT_ID,
      actions: [{ action: "change", itemId: "q2", props: { text: "Which platforms first?" } }],
    });
    expect(changed).toMatchObject({ kind: "updated" });
    const outcome = core.act(FLAT_ID, command(submit as never));
    expect(outcome).toMatchObject({ ok: false, refusal: "stale-rev", index: 1, itemId: "q2" });
    expect(logOf(core, FLAT_ID)).toEqual([]);
  });

  test("each act is checked against the state the earlier ones leave", async () => {
    const { core } = await created(flatAsk());
    const postponeThenAnswer = core.act(
      FLAT_ID,
      command([{ type: "postpone", itemId: "q1", rev: 1 }, answerAct()]),
    );
    expect(postponeThenAnswer.ok).toBe(true);
    expect(statesOf(core, FLAT_ID).q1).toBe("answered");
    const answerThenPostpone = core.act(
      FLAT_ID,
      command([
        answerAct({ itemId: "q2", choice: ["WSL"] }),
        { type: "postpone", itemId: "q2", rev: 1 },
      ]),
    );
    expect(answerThenPostpone).toMatchObject({ ok: false, refusal: "state", index: 1 });
    const postponeAndUndo = core.act(
      FLAT_ID,
      command([
        { type: "postpone", itemId: "q3", rev: 1 },
        { type: "reopen", itemId: "q3" },
      ]),
    );
    expect(postponeAndUndo.ok && postponeAndUndo.events.map((event) => event.type)).toEqual([
      "postponed",
      "reopened",
    ]);
    expect(statesOf(core, FLAT_ID)).toEqual({ q1: "answered", q2: "open", q3: "open" });
  });

  test("a command needs a 22-character action ID and at least one act", async () => {
    const { core } = await created(flatAsk());
    for (const bad of [
      { actionId: "short", acts: [answerAct()] },
      { actionId: actionId(900), acts: [] },
      { actionId: actionId(901), acts: "answer" },
    ]) {
      expect(core.act(FLAT_ID, bad as never)).toMatchObject({ ok: false, refusal: "command" });
    }
    expect(logOf(core, FLAT_ID)).toEqual([]);
  });
});

describe("one command, applied once", () => {
  test("a submit retried with its action ID appends nothing and is acknowledged as before", async () => {
    const { core, heard } = await created(flatAsk());
    const first = command(submit as never);
    const applied = core.act(FLAT_ID, first);
    heard.length = 0;
    const retried = core.act(FLAT_ID, { ...first });
    expect(retried).toEqual({
      ok: true,
      events: applied.ok ? applied.events : [],
      repeated: true,
    });
    expect(logOf(core, FLAT_ID)).toHaveLength(3);
    expect(heard).toEqual([]);
  });

  test("the repeat is acknowledged as before even when its acts would now be refused", async () => {
    const { core } = await created(flatAsk());
    const postpone = command([{ type: "postpone", itemId: "q1", rev: 1 }]);
    core.act(FLAT_ID, postpone);
    expect(core.act(FLAT_ID, postpone)).toMatchObject({ ok: true, repeated: true });
    expect(logOf(core, FLAT_ID)).toHaveLength(1);
  });

  test("a refused command's action ID is not taken: the same ID applies once the acts can", async () => {
    const { core } = await created(flatAsk());
    const id = actionId(700);
    expect(core.act(FLAT_ID, command([answerAct({ choice: ["nope"] })], id)).ok).toBe(false);
    expect(core.act(FLAT_ID, command([answerAct()], id))).toMatchObject({
      ok: true,
      repeated: false,
    });
  });

  test("action IDs are per ask", async () => {
    const fixture = await created(flatAsk());
    await fixture.core.ask(areasAsk());
    const id = actionId(800);
    expect(fixture.core.act(FLAT_ID, command([answerAct()], id)).ok).toBe(true);
    const other = fixture.core.act(
      LIFECYCLE_ID,
      command([answerAct({ itemId: "rollout", choice: ["All at once"] })], id),
    );
    expect(other).toMatchObject({ ok: true, repeated: false });
  });

  test("E1's answer without an action ID keeps E1's refusal of an answered question", async () => {
    const { core } = await created(flatAsk());
    expect(core.answer(FLAT_ID, e1Answer({ itemId: "q1", choice: ["main"] })).ok).toBe(true);
    expect(core.answer(FLAT_ID, e1Answer({ itemId: "q1", choice: ["release"] }))).toEqual({
      ok: false,
      refusal: "answered",
      detail: "the question is already answered",
    });
    core.act(FLAT_ID, command([{ type: "decline", itemId: "q2", rev: 1, when: WHEN }]));
    expect(core.answer(FLAT_ID, e1Answer({ itemId: "q2", choice: ["WSL"] }))).toMatchObject({
      ok: false,
      refusal: "answered",
    });
    core.act(FLAT_ID, command([{ type: "postpone", itemId: "q3", rev: 1 }]));
    expect(core.answer(FLAT_ID, e1Answer({ itemId: "q3", choice: ["Sara"] })).ok).toBe(true);
    expect(statesOf(core, FLAT_ID).q3).toBe("answered");
  });
});

describe("command groups", () => {
  test("each command's events share one group number, never on the wire", async () => {
    const { core } = await created(flatAsk());
    core.answer(FLAT_ID, e1Answer({ itemId: "q1", choice: ["main"] }));
    core.act(FLAT_ID, command(submit.slice(1) as never));
    core.act(
      FLAT_ID,
      command([{ type: "follow-up", itemId: "q1", rev: 1, text: "?", when: WHEN }]),
    );
    const read = core.read(FLAT_ID, `${core.epoch}.0`);
    const groups = read.kind === "events" ? (read.groups ?? []) : [];
    expect(groups).toHaveLength(4);
    const [one, two, three, four] = groups;
    expect(two).toBe(three as number);
    expect(new Set([one, two, four]).size).toBe(3);
    expect(read.kind === "events" && read.events.every((event) => !("group" in event))).toBe(true);
    const later = core.read(FLAT_ID, `${core.epoch}.2`);
    expect(later.kind === "events" && later.groups).toEqual([three as number, four as number]);
  });
});
