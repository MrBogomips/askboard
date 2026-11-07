// Entries in the draft record (atoms, task 1.7; contract spec: Draft record message): the text an
// input atom holds that gives no value, by item ID, each 1 to 200 characters, in the board
// protocol's next minor. They are unsent work like the values and results, checked against the
// ask's board document, and never part of an answer.

import { describe, expect, test } from "bun:test";
import { lifecycleBoardDocument, lifecycleDraftRecord } from "../src/fixtures/index.ts";
import {
  BOARD_PROTOCOL_VERSION,
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

// The lifecycle's "payment" question (in its first area), given an item `days`, in a board document.
const [scope, delivery] = lifecycleBoardDocument.items;
if (scope?.type !== "area") throw new Error("the fixture's first item is an area");
const documentWithDays = {
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
                  items: [{ type: "number-field", id: "days", props: { label: "Days" } }],
                },
              }
            : question,
        ),
      },
    },
    delivery,
  ],
} as never;

// A record whose "payment" question holds `entries`, which a test may make invalid on purpose.
const recordWith = (entries: unknown): DraftRecord =>
  ({
    ...lifecycleDraftRecord,
    questions: { payment: { rev: 1, entries } },
  }) as unknown as DraftRecord;
const message = (record: unknown) => ({ version, type: "draft", record });

describe("a draft record's entries", () => {
  test("a record holding an entry validates in both directions, beside values and results", () => {
    const record = {
      ...lifecycleDraftRecord,
      questions: {
        payment: {
          rev: 1,
          values: { payment: ["Adyen"] },
          results: { other: "x" },
          entries: { days: "1e3", amount: "12,345" },
        },
      },
    };
    for (const direction of ["toHost", "toPage"] as const) {
      expect(validateBoardMessage(direction, message(record)).ok, direction).toBe(true);
    }
  });

  test("an entry is a string of 1 to 200 characters: 200 code points pass, 201 and an empty one fail", () => {
    expect(ENTRY_MAX_CHARS).toBe(200);
    expect(validateBoardMessage("toHost", message(recordWith({ days: "😀".repeat(200) }))).ok).toBe(
      true,
    );
    for (const [bad, why] of [
      ["x".repeat(201), "201 characters"],
      ["😀".repeat(201), "201 astral characters"],
      ["", "an empty entry"],
      [5, "a number"],
      [null, "null"],
      [["a"], "a list"],
      [{ text: "a" }, "an object"],
    ] as const) {
      const result = validateBoardMessage("toHost", message(recordWith({ days: bad })));
      expect(result.ok, why).toBe(false);
      expect(paths(result), why).toContain("/record/questions/payment/entries/days");
    }
  });

  test("an entry key that is no ID is refused at the entries; a list is no entries", () => {
    const result = validateBoardMessage("toHost", message(recordWith({ "a b": "x" })));
    expect(paths(result)).toContain("/record/questions/payment/entries");
    expect(validateBoardMessage("toHost", message(recordWith(["x"]))).ok).toBe(false);
  });

  test("an entry for an item the question holds has no problem against its board document", () => {
    const record = recordWith({ days: "1e3" });
    expect(draftRecordProblems(record, documentWithDays)).toEqual([]);
  });

  test("an entry for an item the question lacks, and one of 201 characters, are refused, naming the entry", () => {
    const record = recordWith({ days: "1e3" });
    expect(draftRecordProblems(record, lifecycleBoardDocument)).toEqual([
      {
        path: "/questions/payment/entries/days",
        message: '"days" names no item of the question "payment"',
      },
    ]);
    const long = recordWith({ days: "x".repeat(201) });
    expect(validateBoardMessage("toHost", message(long)).ok).toBe(false);
    expect(paths(validateBoardMessage("toHost", message(long)))).toEqual([
      "/record/questions/payment/entries/days",
    ]);
  });

  test.each(["constructor", "toString", "__proto__", "hasOwnProperty"])(
    "an entry key %s that names no item is refused like any unknown item ID",
    (key) => {
      const entries = JSON.parse(`{${JSON.stringify(key)}: "x"}`);
      const record = recordWith(entries);
      expect(validateBoardMessage("toHost", message(record)).ok).toBe(true);
      expect(draftRecordProblems(record, documentWithDays)).toEqual([
        {
          path: `/questions/payment/entries/${key}`,
          message: `"${key}" names no item of the question "payment"`,
        },
      ]);
    },
  );

  test("an entry keyed with a slash or a tilde is escaped in the problem's path", () => {
    const problems = draftRecordProblems(recordWith({ "a/b~c": "x" }), documentWithDays);
    expect(problems.map(({ path }) => path)).toEqual(["/questions/payment/entries/a~1b~0c"]);
  });

  test("a record without entries has none of these problems", () => {
    expect(draftRecordProblems(lifecycleDraftRecord, lifecycleBoardDocument)).toEqual([]);
    expect(draftRecordProblems(recordWith({}), documentWithDays)).toEqual([]);
  });

  test("a record with entries at the draft limit passes, and one character over is refused at the record", () => {
    const entries = Object.fromEntries(
      Array.from({ length: 5_000 }, (_, at) => [`item_${at}`, "e".repeat(ENTRY_MAX_CHARS)]),
    );
    const shape = (pad: string) => ({
      ...lifecycleDraftRecord,
      questions: { payment: { rev: 1, values: { payment: pad }, entries } },
    });
    const room = DRAFT_RECORD_MAX_CHARS - JSON.stringify(shape("")).length;
    expect(room).toBeGreaterThan(0);
    const atLimit = shape("x".repeat(room));
    expect(JSON.stringify(atLimit)).toHaveLength(DRAFT_RECORD_MAX_CHARS);
    expect(validateBoardMessage("toHost", message(atLimit)).ok).toBe(true);
    const over = validateBoardMessage("toHost", message(shape("x".repeat(room + 1))));
    expect(over.ok).toBe(false);
    expect(paths(over)).toEqual(["/record"]);
  });

  test("entries never appear in the lifecycle fixtures' records unasked", () => {
    expect(JSON.stringify(lifecycleDraftRecord)).not.toContain("entries");
  });
});

describe("the board protocol since atoms", () => {
  const setOf = SCHEMA_SETS.find((candidate) => candidate.name === "board-protocol");

  test("holds this change's addition", () => {
    expect(Number(BOARD_PROTOCOL_VERSION.split(".")[1])).toBeGreaterThanOrEqual(7);
    expect(setOf?.version).toBe(BOARD_PROTOCOL_VERSION);
  });

  test("a receiver at the new minor accepts the previous minor and refuses another major", () => {
    if (setOf === undefined) throw new Error("no board protocol set");
    expect(unsupportedVersion(setOf, "1.6")).toBeUndefined();
    expect(unsupportedVersion(setOf, "2.0")).toBeDefined();
  });

  test("the previous minor's records (no entries) validate", () => {
    const old = { version: "1.6", type: "draft", record: lifecycleDraftRecord };
    expect(validateBoardMessage("toHost", old).ok).toBe(true);
  });

  test("the module's header names this change", async () => {
    const text = await Bun.file(
      new URL("../src/schemas/board-protocol/index.ts", import.meta.url),
    ).text();
    expect((text.split("\nimport ")[0] as string).includes("atoms")).toBe(true);
  });
});
