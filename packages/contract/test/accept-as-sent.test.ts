// Answers accepted as sent (accept-as-sent, contract spec: An answer accepted as sent in the answer
// act, A held answer accepted as sent in the draft record, An answer accepted as sent in the output
// format, An answer accepted as sent in the board state, fetch and Snapshots): `asSent: true` on
// the answer act, the held answer, the answer event, the board state's answer and fetch's answer.

import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  acceptAsSentAct,
  acceptAsSentDraft,
  acceptAsSentEvent,
  acceptAsSentFetch,
  acceptAsSentState,
} from "../src/fixtures/index.ts";
import { SCHEMA_IDS } from "../src/index.ts";
import { type Checked, validateAgainst, validateBoardMessage } from "../src/validate.ts";

const paths = (result: Checked<unknown>): string[] =>
  result.ok ? [] : result.problems.map(({ path }) => path);

const actWith = (answer: Record<string, unknown>) => ({
  ...acceptAsSentAct,
  acts: [{ ...acceptAsSentAct.acts[0], ...answer }],
});
const draftHeld = (held: Record<string, unknown>) => ({
  ...acceptAsSentDraft,
  record: { ...acceptAsSentDraft.record, questions: { plan: { rev: 1, held } } },
});
const stateWith = (answer: Record<string, unknown>) => ({
  ...acceptAsSentState,
  state: {
    ask: "waiting",
    questions: [{ itemId: "plan", rev: 1, state: "answered", answer: { ...answer } }],
  },
});
const fetchWith = (answer: Record<string, unknown>) => ({
  ...acceptAsSentFetch,
  item: { ...acceptAsSentFetch.item, answer: { ...answer } },
});

describe("an answer accepted as sent in the answer act", () => {
  test("an act with asSent, a note and derived validates", () => {
    expect(validateBoardMessage("toHost", acceptAsSentAct).ok).toBe(true);
  });

  test("asSent with no note and no derived validates, and so does values beside it", () => {
    expect(
      validateBoardMessage("toHost", actWith({ note: undefined, derived: undefined })).ok,
    ).toBe(true);
    expect(validateBoardMessage("toHost", actWith({ values: { tree: { nodes: [] } } })).ok).toBe(
      true,
    );
  });

  test.each([
    ["choice", ["Yes"]],
    ["other", "Elsewhere"],
    ["optionNotes", { Yes: "x" }],
    ["results", { tree: 1 }],
  ])("asSent beside %s is refused at that field", (field, value) => {
    expect(paths(validateBoardMessage("toHost", actWith({ [field]: value })))).toContain(
      `/acts/0/${field}`,
    );
  });

  test("asSent other than true is refused", () => {
    expect(validateBoardMessage("toHost", actWith({ asSent: false })).ok).toBe(false);
    expect(validateBoardMessage("toHost", actWith({ asSent: "yes" })).ok).toBe(false);
  });
});

describe("a held answer accepted as sent in the draft record", () => {
  test("a held answer with asSent validates", () => {
    expect(validateBoardMessage("toHost", acceptAsSentDraft).ok).toBe(true);
    expect(validateBoardMessage("toPage", acceptAsSentDraft).ok).toBe(true);
  });

  test.each(["decline", "postpone", "note", "reopen"])("asSent on a held %s is refused", (act) => {
    const checked = validateBoardMessage("toHost", draftHeld({ act, order: 0, asSent: true }));
    expect(checked.ok).toBe(false);
  });

  test("asSent other than true is refused", () => {
    expect(
      validateBoardMessage("toHost", draftHeld({ act: "answer", order: 0, asSent: false })).ok,
    ).toBe(false);
  });
});

describe("an answer accepted as sent in the output format", () => {
  const event = acceptAsSentEvent;

  test("an event with asSent, a note and derived validates", () => {
    expect(validateAgainst(SCHEMA_IDS.answerEvent, event).ok).toBe(true);
  });

  test("replaces and tooLarge stay admitted beside it", () => {
    expect(validateAgainst(SCHEMA_IDS.answerEvent, { ...event, replaces: "k3x9.0" }).ok).toBe(true);
  });

  test.each([
    ["choice", ["Yes"]],
    ["other", "Elsewhere"],
    ["optionNotes", { Yes: "x" }],
    ["changes", [{ op: "remove", target: "a" }]],
    ["results", { tree: 1 }],
    ["declined", true],
  ])("asSent beside %s is refused", (field, value) => {
    expect(validateAgainst(SCHEMA_IDS.answerEvent, { ...event, [field]: value }).ok).toBe(false);
  });

  test("asSent other than true is refused", () => {
    expect(validateAgainst(SCHEMA_IDS.answerEvent, { ...event, asSent: false }).ok).toBe(false);
  });

  test("every answer event of the earlier fixtures still validates", async () => {
    const folder = join(import.meta.dir, "fixtures/answers");
    const files = (await readdir(folder)).filter((name) => name.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const { asks } = (await Bun.file(join(folder, file)).json()) as {
        asks: { events: { type: string }[] }[];
      };
      for (const ask of asks) {
        for (const e of ask.events.filter(({ type }) => type === "answer")) {
          expect({ file, ok: validateAgainst(SCHEMA_IDS.answerEvent, e).ok }).toEqual({
            file,
            ok: true,
          });
        }
      }
    }
  });
});

describe("an answer accepted as sent in the board state, fetch and Snapshots", () => {
  test("the board state's answer validates, current and previous", () => {
    expect(validateBoardMessage("toPage", acceptAsSentState).ok).toBe(true);
    const previous = {
      ...acceptAsSentState,
      state: {
        ask: "waiting",
        questions: [
          {
            itemId: "plan",
            rev: 2,
            state: "answered",
            answer: { note: "later", when: "2026-11-16T10:00:00Z", receipt: "sent" },
            previous: { asSent: true, when: "2026-11-16T09:30:00Z", receipt: "delivered" },
          },
        ],
      },
    };
    expect(validateBoardMessage("toPage", previous).ok).toBe(true);
  });

  test.each([
    ["choice", ["Yes"]],
    ["other", "Elsewhere"],
    ["optionNotes", { Yes: "x" }],
    ["values", { tree: { nodes: [] } }],
    ["results", { tree: 1 }],
    ["declined", true],
  ])("the board state's asSent beside %s is refused", (field, value) => {
    const answer = { asSent: true, when: "2026-11-16T09:30:00Z", receipt: "sent", [field]: value };
    expect(validateBoardMessage("toPage", stateWith(answer)).ok).toBe(false);
  });

  test("fetch's answer with asSent validates, with the same exclusions", () => {
    expect(validateAgainst(SCHEMA_IDS.fetchResult, acceptAsSentFetch).ok).toBe(true);
    const base = { cursor: "k3x9.1", who: "Sara Conti", when: "2026-11-16T09:30:00Z" };
    for (const [field, value] of [
      ["choice", ["Yes"]],
      ["other", "Elsewhere"],
      ["optionNotes", { Yes: "x" }],
      ["values", { tree: { nodes: [] } }],
      ["results", { tree: 1 }],
      ["declined", true],
    ] as const) {
      const answer = { ...base, asSent: true, [field]: value };
      expect(validateAgainst(SCHEMA_IDS.fetchResult, fetchWith(answer)).ok, field).toBe(false);
    }
    expect(validateAgainst(SCHEMA_IDS.fetchResult, fetchWith({ ...base, asSent: false })).ok).toBe(
      false,
    );
  });
});
