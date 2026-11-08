// Cell entries in the draft record (table-widget, task 1.5; contract spec: Cell entries in the draft
// record): the text a Table's cell holds that gives no value, by item ID and by cell (`row.field`),
// each 1 to 200 characters, at most 2,000 per item, in the board protocol's next minor. They are
// unsent work like the entries, checked against the ask's board document, and never part of an
// answer.

import { describe, expect, test } from "bun:test";
import { lifecycleBoardDocument, lifecycleDraftRecord } from "../src/fixtures/index.ts";
import {
  BOARD_PROTOCOL_VERSION,
  CELL_ENTRIES_MAX,
  DRAFT_RECORD_MAX_CHARS,
  type DraftRecord,
  ENTRY_MAX_CHARS,
  SCHEMA_SETS,
} from "../src/index.ts";
import { type Checked, draftRecordProblems, validateBoardMessage } from "../src/validate.ts";
import { unsupportedVersion } from "../src/versions.ts";

const version = BOARD_PROTOCOL_VERSION;
const paths = (result: Checked<unknown>) =>
  result.ok ? [] : result.problems.map((problem) => problem.path);

// The lifecycle's "payment" question (in its first area), given items, in a board document.
const [scope, delivery] = lifecycleBoardDocument.items;
if (scope?.type !== "area") throw new Error("the fixture's first item is an area");
const documentWith = (...ids: readonly string[]) =>
  ({
    ...lifecycleBoardDocument,
    items: [
      {
        ...scope,
        props: {
          ...scope.props,
          items: scope.props.items.map((question) =>
            question.id === "payment"
              ? {
                  ...question,
                  props: {
                    ...question.props,
                    items: ids.map((id) => ({
                      type: "table",
                      id,
                      props: { columns: [], rows: [] },
                    })),
                  },
                }
              : question,
          ),
        },
      },
      delivery,
    ],
  }) as never;
const documentWithCosts = documentWith("costs");

// A record whose "payment" question holds `cellEntries`, which a test may make invalid on purpose.
const recordWith = (cellEntries: unknown): DraftRecord =>
  ({
    ...lifecycleDraftRecord,
    questions: { payment: { rev: 1, cellEntries } },
  }) as unknown as DraftRecord;
const message = (record: unknown, at = version) => ({ version: at, type: "draft", record });
const AT = "/record/questions/payment/cellEntries";

describe("a draft record's cell entries", () => {
  test("a record holding a cell entry validates in both directions, beside values, results and entries", () => {
    const record = {
      ...lifecycleDraftRecord,
      questions: {
        payment: {
          rev: 1,
          values: { payment: ["Adyen"] },
          results: { other: "x" },
          entries: { days: "1e3" },
          cellEntries: { costs: { "pm.rate": "12,5", "u-1.days": "abc" } },
        },
      },
    };
    for (const direction of ["toHost", "toPage"] as const) {
      expect(validateBoardMessage(direction, message(record)).ok, direction).toBe(true);
    }
  });

  test("a cell entry is a string of 1 to 200 characters: 200 code points pass, 201 and an empty one fail", () => {
    expect(ENTRY_MAX_CHARS).toBe(200);
    const entry = (text: unknown) => recordWith({ costs: { "pm.rate": text } });
    expect(validateBoardMessage("toHost", message(entry("😀".repeat(200)))).ok).toBe(true);
    for (const [bad, why] of [
      ["x".repeat(201), "201 characters"],
      ["😀".repeat(201), "201 astral characters"],
      ["", "an empty entry"],
      [5, "a number"],
      [null, "null"],
      [["a"], "a list"],
      [{ text: "a" }, "an object"],
    ] as const) {
      const result = validateBoardMessage("toHost", message(entry(bad)));
      expect(result.ok, why).toBe(false);
      expect(paths(result), why).toContain(`${AT}/costs/pm.rate`);
    }
  });

  test("a cell key is a row ID, a dot and a field: `pm.rate.x`, `pm`, `.rate`, `pm.Rate`, `pm.` and a slash are refused", () => {
    for (const key of [
      "pm.rate.x",
      "pm",
      ".rate",
      "pm.Rate",
      "pm.",
      "pm.1a",
      "p m.rate",
      "pm.rate ",
      `${"x".repeat(65)}.rate`,
      `pm.${"a".repeat(65)}`,
      "pm/x.rate",
      "pm.id1-",
    ]) {
      const result = validateBoardMessage("toHost", message(recordWith({ costs: { [key]: "x" } })));
      expect([key, result.ok]).toEqual([key, false]);
      expect([key, [...new Set(paths(result))]]).toEqual([key, [`${AT}/costs`]]);
    }
    for (const key of [
      "pm.rate",
      "u-1.days",
      "A_b-9.a1",
      `${"x".repeat(64)}.${"a".repeat(64)}`,
      "constructor.toString",
      "__proto__.rate",
    ]) {
      const result = validateBoardMessage("toHost", message(recordWith({ costs: { [key]: "x" } })));
      expect([key, result.ok]).toEqual([key, true]);
    }
  });

  test("an item key that is no ID is refused at the cell entries; a list or a text is no cell entries", () => {
    expect(
      paths(validateBoardMessage("toHost", message(recordWith({ "a b": { "pm.rate": "x" } })))),
    ).toContain(AT);
    for (const bad of [["x"], "x", null, { costs: "x" }, { costs: ["x"] }]) {
      expect(validateBoardMessage("toHost", message(recordWith(bad))).ok).toBe(false);
    }
  });

  test("a cell entry for an item the question holds has no problem against its board document", () => {
    expect(
      draftRecordProblems(recordWith({ costs: { "pm.rate": "12,5" } }), documentWithCosts),
    ).toEqual([]);
  });

  test("a cell entry for an item the question lacks is refused, naming the item", () => {
    expect(
      draftRecordProblems(recordWith({ costs: { "pm.rate": "x" } }), lifecycleBoardDocument),
    ).toEqual([
      {
        path: "/questions/payment/cellEntries/costs",
        message: '"costs" names no item of the question "payment"',
      },
    ]);
  });

  test("the item key `__proto__` and the cell keys `__proto__.rate` and `constructor.toString` are own keys, never inherited", () => {
    const entries = JSON.parse(
      '{"__proto__":{"__proto__.rate":"x","constructor.toString":"y"},"constructor":{"constructor.toString":"z"}}',
    );
    expect(Object.hasOwn(entries, "__proto__")).toBe(true);
    const record = recordWith(entries);
    expect(validateBoardMessage("toHost", message(record)).ok).toBe(true);
    expect(draftRecordProblems(record, documentWith("__proto__", "constructor"))).toEqual([]);
    expect(draftRecordProblems(record, documentWithCosts).map(({ path }) => path)).toEqual([
      "/questions/payment/cellEntries/__proto__",
      "/questions/payment/cellEntries/constructor",
    ]);
    const inherited = recordWith({ toString: { "a.b": "x" }, hasOwnProperty: { "a.b": "x" } });
    expect(draftRecordProblems(inherited, documentWithCosts).map(({ path }) => path)).toEqual([
      "/questions/payment/cellEntries/toString",
      "/questions/payment/cellEntries/hasOwnProperty",
    ]);
  });

  test("an item key with a slash or a tilde is escaped in the problem's path", () => {
    const problems = draftRecordProblems(
      recordWith({ "a/b~c": { "x.y": "x" } }),
      documentWithCosts,
    );
    expect(problems.map(({ path }) => path)).toEqual(["/questions/payment/cellEntries/a~1b~0c"]);
  });

  test("a record without cell entries has none of these problems", () => {
    expect(draftRecordProblems(lifecycleDraftRecord, lifecycleBoardDocument)).toEqual([]);
    expect(draftRecordProblems(recordWith({}), documentWithCosts)).toEqual([]);
    expect(JSON.stringify(lifecycleDraftRecord)).not.toContain("cellEntries");
  });

  test("2,000 cell entries for one item pass and 2,001 are refused, naming the item's cells", () => {
    expect(CELL_ENTRIES_MAX).toBe(2_000);
    const cells = (count: number) =>
      Object.fromEntries(
        Array.from({ length: count }, (_, at) => [
          `r${Math.floor(at / 10)}.f${at % 10}`,
          "e".repeat(ENTRY_MAX_CHARS),
        ]),
      );
    const atLimit = recordWith({ costs: cells(CELL_ENTRIES_MAX) });
    expect(JSON.stringify(atLimit).length).toBeLessThan(DRAFT_RECORD_MAX_CHARS);
    expect(validateBoardMessage("toHost", message(atLimit)).ok).toBe(true);
    expect(validateBoardMessage("toPage", message(atLimit)).ok).toBe(true);
    const over = validateBoardMessage(
      "toHost",
      message(recordWith({ costs: cells(CELL_ENTRIES_MAX + 1) })),
    );
    expect(over.ok).toBe(false);
    expect(paths(over)).toEqual([`${AT}/costs`]);
  });

  test("the draft record's own limit still bounds the whole record, cell entries included", () => {
    const cells = (count: number) =>
      Object.fromEntries(
        Array.from({ length: count }, (_, at) => [`r${at}.f`, "e".repeat(ENTRY_MAX_CHARS)]),
      );
    const shape = (pad: string) => ({
      ...lifecycleDraftRecord,
      questions: {
        payment: {
          rev: 1,
          values: { payment: pad },
          cellEntries: { costs: cells(1_500), other: cells(1_500) },
        },
      },
    });
    const room = DRAFT_RECORD_MAX_CHARS - JSON.stringify(shape("")).length;
    expect(room).toBeGreaterThan(0);
    expect(validateBoardMessage("toHost", message(shape("x".repeat(room)))).ok).toBe(true);
    expect(paths(validateBoardMessage("toHost", message(shape("x".repeat(room + 1)))))).toEqual([
      "/record",
    ]);
  });
});

describe("the board protocol since table-widget", () => {
  const setOf = SCHEMA_SETS.find((candidate) => candidate.name === "board-protocol");
  const previous = `1.${Number(BOARD_PROTOCOL_VERSION.split(".")[1]) - 1}`;

  test("the minor is bound at this change's number", () => {
    expect(BOARD_PROTOCOL_VERSION).toBe("1.8");
    expect(setOf?.version).toBe(BOARD_PROTOCOL_VERSION);
  });

  test("a receiver at the new minor accepts the previous minor and refuses another major", () => {
    if (setOf === undefined) throw new Error("no board protocol set");
    expect(unsupportedVersion(setOf, previous)).toBeUndefined();
    expect(unsupportedVersion(setOf, "2.0")).toBeDefined();
  });

  test("a record of the previous minor, with no cell entry, validates", () => {
    const old = message(lifecycleDraftRecord, previous);
    expect(validateBoardMessage("toHost", old).ok).toBe(true);
    expect(validateBoardMessage("toPage", old).ok).toBe(true);
    const withEntries = message(
      { ...lifecycleDraftRecord, questions: { payment: { rev: 1, entries: { days: "x" } } } },
      previous,
    );
    expect(validateBoardMessage("toHost", withEntries).ok).toBe(true);
  });

  test("the module's header names this change", async () => {
    const text = await Bun.file(
      new URL("../src/schemas/board-protocol/index.ts", import.meta.url),
    ).text();
    expect((text.split("\nimport ")[0] as string).includes("table-widget")).toBe(true);
  });
});
