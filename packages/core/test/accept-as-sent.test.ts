import { describe, expect, test } from "bun:test";
import { RESULT_VERSIONS, SCHEMA_IDS } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import { AskCore } from "../src/index.ts";
import { boardStateOf } from "../src/snapshot/state.ts";
import { fakePorts } from "./fakes.ts";
import { actionId, appendedOf, logOf, WHEN } from "./lifecycle-fakes.ts";

// Core spec: Answers only from an explicit user action, the `asSent` answer (accept-as-sent, design
// decision 4): an answer that accepts a question's content as the agent sent it is accepted only on
// a question whose named revision has no options and holds an edit widget, with every value it
// carries equal to the item as sent and the field checks passing; anything else is refused, with
// the log unchanged (AD-10, NFR-10).

type Act = Parameters<AskCore["act"]>[1];
type AskInput = Parameters<AskCore["ask"]>[0];
type Json = Record<string, unknown>;

let n = 0;
const ASK_ID = "accept-as-sent-q1";
const TREE = { nodes: [{ id: "ux", label: "UX" }] };
const tree = (id = "t") => ({ type: "tree", id, props: structuredClone(TREE) });
const field = { type: "text-field", id: "who", props: { label: "Who", required: true } };

const question = (id: string, props: Json) => ({ type: "question", id, props });

const setup = async (...questions: ReturnType<typeof question>[]) => {
  const core = new AskCore(fakePorts().ports);
  const outcome = await core.ask({ askId: ASK_ID, items: questions } as unknown as AskInput);
  if (outcome.kind !== "created") throw new Error(outcome.kind);
  const heard: Parameters<Parameters<AskCore["subscribe"]>[0]>[0][] = [];
  core.subscribe((event) => heard.push(event));
  return { core, heard };
};

const send = (core: AskCore, itemId: string, fields: Json, rev = 1) => {
  n += 1;
  const act = { type: "answer", itemId, rev, when: WHEN, ...fields };
  return core.act(ASK_ID, { actionId: actionId(n), acts: [act] } as unknown as Act);
};

const refusalOf = (outcome: ReturnType<AskCore["act"]>) => {
  if (outcome.ok) throw new Error("accepted");
  return JSON.stringify(outcome);
};

const reviewed = () => question("plan", { text: "Is the plan right?", items: [tree()] });

describe("a question with a Tree accepted as sent", () => {
  test("is answered by an event with asSent and the note, and no changes", async () => {
    const { core, heard } = await setup(reviewed());
    const outcome = send(core, "plan", { asSent: true, note: "Va bene così." });
    expect(outcome.ok).toBe(true);
    const [event] = logOf(core, ASK_ID);
    expect(event).toMatchObject({ type: "answer", itemId: "plan", rev: 1, asSent: true });
    expect(event).toMatchObject({ note: "Va bene così." });
    for (const field of ["changes", "choice", "other", "optionNotes", "results", "declined"]) {
      expect(event).not.toHaveProperty(field);
    }
    expect(appendedOf(heard)).toHaveLength(1);
    expect(core.keptAnswerValues(ASK_ID)?.size ?? 0).toBe(0);
  });

  test("with no note it is answered too", async () => {
    const { core } = await setup(reviewed());
    expect(send(core, "plan", { asSent: true }).ok).toBe(true);
    expect(logOf(core, ASK_ID)[0]).toMatchObject({ asSent: true });
  });

  test("a derived value the item does not declare refuses the acceptance too", async () => {
    const { core } = await setup(reviewed());
    expect(refusalOf(send(core, "plan", { asSent: true, derived: { "t.count": 1 } }))).toContain(
      "derived",
    );
    expect(logOf(core, ASK_ID)).toEqual([]);
  });

  test("beside values equal to what was sent is accepted, and keeps no value", async () => {
    const { core } = await setup(reviewed());
    expect(send(core, "plan", { asSent: true, values: { t: structuredClone(TREE) } }).ok).toBe(
      true,
    );
    expect(logOf(core, ASK_ID)[0]).not.toHaveProperty("changes");
    expect(core.keptAnswerValues(ASK_ID)?.size ?? 0).toBe(0);
  });

  test("the board and fetch carry asSent on the answer", async () => {
    const { core } = await setup(reviewed());
    send(core, "plan", { asSent: true, note: "ok" });
    const value = core.fullValue(ASK_ID, "plan");
    if (value.kind !== "item") throw new Error(value.kind);
    expect(value.item).toMatchObject({ state: "answered", answer: { asSent: true, note: "ok" } });
  });
});

describe("a question accepted as sent on a kept revision", () => {
  test("names the revision the user kept with an ignore edit choice", async () => {
    const { core } = await setup(reviewed());
    const updated = await core.update({
      askId: ASK_ID,
      actions: [{ action: "change", itemId: "plan", props: { items: [tree("d")] } }],
    });
    expect(updated).toMatchObject({ kind: "updated" });
    n += 1;
    const kept = core.act(ASK_ID, {
      actionId: actionId(n),
      acts: [
        { type: "edit-choice", itemId: "plan", rev: 2, edit: "ignore", keptRev: 1, when: WHEN },
      ],
    } as unknown as Act);
    expect(kept.ok).toBe(true);
    expect(send(core, "plan", { asSent: true }, 1).ok).toBe(true);
    expect(logOf(core, ASK_ID).at(-1)).toMatchObject({ asSent: true, rev: 1 });
  });

  test("an old revision with no edit choice is a stale revision, refused", async () => {
    const { core } = await setup(reviewed());
    await core.update({
      askId: ASK_ID,
      actions: [{ action: "change", itemId: "plan", props: { items: [tree("d")] } }],
    });
    expect(send(core, "plan", { asSent: true }, 1).ok).toBe(false);
    expect(logOf(core, ASK_ID).map((event) => event.type)).toEqual([]);
  });
});

describe("an acceptance beside a moving value", () => {
  test("a value that differs from the item as sent is refused, with the log unchanged", async () => {
    const { core, heard } = await setup(reviewed());
    const moved = { nodes: [{ id: "ux", label: "Moved" }] };
    const outcome = send(core, "plan", { asSent: true, values: { t: moved } });
    expect(refusalOf(outcome)).toContain("as sent");
    expect(logOf(core, ASK_ID)).toEqual([]);
    expect(appendedOf(heard)).toEqual([]);
    expect(core.keptAnswerValues(ASK_ID)?.size ?? 0).toBe(0);
  });
});

describe("an acceptance where it is not true", () => {
  test("on a question with options is refused", async () => {
    const { core, heard } = await setup(
      question("plan", { text: "Plan?", options: [{ label: "Yes" }], items: [tree()] }),
    );
    expect(refusalOf(send(core, "plan", { asSent: true }))).toContain("as sent");
    expect(logOf(core, ASK_ID)).toEqual([]);
    expect(appendedOf(heard)).toEqual([]);
  });

  test("on a question with no edit widget is refused", async () => {
    const { core } = await setup(
      question("plan", {
        text: "Plan?",
        items: [{ type: "text-field", id: "f", props: { label: "F" } }],
      }),
    );
    expect(refusalOf(send(core, "plan", { asSent: true }))).toContain("as sent");
    expect(logOf(core, ASK_ID)).toEqual([]);
  });

  test.each([
    ["a choice", { choice: ["Yes"] }],
    ["an Other… text", { other: "Else" }],
    ["option notes", { optionNotes: { Yes: "x" } }],
    ["a result", { results: { t: 1 } }],
  ])("beside %s is refused, with the log unchanged", async (_, extra) => {
    const { core } = await setup(
      question("plan", {
        text: "Plan?",
        allowOther: true,
        items: [tree()],
      }),
    );
    expect(send(core, "plan", { asSent: true, ...extra }).ok).toBe(false);
    expect(logOf(core, ASK_ID)).toEqual([]);
  });

  test("a decline carrying asSent is refused, naming the acceptance", async () => {
    const { core } = await setup(reviewed());
    n += 1;
    const outcome = core.act(ASK_ID, {
      actionId: actionId(n),
      acts: [{ type: "decline", itemId: "plan", rev: 1, asSent: true, when: WHEN }],
    } as unknown as Act);
    expect(refusalOf(outcome)).toContain("accepted as sent");
    expect(logOf(core, ASK_ID)).toEqual([]);
  });

  test("a required field left empty refuses the answer, naming the field", async () => {
    const { core } = await setup(question("plan", { text: "Plan?", items: [tree(), field] }));
    const detail = refusalOf(send(core, "plan", { asSent: true }));
    expect(detail).toContain("who");
    expect(logOf(core, ASK_ID)).toEqual([]);
  });

  test.each([false, "true", 1, null])("an asSent of %p is refused as act", async (value) => {
    const { core } = await setup(reviewed());
    expect(refusalOf(send(core, "plan", { asSent: value }))).toContain("act");
    expect(logOf(core, ASK_ID)).toEqual([]);
  });
});

describe("an answer with values equal to what was sent and no asSent", () => {
  test("is still refused", async () => {
    const { core } = await setup(reviewed());
    expect(send(core, "plan", { values: { t: structuredClone(TREE) } }).ok).toBe(false);
    expect(logOf(core, ASK_ID)).toEqual([]);
  });

  test("a note alone is still refused as an answer", async () => {
    const { core } = await setup(reviewed());
    expect(send(core, "plan", { note: "Va bene così" }).ok).toBe(false);
  });
});

describe("the board view, fetch and a Snapshot's state of an accepted question", () => {
  const questionOf = (core: AskCore) => {
    const board = core.lifecycleBoard(ASK_ID);
    if (board === undefined || board.state === "discarded") throw new Error("no board");
    const [first] = board.questions;
    if (first === undefined) throw new Error("no question");
    return { board, question: first };
  };

  test("the board's current answer holds asSent, with its receipt, and no values", async () => {
    const { core } = await setup(reviewed());
    send(core, "plan", { asSent: true, note: "ok" });
    const { board, question } = questionOf(core);
    expect(question.answer).toMatchObject({ asSent: true, note: "ok" });
    expect(question.answer).not.toHaveProperty("values");
    const state = boardStateOf(board as never).questions[0];
    expect(state).toMatchObject({ state: "answered", answer: { asSent: true, note: "ok" } });
    expect(state).toMatchObject({ answer: { receipt: "sent" } });
  });

  test("the previous answer after a reopen holds asSent", async () => {
    const { core } = await setup(reviewed());
    send(core, "plan", { asSent: true });
    await core.update({ askId: ASK_ID, actions: [{ action: "reopen", itemId: "plan" }] });
    const { board, question } = questionOf(core);
    expect(question.previous).toMatchObject({ asSent: true });
    expect(boardStateOf(board as never).questions[0]).toMatchObject({
      previous: { asSent: true },
    });
  });

  test("fetch's answer passes the tool envelopes", async () => {
    const { core } = await setup(reviewed());
    send(core, "plan", { asSent: true, note: "ok" });
    const value = core.fullValue(ASK_ID, "plan");
    if (value.kind !== "item") throw new Error(value.kind);
    const result = {
      versions: RESULT_VERSIONS,
      epoch: core.epoch,
      askId: value.askId,
      state: value.state,
      item: value.item,
      unchecked: true,
    };
    const checked = validateAgainst(SCHEMA_IDS.fetchResult, result);
    expect(checked.ok ? [] : checked.problems).toEqual([]);
    expect(value.item).toMatchObject({ answer: { asSent: true } });
  });
});
