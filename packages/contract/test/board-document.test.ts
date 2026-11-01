import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { plainChoiceBoardDocument } from "../src/fixtures/index.ts";
import { BOARD_DOCUMENT_VERSION, SCHEMA_IDS } from "../src/index.ts";
import { validateAgainst, validateBoardDocument } from "../src/validate.ts";

// The approved example the fixture is built from (review-model-contract, archived).
const EXAMPLES = join(
  import.meta.dir,
  "../../../openspec/changes/archive/2026-10-29-review-model-contract/examples",
);
const plainChoiceAsk = async () =>
  (await Bun.file(join(EXAMPLES, "asks/plain-choice.json")).json()) as {
    askId: string;
    items: { type: string; id: string; props: Record<string, unknown> }[];
  };

const clone = <T>(value: T): T => structuredClone(value);
const paths = (result: ReturnType<typeof validateBoardDocument>) =>
  result.ok ? [] : result.problems.map((problem) => problem.path);

describe("the plain question (input format)", () => {
  test("the approved plain-choice ask's question is a valid question item", async () => {
    const [question] = (await plainChoiceAsk()).items;
    expect(validateAgainst(SCHEMA_IDS.question, question)).toEqual({ ok: true, value: question });
  });

  test.each([
    ["an option preview that is not text", ["options", 0, "preview"]],
    ["a recommended field on the question itself", ["recommended"]],
    ["nested items", ["items"]],
  ] as const)("a question with %s fails, naming the field", async (_case, where) => {
    const [question] = clone((await plainChoiceAsk()).items);
    let target: Record<string, unknown> = question?.props ?? {};
    for (const step of where.slice(0, -1)) target = (target as never)[step];
    target[where.at(-1) as string] = 7;
    const result = validateAgainst(SCHEMA_IDS.question, question);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.problems.map((problem) => problem.path)).toContain(
      `/props/${where.join("/")}`,
    );
  });

  test("a question needs text and at least one option", () => {
    const empty = { type: "question", id: "q", props: { text: "", options: [] } };
    const result = validateAgainst(SCHEMA_IDS.question, empty);
    expect(result.ok ? [] : result.problems.map((problem) => problem.path)).toEqual([
      "/props/text",
      "/props/options",
    ]);
  });
});

describe("the board document (owner ask-core)", () => {
  test("the fixture is the approved plain-choice ask as accepted, at rev 1", async () => {
    const ask = await plainChoiceAsk();
    const [question] = ask.items;
    expect(plainChoiceBoardDocument).toEqual({
      version: BOARD_DOCUMENT_VERSION,
      askId: ask.askId,
      title: "Which database should the order service use?",
      items: [{ ...question, rev: 1 } as never],
    });
  });

  test("a board document built from asks/plain-choice.json validates", () => {
    expect(validateBoardDocument(plainChoiceBoardDocument)).toEqual({
      ok: true,
      value: plainChoiceBoardDocument,
    });
  });

  test.each([
    ["the document", (doc: Record<string, unknown>) => Object.assign(doc, { layout: "grid" })],
    ["a question", (doc: Record<string, unknown>) => Object.assign(itemOf(doc), { hidden: true })],
    ["its props", (doc: Record<string, unknown>) => Object.assign(propsOf(doc), { colour: "red" })],
  ])("an unknown field in %s fails, naming it", (_case, change) => {
    const doc = clone(plainChoiceBoardDocument) as unknown as Record<string, unknown>;
    change(doc);
    const result = validateBoardDocument(doc);
    expect(result).toMatchObject({ ok: false, reason: "schema" });
    expect(paths(result).some((path) => /\/(layout|hidden|colour)$/.test(path))).toBe(true);
  });

  test("a rev below 1 or a malformed ID fails; a second question passes in board document 1.1", () => {
    const two = clone(plainChoiceBoardDocument) as unknown as Record<string, unknown[]>;
    two.items?.push({ ...(clone(two.items[0]) as object), id: "cache" });
    expect(validateBoardDocument(two).ok).toBe(true);
    const rev = clone(plainChoiceBoardDocument) as unknown as Record<string, unknown>;
    Object.assign(itemOf(rev), { rev: 0 });
    expect(paths(validateBoardDocument(rev))).toContain("/items/0/rev");
    const id = { ...clone(plainChoiceBoardDocument), askId: "order db" };
    expect(paths(validateBoardDocument(id))).toContain("/askId");
  });

  test("a title is at most 256 characters", () => {
    const at = (title: string) => validateBoardDocument({ ...plainChoiceBoardDocument, title });
    expect(at("x".repeat(256)).ok).toBe(true);
    expect(paths(at("x".repeat(257)))).toEqual(["/title"]);
  });

  test("a board document of another major is refused, naming the supported version", () => {
    const result = validateBoardDocument({ ...plainChoiceBoardDocument, version: "2.0" });
    expect(result).toMatchObject({ ok: false, reason: "version" });
    expect(result.ok ? "" : result.problems[0]?.message).toContain("supports version 1");
  });
});

function itemOf(doc: Record<string, unknown>): Record<string, unknown> {
  return (doc.items as Record<string, unknown>[])[0] ?? {};
}

function propsOf(doc: Record<string, unknown>): Record<string, unknown> {
  return itemOf(doc).props as Record<string, unknown>;
}
