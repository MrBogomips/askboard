import { describe, expect, test } from "bun:test";
import type { AnswerEvent, OutputEvent, QuestionState } from "@askboard/contract";
import { askStateOf, questionStatus } from "../src/lifecycle/states.ts";
import {
  answerAct,
  areasAsk,
  boardOf,
  command,
  created,
  FLAT_ID,
  flatAsk,
  LIFECYCLE_ID,
  statesOf,
  WHEN,
} from "./lifecycle-fakes.ts";

// Core spec: Question states, Ask states (ask-lifecycle, task 2.2). States are derived from the log,
// the recorded answers and the agent's reopens; only `closed` and `discarded` are stored.

const entry = (seq: number, event: Partial<OutputEvent> & Pick<OutputEvent, "type">) => ({
  seq,
  group: seq,
  event: { cursor: `e.${seq}`, itemId: "q1", rev: 1, ...event } as OutputEvent,
});
const answered = (seq: number, fields: Partial<AnswerEvent> = {}) =>
  entry(seq, { type: "answer", who: "Sara", when: WHEN, choice: ["main"], ...fields });

describe("question states, derived", () => {
  const cases: [
    string,
    Parameters<typeof questionStatus>[0],
    ReturnType<typeof entry>[],
    string,
  ][] = [
    ["no event: open", undefined, [], "open"],
    ["an answer: answered", undefined, [answered(1)], "answered"],
    ["a decline: declined", undefined, [answered(1, { declined: true })], "declined"],
    ["a postpone: postponed", undefined, [entry(1, { type: "postponed" })], "postponed"],
    [
      "a postpone undone: open",
      undefined,
      [entry(1, { type: "postponed" }), entry(2, { type: "reopened" })],
      "open",
    ],
    [
      "a decline undone: open",
      undefined,
      [answered(1, { declined: true }), entry(2, { type: "reopened" })],
      "open",
    ],
    [
      "a postponed question answered: answered",
      undefined,
      [entry(1, { type: "postponed" }), answered(2)],
      "answered",
    ],
    [
      "an answer then a decline: declined",
      undefined,
      [answered(1), answered(2, { declined: true })],
      "declined",
    ],
    [
      "notes, follow-ups and edit choices change nothing",
      undefined,
      [
        entry(1, { type: "postponed" }),
        entry(2, { type: "note", who: "Sara", when: WHEN, note: "later" }),
        entry(3, { type: "follow-up", who: "Sara", when: WHEN, text: "why?" }),
        entry(4, { type: "edit-choice", rev: 2, edit: "reload" }),
      ],
      "postponed",
    ],
    ["a recorded answer: answered", { at: 0, kind: "recorded" }, [], "answered"],
    [
      "a recorded answer over a postpone: answered",
      { at: 1, kind: "recorded" },
      [entry(1, { type: "postponed" })],
      "answered",
    ],
    [
      "a board answer after a recorded one: answered",
      { at: 1, kind: "recorded" },
      [entry(1, { type: "postponed" }), answered(2)],
      "answered",
    ],
    ["the agent's reopen over an answer: open", { at: 1, kind: "reopened" }, [answered(1)], "open"],
    [
      "a postpone after the agent's reopen: postponed",
      { at: 1, kind: "reopened" },
      [answered(1), entry(2, { type: "postponed" })],
      "postponed",
    ],
  ];

  test.each(cases)("%s", (_, mark, entries, state) => {
    expect(questionStatus(mark, entries).state).toBe(state as QuestionState);
  });

  test("the current answer is the latest logged one after the mark, or the recorded one", () => {
    const first = answered(1);
    const second = answered(2, { choice: ["release"] });
    expect(questionStatus(undefined, [first, second]).answer).toEqual({
      kind: "logged",
      entry: second as never,
    });
    expect(questionStatus({ at: 2, kind: "recorded" }, [first, second]).answer).toEqual({
      kind: "recorded",
    });
    expect(questionStatus({ at: 2, kind: "reopened" }, [first, second]).answer).toBeUndefined();
    expect(
      questionStatus(undefined, [first, entry(3, { type: "reopened" })]).answer,
    ).toBeUndefined();
  });
});

describe("ask states, derived: the spine's lifecycle diagram as a table", () => {
  const live = { acted: true };
  const cases: [string, Parameters<typeof askStateOf>[0], string][] = [
    ["[*] → waiting: the ask", { acted: false, questions: ["open", "open"] }, "waiting"],
    [
      "waiting → partly-answered: a first answer",
      { ...live, questions: ["answered", "open"] },
      "partly-answered",
    ],
    [
      "waiting → partly-answered: a first decline",
      { ...live, questions: ["declined", "open"] },
      "partly-answered",
    ],
    [
      "waiting → partly-answered: a first postpone",
      { ...live, questions: ["postponed", "open"] },
      "partly-answered",
    ],
    [
      "waiting → answered: every question answered or declined at once",
      { ...live, questions: ["answered", "declined"] },
      "answered",
    ],
    [
      "partly-answered → answered: the last open question answered, declined or recorded",
      { ...live, questions: ["answered", "declined", "answered"] },
      "answered",
    ],
    [
      "partly-answered → answered: the last open question deleted (it leaves the list)",
      { ...live, questions: ["answered"] },
      "answered",
    ],
    [
      "answered → partly-answered: the agent adds a question",
      { ...live, questions: ["answered", "answered", "open"] },
      "partly-answered",
    ],
    [
      "answered → partly-answered: the agent or the user reopens one",
      { ...live, questions: ["answered", "open"] },
      "partly-answered",
    ],
    [
      "answered, with one postponed",
      { ...live, questions: ["answered", "answered", "postponed"] },
      "answered",
    ],
    // AD-10: the state never claims more than the user has given; `answered` needs an answer or a
    // decline, as the diagram's waiting → partly-answered on a first postpone says.
    [
      "all questions postponed: partly-answered, since none is answered or declined",
      { ...live, questions: ["postponed", "postponed"] },
      "partly-answered",
    ],
    [
      "the only question postponed: partly-answered",
      { ...live, questions: ["postponed"] },
      "partly-answered",
    ],
    [
      "one declined, the rest postponed: answered",
      { ...live, questions: ["postponed", "declined", "postponed"] },
      "answered",
    ],
    [
      "no way back to waiting once acted",
      { ...live, questions: ["open", "open"] },
      "partly-answered",
    ],
    ["waiting → closed", { stored: "closed", acted: false, questions: ["open"] }, "closed"],
    [
      "partly-answered → closed",
      { stored: "closed", ...live, questions: ["answered", "open"] },
      "closed",
    ],
    ["answered → closed", { stored: "closed", ...live, questions: ["answered"] }, "closed"],
    ["waiting → discarded", { stored: "discarded", acted: false, questions: [] }, "discarded"],
    [
      "partly-answered → discarded",
      { stored: "discarded", ...live, questions: ["open"] },
      "discarded",
    ],
    ["answered → discarded", { stored: "discarded", ...live, questions: [] }, "discarded"],
  ];

  test.each(cases)("%s", (_, input, state) => {
    expect(askStateOf(input)).toBe(state as never);
  });
});

describe("ask states through acts", () => {
  test("of three questions, two answered and one postponed: answered", async () => {
    const { core } = await created(flatAsk());
    core.act(
      FLAT_ID,
      command([
        answerAct(),
        answerAct({ itemId: "q2", choice: ["Linux"] }),
        { type: "postpone", itemId: "q3", rev: 1 },
      ]),
    );
    expect(statesOf(core, FLAT_ID)).toEqual({ q1: "answered", q2: "answered", q3: "postponed" });
    expect(boardOf(core, FLAT_ID).state).toBe("answered");
    expect(core.read(FLAT_ID, `${core.epoch}.0`)).toMatchObject({ state: "answered" });
  });

  test("every question postponed: partly-answered, never answered (AD-10)", async () => {
    const { core } = await created(flatAsk());
    const postpones = ["q1", "q2", "q3"].map((itemId) => ({ type: "postpone", itemId, rev: 1 }));
    core.act(FLAT_ID, command(postpones as never));
    expect(statesOf(core, FLAT_ID)).toEqual({ q1: "postponed", q2: "postponed", q3: "postponed" });
    expect(boardOf(core, FLAT_ID).state).toBe("partly-answered");
    expect(core.read(FLAT_ID, `${core.epoch}.0`)).toMatchObject({ state: "partly-answered" });
    core.act(FLAT_ID, command([answerAct({ itemId: "q2", choice: ["Linux"] })]));
    expect(boardOf(core, FLAT_ID).state).toBe("answered");
  });

  test("the user reopens a declined question on an answered ask: partly-answered", async () => {
    const { core } = await created(flatAsk());
    core.act(
      FLAT_ID,
      command([
        answerAct(),
        answerAct({ itemId: "q2", choice: ["Linux"] }),
        { type: "decline", itemId: "q3", rev: 1, note: "Not my call", when: WHEN },
      ]),
    );
    expect(boardOf(core, FLAT_ID).state).toBe("answered");
    core.act(FLAT_ID, command([{ type: "reopen", itemId: "q3" }]));
    expect(statesOf(core, FLAT_ID)).toMatchObject({ q3: "open" });
    expect(boardOf(core, FLAT_ID).state).toBe("partly-answered");
  });

  test("a postponed question stays postponed until the user answers, declines or undoes it", async () => {
    const { core } = await created(areasAsk());
    const postpone = { type: "postpone", itemId: "erp-export", rev: 1 } as const;
    core.act(LIFECYCLE_ID, command([postpone]));
    expect(statesOf(core, LIFECYCLE_ID)["erp-export"]).toBe("postponed");
    expect(boardOf(core, LIFECYCLE_ID).state).toBe("partly-answered");
    core.act(
      LIFECYCLE_ID,
      command([{ type: "note", itemId: "erp-export", rev: 1, note: "Ask finance", when: WHEN }]),
    );
    expect(statesOf(core, LIFECYCLE_ID)["erp-export"]).toBe("postponed");
    core.act(LIFECYCLE_ID, command([{ type: "reopen", itemId: "erp-export" }]));
    expect(statesOf(core, LIFECYCLE_ID)["erp-export"]).toBe("open");
    core.act(LIFECYCLE_ID, command([postpone]));
    core.act(
      LIFECYCLE_ID,
      command([
        answerAct({ itemId: "erp-export", choice: ["Yes"] }),
        answerAct({ itemId: "region", choice: ["EU"] }),
      ]),
    );
    expect(statesOf(core, LIFECYCLE_ID)["erp-export"]).toBe("answered");
    core.act(LIFECYCLE_ID, command([postpone]));
    expect(statesOf(core, LIFECYCLE_ID)["erp-export"]).toBe("answered");
  });

  test("notes and follow-ups alone leave an ask waiting", async () => {
    const { core } = await created(flatAsk());
    core.act(
      FLAT_ID,
      command([
        { type: "note", itemId: "q1", rev: 1, note: "Both work", when: WHEN },
        { type: "follow-up", itemId: "q2", rev: 1, text: "Is WSL a platform?", when: WHEN },
      ]),
    );
    expect(boardOf(core, FLAT_ID).state).toBe("waiting");
  });
});
