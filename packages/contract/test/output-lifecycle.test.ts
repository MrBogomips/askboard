import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { SCHEMA_IDS } from "../src/index.ts";
import { validateAgainst } from "../src/validate.ts";

// Output format 1.1 (contract spec: Answer event in the output format, Lifecycle events, Ask and
// question states, Closed asks on the wire): what an answer adds, the five lifecycle events and
// the states. No closed event: push-delivery defines it.
const FIXTURES = join(import.meta.dir, "fixtures");
const read = async (path: string) => Bun.file(join(FIXTURES, path)).json();

const base = { cursor: "k3x9.5", itemId: "erp-export", rev: 2 };
const by = { who: "Sara Conti", when: "2026-10-31T14:05:12Z" };
const answer = { ...base, type: "answer", ...by, choice: ["Yes"] };

const pathsOf = (id: string, value: unknown) => {
  const checked = validateAgainst(id, value);
  return checked.ok ? [] : checked.problems.map((problem) => problem.path);
};
const passes = (id: string, value: unknown) =>
  expect(validateAgainst(id, value)).toEqual({ ok: true, value });

describe("the answer event 1.1", () => {
  test("Other text and option notes: other and optionNotes by label", () => {
    const value = {
      ...answer,
      choice: ["DynamoDB"],
      other: "MariaDB",
      optionNotes: { DynamoDB: "Only if the team takes it on." },
    };
    passes(SCHEMA_IDS.answerEvent, value);
  });

  test("a decline carries declined: true and the reason as note, and no choice or other", () => {
    const { choice: _, ...bare } = answer;
    passes(SCHEMA_IDS.answerEvent, { ...bare, declined: true, note: "Not my call" });
    passes(SCHEMA_IDS.answerEvent, { ...bare, declined: true });
    for (const content of [
      { choice: ["Yes"] },
      { other: "x" },
      { optionNotes: { Yes: "x" } },
      { changes: [{ op: "remove", target: "a.b" }] },
    ]) {
      const value = { ...bare, declined: true, ...content };
      const [field] = Object.keys(content);
      expect({ field, paths: pathsOf(SCHEMA_IDS.answerEvent, value) }).toEqual({
        field,
        paths: [`/${field}`],
      });
    }
  });

  test("a revised answer names the replaced answer's cursor", () => {
    passes(SCHEMA_IDS.answerEvent, { ...answer, choice: ["No"], replaces: "k3x9.4" });
    expect(pathsOf(SCHEMA_IDS.answerEvent, { ...answer, replaces: "4" })).toEqual(["/replaces"]);
  });

  test.each([
    ["declined false", { declined: false }, "/declined"],
    ["empty Other text", { other: "" }, "/other"],
    ["Other text of 10,001 characters", { other: "o".repeat(10_001) }, "/other"],
    ["an empty option note", { optionNotes: { Yes: "" } }, "/optionNotes/Yes"],
    [
      "an option note of 2,001 characters",
      { optionNotes: { Yes: "n".repeat(2_001) } },
      "/optionNotes/Yes",
    ],
    ["option notes on no option", { optionNotes: {} }, "/optionNotes"],
    ["an option note under an empty label", { optionNotes: { "": "x" } }, "/optionNotes"],
  ])("%s is refused", (_, change, path) => {
    expect(pathsOf(SCHEMA_IDS.answerEvent, { ...answer, ...change })).toContain(path);
  });

  test("Other text of 10,000 characters and an option note of 2,000 pass", () => {
    const value = { ...answer, other: "o".repeat(10_000), optionNotes: { Yes: "n".repeat(2_000) } };
    passes(SCHEMA_IDS.answerEvent, value);
  });
});

describe("the lifecycle events", () => {
  test("the approved postponed event of answers/uj2-wbs-gantt.json passes", async () => {
    const answers = (await read("answers/uj2-wbs-gantt.json")) as {
      asks: { events: Record<string, unknown>[] }[];
    };
    const postponed = answers.asks[0]?.events.find((event) => event.type === "postponed");
    expect(postponed).toEqual({
      cursor: "k3x9.2",
      type: "postponed",
      itemId: "erp-export",
      rev: 1,
    });
    passes(SCHEMA_IDS.postponedEvent, postponed);
  });

  test.each([
    ["postponed", SCHEMA_IDS.postponedEvent, { ...base, type: "postponed" }],
    ["reopened", SCHEMA_IDS.reopenedEvent, { ...base, type: "reopened" }],
    ["note", SCHEMA_IDS.noteEvent, { ...base, type: "note", ...by, note: "Ask finance first." }],
    [
      "follow-up",
      SCHEMA_IDS.followUpEvent,
      { ...base, type: "follow-up", ...by, text: "Which ERP do you mean?" },
    ],
    [
      "edit-choice reload",
      SCHEMA_IDS.editChoiceEvent,
      { ...base, type: "edit-choice", edit: "reload" },
    ],
    [
      "edit-choice ignore",
      SCHEMA_IDS.editChoiceEvent,
      { ...base, type: "edit-choice", edit: "ignore", keptRev: 1 },
    ],
  ])("a %s event passes", (_, id, event) => {
    passes(id, event);
  });

  test("an ignore without the kept revision fails, naming keptRev", () => {
    const ignore = { ...base, type: "edit-choice", edit: "ignore" };
    expect(pathsOf(SCHEMA_IDS.editChoiceEvent, ignore)).toEqual(["/keptRev"]);
  });

  test("a reload names no kept revision", () => {
    const reload = { ...base, type: "edit-choice", edit: "reload", keptRev: 1 };
    expect(pathsOf(SCHEMA_IDS.editChoiceEvent, reload)).toEqual(["/keptRev"]);
  });

  test.each([
    [
      "a postponed event with who",
      SCHEMA_IDS.postponedEvent,
      { ...base, type: "postponed", ...by },
      "/who",
    ],
    ["a note without its note", SCHEMA_IDS.noteEvent, { ...base, type: "note", ...by }, "/note"],
    [
      "a note of 10,001 characters",
      SCHEMA_IDS.noteEvent,
      { ...base, type: "note", ...by, note: "n".repeat(10_001) },
      "/note",
    ],
    [
      "a follow-up of 10,001 characters",
      SCHEMA_IDS.followUpEvent,
      { ...base, type: "follow-up", ...by, text: "t".repeat(10_001) },
      "/text",
    ],
    [
      "a follow-up without when",
      SCHEMA_IDS.followUpEvent,
      { ...base, type: "follow-up", who: by.who, text: "x" },
      "/when",
    ],
    [
      "an edit that is neither",
      SCHEMA_IDS.editChoiceEvent,
      { ...base, type: "edit-choice", edit: "merge" },
      "/edit",
    ],
    [
      "a reopened event at rev 0",
      SCHEMA_IDS.reopenedEvent,
      { ...base, type: "reopened", rev: 0 },
      "/rev",
    ],
  ])("%s is refused", (_, id, event, path) => {
    expect(pathsOf(id, event)).toContain(path);
  });

  test("a discarded event after the tab closed passes, with the reason board-closed", () => {
    passes(SCHEMA_IDS.discardedEvent, {
      cursor: "k3x9.9",
      type: "discarded",
      reason: "board-closed",
    });
    const other = { cursor: "k3x9.9", type: "discarded", reason: "agent-finished" };
    expect(pathsOf(SCHEMA_IDS.discardedEvent, other)).toEqual(["/reason"]);
  });
});

describe("ask and question states", () => {
  test("an ask is waiting, partly-answered, answered, closed or discarded", () => {
    for (const state of ["waiting", "partly-answered", "answered", "closed", "discarded"]) {
      passes(SCHEMA_IDS.askState, state);
    }
    expect(validateAgainst(SCHEMA_IDS.askState, "open").ok).toBe(false);
  });

  test("a question is open, answered, postponed or declined", () => {
    for (const state of ["open", "answered", "postponed", "declined"]) {
      passes(SCHEMA_IDS.questionState, state);
    }
    expect(validateAgainst(SCHEMA_IDS.questionState, "waiting").ok).toBe(false);
  });

  test("the typed outcomes add postponed, closed and discarded", () => {
    for (const outcome of ["unavailable", "open", "postponed", "closed", "discarded"]) {
      passes(SCHEMA_IDS.outcome, outcome);
    }
    expect(validateAgainst(SCHEMA_IDS.outcome, "answered").ok).toBe(false);
  });
});
