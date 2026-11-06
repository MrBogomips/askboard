import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { SCHEMA_IDS } from "../src/index.ts";
import { type RequestProblem, validateAgainst, validateAskRequest } from "../src/validate.ts";

// Input format 1.1 (contract spec: Input format for questions and areas, Areas, Question props):
// several questions, areas, FR-3's fields, and the checks over every item. Every refusal names the
// item and the field.
type Item = { type: string; id: string; props: Record<string, unknown> };
type Ask = { askId: string; items: Item[]; [field: string]: unknown };

const FIXTURES = join(import.meta.dir, "fixtures");
const read = async (path: string) => (await Bun.file(join(FIXTURES, path)).json()) as Ask;

const option = (label: string, extra: Record<string, unknown> = {}) => ({ label, ...extra });
const question = (id: string, props: Record<string, unknown> = {}): Item => ({
  type: "question",
  id,
  props: { text: `Question ${id}?`, options: [option("Yes"), option("No")], ...props },
});
const area = (id: string, items: Item[], title = `Area ${id}`): Item => ({
  type: "area",
  id,
  props: { title, items },
});
const ask = (items: Item[], extra: Record<string, unknown> = {}): Ask => ({
  askId: "checkout-plan-p8r3",
  items,
  ...extra,
});

const problemsOf = (value: unknown): readonly RequestProblem[] => {
  const checked = validateAskRequest(value);
  return checked.ok ? [] : checked.problems;
};
const only = (value: unknown): RequestProblem => {
  const problems = problemsOf(value);
  expect(problems).toHaveLength(1);
  return problems[0] as RequestProblem;
};

describe("several questions", () => {
  test("an ask of six questions with distinct item IDs passes", () => {
    const six = ask(["a", "b", "c", "d", "e", "f"].map((id) => question(id)));
    expect(validateAskRequest(six)).toEqual({ ok: true, value: six as never });
  });

  test("the plain-choice ask still passes unchanged", async () => {
    const plain = await read("asks/plain-choice.json");
    expect(validateAskRequest(plain)).toEqual({ ok: true, value: plain as never });
  });

  test("two items with one ID are refused, naming the second and the field", () => {
    const problem = only(ask([question("a"), question("b"), question("a")]));
    expect(problem).toMatchObject({ path: "/items/2/id", itemId: "a", field: "id" });
    expect(problem.message).toStartWith('item "a", id');
    expect(problem.message).toContain("unique in the ask");
  });

  test("a problem in a later question names that question", () => {
    const value = ask([question("a"), question("b", { text: "" })]);
    expect(only(value)).toMatchObject({ path: "/items/1/props/text", itemId: "b" });
  });

  test("every question's labels are checked, not only the first's", () => {
    const repeated = { options: [option("Yes"), option("Yes")] };
    const problem = only(ask([question("a"), question("b", repeated)]));
    expect(problem).toMatchObject({ itemId: "b", field: "props.options[1].label" });
    expect(problem.message).toContain('"Yes"');
  });

  test.each([
    ["a later item ID", ask([question("a"), question("u-b")]), "/items/1/id"],
    [
      "an ID in an area",
      ask([area("intro", [question("a"), question("u-b")])]),
      "/items/0/props/items/1/id",
    ],
    ["an area's ID", ask([area("u-intro", [question("a")])]), "/items/0/id"],
  ])("%s with the prefix u- is refused, saying the prefix is reserved", (_, value, path) => {
    const problem = only(value);
    expect(problem.path).toBe(path);
    expect(problem.message).toContain('the prefix "u-" is reserved for IDs the board makes');
  });
});

describe("areas (FR-2)", () => {
  test("an ask of three titled areas, each with two questions, passes", () => {
    const three = ask([
      area("scope", [question("q1"), question("q2")]),
      area("design", [question("q3"), question("q4")]),
      area("delivery", [question("q5"), question("q6")]),
    ]);
    expect(validateAskRequest(three)).toEqual({ ok: true, value: three as never });
  });

  test("a question beside an area is refused, naming the question and the rule", () => {
    const problem = only(ask([area("scope", [question("q1")]), question("q2")]));
    expect(problem).toMatchObject({ path: "/items/1", itemId: "q2", field: "items" });
    expect(problem.message).toStartWith('item "q2"');
    expect(problem.message).toContain("every top-level item must be an area");
  });

  test("an area inside an area is refused, naming the inner area", () => {
    const inner = area("inner", [question("q2")]);
    const problem = only(ask([area("outer", [question("q1"), inner])]));
    expect(problem).toMatchObject({ itemId: "inner", field: "type" });
    expect(problem.path).toBe("/items/0/props/items/1/type");
    expect(problem.message).toStartWith('item "inner"');
    expect(problem.message).toContain("an area cannot hold an area");
  });

  test.each([
    ["an empty title", { title: "" }, "props.title"],
    ["no title", { title: undefined }, "props.title"],
    ["no questions", { items: [] }, "props.items"],
  ])("an area with %s is refused, naming the area and the field", (_, change, field) => {
    const value = ask([area("scope", [question("q1")])]);
    Object.assign((value.items[0] as Item).props, change);
    const props = (value.items[0] as Item).props;
    for (const key of Object.keys(props)) if (props[key] === undefined) delete props[key];
    const problem = only(value);
    expect(problem).toMatchObject({ itemId: "scope", field });
    expect(problem.message).toStartWith(`item "scope", ${field}`);
  });

  test("an area's unknown field is refused, saying what an area's props hold", () => {
    const value = ask([area("scope", [question("q1")])]);
    Object.assign((value.items[0] as Item).props, { colour: "red" });
    const problem = only(value);
    expect(problem).toMatchObject({ itemId: "scope", field: "props.colour" });
    expect(problem.expected).toContain("title and items");
  });

  test("an item of another type inside an area is refused for its type alone", () => {
    const table = { type: "table", id: "rates", props: { rows: [] } };
    const value = ask([area("scope", [question("q1"), table as never])]);
    const problem = only(value);
    expect(problem).toMatchObject({ itemId: "rates", field: "type" });
    expect(problem.expected).toContain('"question"');
  });

  test("a problem in a question inside an area names that question", () => {
    const value = ask([area("scope", [question("q1", { options: [] })])]);
    expect(only(value)).toMatchObject({
      path: "/items/0/props/items/0/props/options",
      itemId: "q1",
      field: "props.options",
    });
  });

  test("item IDs are unique across areas, the areas' own IDs included", () => {
    const value = ask([area("scope", [question("q1")]), area("design", [question("scope")])]);
    expect(only(value)).toMatchObject({ path: "/items/1/props/items/0/id", itemId: "scope" });
  });
});

describe("question props: FR-3's fields", () => {
  const full = () =>
    question("database", {
      header: "Database",
      multiSelect: false,
      allowOther: true,
      options: [
        option("PostgreSQL", {
          description: "Relational.",
          preview: "CREATE TABLE orders (id bigint primary key);",
          annotation: "The platform team runs it already.",
          recommended: true,
        }),
        option("SQLite", { preview: "orders.db, one file" }),
      ],
    });

  test("allowOther, a preview, an annotation and a recommended option pass", () => {
    const value = ask([full()]);
    expect(validateAskRequest(value)).toEqual({ ok: true, value: value as never });
    expect(validateAgainst(SCHEMA_IDS.question, full()).ok).toBe(true);
  });

  test("the approved uj1 ask's recommended option passes as question props", async () => {
    const uj1 = await read("asks/uj1-diff-graph.json");
    const { items: _, ...props } = (uj1.items[1] as Item).props;
    expect(validateAgainst(SCHEMA_IDS.questionProps, props).ok).toBe(true);
  });

  test("two recommended options are refused, naming the question and both labels", () => {
    const value = ask([full()]);
    const props = (value.items[0] as Item).props as { options: Record<string, unknown>[] };
    Object.assign(props.options[1] as object, { recommended: true });
    const problem = only(value);
    expect(problem).toMatchObject({
      path: "/items/0/props/options/1/recommended",
      itemId: "database",
    });
    expect(problem.message).toContain('"PostgreSQL"');
    expect(problem.message).toContain('"SQLite"');
    expect(problem.message).toContain("at most one");
  });

  test.each([
    ["recommended false", { recommended: false }, "props.options[0].recommended"],
    ["a preview of 10,001 characters", { preview: "p".repeat(10_001) }, "props.options[0].preview"],
    [
      "an annotation of 2,001 characters",
      { annotation: "a".repeat(2_001) },
      "props.options[0].annotation",
    ],
    ["an empty preview", { preview: "" }, "props.options[0].preview"],
  ])("%s is refused, naming the item and the field", (_, change, field) => {
    const value = ask([question("database")]);
    const props = (value.items[0] as Item).props as { options: Record<string, unknown>[] };
    Object.assign(props.options[0] as object, change);
    expect(only(value)).toMatchObject({ itemId: "database", field });
  });

  test("a preview of 10,000 and an annotation of 2,000 characters pass", () => {
    const value = ask([
      question("database", {
        options: [option("A", { preview: "p".repeat(10_000), annotation: "a".repeat(2_000) })],
      }),
    ]);
    expect(validateAskRequest(value).ok).toBe(true);
  });

  test("allowOther is true or false", () => {
    expect(only(ask([question("q", { allowOther: "yes" })]))).toMatchObject({
      itemId: "q",
      field: "props.allowOther",
    });
  });

  test("an option's unknown field is refused, saying what an option holds", () => {
    const value = ask([question("q", { options: [option("A", { colour: "red" })] })]);
    const problem = only(value);
    expect(problem.field).toBe("props.options[0].colour");
    expect(problem.expected).toContain("label, description, preview, annotation and recommended");
  });
});

describe("what the input format still refuses", () => {
  // A widget item of a type the input format does not define is refused at its type. Since input
  // format 1.4 (widget-answers) `tree`, `gantt` and `molecule` are defined, so the approved uj2 and
  // uj3 asks pass the contract: uj3's reference names a molecule no definition ships, which
  // ask-core refuses, not the contract.
  test("the approved uj1 ask is refused, naming each widget item and its type", async () => {
    const problems = problemsOf(await read("asks/uj1-diff-graph.json"));
    const named = problems.filter((problem) => problem.field === "type");
    expect(named.map((problem) => problem.itemId)).toEqual(["fix-diff", "retry-states"]);
    for (const problem of named) {
      expect(problem.message).toStartWith(`item "${problem.itemId}", type`);
    }
  });

  test.each(["uj2-wbs-gantt", "uj3-sales-review"])("the approved %s ask passes", async (name) => {
    expect(problemsOf(await read(`asks/${name}.json`))).toEqual([]);
  });

  // Input format 1.2 accepts it-IT (settings-languages); any other value is still refused.
  test.each(["language", "locale"])("%s fr-FR is still refused, naming the field", (field) => {
    const problem = only(ask([question("q")], { [field]: "fr-FR" }));
    expect(problem).toMatchObject({ path: `/${field}`, field });
  });

  test("an item type the input format does not define is refused for its type alone", () => {
    const value = ask([question("a"), { type: "table", id: "rates", props: { rows: [] } }]);
    const problem = only(value);
    expect(problem).toMatchObject({ path: "/items/1/type", itemId: "rates", field: "type" });
    expect(problem.expected).toContain('"question" or "area"');
  });

  test("an item without a type is refused, saying the type is required", () => {
    const value = ask([question("a")]);
    delete (value.items[0] as Partial<Item>).type;
    const problem = only(value);
    expect(problem).toMatchObject({ path: "/items/0/type", itemId: "a", field: "type" });
    expect(problem.message).toContain("type is required");
  });

  test("an item that is not an object is refused at its place", () => {
    expect(only(ask([question("a"), "b" as never]))).toMatchObject({
      path: "/items/1",
      field: "items[1]",
    });
  });
});
