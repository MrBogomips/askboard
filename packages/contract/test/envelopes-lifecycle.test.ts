import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { SCHEMA_IDS } from "../src/index.ts";
import { validateAgainst } from "../src/validate.ts";

// Tool envelopes 1.1 (contract spec: Envelopes of update and fetch, Ask and question states,
// Closed asks on the wire): collect's new events, states and outcomes, and the results of update
// and fetch, every one naming its versions and the epoch.
const FIXTURES = join(import.meta.dir, "fixtures");
const read = async (path: string) => Bun.file(join(FIXTURES, path)).json();

const versions = { result: "1.1", output: "1.1" };
const head = { versions, epoch: "k3x9", askId: "checkout-plan-p8r3" };
const by = { who: "Sara Conti", when: "2026-10-31T14:05:12Z" };

const pathsOf = (id: string, value: unknown) => {
  const checked = validateAgainst(id, value);
  return checked.ok ? [] : checked.problems.map((problem) => problem.path);
};
const passes = (id: string, value: unknown) =>
  expect(validateAgainst(id, value)).toEqual({ ok: true, value });

const events = [
  { cursor: "k3x9.1", type: "answer", itemId: "q1", rev: 1, ...by, choice: ["Yes"], other: "Both" },
  { cursor: "k3x9.2", type: "postponed", itemId: "q2", rev: 1 },
  { cursor: "k3x9.3", type: "reopened", itemId: "q2", rev: 1 },
  { cursor: "k3x9.4", type: "note", itemId: "q2", rev: 1, ...by, note: "Ask finance." },
  { cursor: "k3x9.5", type: "follow-up", itemId: "q3", rev: 1, ...by, text: "Why?" },
  { cursor: "k3x9.6", type: "edit-choice", itemId: "q3", rev: 2, edit: "ignore", keptRev: 1 },
  {
    cursor: "k3x9.7",
    type: "answer",
    itemId: "q3",
    rev: 1,
    ...by,
    declined: true,
    replaces: "k3x9.1",
  },
  { cursor: "k3x9.8", type: "discarded", reason: "board-closed" },
];

describe("the collect result 1.1", () => {
  test("the approved UJ-2 answer, an answered ask with a postponed question, passes", async () => {
    const result = await read("answers/uj2-wbs-gantt.json");
    passes(SCHEMA_IDS.collectResult, result);
  });

  test("an entry may hold every event type the output format defines", () => {
    const entry = {
      askId: head.askId,
      state: "discarded",
      cursor: "k3x9.8",
      events,
      unchecked: true,
    };
    passes(SCHEMA_IDS.collectResult, { versions, epoch: "k3x9", asks: [entry] });
  });

  test.each(["partly-answered", "closed"])("an entry may be %s", (state) => {
    const entry = { askId: head.askId, state, cursor: "k3x9.0", events: [] };
    passes(SCHEMA_IDS.collectResult, { versions, epoch: "k3x9", asks: [entry] });
  });

  test.each(["open", "postponed", "closed"])(
    "a waiting collect may end with the outcome %s",
    (outcome) => {
      const entry = { askId: head.askId, state: "partly-answered", cursor: "k3x9.0", events: [] };
      passes(SCHEMA_IDS.collectResult, { versions, epoch: "k3x9", asks: [entry], outcome });
    },
  );

  test("a closed event, which push delivery adds to the output format's 1.1, is one of collect's", () => {
    const closed = { cursor: "k3x9.9", type: "closed", reason: "agent-finished" };
    const entry = { askId: head.askId, state: "closed", cursor: "k3x9.9", events: [closed] };
    passes(SCHEMA_IDS.collectResult, { versions, epoch: "k3x9", asks: [entry] });
    const agents = { ...entry, events: [{ ...closed, reason: "agent" }] };
    expect(
      pathsOf(SCHEMA_IDS.collectResult, { versions, epoch: "k3x9", asks: [agents] }),
    ).not.toEqual([]);
  });

  test("the outcome discarded is not collect's: a discarded ask says so in its state", () => {
    const entry = { askId: head.askId, state: "discarded", cursor: "k3x9.0", events: [] };
    const value = { versions, epoch: "k3x9", asks: [entry], outcome: "discarded" };
    expect(pathsOf(SCHEMA_IDS.collectResult, value)).toEqual(["/outcome"]);
  });
});

describe("the update result", () => {
  const applied = [
    { action: "add", itemId: "q4", rev: 1 },
    { action: "change", itemId: "q2", rev: 2 },
    { action: "delete", itemId: "q5" },
    { action: "reopen", itemId: "q1", rev: 2 },
    { action: "answer", itemId: "erp-export", rev: 1, recorded: by },
    { action: "reply", itemId: "q3" },
    { action: "close" },
  ];
  const result = { ...head, state: "closed", applied, unchecked: true };

  test("adding and rewording, a recorded answer and a close pass", () => {
    passes(SCHEMA_IDS.updateResult, result);
  });

  test("it carries no cursor, so the agent's cursor still covers every event", () => {
    expect(pathsOf(SCHEMA_IDS.updateResult, { ...result, cursor: "k3x9.7" })).toEqual(["/cursor"]);
  });

  test("a recorded answer names who and when, and only an answer is recorded", () => {
    const unnamed = { ...result, applied: [{ action: "answer", itemId: "erp-export", rev: 1 }] };
    expect(pathsOf(SCHEMA_IDS.updateResult, unnamed)).toEqual(["/applied/0/recorded"]);
    const recordedChange = {
      ...result,
      applied: [{ action: "change", itemId: "q2", rev: 2, recorded: by }],
    };
    expect(pathsOf(SCHEMA_IDS.updateResult, recordedChange)).toEqual(["/applied/0/recorded"]);
    const noWhen = { ...result, applied: [{ ...applied[4], recorded: { who: by.who } }] };
    expect(pathsOf(SCHEMA_IDS.updateResult, noWhen)).toEqual(["/applied/0/recorded/when"]);
  });

  test("a close names no item, and every other action names its item", () => {
    const named = { ...result, applied: [{ action: "close", itemId: "q1" }] };
    expect(pathsOf(SCHEMA_IDS.updateResult, named)).toEqual(["/applied/0/itemId"]);
    const unnamed = { ...result, applied: [{ action: "delete" }] };
    expect(pathsOf(SCHEMA_IDS.updateResult, unnamed)).toEqual(["/applied/0/itemId"]);
  });

  test("names its versions and its epoch", () => {
    const { versions: _, ...bare } = result;
    expect(pathsOf(SCHEMA_IDS.updateResult, bare)).toEqual(["/versions"]);
    const { epoch: __, ...noEpoch } = result;
    expect(pathsOf(SCHEMA_IDS.updateResult, noEpoch)).toEqual(["/epoch"]);
  });
});

describe("the typed results of update and fetch", () => {
  test.each(["closed", "discarded"])("update's %s names the ask and passes", (outcome) => {
    passes(SCHEMA_IDS.updateOutcome, { ...head, outcome });
  });

  test("fetch's typed result is discarded or deleted, never closed: a closed ask's items are still fetched", () => {
    passes(SCHEMA_IDS.fetchOutcome, { ...head, outcome: "discarded" });
    expect(pathsOf(SCHEMA_IDS.fetchOutcome, { ...head, outcome: "closed" })).toEqual(["/outcome"]);
  });

  test.each([SCHEMA_IDS.updateOutcome, SCHEMA_IDS.fetchOutcome])(
    "%s names its versions and ask",
    (id) => {
      const { versions: _, ...bare } = { ...head, outcome: "discarded" };
      expect(pathsOf(id, bare)).toEqual(["/versions"]);
      const { askId: __, ...noAsk } = { ...head, outcome: "discarded" };
      expect(pathsOf(id, noAsk)).toEqual(["/askId"]);
    },
  );
});

describe("the fetch result", () => {
  const props = {
    text: "Which database?",
    options: [{ label: "PostgreSQL" }, { label: "SQLite" }],
  };
  const logged = { cursor: "k3x9.4", choice: ["SQLite"], ...by };
  const item = {
    type: "question",
    id: "database",
    rev: 1,
    props,
    state: "answered",
    answer: logged,
  };
  const result = { ...head, state: "answered", item, unchecked: true };

  test("a question at its revision, with its answer in full and that answer's cursor, passes", () => {
    passes(SCHEMA_IDS.fetchResult, result);
  });

  test("a recorded answer carries recorded: true and no cursor; a logged one its cursor", () => {
    const { cursor: _, ...content } = logged;
    const recorded = { ...item, answer: { ...content, recorded: true } };
    passes(SCHEMA_IDS.fetchResult, { ...result, item: recorded });
    const both = { ...item, answer: { ...logged, recorded: true } };
    expect(pathsOf(SCHEMA_IDS.fetchResult, { ...result, item: both })).toEqual([
      "/item/answer/cursor",
    ]);
    const neither = { ...item, answer: content };
    expect(pathsOf(SCHEMA_IDS.fetchResult, { ...result, item: neither })).toEqual([
      "/item/answer/cursor",
    ]);
  });

  test("a reopened question is open with its previous answer, and holds no current one", () => {
    const reopened = { ...item, rev: 2, state: "open", answer: undefined, previous: logged };
    passes(SCHEMA_IDS.fetchResult, { ...result, item: JSON.parse(JSON.stringify(reopened)) });
    const withAnswer = { ...item, state: "postponed" };
    expect(pathsOf(SCHEMA_IDS.fetchResult, { ...result, item: withAnswer })).toEqual([
      "/item/answer",
    ]);
    const without = { ...item, state: "declined", answer: undefined };
    expect(
      pathsOf(SCHEMA_IDS.fetchResult, { ...result, item: JSON.parse(JSON.stringify(without)) }),
    ).toEqual(["/item/answer"]);
  });

  test("an area is its title and questions, with no revision or state of its own", () => {
    const area = {
      type: "area",
      id: "scope",
      props: { title: "Scope", items: [{ type: "question", id: "database", rev: 1, props }] },
    };
    passes(SCHEMA_IDS.fetchResult, { ...result, item: area });
    const withRev = { ...area, rev: 1 };
    expect(pathsOf(SCHEMA_IDS.fetchResult, { ...result, item: withRev })).toEqual(["/item/rev"]);
  });

  test("a question without its revision or state is refused", () => {
    const { rev: _, ...noRev } = item;
    expect(pathsOf(SCHEMA_IDS.fetchResult, { ...result, item: noRev })).toEqual(["/item/rev"]);
    const { state: __, ...noState } = item;
    expect(pathsOf(SCHEMA_IDS.fetchResult, { ...result, item: noState })).toEqual(["/item/state"]);
  });

  test("names its versions", () => {
    const { versions: _, ...bare } = result;
    expect(pathsOf(SCHEMA_IDS.fetchResult, bare)).toEqual(["/versions"]);
  });
});

describe("a fetch page", () => {
  const page = {
    ...head,
    itemId: "plan",
    part: '{"id":"plan","props":{',
    continuation: "eyJyZXYiOjF9",
    unchecked: true,
  };

  test("a slice of the item's JSON text with a continuation passes, and the last one without", () => {
    passes(SCHEMA_IDS.fetchPage, page);
    const { continuation: _, ...last } = page;
    passes(SCHEMA_IDS.fetchPage, last);
  });

  test("a slice holds at most 24,000 characters", () => {
    passes(SCHEMA_IDS.fetchPage, { ...page, part: "x".repeat(24_000) });
    expect(pathsOf(SCHEMA_IDS.fetchPage, { ...page, part: "x".repeat(24_001) })).toEqual(["/part"]);
  });

  test("a continuation is base64url, and a page names its versions", () => {
    expect(pathsOf(SCHEMA_IDS.fetchPage, { ...page, continuation: "a+b" })).toEqual([
      "/continuation",
    ]);
    const { versions: _, ...bare } = page;
    expect(pathsOf(SCHEMA_IDS.fetchPage, bare)).toEqual(["/versions"]);
  });
});
