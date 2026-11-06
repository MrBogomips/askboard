// The answer's `results` seam in the contract's schemas (widget-registry, tasks 2.2 and 2.3;
// contract spec: the answer act, the draft record, the board state, a too-large answer, `fetch`
// results, the Snapshot data and "This change's sets at their next minor"), proven with the
// test-only type's results.

import { describe, expect, test } from "bun:test";
import Ajv2020, { type AnySchemaObject } from "ajv/dist/2020";
import { AJV_OPTIONS } from "../src/compiled.ts";
import {
  PROBE_SESSION,
  PROBE_TYPES,
  plainChoiceBoardDocument,
  probeAnswerEvent,
  probeBoardDocument,
  probeBoardState,
  probeDraftRecord,
  probeFetchItemResult,
  probeFetchResult,
  probeResultAct,
  probeSnapshotEntry,
  probeTooLargeEvent,
} from "../src/fixtures/index.ts";
import {
  BOARD_PROTOCOL_VERSION,
  OUTPUT_FORMAT_VERSION,
  SCHEMA_IDS,
  SNAPSHOT_DATA_VERSION,
  TOOL_ENVELOPES_VERSION,
} from "../src/index.ts";
import act from "../src/schemas/board-protocol/act.json" with { type: "json" };
import { SCHEMA_SETS } from "../src/sets.ts";
import {
  type Checked,
  draftRecordProblems,
  validateAgainst,
  validateBoardMessage,
  validateSnapshotData,
} from "../src/validate.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";

// The paths of a refusal, each once: a bad key in a map is reported by the map and by its names.
const pathsOf = (result: Checked<unknown>) =>
  result.ok ? [] : [...new Set(result.problems.map((problem) => problem.path))];

const withResults = (results: unknown) => {
  const command = structuredClone(probeResultAct) as unknown as { acts: Record<string, unknown>[] };
  const [first] = command.acts;
  if (first !== undefined) first.results = results;
  return command;
};

describe("results in the answer act", () => {
  test("an act whose answer carries results for a probe item passes", () => {
    const checked = validateBoardMessage("toHost", probeResultAct);
    expect(checked.ok).toBe(true);
    expect(probeResultAct.acts[0]).toMatchObject({ results: { pick: { pick: "a" } } });
  });

  test("results sit beside values and derived", () => {
    const command = withResults({ pick: { pick: "a" } });
    Object.assign(command.acts[0] ?? {}, { values: { pick: {} }, derived: { "pick.count": 2 } });
    expect(validateBoardMessage("toHost", command).ok).toBe(true);
  });

  test("any JSON is a result, since the item's type says what it is", () => {
    for (const result of [{ pick: "a" }, [1, 2], "text", 3, null, true]) {
      expect(validateBoardMessage("toHost", withResults({ pick: result })).ok).toBe(true);
    }
  });

  test("a key that is no ID fails, naming results", () => {
    const checked = validateBoardMessage("toHost", withResults({ "a b": { pick: "a" } }));
    expect(checked.ok).toBe(false);
    expect(pathsOf(checked)).toEqual(["/acts/0/results"]);
  });

  test("an empty results fails, naming results", () => {
    const checked = validateBoardMessage("toHost", withResults({}));
    expect(pathsOf(checked)).toEqual(["/acts/0/results"]);
  });

  test("results that are no object fail, naming results", () => {
    for (const results of [[1], "a", 3, null]) {
      expect(pathsOf(validateBoardMessage("toHost", withResults(results)))).toEqual([
        "/acts/0/results",
      ]);
    }
  });

  test("E1's answer command refuses results, as a schema error naming them", () => {
    const e1 = {
      version: BOARD_PROTOCOL_VERSION,
      type: "answer",
      itemId: "choose",
      rev: 1,
      choice: ["A"],
      when: "2026-11-06T09:00:00Z",
      results: { pick: { pick: "a" } },
    };
    const checked = validateBoardMessage("toHost", e1);
    expect(checked).toMatchObject({ ok: false, reason: "schema" });
    expect(pathsOf(checked)).toEqual(["/results"]);
  });

  test("a receiver on the previous minor refuses results, as a schema error naming them", () => {
    // The previous minor's schema is this one without the field: nothing else changed in act.json.
    const previous = structuredClone(act) as AnySchemaObject;
    delete previous.$defs.answer.properties.results;
    const ajv = new Ajv2020({ ...AJV_OPTIONS });
    for (const set of SCHEMA_SETS) {
      for (const schema of set.schemas as AnySchemaObject[]) {
        ajv.addSchema(schema.$id === previous.$id ? previous : schema);
      }
    }
    const errors = errorsOf(ajv, SCHEMA_IDS.act, probeResultAct);
    expect(errors.map((error) => [error.instancePath, error.params.additionalProperty])).toEqual([
      ["/acts/0", "results"],
    ]);
    const { results: _, ...plain } = probeResultAct.acts[0] as Record<string, unknown>;
    expect(errorsOf(ajv, SCHEMA_IDS.act, { ...probeResultAct, acts: [plain] })).toEqual([]);
  });
});

describe("results in the draft record", () => {
  test("a record whose question holds a result for a probe item passes", () => {
    expect(
      validateBoardMessage("toHost", {
        version: BOARD_PROTOCOL_VERSION,
        type: "draft",
        record: probeDraftRecord,
      }).ok,
    ).toBe(true);
    expect(validateAgainst(SCHEMA_IDS.draftRecord, probeDraftRecord).ok).toBe(true);
    expect(draftRecordProblems(probeDraftRecord, probeBoardDocument)).toEqual([]);
  });

  test("a result may be any JSON, and a key that is no ID fails", () => {
    const record = (results: unknown) => ({
      ...probeDraftRecord,
      questions: { choose: { rev: 1, results } },
    });
    expect(validateAgainst(SCHEMA_IDS.draftRecord, record({ pick: [1, null, "x"] })).ok).toBe(true);
    const bad = validateAgainst(SCHEMA_IDS.draftRecord, record({ "a b": 1 }));
    expect(pathsOf(bad)).toEqual(["/questions/choose/results"]);
    expect(validateAgainst(SCHEMA_IDS.draftRecord, record("x")).ok).toBe(false);
  });

  test("the check against the board document reports a key that names no item of the question", () => {
    const record = {
      ...probeDraftRecord,
      questions: { choose: { rev: 1, results: { pick: { pick: "a" }, zz: { pick: "a" } } } },
    };
    const problems = draftRecordProblems(record, probeBoardDocument);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.path).toBe("/questions/choose/results/zz");
    expect(problems[0]?.message).toContain('"zz"');
  });

  test("an inherited name is no item either, and a pointer's characters are escaped", () => {
    const results = JSON.parse('{"__proto__": 1, "constructor": 2, "pick": 3}') as Record<
      string,
      unknown
    >;
    const record = { ...probeDraftRecord, questions: { choose: { rev: 1, results } } };
    const paths = draftRecordProblems(record, probeBoardDocument).map((problem) => problem.path);
    expect(paths).toEqual([
      "/questions/choose/results/__proto__",
      "/questions/choose/results/constructor",
    ]);
  });

  test("results and values are checked alike", () => {
    const record = {
      ...probeDraftRecord,
      questions: { choose: { rev: 1, values: { zz: {} }, results: { yy: 1 } } },
    };
    expect(draftRecordProblems(record, probeBoardDocument).map((problem) => problem.path)).toEqual([
      "/questions/choose/values/zz",
      "/questions/choose/results/yy",
    ]);
  });
});

describe("logged results in the board state", () => {
  test("a state whose question's answer holds results for a probe item passes", () => {
    expect(validateBoardMessage("toPage", probeBoardState).ok).toBe(true);
  });

  test("the previous answer takes results too, and an empty or mis-keyed one fails", () => {
    const [question] = probeBoardState.state.questions;
    const answer = (question as { answer: Record<string, unknown> }).answer;
    const message = (results: unknown) => ({
      ...probeBoardState,
      state: {
        ask: "waiting",
        questions: [{ itemId: "choose", rev: 1, state: "open", previous: { ...answer, results } }],
      },
    });
    expect(validateBoardMessage("toPage", message({ pick: { pick: "b" } })).ok).toBe(true);
    expect(validateBoardMessage("toPage", message({})).ok).toBe(false);
    expect(validateBoardMessage("toPage", message({ "a b": 1 })).ok).toBe(false);
  });
});

describe("the answer event", () => {
  const ok = (value: unknown) => validateAgainst(SCHEMA_IDS.answerEvent, value);

  test("an event holding results passes", () => {
    expect(ok(probeAnswerEvent).ok).toBe(true);
    expect(probeAnswerEvent.results).toEqual({ pick: { pick: "a" } });
  });

  test("a too-large event carries no results, naming them", () => {
    expect(ok(probeTooLargeEvent).ok).toBe(true);
    const checked = ok({ ...probeTooLargeEvent, results: { pick: { pick: "a" } } });
    expect(checked.ok).toBe(false);
    expect(pathsOf(checked)).toContain("/results");
  });

  test("a decline carries no results", () => {
    const declined = { ...probeAnswerEvent, declined: true };
    expect(ok(declined).ok).toBe(false);
    const { results: _, ...bare } = declined;
    expect(ok(bare).ok).toBe(true);
  });
});

describe("results in fetch results", () => {
  const ajv = ajvOver(PROBE_TYPES);
  const fetchErrors = (value: unknown) => errorsOf(ajv, SCHEMA_IDS.fetchResult, value);

  test("a question whose answer holds results for a probe item passes", () => {
    expect(fetchErrors(probeFetchResult)).toEqual([]);
    expect(JSON.stringify(probeFetchResult)).toContain('"results"');
  });

  test("an answer's results are keyed by item ID (in reference addressing), and empty or mis-keyed ones fail", () => {
    const withAnswer = (results: unknown) => {
      const copy = structuredClone(probeFetchResult) as { item: { answer: object } };
      Object.assign(copy.item.answer, { results });
      return copy;
    };
    expect(fetchErrors(withAnswer({ pick: { pick: "a" } }))).toEqual([]);
    expect(fetchErrors(withAnswer({}))).not.toEqual([]);
    expect(fetchErrors(withAnswer({ "a b": 1 }))).not.toEqual([]);
  });

  test("a probe item fetched alone holds its result, checked by the probe's schema", () => {
    expect(fetchErrors(probeFetchItemResult)).toEqual([]);
    const item = (probeFetchItemResult as { item: object }).item;
    const result = (value: unknown) => ({
      ...probeFetchItemResult,
      item: { ...item, result: value },
    });
    expect(fetchErrors(result({ pick: "b" }))).toEqual([]);
    expect(fetchErrors(result({ pick: 3 }))).not.toEqual([]);
    expect(fetchErrors(result({}))).not.toEqual([]);
  });

  test("a question or an area holding result fails, naming it", () => {
    const question = structuredClone(probeFetchResult) as { item: object };
    const asked = { ...question, item: { ...question.item, result: { pick: "a" } } };
    expect(
      fetchErrors(asked).map((error) => error.params.additionalProperty ?? error.keyword),
    ).not.toEqual([]);
    const area = {
      ...probeFetchResult,
      item: { type: "area", id: "g", props: { title: "G", items: [] }, result: { pick: "a" } },
    };
    expect(fetchErrors(area)).not.toEqual([]);
    // A question without result still passes: the failure is the result's.
    expect(fetchErrors(probeFetchResult)).toEqual([]);
  });
});

describe("kept results in the Snapshot data", () => {
  // The data of E1's plain choice, with `entry` as its only logged event; the schema holds no
  // link between the event and the document.
  const data = (entry: unknown) => ({
    versions: {
      snapshot: SNAPSHOT_DATA_VERSION,
      output: OUTPUT_FORMAT_VERSION,
      boardProtocol: BOARD_PROTOCOL_VERSION,
    },
    snapshot: { takenAt: "2026-11-06T09:45:02Z", takenBy: "agent" },
    epoch: PROBE_SESSION.epoch,
    askId: PROBE_SESSION.askId,
    document: plainChoiceBoardDocument,
    revisions: [],
    state: probeBoardState.state,
    events: [entry],
  });
  const entryPaths = (entry: unknown) => pathsOf(validateSnapshotData(data(entry)));

  test("a logged too-large event holds results beside its values", () => {
    expect(validateSnapshotData(data(probeSnapshotEntry)).ok).toBe(true);
    const beside = { ...probeSnapshotEntry, values: { pick: { options: [] } } };
    expect(validateSnapshotData(data(beside)).ok).toBe(true);
    expect(probeSnapshotEntry.results).toEqual({ pick: { pick: "a" } });
  });

  test("an event logged whole holds no results, naming them", () => {
    const whole = { event: probeAnswerEvent, results: { pick: { pick: "a" } } };
    expect(entryPaths(whole)).toContain("/events/0/results");
    expect(validateSnapshotData(data({ event: probeAnswerEvent })).ok).toBe(true);
  });

  test("empty or mis-keyed results fail", () => {
    expect(entryPaths({ ...probeSnapshotEntry, results: {} })).toContain("/events/0/results");
    expect(entryPaths({ ...probeSnapshotEntry, results: { "a b": 1 } })).toContain(
      "/events/0/results",
    );
  });
});

describe("the fixtures name the sets' versions by their constants", () => {
  test("version fields come from the constants", () => {
    expect(probeResultAct.version).toBe(BOARD_PROTOCOL_VERSION);
    expect(probeBoardState.version).toBe(BOARD_PROTOCOL_VERSION);
    expect(probeFetchResult.versions).toEqual({
      result: TOOL_ENVELOPES_VERSION,
      output: OUTPUT_FORMAT_VERSION,
    });
    expect(SNAPSHOT_DATA_VERSION).toBeDefined();
  });
});
