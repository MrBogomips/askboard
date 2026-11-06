import { describe, expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020";
import { BOARD_PROTOCOL_VERSION } from "../src/schemas/board-protocol/index.ts";
import { SCHEMA_SETS } from "../src/sets.ts";
import { type Checked, validateBoardMessage } from "../src/validate.ts";

// Widget values in the board protocol (widget-answers, task 1.4; contract spec: Widget values in the
// answer act, Logged widget values in the board state): `values` and `derived` on the `answer` act,
// `values` in a question's current and previous answer, E1's `answer` command unchanged.
const version = BOARD_PROTOCOL_VERSION;
const when = "2026-11-02T09:30:00Z";
const actionId = "aX9kQ2mPz7RtLw4nB8cYhA";

const TREE = { columns: [], nodes: [{ id: "ux", label: "UX design" }] };
const PLAN = {
  start: "2026-11-02",
  workPackages: "wbs__tree",
  tasks: { ux: { start: "2026-11-09" } },
};

const act = (answer: Record<string, unknown>) => ({
  version,
  type: "act",
  actionId,
  acts: [{ type: "answer", itemId: "plan", rev: 1, when, ...answer }],
});
const answered = (answer: Record<string, unknown>) => ({
  version,
  type: "state",
  state: {
    ask: "waiting",
    questions: [
      { itemId: "plan", rev: 1, state: "answered", answer: { when, receipt: "sent", ...answer } },
    ],
  },
});
const paths = (result: Checked<unknown>): string[] =>
  result.ok ? [] : result.problems.map(({ path }) => path);

describe("the answer act's widget values", () => {
  const values = { wbs__tree: TREE, schedule__plan: PLAN };
  const derived = { "schedule__plan.finish": "2026-11-20", "schedule__plan.critical": ["ux"] };

  test("an act with values and derived validates", () => {
    expect(validateBoardMessage("toHost", act({ values, derived })).ok).toBe(true);
  });

  test("an act with values beside a choice validates", () => {
    expect(validateBoardMessage("toHost", act({ choice: ["Yes"], values })).ok).toBe(true);
  });

  test("values with no item is refused", () => {
    expect(paths(validateBoardMessage("toHost", act({ values: {} })))).toContain("/acts/0/values");
  });

  test("a value that is no object is refused at its item", () => {
    const result = validateBoardMessage("toHost", act({ values: { wbs__tree: [] } }));
    expect(paths(result)).toContain("/acts/0/values/wbs__tree");
  });

  test("a key that is no item ID is refused", () => {
    const result = validateBoardMessage("toHost", act({ values: { "a.b": TREE } }));
    expect(result.ok).toBe(false);
  });

  test("derived with a key that is no reference is refused", () => {
    const result = validateBoardMessage("toHost", act({ values, derived: { "a..b": 1 } }));
    expect(result.ok).toBe(false);
  });

  test("derived takes any JSON value, null included", () => {
    const result = validateBoardMessage(
      "toHost",
      act({ values, derived: { "plan.finish": null } }),
    );
    expect(result.ok).toBe(true);
  });

  test("E1's answer command keeps its choice-only shape", () => {
    const result = validateBoardMessage("toHost", {
      version,
      type: "answer",
      itemId: "plan",
      rev: 1,
      when,
      choice: ["Yes"],
      values: { wbs__tree: TREE },
    });
    expect(result.ok).toBe(false);
    expect(paths(result)).toEqual(["/values"]);
  });

  test("a receiver on the earlier minor refuses values, naming it", () => {
    const older = structuredClone(SCHEMA_SETS.flatMap(({ schemas }) => schemas)) as Record<
      string,
      unknown
    >[];
    const actSchema = older.find((each) => each.$id === "urn:askboard:board-protocol:act") as {
      $defs: { answer: { properties: Record<string, unknown> } };
    };
    delete actSchema.$defs.answer.properties.values;
    delete actSchema.$defs.answer.properties.derived;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    for (const schema of older) ajv.addSchema(schema);
    const validate = ajv.getSchema("urn:askboard:board-protocol:act");
    expect(validate?.(act({ values: { wbs__tree: TREE } }))).toBe(false);
    expect(
      validate?.errors?.map(({ instancePath, params }) => [instancePath, params]),
    ).toContainEqual(["/acts/0", { additionalProperty: "values" }]);
  });
});

describe("the board state's logged widget values", () => {
  test("an answered Tree question holds values with its when and receipt", () => {
    const values = { wbs__tree: TREE, schedule__plan: PLAN };
    expect(validateBoardMessage("toPage", answered({ values })).ok).toBe(true);
  });

  test("the previous answer after a reopen holds values too", () => {
    const message = answered({ values: { wbs__tree: TREE } });
    const question = (message.state.questions[0] ?? {}) as Record<string, unknown>;
    question.previous = { when, receipt: "delivered", values: { wbs__tree: TREE } };
    expect(validateBoardMessage("toPage", message).ok).toBe(true);
  });

  test("a derived value in the state is refused, naming derived", () => {
    const result = validateBoardMessage(
      "toPage",
      answered({ values: { wbs__tree: TREE }, derived: { "plan.finish": "2026-11-20" } }),
    );
    expect(result.ok).toBe(false);
    expect(paths(result)).toContain("/state/questions/0/answer/derived");
  });

  test("empty values are refused", () => {
    const result = validateBoardMessage("toPage", answered({ values: {} }));
    expect(paths(result)).toContain("/state/questions/0/answer/values");
  });
});
