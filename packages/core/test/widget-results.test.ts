import { describe, expect, test } from "bun:test";
import { ANSWER_EVENT_MAX_CHARS, type AnswerEvent, JSON_MAX_DEPTH } from "@askboard/contract";
import { PROBE_TYPES, PROBE_WIDGET } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { AskCore } from "../src/index.ts";
import type { ExpansionMap } from "../src/molecules/map.ts";
import { fakePorts } from "./fakes.ts";
import { actionId, appendedOf, logOf, WHEN } from "./lifecycle-fakes.ts";
import { copyOf, fakeMoleculeSource, ganttPlan, uj2Ask, wbsPert } from "./molecules.ts";
import { answerAct, checked, type Item, type Json, modelOf, PROBE_ITEM } from "./probe-fakes.ts";

// Core spec: Widget results in an answer (widget-registry design decision 6): results are checked
// after values, key by key, and refused whole; a result counts as an answer's content; a decline
// carries none. The probe type is the only one that declares a result, so most scenarios run the
// acts over `PROBE_TYPES`; the Tree's refusal also runs through `AskCore`.

const PICK = { pick: { pick: "a" } };
const TREE_ITEM: Item = { type: "tree", id: "wbs", props: { nodes: [{ id: "n", label: "N" }] } };

const refusal = (acts: readonly unknown[], model = modelOf([PROBE_ITEM, TREE_ITEM])) => {
  const { log, outcome } = checked(model, acts);
  if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
  expect(log.latestSeq).toBe(0);
  return outcome.problem;
};

describe("a result in an answer act", () => {
  test("a result alone is an answer: logged with its result, and kept", () => {
    const { outcome } = checked(modelOf([PROBE_ITEM]), [answerAct({ results: PICK })]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const [event] = outcome.events as AnswerEvent[];
    expect(event?.results).toEqual(PICK);
    expect(event).not.toHaveProperty("changes");
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
    expect([...outcome.kept.values()][0]?.results).toEqual(PICK);
  });

  test("a result checked against the edited value, when the answer carries one", () => {
    const edited = { options: [{ id: "c", label: "C" }] };
    const values = { pick: edited };
    const ok = checked(modelOf([PROBE_ITEM]), [
      answerAct({ values, results: { pick: { pick: "c" } } }),
    ]).outcome;
    expect(ok.ok).toBe(true);
    const old = refusal([answerAct({ values, results: PICK })], modelOf([PROBE_ITEM]));
    expect(old.refusal).toBe("content");
    expect(old.detail).toContain("pick");
  });

  test("a result checked against the props as sent, when no value is edited", () => {
    const problem = refusal(
      [answerAct({ results: { pick: { pick: "z" } } })],
      modelOf([PROBE_ITEM]),
    );
    expect(problem.detail).toContain("the result of item pick");
    expect(problem.detail).toContain('"z"');
  });

  test("a result for a Tree is refused naming the item and saying a Tree gives no result", () => {
    const problem = refusal([answerAct({ results: { wbs: { any: 1 } } })]);
    expect(problem.refusal).toBe("content");
    expect(problem.detail).toContain("item wbs is a Tree, and a Tree gives no result");
    expect(problem.itemId).toBe("choose");
  });

  test("a key that is not an own item is refused naming the key", () => {
    const own = modelOf([PROBE_ITEM], [{ ...PROBE_ITEM, id: "elsewhere" }]);
    for (const key of ["__proto__", "constructor", "toString", "elsewhere", "nothing"]) {
      const results = JSON.parse(`{"${key}": {"pick": "a"}}`) as Json;
      const problem = refusal([answerAct({ results })], own);
      expect(problem.detail).toContain(`"${key}"`);
    }
  });

  test("a result its schema refuses is refused naming the item and the problem", () => {
    const problem = refusal([answerAct({ results: { pick: { pick: 5 } } })], modelOf([PROBE_ITEM]));
    expect(problem.detail).toContain("the result of item pick");
  });

  test("a result that is not JSON, or results that are no object, are refused", () => {
    const model = modelOf([PROBE_ITEM]);
    const bad = refusal([answerAct({ results: { pick: { pick: "a", n: undefined } } })], model);
    expect(bad.detail).toContain("is not JSON");
    for (const results of [[], "text", null, 3]) {
      expect(refusal([answerAct({ results })], model).detail).toContain(
        "results are not an object",
      );
    }
  });

  test("a result nested a million deep, or holding itself, is refused, never thrown", () => {
    const model = modelOf([PROBE_ITEM]);
    let deep: unknown[] = [];
    for (let level = 0; level < 1_000_000; level++) deep = [deep];
    const cyclic: Json = {};
    cyclic.self = cyclic;
    for (const result of [deep, cyclic]) {
      const problem = refusal([answerAct({ results: { pick: result } })], model);
      expect(problem.detail).toContain(`nested deeper than ${JSON_MAX_DEPTH} levels`);
      expect(problem.detail).not.toContain("is not JSON");
    }
    const derived = refusal([answerAct({ derived: { "pick.count": deep } })], model);
    expect(derived.detail).toContain(`nested deeper than ${JSON_MAX_DEPTH} levels`);
  });

  test("the depth bound is the contract's, 64 levels: one level more is refused, the bound itself passes", () => {
    expect(JSON_MAX_DEPTH).toBe(64);
    const model = modelOf([PROBE_ITEM]);
    const nested = (levels: number): Json => {
      let value: Json = { pick: "a" };
      for (let level = 1; level < levels; level++) value = { pick: value };
      return value;
    };
    // The probe's schema refuses the shape, but only after the depth check: the message tells which.
    const over = refusal([answerAct({ results: { pick: nested(JSON_MAX_DEPTH + 1) } })], model);
    expect(over.detail).toContain(`nested deeper than ${JSON_MAX_DEPTH} levels`);
    const within = refusal([answerAct({ results: { pick: nested(JSON_MAX_DEPTH) } })], model);
    expect(within.detail).not.toContain("nested deeper");
  });

  test("results that name nothing are no content", () => {
    const problem = refusal([answerAct({ results: {} })], modelOf([PROBE_ITEM]));
    expect(problem.detail).toContain("names no option");
  });

  test("a decline carrying results is refused, with nothing appended", () => {
    const problem = refusal(
      [{ ...answerAct({ results: PICK }), type: "decline" }],
      modelOf([PROBE_ITEM]),
    );
    expect(problem.refusal).toBe("content");
    expect(problem.detail).toContain("decline");
    expect(problem.detail).toContain("results");
  });

  test("two items of one reference with results are refused: they would share one key", () => {
    const first = { ...PROBE_ITEM, id: "ref__a" };
    const second = { ...PROBE_ITEM, id: "ref__b" };
    const entry = { reference: "ref", molecule: "m", version: "1.0.0" };
    const expansion: ExpansionMap = new Map([
      ["ref__a", entry],
      ["ref__b", entry],
    ]);
    const { outcome, log } = checked(
      modelOf([first, second]),
      [answerAct({ results: { ref__a: { pick: "a" }, ref__b: { pick: "b" } } })],
      { expansion },
    );
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome)).toContain("ref");
    expect(log.latestSeq).toBe(0);
  });
});

// A type whose result schema takes `{}` and `{annotations: []}`: the case the registry check now
// flags, which the core still refuses on its own (a result that holds nothing is no answer).
const LOOSE_RESULT = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:loose-result",
  type: "object",
  additionalProperties: false,
  properties: { annotations: { type: "array" } },
} as const;
const LOOSE_WIDGET = {
  ...PROBE_WIDGET,
  type: "loose",
  props: { ...PROBE_WIDGET.props, $id: "urn:askboard:input:loose-props" },
  edits: undefined,
  derived: undefined,
  result: { schema: LOOSE_RESULT },
};
const LOOSE_ITEM: Item = { ...PROBE_ITEM, type: "loose", id: "note" };

describe("a result that holds nothing", () => {
  const types = [...PROBE_TYPES, LOOSE_WIDGET];
  const looseRefusal = (acts: readonly unknown[]) => {
    const { log, outcome } = checked(modelOf([LOOSE_ITEM]), acts, { types });
    if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
    expect(log.latestSeq).toBe(0);
    return outcome.problem;
  };

  test.each([
    ["{}", {}],
    ["{annotations: []}", { annotations: [] }],
    ["empty lists and objects at any depth", { annotations: [[], {}, [{}]] }],
    ["null", null],
    ['""', ""],
    ["nulls and empty strings at any depth", { pick: null, notes: [""] }],
  ])(
    "%s is refused, naming the item and saying it holds nothing, with nothing appended",
    (_, result) => {
      const problem = looseRefusal([answerAct({ results: { note: result } })]);
      expect(problem.refusal).toBe("content");
      expect(problem.detail).toContain('the result of item "note" holds nothing');
      expect(problem.itemId).toBe("choose");
    },
  );

  test("a result with one leaf of content, even false or 0, is an answer", () => {
    for (const result of [
      { annotations: ["a"] },
      { annotations: ["", 0] },
      { annotations: [[false]] },
    ]) {
      const { outcome } = checked(
        modelOf([LOOSE_ITEM]),
        [answerAct({ results: { note: result } })],
        {
          types,
        },
      );
      expect(outcome.ok).toBe(true);
      expect(outcome.ok && outcome.events).toHaveLength(1);
    }
  });

  test("the probe's result, which requires a pick, is still logged", () => {
    const { outcome } = checked(modelOf([PROBE_ITEM]), [answerAct({ results: PICK })]);
    expect(outcome.ok).toBe(true);
  });
});

describe("a result for a Tree through the ask-core", () => {
  const ASK_ID = uj2Ask.askId;
  type Act = Parameters<AskCore["act"]>[1];

  const setup = async () => {
    const core = new AskCore({
      ...fakePorts().ports,
      molecules: fakeMoleculeSource([wbsPert, ganttPlan]).source,
    });
    const outcome = await core.ask(copyOf(uj2Ask) as unknown as Parameters<AskCore["ask"]>[0]);
    if (outcome.kind !== "created") throw new Error(outcome.kind);
    const heard: Parameters<Parameters<AskCore["subscribe"]>[0]>[0][] = [];
    core.subscribe((event) => heard.push(event));
    return { core, heard };
  };

  const send = (core: AskCore, n: number, fields: Json, type = "answer") =>
    core.act(ASK_ID, {
      actionId: actionId(300 + n),
      acts: [{ type, itemId: "plan", rev: 1, when: WHEN, ...fields }],
    } as unknown as Act);

  test("is refused naming the item, with the log unchanged and nothing published", async () => {
    const { core, heard } = await setup();
    const outcome = send(core, 1, { results: { wbs__tree: { x: 1 } } });
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome)).toContain("a Tree gives no result");
    expect(JSON.stringify(outcome)).toContain("wbs__tree");
    expect(logOf(core, ASK_ID)).toEqual([]);
    expect(appendedOf(heard)).toEqual([]);
  });

  test("a decline with results is refused, with the log unchanged", async () => {
    const { core, heard } = await setup();
    const outcome = send(core, 2, { results: { wbs__tree: { x: 1 } } }, "decline");
    expect(outcome.ok).toBe(false);
    expect(logOf(core, ASK_ID)).toEqual([]);
    expect(appendedOf(heard)).toEqual([]);
  });

  test("an ask-core that kept nothing keeps no results", async () => {
    const { core } = await setup();
    expect(core.keptAnswerResults(ASK_ID)?.size).toBe(0);
  });
});

describe("a result too large for one event", () => {
  const BIG = {
    ...PROBE_WIDGET,
    type: "bigprobe",
    result: {
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: "urn:askboard:output:bigprobe-result",
        type: "object",
        required: ["text"],
        properties: { text: { type: "string" } },
        additionalProperties: false,
      },
    },
  };
  const text = "x".repeat(ANSWER_EVENT_MAX_CHARS + 10);

  test("is logged as tooLarge with no results, and kept whole", () => {
    const { outcome } = checked(
      modelOf([{ ...PROBE_ITEM, type: "bigprobe" }]),
      [answerAct({ results: { pick: { text } } })],
      { types: [...PROBE_TYPES, BIG] },
    );
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const [event] = outcome.events as AnswerEvent[];
    expect(event?.tooLarge).toBe(true);
    expect(event).not.toHaveProperty("results");
    expect(JSON.stringify(event).length).toBeLessThan(ANSWER_EVENT_MAX_CHARS);
    expect(validateAgainst("urn:askboard:output:answer-event", event).ok).toBe(true);
    expect([...outcome.kept.values()][0]?.results).toEqual({ pick: { text } });
  });
});
