import { describe, expect, test } from "bun:test";
import { COLLECT_ASKS_MAX, TOOL_DEFINITIONS, type ToolDefinition } from "../src/index.ts";
import {
  type RequestProblem,
  toolInputProblems,
  validateAskRequest,
  validateCollectRequest,
} from "../src/validate.ts";

// The contract's validation function for tool requests (task 3.4): every problem, in document
// order, each with its item ID when it is in an item, its field and the expected shape.
const problemsOf = (checked: { ok: boolean; problems?: readonly RequestProblem[] }) =>
  checked.ok ? [] : (checked.problems ?? []);

describe("a request with many problems", () => {
  const request = {
    askId: "u-order",
    agentName: "",
    items: [
      {
        type: "question",
        id: "database",
        props: {
          header: 7,
          options: [{ label: "A", preview: 7 }, { label: "A" }, { description: "no label" }],
          multiSelect: "yes",
          recommended: "A",
        },
      },
      { type: "question", id: "cache", props: {} },
    ],
    locale: "it-IT",
    colour: "red",
  };
  const problems = problemsOf(validateAskRequest(request));

  test("every problem is reported once, in document order", () => {
    expect(problems.map(({ path }) => path)).toEqual([
      "/askId",
      "/agentName",
      "/items/0/props/text",
      "/items/0/props/header",
      "/items/0/props/options/0/preview",
      "/items/0/props/options/1/label",
      "/items/0/props/options/2/label",
      "/items/0/props/multiSelect",
      "/items/0/props/recommended",
      "/items/1/props/text",
      "/items/1/props/options",
      "/locale",
      "/colour",
    ]);
  });

  test("each problem names its item ID when it is in an item, its field and the expected shape", () => {
    for (const problem of problems) {
      expect(problem.field.length).toBeGreaterThan(0);
      expect(problem.expected.length).toBeGreaterThan(0);
      expect(problem.message).toContain(
        problem.itemId ? `item "${problem.itemId}"` : problem.field,
      );
    }
    expect(problems.filter((p) => p.path.startsWith("/items/0")).map((p) => p.itemId)).toEqual(
      Array(7).fill("database"),
    );
    expect(problems.filter((p) => p.path.startsWith("/items/1")).map((p) => p.itemId)).toEqual([
      "cache",
      "cache",
    ]);
    expect(problems.find((p) => p.path === "/items/0/props/text")).toMatchObject({
      field: "props.text",
      message: expect.stringContaining("props.text is required"),
    });
  });
});

describe("the collect request", () => {
  const ok = { asks: [{ askId: "order-db-choice-x7k2", after: "k3x9.0" }] };

  test("a request of the approved shape validates, with or without wait", () => {
    expect(validateCollectRequest(ok)).toEqual({ ok: true, value: ok });
    const waiting = { ...ok, wait: { askId: "order-db-choice-x7k2", itemId: "database" } };
    expect(validateCollectRequest(waiting)).toEqual({ ok: true, value: waiting });
  });

  test.each([
    ["no asks", {}, "/asks", "asks"],
    ["an empty list", { asks: [] }, "/asks", "asks"],
    [
      "a cursor that is not <epoch>.<seq>",
      { asks: [{ askId: "a", after: "1" }] },
      "/asks/0/after",
      "asks[0].after",
    ],
    [
      "a seq past the safe integers",
      { asks: [{ askId: "a", after: "k3x9.9007199254740992" }] },
      "/asks/0/after",
      "asks[0].after",
    ],
    [
      "a malformed ask ID",
      { asks: [{ askId: "a b", after: "k3x9.0" }] },
      "/asks/0/askId",
      "asks[0].askId",
    ],
    ["an unknown field", { ...ok, versions: {} }, "/versions", "versions"],
    [
      "a wait on an ask it does not pass",
      { ...ok, wait: { askId: "other", itemId: "q" } },
      "/wait/askId",
      "wait.askId",
    ],
    [
      "a wait on a malformed item ID",
      { ...ok, wait: { askId: "order-db-choice-x7k2", itemId: "a b" } },
      "/wait/itemId",
      "wait.itemId",
    ],
    [
      "a wait without its item",
      { ...ok, wait: { askId: "order-db-choice-x7k2" } },
      "/wait/itemId",
      "wait.itemId",
    ],
  ])("%s is refused, naming the field", (_, request, path, field) => {
    const problems = problemsOf(validateCollectRequest(request));
    expect(problems.map((problem) => [problem.path, problem.field])).toEqual([[path, field]]);
    expect(problems[0]?.message).toStartWith(field);
  });

  test("at most COLLECT_ASKS_MAX asks per collect, so a result's entries always fit", () => {
    const asks = (count: number) => ({
      asks: Array.from({ length: count }, (_, n) => ({ askId: `ask-${n}`, after: "k3x9.0" })),
    });
    expect(validateCollectRequest(asks(COLLECT_ASKS_MAX)).ok).toBe(true);
    const problems = problemsOf(validateCollectRequest(asks(COLLECT_ASKS_MAX + 1)));
    expect(problems.map(({ path, field }) => [path, field])).toEqual([["/asks", "asks"]]);
    expect(problems[0]?.message).toContain(`at most ${COLLECT_ASKS_MAX} asks`);
  });

  test("an ask passed twice is refused, naming the second entry", () => {
    const twice = { asks: [ok.asks[0], { askId: "order-db-choice-x7k2", after: "k3x9.1" }] };
    const [problem] = problemsOf(validateCollectRequest(twice));
    expect(problem).toMatchObject({ path: "/asks/1/askId", field: "asks[1].askId" });
    expect(problem?.message).toContain("once");
  });

  test("a request that is not an object is refused", () => {
    expect(problemsOf(validateCollectRequest(null))).toMatchObject([{ path: "/" }]);
  });
});

describe("AD-6's rule on tool inputs", () => {
  test("the listed definitions follow it", () => {
    expect(toolInputProblems(TOOL_DEFINITIONS)).toEqual([]);
  });

  const withSchema = (inputSchema: Record<string, unknown>): ToolDefinition => ({
    name: "probe",
    description: "A probe.",
    inputSchema,
    annotations: {},
  });

  test.each([
    ["holds a space", "ask id"],
    ["is empty", ""],
    ["is 65 characters long", "a".repeat(65)],
    ["holds a colon", "ask:id"],
  ])("a top-level property name that %s fails", (_, name) => {
    const definition = withSchema({ type: "object", properties: { [name]: { type: "string" } } });
    expect(toolInputProblems([definition])).toEqual([
      `probe: the top-level property name ${JSON.stringify(name)} is not 1 to 64 characters from A-Z, a-z, 0-9, _, . and - (AD-6)`,
    ]);
  });

  test("a 64-character name with dots and dashes passes", () => {
    const name = `a.b-c_${"d".repeat(58)}`;
    const definition = withSchema({ type: "object", properties: { [name]: { type: "string" } } });
    expect(toolInputProblems([definition])).toEqual([]);
  });

  test.each(["oneOf", "anyOf", "allOf"])("a root %s fails", (keyword) => {
    const definition = withSchema({ type: "object", [keyword]: [{ required: ["a"] }] });
    expect(toolInputProblems([definition])).toEqual([
      `probe: root ${keyword} in the input schema (AD-6)`,
    ]);
  });

  test("an input schema that is not an object fails", () => {
    expect(toolInputProblems([withSchema({ type: "string" })])).toEqual([
      'probe: the input schema has type "string", not "object" (AD-6)',
    ]);
  });
});
