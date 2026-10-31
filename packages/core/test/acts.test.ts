import { describe, expect, test } from "bun:test";
import { NOTE_MAX_CHARS } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import { UNKNOWN_USER } from "../src/index.ts";
import {
  answerAct,
  appendedOf,
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

// Core spec: Answers only from an explicit user action, Who and when, Postponing, Declining,
// Undoing a sent postpone or decline, A note without an answer, Follow-ups (ask-lifecycle, task
// 2.3). Every refusal leaves the log as it was and tells the subscription nothing.

const EVENT_IDS: Record<string, string> = {
  answer: "urn:askboard:output:answer-event",
  postponed: "urn:askboard:output:postponed-event",
  reopened: "urn:askboard:output:reopened-event",
  note: "urn:askboard:output:note-event",
  "follow-up": "urn:askboard:output:follow-up-event",
  "edit-choice": "urn:askboard:output:edit-choice-event",
};

// The core's events validate against the output format.
const expectValid = (events: readonly { readonly type: string }[]) => {
  for (const event of events) {
    expect(validateAgainst(EVENT_IDS[event.type] ?? "", event).ok).toBe(true);
  }
};

describe("answer acts", () => {
  test("an answer with option notes and a note appends one answer event; who is the expected user", async () => {
    const { core, heard } = await created(areasAsk());
    const outcome = core.act(
      LIFECYCLE_ID,
      command([
        answerAct({
          itemId: "region",
          choice: ["EU", "US"],
          optionNotes: { US: "East coast only, at first." },
          note: "APAC next year.",
        }),
      ]),
    );
    const event = {
      cursor: `${core.epoch}.1`,
      type: "answer",
      itemId: "region",
      rev: 1,
      who: "Sara Conti",
      when: WHEN,
      choice: ["EU", "US"],
      optionNotes: { US: "East coast only, at first." },
      note: "APAC next year.",
    };
    expect(outcome).toEqual({ ok: true, events: [event as never], repeated: false });
    expect(appendedOf(heard)).toEqual([event as never]);
    expect(statesOf(core, LIFECYCLE_ID).region).toBe("answered");
    expectValid(appendedOf(heard));
  });

  test("an answer with only Other… text, on a question that offers it", async () => {
    const { core } = await created(areasAsk());
    const outcome = core.act(
      LIFECYCLE_ID,
      command([answerAct({ itemId: "payment", choice: undefined, other: "Mollie" })]),
    );
    expect(outcome.ok && outcome.events[0]).toMatchObject({ other: "Mollie" });
    expect(outcome.ok && "choice" in (outcome.events[0] ?? {})).toBe(false);
    expect(statesOf(core, LIFECYCLE_ID).payment).toBe("answered");
  });

  const refused: [string, Record<string, unknown>, string][] = [
    ["a label that is not an option", { choice: ["develop"] }, "choice"],
    ["two labels on a single-choice question", { choice: ["main", "release"] }, "choice"],
    ["a label twice", { itemId: "q2", choice: ["Linux", "Linux"] }, "choice"],
    ["Other… text on a question without allowOther", { other: "trunk" }, "content"],
    ["no label and no Other… text", { choice: undefined, note: "no idea" }, "content"],
    ["an empty choice", { choice: [] }, "choice"],
    ["an option note on a label that is not an option", { optionNotes: { trunk: "x" } }, "content"],
    ["an option note that is empty", { optionNotes: { main: "" } }, "content"],
    ["option notes that are not an object", { optionNotes: ["main"] }, "content"],
    ["a note longer than the limit", { note: "n".repeat(NOTE_MAX_CHARS + 1) }, "content"],
    ["a rev that is not current and not kept", { rev: 2 }, "stale-rev"],
    ["a rev that is not an integer", { rev: 1.5 }, "act"],
    ["a when that is no real time", { when: "2026-02-30T10:00:00Z" }, "when"],
    ["a when that is not text", { when: 5 }, "act"],
    ["an unknown question", { itemId: "q9" }, "unknown-item"],
    ["an item ID that is not text", { itemId: ["q1"] }, "act"],
    ["a choice that is not a list of labels", { choice: "main" }, "choice"],
  ];

  test.each(refused)("%s is refused, and the log is unchanged", async (_, fields, refusal) => {
    const { core, heard } = await created(flatAsk());
    const outcome = core.act(FLAT_ID, command([answerAct(fields as never)]));
    expect(outcome).toMatchObject({ ok: false, refusal, index: 0 });
    expect(outcome.ok ? "" : outcome.detail.length).toBeGreaterThan(0);
    expect(logOf(core, FLAT_ID)).toEqual([]);
    expect(heard).toEqual([]);
    expect(statesOf(core, FLAT_ID)).toEqual({ q1: "open", q2: "open", q3: "open" });
  });

  test("an act of a type the protocol does not define is refused", async () => {
    const { core } = await created(flatAsk());
    const outcome = core.act(FLAT_ID, command([{ type: "telemetry", itemId: "q1" } as never]));
    expect(outcome).toMatchObject({ ok: false, refusal: "act", index: 0 });
    expect(logOf(core, FLAT_ID)).toEqual([]);
  });

  test("acts on an ask this epoch does not hold are refused", async () => {
    const { core } = await created(flatAsk());
    expect(core.act("other-ask", command([answerAct()]))).toMatchObject({
      ok: false,
      refusal: "unknown-ask",
    });
  });
});

describe("who and when", () => {
  test("answers, notes and follow-ups carry the board's when and the ask's who", async () => {
    const { core } = await created(flatAsk(), { git: "Paola Greco" });
    const outcome = core.act(
      FLAT_ID,
      command([
        answerAct({ when: "2026-10-31T09:00:00.5Z" }),
        { type: "note", itemId: "q2", rev: 1, note: "Linux first", when: WHEN },
        { type: "follow-up", itemId: "q3", rev: 1, text: "Can Paola sign?", when: WHEN },
      ]),
    );
    const events = outcome.ok ? outcome.events : [];
    expect(events.map((event) => ("who" in event ? event.who : undefined))).toEqual([
      "Paola Greco",
      "Paola Greco",
      "Paola Greco",
    ]);
    expect(events.map((event) => ("when" in event ? event.when : undefined))).toEqual([
      "2026-10-31T09:00:00.5Z",
      WHEN,
      WHEN,
    ]);
    expectValid(events);
  });

  test("with no expected user and no git user name, the login name; with none, a placeholder", async () => {
    const login = await created(flatAsk(), { login: "paola" });
    const answered = login.core.act(FLAT_ID, command([answerAct()]));
    expect(answered.ok && answered.events[0]).toMatchObject({ who: "paola" });
    const nobody = await created(flatAsk());
    const unnamed = nobody.core.act(FLAT_ID, command([answerAct()]));
    expect(unnamed.ok && unnamed.events[0]).toMatchObject({ who: UNKNOWN_USER });
  });
});

describe("postponing", () => {
  test("an open question at its current rev: a postponed event, and the question is postponed", async () => {
    const { core } = await created(areasAsk());
    const outcome = core.act(
      LIFECYCLE_ID,
      command([{ type: "postpone", itemId: "erp-export", rev: 1 }]),
    );
    expect(outcome).toEqual({
      ok: true,
      events: [{ cursor: `${core.epoch}.1`, type: "postponed", itemId: "erp-export", rev: 1 }],
      repeated: false,
    });
    expect(statesOf(core, LIFECYCLE_ID)["erp-export"]).toBe("postponed");
    expectValid(outcome.ok ? outcome.events : []);
  });

  test.each([
    ["a question whose answer is logged", [answerAct()], { rev: 1 }],
    ["a question already postponed", [{ type: "postpone", itemId: "q1", rev: 1 }], { rev: 1 }],
    ["a rev that is not current", [], { rev: 2 }],
  ] as const)("postponing %s is refused, and the log is unchanged", async (_, before, fields) => {
    const { core } = await created(flatAsk());
    if (before.length > 0) core.act(FLAT_ID, command(before as never));
    const log = logOf(core, FLAT_ID);
    const outcome = core.act(
      FLAT_ID,
      command([{ type: "postpone", itemId: "q1", ...fields } as never]),
    );
    expect(outcome).toMatchObject({ ok: false, index: 0, itemId: "q1" });
    expect(logOf(core, FLAT_ID)).toEqual(log);
  });
});

describe("declining", () => {
  test("declining with a reason appends a declined answer event; the question is declined", async () => {
    const { core } = await created(areasAsk());
    const outcome = core.act(
      LIFECYCLE_ID,
      command([{ type: "decline", itemId: "erp-export", rev: 1, note: "Not my call", when: WHEN }]),
    );
    const event = {
      cursor: `${core.epoch}.1`,
      type: "answer",
      itemId: "erp-export",
      rev: 1,
      who: "Sara Conti",
      when: WHEN,
      declined: true,
      note: "Not my call",
    };
    expect(outcome).toEqual({ ok: true, events: [event as never], repeated: false });
    expect(statesOf(core, LIFECYCLE_ID)["erp-export"]).toBe("declined");
    expectValid([event]);
  });

  test("a postponed question can be declined, without a reason", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([{ type: "postpone", itemId: "q1", rev: 1 }]));
    const outcome = core.act(
      FLAT_ID,
      command([{ type: "decline", itemId: "q1", rev: 1, when: WHEN }]),
    );
    expect(outcome.ok && outcome.events[0]).toEqual({
      cursor: `${core.epoch}.2`,
      type: "answer",
      itemId: "q1",
      rev: 1,
      who: UNKNOWN_USER,
      when: WHEN,
      declined: true,
    });
    expect(statesOf(core, FLAT_ID).q1).toBe("declined");
  });

  test.each([
    ["a stale rev", { rev: 2 }, "stale-rev"],
    ["a when that is no real time", { when: "2026-13-01T00:00:00Z" }, "when"],
    ["an unknown question", { itemId: "nope" }, "unknown-item"],
  ] as const)(
    "a decline with %s is refused, and the log is unchanged",
    async (_, fields, refusal) => {
      const { core } = await created(flatAsk());
      const outcome = core.act(
        FLAT_ID,
        command([{ type: "decline", itemId: "q1", rev: 1, when: WHEN, ...fields }]),
      );
      expect(outcome).toMatchObject({ ok: false, refusal });
      expect(logOf(core, FLAT_ID)).toEqual([]);
    },
  );
});

describe("undoing a sent postpone or decline", () => {
  test("undoing the logged postpone appends reopened; the question is open", async () => {
    const { core } = await created(areasAsk());
    core.act(LIFECYCLE_ID, command([{ type: "postpone", itemId: "erp-export", rev: 1 }]));
    const outcome = core.act(LIFECYCLE_ID, command([{ type: "reopen", itemId: "erp-export" }]));
    expect(outcome).toEqual({
      ok: true,
      events: [{ cursor: `${core.epoch}.2`, type: "reopened", itemId: "erp-export", rev: 1 }],
      repeated: false,
    });
    expect(statesOf(core, LIFECYCLE_ID)["erp-export"]).toBe("open");
    expectValid(outcome.ok ? outcome.events : []);
  });

  test.each([
    ["an open question", []],
    ["an answered question", [answerAct()]],
  ] as const)("undoing on %s is refused, and the log is unchanged", async (_, before) => {
    const { core } = await created(flatAsk());
    if (before.length > 0) core.act(FLAT_ID, command(before as never));
    const log = logOf(core, FLAT_ID);
    const outcome = core.act(FLAT_ID, command([{ type: "reopen", itemId: "q1" }]));
    expect(outcome).toMatchObject({ ok: false, refusal: "state", index: 0, itemId: "q1" });
    expect(logOf(core, FLAT_ID)).toEqual(log);
  });
});

describe("a note without an answer", () => {
  test("a note alone appends a note event and the question stays open", async () => {
    const { core } = await created(flatAsk());
    const outcome = core.act(
      FLAT_ID,
      command([{ type: "note", itemId: "q1", rev: 1, note: "Either works.", when: WHEN }]),
    );
    expect(outcome.ok && outcome.events).toEqual([
      {
        cursor: `${core.epoch}.1`,
        type: "note",
        itemId: "q1",
        rev: 1,
        who: UNKNOWN_USER,
        when: WHEN,
        note: "Either works.",
      },
    ]);
    expect(statesOf(core, FLAT_ID).q1).toBe("open");
  });

  test("a note on a postponed question keeps it postponed", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([{ type: "postpone", itemId: "q1", rev: 1 }]));
    expect(
      core.act(FLAT_ID, command([{ type: "note", itemId: "q1", rev: 1, note: "x", when: WHEN }]))
        .ok,
    ).toBe(true);
    expect(statesOf(core, FLAT_ID).q1).toBe("postponed");
  });

  test.each([
    ["an answered question", [answerAct()], {}, "state"],
    ["an empty note", [], { note: "" }, "content"],
    ["a stale rev", [], { rev: 3 }, "stale-rev"],
  ] as const)(
    "a note on %s is refused, and the log is unchanged",
    async (_, before, fields, refusal) => {
      const { core } = await created(flatAsk());
      if (before.length > 0) core.act(FLAT_ID, command(before as never));
      const log = logOf(core, FLAT_ID);
      const outcome = core.act(
        FLAT_ID,
        command([{ type: "note", itemId: "q1", rev: 1, note: "x", when: WHEN, ...fields }]),
      );
      expect(outcome).toMatchObject({ ok: false, refusal });
      expect(logOf(core, FLAT_ID)).toEqual(log);
    },
  );
});

describe("follow-ups", () => {
  test("a follow-up on an answered question appends follow-up; state and rev unchanged", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([answerAct()]));
    const outcome = core.act(
      FLAT_ID,
      command([{ type: "follow-up", itemId: "q1", rev: 1, text: "Why main?", when: WHEN }]),
    );
    expect(outcome.ok && outcome.events).toEqual([
      {
        cursor: `${core.epoch}.2`,
        type: "follow-up",
        itemId: "q1",
        rev: 1,
        who: UNKNOWN_USER,
        when: WHEN,
        text: "Why main?",
      },
    ]);
    const question = boardOf(core, FLAT_ID).questions[0];
    expect([question?.state, question?.rev]).toEqual(["answered", 1]);
    expect(question?.thread).toEqual([
      {
        cursor: `${core.epoch}.2`,
        who: UNKNOWN_USER,
        when: WHEN,
        text: "Why main?",
        replies: [],
      },
    ]);
  });

  test.each([
    ["an open", []],
    ["a postponed", [{ type: "postpone", itemId: "q1", rev: 1 }]],
    ["a declined", [{ type: "decline", itemId: "q1", rev: 1, when: WHEN }]],
  ] as const)("a follow-up on %s question is appended", async (_, before) => {
    const { core } = await created(flatAsk());
    if (before.length > 0) core.act(FLAT_ID, command(before as never));
    const state = statesOf(core, FLAT_ID).q1;
    const outcome = core.act(
      FLAT_ID,
      command([{ type: "follow-up", itemId: "q1", rev: 1, text: "?", when: WHEN }]),
    );
    expect(outcome.ok).toBe(true);
    expect(statesOf(core, FLAT_ID).q1).toBe(state);
  });

  test.each([
    ["empty text", { text: "" }, "content"],
    ["a when that is no real time", { when: "2026-04-31T00:00:00Z" }, "when"],
    ["a rev the question never had", { rev: 4 }, "stale-rev"],
  ] as const)(
    "a follow-up with %s is refused, and the log is unchanged",
    async (_, fields, refusal) => {
      const { core } = await created(flatAsk());
      const outcome = core.act(
        FLAT_ID,
        command([{ type: "follow-up", itemId: "q1", rev: 1, text: "?", when: WHEN, ...fields }]),
      );
      expect(outcome).toMatchObject({ ok: false, refusal });
      expect(logOf(core, FLAT_ID)).toEqual([]);
    },
  );
});
