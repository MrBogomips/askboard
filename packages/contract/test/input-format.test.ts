import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ASK_TITLE_MAX_CHARS, CHOICE_LABELS_MAX_CHARS, NAME_MAX_CHARS } from "../src/index.ts";
import { type RequestProblem, validateAskRequest } from "../src/validate.ts";

// The input format's ask level (contract spec: Input format, Agent-chosen IDs, Unique option
// labels). Every refusal names the item ID, when the problem is in an item, and the field.
type Ask = {
  askId: string;
  items: { type: string; id: string; props: Record<string, unknown> }[];
  [field: string]: unknown;
};

const plainChoice = (await Bun.file(
  join(import.meta.dir, "fixtures/asks/plain-choice.json"),
).json()) as Ask;
const ask = (): Ask => structuredClone(plainChoice);
const question = (value: Ask) => value.items[0] as Ask["items"][number];

const problemsOf = (value: unknown): readonly RequestProblem[] => {
  const checked = validateAskRequest(value);
  return checked.ok ? [] : checked.problems;
};
const only = (value: unknown): RequestProblem => {
  const problems = problemsOf(value);
  expect(problems).toHaveLength(1);
  return problems[0] as RequestProblem;
};

describe("the ask level of the input format", () => {
  test("the approved plain-choice ask validates, with every optional field E1 accepts", () => {
    const full = {
      ...ask(),
      title: "Order service database",
      agentName: "Planner",
      expectedUser: "Paola Greco",
      presentation: "tabs",
      delivery: "submitted",
      language: "en-US",
      locale: "en-US",
    };
    expect(validateAskRequest(full)).toEqual({ ok: true, value: full as never });
  });

  test("a second question is refused, naming its item ID and the one-question rule", () => {
    const two = ask();
    two.items.push({ ...structuredClone(question(two)), id: "cache" });
    const problem = only(two);
    expect(problem).toMatchObject({ path: "/items/1", itemId: "cache", field: "items" });
    expect(problem.message).toContain('item "cache"');
    expect(problem.message).toContain("one question per ask");
  });

  test.each([
    ["recommended", ["recommended"], "props.recommended", "text, header, options and multiSelect"],
    ["items", ["items"], "props.items", "text, header, options and multiSelect"],
    [
      "an option preview",
      ["options", 0, "preview"],
      "props.options[0].preview",
      "label and description",
    ],
  ] as const)(
    "a question's %s is refused, naming the item ID and the field",
    (_, where, field, allowed) => {
      const value = ask();
      let target = question(value).props as Record<string | number, unknown>;
      for (const step of where.slice(0, -1)) target = target[step] as Record<string, unknown>;
      target[where.at(-1) as string] = "x";
      const problem = only(value);
      expect(problem).toMatchObject({ itemId: "database", field });
      expect(problem.message).toStartWith(`item "database", ${field}`);
      expect(problem.expected).toContain(allowed);
    },
  );

  test("an ask-level field E1 does not define is refused, naming it", () => {
    expect(only({ ...ask(), areas: [] })).toMatchObject({ path: "/areas", field: "areas" });
  });

  test.each(["language", "locale"])("%s it-IT is refused, naming the field", (field) => {
    const problem = only({ ...ask(), [field]: "it-IT" });
    expect(problem).toMatchObject({ path: `/${field}`, field });
    expect(problem.itemId).toBeUndefined();
    expect(problem.expected).toContain('"en-US"');
  });

  test.each([
    ["holds a space", "order db"],
    ["is 65 characters long", "a".repeat(65)],
  ])("an ask ID that %s is refused, naming the field", (_, askId) => {
    const problem = only({ ...ask(), askId });
    expect(problem).toMatchObject({ path: "/askId", field: "askId" });
    expect(problem.expected).toContain("1 to 64 characters");
  });

  test("a malformed item ID is refused, naming the field", () => {
    const value = ask();
    question(value).id = "data base";
    expect(only(value)).toMatchObject({ path: "/items/0/id", field: "items[0].id" });
  });

  test.each([
    ["an item ID", (value: Ask) => Object.assign(question(value), { id: "u-1" }), "/items/0/id"],
    ["an ask ID", (value: Ask) => Object.assign(value, { askId: "u-order" }), "/askId"],
  ])(
    "%s with the view-made prefix u- is refused, saying the prefix is reserved",
    (_, edit, path) => {
      const value = ask();
      edit(value);
      const problem = only(value);
      expect(problem.path).toBe(path);
      expect(problem.message).toContain('the prefix "u-" is reserved for IDs the board makes');
    },
  );

  test("two options labelled PostgreSQL are refused, naming the item ID and the label", () => {
    const value = ask();
    const options = question(value).props.options as { label: string }[];
    (options[2] as { label: string }).label = "PostgreSQL";
    const problem = only(value);
    expect(problem).toMatchObject({
      path: "/items/0/props/options/2/label",
      itemId: "database",
      field: "props.options[2].label",
    });
    expect(problem.message).toContain('"PostgreSQL"');
    expect(problem.message).toContain("unique");
  });

  test("an item type E1 does not define is refused for its type alone", () => {
    const value = ask();
    Object.assign(question(value), { type: "table", props: { rows: [] } });
    const problem = only(value);
    expect(problem).toMatchObject({ path: "/items/0/type", itemId: "database", field: "type" });
    expect(problem.expected).toContain('"question"');
  });

  test("a question without options names the item ID and says options is required", () => {
    const value = ask();
    delete question(value).props.options;
    const problem = only(value);
    expect(problem).toMatchObject({ itemId: "database", field: "props.options" });
    expect(problem.message).toContain("props.options is required");
    expect(problem.expected).toContain("non-empty list of options");
  });

  test("the title, the agent name and the expected user have their limits", () => {
    expect(validateAskRequest({ ...ask(), title: "t".repeat(ASK_TITLE_MAX_CHARS) }).ok).toBe(true);
    expect(only({ ...ask(), title: "t".repeat(ASK_TITLE_MAX_CHARS + 1) }).field).toBe("title");
    expect(only({ ...ask(), title: "" }).field).toBe("title");
    for (const field of ["agentName", "expectedUser"]) {
      expect(validateAskRequest({ ...ask(), [field]: "n".repeat(NAME_MAX_CHARS) }).ok).toBe(true);
      expect(only({ ...ask(), [field]: "n".repeat(NAME_MAX_CHARS + 1) }).field).toBe(field);
    }
  });

  test("option labels that could not fit in one answer are refused", () => {
    const value = ask();
    const label = (n: number) => `${n}-${"x".repeat(1_000)}`;
    question(value).props.options = Array.from({ length: 20 }, (_, n) => ({ label: label(n) }));
    const problem = only(value);
    expect(problem).toMatchObject({ itemId: "database", field: "props.options" });
    expect(problem.message).toContain(String(CHOICE_LABELS_MAX_CHARS));
  });

  test("a request that is not an object is refused", () => {
    for (const value of [null, [], "ask", 3]) {
      expect(only(value)).toMatchObject({ path: "/", field: "(the ask)" });
    }
  });

  test("problems come in document order, whatever order the schema finds them in", () => {
    const value = {
      title: "",
      askId: "order db",
      items: [{ type: "question", id: "u-1", props: { options: [], text: "" } }],
      language: "it-IT",
    };
    expect(problemsOf(value).map((problem) => problem.path)).toEqual([
      "/title",
      "/askId",
      "/items/0/id",
      "/items/0/props/options",
      "/items/0/props/text",
      "/language",
    ]);
  });

  test("a problem in an item whose ID is unusable names the item by its index", () => {
    const value = ask();
    Object.assign(question(value), { id: 7 });
    const problem = only(value);
    expect(problem).toMatchObject({ path: "/items/0/id", field: "items[0].id" });
    expect(problem.itemId).toBeUndefined();
    expect(problem.message).toStartWith("items[0].id must be an ID");
  });
});
