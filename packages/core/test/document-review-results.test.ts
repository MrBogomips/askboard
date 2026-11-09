import { describe, expect, test } from "bun:test";
import {
  ANSWER_EVENT_MAX_CHARS,
  type AnswerEvent,
  BOARD_PROTOCOL_VERSION,
  DOCUMENT_REVIEW_ANNOTATIONS_MAX,
  DRAFT_RECORD_MAX_CHARS,
  FETCH_PAGE_MAX_CHARS,
  widgetResultProblems,
} from "@askboard/contract";
import {
  DOCUMENT_REVIEW_FIXTURE_ITEM,
  DOCUMENT_REVIEW_RESULTS,
  DOCUMENT_REVIEW_TYPES,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { validateAgainst, validateBoardMessage } from "@askboard/contract/validate";
import { canonicalize } from "../src/index.ts";
import { EventLog } from "../src/lifecycle/log.ts";
import { questionStatus } from "../src/lifecycle/states.ts";
import { widgetItemValue } from "../src/lifecycle/widget-fetch.ts";
import { answerAct, checked, type Item, modelOf } from "./probe-fakes.ts";

// Core spec: Document review results through ask-core (document-review, design decision 5):
// ask-core checks a Document review's result against the item's props in the revision the answer
// names, through the registry alone, and never places a quote in the text, which only the board
// renders. A refusal appends, keeps and publishes nothing. Every test passes the registry through
// `withWidgetTypes`, which gives the same registry before and after the type is registered.

const TYPES = withWidgetTypes(...DOCUMENT_REVIEW_TYPES);
const ITEM = DOCUMENT_REVIEW_FIXTURE_ITEM as unknown as Item;
const ID = DOCUMENT_REVIEW_FIXTURE_ITEM.id;

type Model = ReturnType<typeof modelOf>;
type Json = Record<string, unknown>;

const run = (model: Model, fields: Json, log?: EventLog) =>
  checked(model, [answerAct(fields)], { types: TYPES, ...(log === undefined ? {} : { log }) });

// A refusal: the log unchanged, and an outcome carrying nothing but the problem (an accepted
// outcome alone carries the events to publish and the content to keep).
const refusal = (model: Model, fields: Json, log?: EventLog) => {
  const before = log?.latestSeq ?? 0;
  const result = run(model, fields, log);
  if (result.outcome.ok) throw new Error(`accepted: ${JSON.stringify(result.outcome.events)}`);
  expect(result.log.latestSeq).toBe(before);
  expect(Object.keys(result.outcome).sort()).toEqual(["index", "ok", "problem"]);
  expect(result.outcome.problem.refusal).toBe("content");
  return result.outcome.problem;
};

const annotation = (id: string, exact: string, body: Json, selector: Json = {}) => ({
  id,
  target: { selector: { type: "quote", exact, ...selector } },
  body,
});

const result = (...annotations: unknown[]): Json => ({ annotations });
const sent = (...annotations: unknown[]): Json => ({ results: { [ID]: result(...annotations) } });
const document = (markdown: string): Item => ({
  ...ITEM,
  props: { markdown, title: "Release notes" },
});
const refusedWith = (annotations: unknown[], ...words: string[]) => {
  const problem = refusal(modelOf([ITEM]), sent(...annotations));
  expect(problem.detail).toContain("the result of item");
  expect(problem.detail).toContain(ID);
  for (const word of words) expect(problem.detail).toContain(word);
};

describe("a Document review's result", () => {
  test("a comment and a suggested edit are logged under `results`, kept and valid in the output format", () => {
    const results = { [ID]: DOCUMENT_REVIEW_RESULTS.commentAndEdit };
    const { outcome } = run(modelOf([ITEM]), { results });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const [event] = outcome.events as AnswerEvent[];
    expect(event?.results).toEqual(results);
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
    expect([...outcome.kept.values()][0]?.results).toEqual(results);
  });

  test("a deletion (an empty replacement) with a comment is logged", () => {
    const { outcome } = run(modelOf([ITEM]), {
      results: { [ID]: DOCUMENT_REVIEW_RESULTS.deletion },
    });
    expect(outcome.ok).toBe(true);
  });

  test("a quote the document's text does not hold is logged: only the board places quotes", () => {
    const { outcome } = run(
      modelOf([ITEM]),
      sent(annotation("u-1", "a passage nobody wrote", { text: "?" })),
    );
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const [event] = outcome.events as AnswerEvent[];
    expect(JSON.stringify(event?.results)).toContain("a passage nobody wrote");
  });

  test("a comment alone answers with no value", () => {
    const { outcome } = run(modelOf([ITEM]), {
      results: { [ID]: DOCUMENT_REVIEW_RESULTS.comment },
    });
    expect(outcome.ok).toBe(true);
  });
});

describe("a result the item's props refuse", () => {
  test("a quote longer than the revision's document is refused, naming the item and the annotation", () => {
    const model = modelOf([document("Short.")]);
    const problem = refusal(model, sent(annotation("u-1", "Short and then some", { text: "x" })));
    expect(problem.detail).toContain(`the result of item ${ID}`);
    expect(problem.detail).toContain('annotation "u-1"');
    expect(problem.detail).toContain("longer than the document");
  });

  test("an ID the board did not make is refused", () => {
    refusedWith([annotation("note-1", "board", { text: "x" })], 'annotation "note-1"', "u-");
  });

  test("the names every object inherits are IDs like any other, refused for their prefix", () => {
    for (const id of ["__proto__", "constructor", "toString"]) {
      refusedWith([annotation(id, "board", { text: "x" })], `annotation "${id}"`, "u-");
    }
  });

  test("an ID held twice is refused", () => {
    refusedWith(
      [annotation("u-1", "board", { text: "x" }), annotation("u-1", "drafts", { text: "y" })],
      "named twice",
    );
  });

  test("a quote of white space only is refused", () => {
    refusedWith([annotation("u-1", "  \n ", { text: "x" })], "white space");
  });

  test("a replacement equal to its quote changes nothing and is refused", () => {
    refusedWith([annotation("u-1", "board", { replacement: "board" })], "changes nothing");
  });

  test("a control or direction character in a quote's passage or context is refused", () => {
    refusedWith([annotation("u-1", "bo\u0007ard", { text: "x" })], "control character");
    refusedWith(
      [annotation("u-1", "board", { text: "x" }, { prefix: "left‮right" })],
      "control character",
    );
    refusedWith([annotation("u-1", "board", { text: "x" }, { suffix: "‏x" })], "control");
  });

  test("a selector that is not a quote is refused by the schema, naming the item", () => {
    for (const selector of [
      { type: "label", label: "Release" },
      { type: "position", start: 0, end: 3 },
      { type: "element", id: "board" },
    ]) {
      refusedWith([{ id: "u-1", target: { selector }, body: { text: "x" } }]);
    }
  });

  test("a body with neither a comment nor a replacement, and an unknown field, are refused", () => {
    refusedWith([annotation("u-1", "board", {})]);
    refusedWith([annotation("u-1", "board", { text: "x", note: "y" })]);
    refusedWith([{ ...annotation("u-1", "board", { text: "x" }), extra: 1 }]);
  });

  test("a comment, a quote or a replacement past its bound is refused", () => {
    refusedWith([annotation("u-1", "board", { text: "x".repeat(2_001) })]);
    refusedWith([annotation("u-1", "board", { replacement: "x".repeat(4_001) })]);
    refusedWith([annotation("u-1", "x".repeat(2_001), { text: "y" })]);
    refusedWith([annotation("u-1", "board", { text: "y" }, { prefix: "x".repeat(201) })]);
  });

  test("no annotation, and more than the most, are refused", () => {
    refusedWith([]);
    const many = Array.from({ length: DOCUMENT_REVIEW_ANNOTATIONS_MAX + 1 }, (_, at) =>
      annotation(`u-${at + 1}`, "board", { text: "x" }),
    );
    refusedWith(many);
  });

  test("a result holding another key, and one that is not an object, are refused", () => {
    for (const value of [
      { annotations: [annotation("u-1", "board", { text: "x" })], extra: true },
      [annotation("u-1", "board", { text: "x" })],
      "all of it",
      null,
    ]) {
      const problem = refusal(modelOf([ITEM]), { results: { [ID]: value } });
      expect(problem.detail).toContain("the result of item");
      expect(problem.detail).toContain(ID);
    }
  });

  test("a result for an item the question does not hold is refused", () => {
    const problem = refusal(modelOf([ITEM]), {
      results: { elsewhere: DOCUMENT_REVIEW_RESULTS.comment },
    });
    expect(problem.detail).toContain('results name "elsewhere"');
  });
});

describe("a refused result keeps nothing", () => {
  test("no events, no kept content and a log that did not move", () => {
    const { log, outcome } = run(modelOf([ITEM]), sent(annotation("x", "board", { text: "?" })));
    expect(outcome.ok).toBe(false);
    expect("events" in outcome).toBe(false);
    expect("kept" in outcome).toBe(false);
    expect(log.latestSeq).toBe(0);
  });

  test("a refused act beside an accepted one in one command keeps neither", () => {
    const model = modelOf([ITEM]);
    const log = new EventLog();
    const good = answerAct({ results: { [ID]: DOCUMENT_REVIEW_RESULTS.comment } });
    const bad = answerAct(sent(annotation("x", "board", { text: "?" })));
    const { outcome } = checked(model, [good, bad], { types: TYPES, log });
    expect(outcome.ok).toBe(false);
    expect(log.latestSeq).toBe(0);
  });

  test("a refusal after an accepted answer leaves that answer alone", () => {
    const model = modelOf([ITEM]);
    const log = new EventLog();
    const first = run(model, { results: { [ID]: DOCUMENT_REVIEW_RESULTS.comment } }, log);
    if (!first.outcome.ok) throw new Error(JSON.stringify(first.outcome.problem));
    model.noteEntries(log.append(first.outcome.events));
    const before = log.latestSeq;
    refusal(model, sent(annotation("x", "board", { text: "?" })), log);
    expect(log.latestSeq).toBe(before);
    expect(log.ofItem("choose")).toHaveLength(1);
  });
});

describe("a decline", () => {
  const WHEN = answerAct({}).when;
  const decline = (extra: Json) =>
    checked(
      modelOf([ITEM]),
      [{ type: "decline", itemId: "choose", rev: 1, when: WHEN, ...extra }],
      {
        types: TYPES,
      },
    );

  test("a decline with a note carries no result and logs nothing as an answer", () => {
    const { log, outcome } = decline({ note: "No." });
    expect(outcome.ok).toBe(true);
    expect(log.latestSeq).toBe(0);
  });

  test("a decline carrying a Document review's result is refused", () => {
    const { outcome } = decline({ results: { [ID]: DOCUMENT_REVIEW_RESULTS.comment } });
    expect(outcome.ok).toBe(false);
  });
});

// A result of `count` annotations, each holding `replacement` code points of `unit`.
const bulky = (count: number, unit: string, replacement: number) =>
  Array.from({ length: count }, (_, at) =>
    annotation(`u-${at + 1}`, `passage ${at}`, { replacement: unit.repeat(replacement) }),
  );

describe("annotations too large for one answer", () => {
  const answered = () => {
    const model = modelOf([ITEM]);
    const log = new EventLog();
    const annotations = bulky(DOCUMENT_REVIEW_ANNOTATIONS_MAX, "r", 4_000);
    const { outcome } = run(model, sent(...annotations), log);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    model.noteEntries(log.append(outcome.events));
    return { model, log, outcome, results: { [ID]: result(...annotations) } };
  };

  test("100 annotations with replacements of 4,000 code points give a tooLarge event, with no results", () => {
    const { outcome } = answered();
    const [event] = outcome.events as AnswerEvent[];
    expect(event?.tooLarge).toBe(true);
    expect(event).not.toHaveProperty("results");
    expect(JSON.stringify(event).length).toBeLessThan(ANSWER_EVENT_MAX_CHARS);
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
  });

  test("ask-core keeps them whole, and fetch of the item returns them as its result, longer than a page", () => {
    const { model, log, outcome, results } = answered();
    expect([...outcome.kept.values()][0]?.results).toEqual(results);
    const question = model.question("choose");
    if (question === undefined) throw new Error("no question");
    const status = questionStatus(question.mark, log.ofItem("choose"));
    const found = widgetItemValue(
      model,
      ID,
      () => status,
      { map: new Map(), source: undefined, kept: outcome.kept },
      TYPES,
    );
    if (found === undefined) throw new Error("no item");
    const held = (found.item as unknown as { result: unknown }).result;
    expect(held).toEqual(results[ID]);
    expect(canonicalize(found.item).length).toBeGreaterThan(FETCH_PAGE_MAX_CHARS * 10);
    expect(widgetResultProblems(ITEM as never, held, ITEM.props, TYPES)).toEqual([]);
  });
});

describe("a Document review fetched alone", () => {
  test("holds its latest answer's annotations as `result`, and they pass its props", () => {
    const model = modelOf([ITEM]);
    const log = new EventLog();
    const results = { [ID]: DOCUMENT_REVIEW_RESULTS.commentAndEdit };
    const { outcome } = run(model, { results }, log);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    model.noteEntries(log.append(outcome.events));
    const question = model.question("choose");
    if (question === undefined) throw new Error("no question");
    const status = questionStatus(question.mark, log.ofItem("choose"));
    const found = widgetItemValue(
      model,
      ID,
      () => status,
      { map: new Map(), source: undefined, kept: outcome.kept },
      TYPES,
    );
    expect(found?.item).toMatchObject({
      type: "document-review",
      id: ID,
      questionId: "choose",
      state: "answered",
      result: DOCUMENT_REVIEW_RESULTS.commentAndEdit,
    });
  });
});

describe("a document shortened by the agent", () => {
  // Revision 2 holds a document shorter than the quote; the user keeps revision 1 ("Keep mine").
  const LONG = `${"A long passage that only the first revision holds. ".repeat(4)}`.trim();
  const revised = () => {
    const model = modelOf([document(`Intro. ${LONG}`)]);
    const log = new EventLog();
    const question = model.question("choose");
    if (question === undefined) throw new Error("no question");
    model.revise(question, { text: "Which one?", items: [document("Intro.")] } as never);
    return { model, log };
  };
  const keepMine = (model: Model, log: EventLog) => {
    const choice = checked(
      model,
      [{ type: "edit-choice", itemId: "choose", rev: 2, edit: "ignore", keptRev: 1 }],
      { types: TYPES, log },
    );
    if (!choice.outcome.ok) throw new Error(JSON.stringify(choice.outcome.problem));
    model.noteEntries(log.append(choice.outcome.events));
  };
  const quoteOfLong = sent(annotation("u-1", LONG, { text: "Why four times?" }));

  test("an answer naming revision 2 with the long quote is refused", () => {
    const { model, log } = revised();
    const problem = refusal(model, { rev: 2, ...quoteOfLong }, log);
    expect(problem.detail).toContain('annotation "u-1"');
    expect(problem.detail).toContain("longer than the document");
  });

  test("an answer naming revision 1, after Keep mine, is logged against revision 1", () => {
    const { model, log } = revised();
    keepMine(model, log);
    const { outcome } = run(model, quoteOfLong, log);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    expect((outcome.events[0] as AnswerEvent).rev).toBe(1);
  });

  test("revision 1's long quote is refused against revision 2 even after Keep mine", () => {
    const { model, log } = revised();
    keepMine(model, log);
    const before = log.latestSeq;
    const { outcome } = run(model, { rev: 2, ...quoteOfLong }, log);
    expect(outcome.ok).toBe(false);
    expect(log.latestSeq).toBe(before);
  });
});

// Two Document reviews of one question, each filled to every bound with emoji (two UTF-16 units and
// four UTF-8 bytes each): the sizes of the draft record that mirrors them and of the act that sends
// them (review U-1).
const EMOJI = "\u{1F600}";
const filled = () =>
  result(
    ...Array.from({ length: DOCUMENT_REVIEW_ANNOTATIONS_MAX }, (_, at) =>
      annotation(
        `u-${at + 1}`,
        EMOJI.repeat(2_000),
        { text: EMOJI.repeat(2_000), replacement: EMOJI.repeat(4_000) },
        { prefix: EMOJI.repeat(200), suffix: EMOJI.repeat(200) },
      ),
    ),
  );

describe("two Document reviews filled to every bound", () => {
  // Figures, measured with these fills: one filled review mirrors as a draft record of 1,692,490
  // characters (within the 2,000,000 the board protocol takes); two give 3,384,911, over it, and
  // the act that sends two takes about 6,744,900 UTF-8 bytes, over board-host's message limit
  // (the server's document-review-size test asserts that side).
  const draft = (...ids: string[]) => ({
    version: BOARD_PROTOCOL_VERSION,
    type: "draft",
    record: {
      delivery: "immediate",
      questions: {
        choose: { rev: 1, results: Object.fromEntries(ids.map((id) => [id, filled()])) },
      },
    },
  });

  test("one filled review's draft record is within the draft limit, and two are over it", () => {
    const one = draft("review-a");
    expect(JSON.stringify(one.record).length).toBeLessThanOrEqual(DRAFT_RECORD_MAX_CHARS);
    expect(validateBoardMessage("toHost", one).ok).toBe(true);
    const two = draft("review-a", "review-b");
    expect(JSON.stringify(two.record).length).toBeGreaterThan(DRAFT_RECORD_MAX_CHARS);
    const refused = validateBoardMessage("toHost", two);
    expect(refused.ok).toBe(false);
  });

  test("ask-core takes what reaches it as one answer, a tooLarge event keeping both reviews whole", () => {
    const second = { ...ITEM, id: "review-b", props: ITEM.props };
    const first = { ...ITEM, id: "review-a", props: ITEM.props };
    const long = { markdown: "a".repeat(10_000) };
    const results = { "review-a": filled(), "review-b": filled() };
    const { outcome } = run(
      modelOf([
        { ...first, props: long },
        { ...second, props: long },
      ]),
      { results },
    );
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const [event] = outcome.events as AnswerEvent[];
    expect(event?.tooLarge).toBe(true);
    expect([...outcome.kept.values()][0]?.results).toEqual(results);
  });
});
