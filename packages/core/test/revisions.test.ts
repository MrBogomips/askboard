import { describe, expect, test } from "bun:test";
import type { Act } from "@askboard/contract";
import { plainChoiceAsk } from "./fakes.ts";
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

// Core spec: Revising an answer, Revisions of a question, Edit choice, and the `change` action that
// makes a revision (Changing an item) (ask-lifecycle, task 2.5).

type Core = Awaited<ReturnType<typeof created>>["core"];

const change = (core: Core, askId: string, itemId: string, props: Record<string, unknown>) =>
  core.update({ askId, actions: [{ action: "change", itemId, props }] });

const editChoice = (itemId: string, rev: number, keptRev?: number): Act =>
  keptRev === undefined
    ? { type: "edit-choice", itemId, rev, edit: "reload" }
    : { type: "edit-choice", itemId, rev, edit: "ignore", keptRev };

describe("revising an answer", () => {
  test("the user changes a sent answer: a new event replaces the logged one, and the latest holds", async () => {
    const { core } = await created(plainChoiceAsk());
    const askId = "order-db-choice-x7k2";
    core.act(askId, command([answerAct({ itemId: "database", choice: ["PostgreSQL"] })]));
    const outcome = core.act(
      askId,
      command([answerAct({ itemId: "database", choice: ["SQLite"], when: WHEN })]),
    );
    expect(outcome.ok && outcome.events[0]).toMatchObject({
      cursor: `${core.epoch}.2`,
      choice: ["SQLite"],
      replaces: `${core.epoch}.1`,
    });
    expect(boardOf(core, askId).questions[0]?.answer).toMatchObject({
      choice: ["SQLite"],
      cursor: `${core.epoch}.2`,
    });
  });

  test("a decline supersedes an earlier answer, naming it", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([answerAct()]));
    const outcome = core.act(
      FLAT_ID,
      command([{ type: "decline", itemId: "q1", rev: 1, note: "Unsure", when: WHEN }]),
    );
    expect(outcome.ok && outcome.events[0]).toMatchObject({
      declined: true,
      replaces: `${core.epoch}.1`,
    });
    expect(statesOf(core, FLAT_ID).q1).toBe("declined");
  });

  test("two answers to one question in one command: the second replaces the first", async () => {
    const { core } = await created(flatAsk());
    const outcome = core.act(FLAT_ID, command([answerAct(), answerAct({ choice: ["release"] })]));
    expect(outcome.ok && outcome.events[1]).toMatchObject({ replaces: `${core.epoch}.1` });
  });

  test("after the user undoes a decline, the next answer replaces nothing", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([{ type: "decline", itemId: "q1", rev: 1, when: WHEN }]));
    core.act(FLAT_ID, command([{ type: "reopen", itemId: "q1" }]));
    const outcome = core.act(FLAT_ID, command([answerAct()]));
    expect(outcome.ok && "replaces" in (outcome.events[0] ?? {})).toBe(false);
  });
});

describe("changing a question makes a revision", () => {
  test("rewording an open question: rev 2, the new text, the other props as they were", async () => {
    const { core, heard } = await created(flatAsk());
    const outcome = change(core, FLAT_ID, "q1", { text: "Which branch do we cut from?" });
    expect(outcome).toEqual({
      kind: "updated",
      askId: FLAT_ID,
      state: "waiting",
      applied: [{ action: "change", itemId: "q1", rev: 2 }],
    });
    const question = boardOf(core, FLAT_ID).document.items[0];
    expect(question).toEqual({
      type: "question",
      id: "q1",
      rev: 2,
      props: {
        text: "Which branch do we cut from?",
        options: [{ label: "main" }, { label: "release" }],
      },
    });
    expect(heard.map((event) => event.type)).toEqual(["document", "state"]);
    expect(logOf(core, FLAT_ID)).toEqual([]);
  });

  test("each given key replaces its old value whole", async () => {
    const { core } = await created(flatAsk());
    change(core, FLAT_ID, "q3", { options: [{ label: "Paola" }], allowOther: false });
    expect(boardOf(core, FLAT_ID).document.items[2]?.props).toEqual({
      text: "Who signs the release off?",
      allowOther: false,
      options: [{ label: "Paola" }],
    });
  });

  test("a merged question the input format refuses is refused, and the question is unchanged", async () => {
    const { core } = await created(flatAsk());
    for (const props of [
      { options: [] },
      { text: "" },
      { colour: "red" },
      { options: [{ label: "a" }, { label: "a" }] },
      {
        options: [
          { label: "a", recommended: true },
          { label: "b", recommended: true },
        ],
      },
    ]) {
      expect(change(core, FLAT_ID, "q1", props)).toMatchObject({
        kind: "refused",
        index: 0,
        itemId: "q1",
        refusal: "props",
      });
    }
    expect(boardOf(core, FLAT_ID).questions[0]?.rev).toBe(1);
  });

  test("a postponed question stays postponed through a change", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([{ type: "postpone", itemId: "q1", rev: 1 }]));
    change(core, FLAT_ID, "q1", { text: "Reworded" });
    expect(boardOf(core, FLAT_ID).questions[0]).toMatchObject({ rev: 2, state: "postponed" });
  });

  test("changing a question whose answer is logged is refused, naming the answer's cursor", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([answerAct({ itemId: "q2", choice: ["WSL"] })]));
    core.act(FLAT_ID, command([{ type: "note", itemId: "q1", rev: 1, note: "x", when: WHEN }]));
    core.act(FLAT_ID, command([answerAct()]));
    const outcome = change(core, FLAT_ID, "q1", { text: "Reworded" });
    expect(outcome).toMatchObject({
      kind: "refused",
      index: 0,
      itemId: "q1",
      cursor: `${core.epoch}.3`,
      refusal: "answered",
    });
    expect(outcome.kind === "refused" && outcome.detail).toContain(`${core.epoch}.3`);
    expect(outcome.kind === "refused" && outcome.detail).toContain("reopen");
    expect(boardOf(core, FLAT_ID).questions[0]?.rev).toBe(1);
  });

  test("a declined question is refused the same way", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([{ type: "decline", itemId: "q1", rev: 1, when: WHEN }]));
    expect(change(core, FLAT_ID, "q1", { text: "x" })).toMatchObject({
      kind: "refused",
      refusal: "answered",
      cursor: `${core.epoch}.1`,
    });
  });

  test("an area's title changes; its questions change through their own actions", async () => {
    const { core } = await created(areasAsk());
    expect(change(core, LIFECYCLE_ID, "scope", { title: "What we ship" })).toMatchObject({
      kind: "updated",
      applied: [{ action: "change", itemId: "scope" }],
    });
    expect(boardOf(core, LIFECYCLE_ID).document.items[0]?.props).toMatchObject({
      title: "What we ship",
    });
    expect(change(core, LIFECYCLE_ID, "scope", { items: [] })).toMatchObject({
      kind: "refused",
      refusal: "props",
    });
    expect(change(core, LIFECYCLE_ID, "scope", { title: "" })).toMatchObject({
      kind: "refused",
      refusal: "props",
    });
  });

  test("a change to an unknown item is refused naming it", async () => {
    const { core } = await created(flatAsk());
    expect(change(core, FLAT_ID, "q9", { text: "x" })).toMatchObject({
      kind: "refused",
      index: 0,
      itemId: "q9",
      refusal: "unknown-item",
    });
  });

  test("an update that is not a valid request is refused with the contract's problems", async () => {
    const { core } = await created(flatAsk());
    const outcome = core.update({ askId: FLAT_ID, actions: [{ action: "change", itemId: "q1" }] });
    expect(outcome.kind).toBe("invalid");
  });
});

describe("edit choice", () => {
  test("the user keeps their work: the ignore keeping rev 1, then the answer naming rev 1", async () => {
    const { core } = await created(flatAsk());
    change(core, FLAT_ID, "q3", { options: [{ label: "Paola" }, { label: "Marco" }] });
    const outcome = core.act(
      FLAT_ID,
      command([editChoice("q3", 2, 1), answerAct({ itemId: "q3", rev: 1, choice: ["Sara"] })]),
    );
    expect(outcome.ok && outcome.events).toEqual([
      {
        cursor: `${core.epoch}.1`,
        type: "edit-choice",
        itemId: "q3",
        rev: 2,
        edit: "ignore",
        keptRev: 1,
      },
      expect.objectContaining({ type: "answer", itemId: "q3", rev: 1, choice: ["Sara"] }),
    ]);
    expect(statesOf(core, FLAT_ID).q3).toBe("answered");
  });

  test("an answer to the kept revision is checked against that revision's content", async () => {
    const { core } = await created(flatAsk());
    change(core, FLAT_ID, "q3", { options: [{ label: "Paola" }], allowOther: false });
    core.act(FLAT_ID, command([editChoice("q3", 2, 1)]));
    expect(
      core.act(FLAT_ID, command([answerAct({ itemId: "q3", rev: 1, choice: ["Paola"] })])),
    ).toMatchObject({ ok: false, refusal: "choice" });
    expect(
      core.act(
        FLAT_ID,
        command([answerAct({ itemId: "q3", rev: 1, choice: undefined, other: "Ines" })]),
      ),
    ).toMatchObject({ ok: true });
  });

  test("a decline naming the kept revision is accepted, and logged at that revision", async () => {
    const { core } = await created(flatAsk());
    change(core, FLAT_ID, "q1", { text: "Reworded" });
    const decline = {
      type: "decline",
      itemId: "q1",
      rev: 1,
      note: "Not mine",
      when: WHEN,
    } as const;
    const outcome = core.act(FLAT_ID, command([editChoice("q1", 2, 1), decline]));
    expect(outcome.ok && outcome.events[1]).toMatchObject({
      type: "answer",
      itemId: "q1",
      rev: 1,
      declined: true,
      note: "Not mine",
    });
    expect(statesOf(core, FLAT_ID).q1).toBe("declined");
    // Without the ignore, the same decline names a stale revision.
    const { core: other } = await created(flatAsk());
    change(other, FLAT_ID, "q1", { text: "Reworded" });
    expect(other.act(FLAT_ID, command([decline]))).toMatchObject({
      ok: false,
      refusal: "stale-rev",
    });
  });

  test("an old revision without the choice is refused", async () => {
    const { core } = await created(flatAsk());
    change(core, FLAT_ID, "q1", { text: "Reworded" });
    expect(core.act(FLAT_ID, command([answerAct({ rev: 1 })]))).toMatchObject({
      ok: false,
      refusal: "stale-rev",
      index: 0,
      itemId: "q1",
    });
    expect(logOf(core, FLAT_ID)).toEqual([]);
  });

  test("the latest edit choice of the current rev counts: a reload after an ignore closes rev 1", async () => {
    const { core } = await created(flatAsk());
    change(core, FLAT_ID, "q1", { text: "Reworded" });
    core.act(FLAT_ID, command([editChoice("q1", 2, 1), editChoice("q1", 2)]));
    expect(core.act(FLAT_ID, command([answerAct({ rev: 1 })]))).toMatchObject({
      ok: false,
      refusal: "stale-rev",
    });
    expect(core.act(FLAT_ID, command([answerAct({ rev: 2 })])).ok).toBe(true);
  });

  test("an ignore kept for an older rev does not open it once the agent changes again", async () => {
    const { core } = await created(flatAsk());
    change(core, FLAT_ID, "q1", { text: "Second" });
    core.act(FLAT_ID, command([editChoice("q1", 2, 1)]));
    change(core, FLAT_ID, "q1", { text: "Third" });
    expect(core.act(FLAT_ID, command([answerAct({ rev: 1 })]))).toMatchObject({
      ok: false,
      refusal: "stale-rev",
    });
    expect(core.act(FLAT_ID, command([editChoice("q1", 3, 1), answerAct({ rev: 1 })])).ok).toBe(
      true,
    );
  });

  test.each([
    ["names a rev that is not current", editChoice("q1", 1)],
    ["keeps a rev not older than the current one", editChoice("q1", 2, 2)],
    ["keeps a rev the question never had", editChoice("q1", 2, 0)],
  ])("an edit choice that %s is refused", async (_, act) => {
    const { core } = await created(flatAsk());
    change(core, FLAT_ID, "q1", { text: "Reworded" });
    expect(core.act(FLAT_ID, command([act]))).toMatchObject({ ok: false, index: 0 });
    expect(logOf(core, FLAT_ID)).toEqual([]);
  });
});

describe("kept revisions", () => {
  test("revisions since the user's last decision are kept; older ones nothing names are dropped", async () => {
    const { core } = await created(flatAsk());
    change(core, FLAT_ID, "q1", { text: "Second" });
    change(core, FLAT_ID, "q1", { text: "Third" });
    // No decision yet: the board may hold work on rev 1 or rev 2.
    expect(core.act(FLAT_ID, command([editChoice("q1", 3, 2)])).ok).toBe(true);
    // The ignore at rev 3 decided: rev 1, which no event names, is dropped; rev 2 is named.
    change(core, FLAT_ID, "q1", { text: "Fourth" });
    expect(core.act(FLAT_ID, command([editChoice("q1", 4, 1)]))).toMatchObject({
      ok: false,
      refusal: "kept-rev",
    });
    expect(core.act(FLAT_ID, command([editChoice("q1", 4, 2)])).ok).toBe(true);
    expect(core.act(FLAT_ID, command([editChoice("q1", 4, 3)])).ok).toBe(true);
  });

  test("a revision an event names stays kept after later decisions", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([{ type: "postpone", itemId: "q1", rev: 1 }]));
    change(core, FLAT_ID, "q1", { text: "Second" });
    core.act(FLAT_ID, command([editChoice("q1", 2)]));
    change(core, FLAT_ID, "q1", { text: "Third" });
    const kept = core.act(
      FLAT_ID,
      command([editChoice("q1", 3, 1), answerAct({ rev: 1, choice: ["release"] })]),
    );
    expect(kept.ok).toBe(true);
    expect(statesOf(core, FLAT_ID).q1).toBe("answered");
  });
});

// For E7's Snapshots: the revisions ask-core keeps, read without changing them.
describe("reading the kept revisions", () => {
  test("per question, in board order, each kept revision with its props, as ask-core prunes them", async () => {
    const { core } = await created(flatAsk());
    const [q1, q2, q3] = flatAsk().items.map((item) => item.props);
    change(core, FLAT_ID, "q1", { text: "Second" });
    change(core, FLAT_ID, "q1", { text: "Third" });
    core.act(FLAT_ID, command([editChoice("q1", 3, 2)]));
    // The ignore at rev 3 decided: rev 1, which no event names, goes at the next change.
    change(core, FLAT_ID, "q1", { text: "Fourth" });
    expect(core.keptRevisions(FLAT_ID) as unknown).toEqual([
      {
        itemId: "q1",
        revisions: [
          { rev: 2, props: { ...q1, text: "Second" } },
          { rev: 3, props: { ...q1, text: "Third" } },
          { rev: 4, props: { ...q1, text: "Fourth" } },
        ],
      },
      { itemId: "q2", revisions: [{ rev: 1, props: q2 }] },
      { itemId: "q3", revisions: [{ rev: 1, props: q3 }] },
    ]);
  });

  test("is read-only: the props are frozen, and changing what was read changes nothing", async () => {
    const { core } = await created(flatAsk());
    change(core, FLAT_ID, "q1", { text: "Second" });
    const read = core.keptRevisions(FLAT_ID) ?? [];
    const revisions = read[0]?.revisions ?? [];
    expect(revisions).toHaveLength(2);
    expect(Object.isFrozen(revisions[0]?.props)).toBe(true);
    (revisions as unknown[]).splice(0);
    (read as unknown[]).splice(0);
    expect(core.keptRevisions(FLAT_ID)?.[0]?.revisions.map(({ rev }) => rev)).toEqual([1, 2]);
    expect(core.act(FLAT_ID, command([editChoice("q1", 2, 1)])).ok).toBe(true);
  });

  test("an ask this epoch does not hold has none, and a discarded ask keeps none", async () => {
    const { core } = await created(flatAsk());
    expect(core.keptRevisions("no-such-ask")).toBeUndefined();
    core.discardAll("session-exit");
    expect(core.keptRevisions(FLAT_ID) as unknown).toEqual([]);
  });
});
