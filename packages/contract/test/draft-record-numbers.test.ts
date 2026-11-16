// Short question numbers in the draft record (answering-flow-visual, task 1.1; contract spec: Short
// question numbers in the draft record): `numbers` by question ID and `nextNumber`, in the board
// protocol's next minor. They are not unsent work, and the record's own checks name the field.

import { describe, expect, test } from "bun:test";
import {
  answeringFlowVisualDraftRecord,
  answeringFlowVisualNumbers,
  lifecycleBoardDocument,
  lifecycleDraftRecord,
} from "../src/fixtures/index.ts";
import {
  BOARD_PROTOCOL_VERSION,
  type DraftRecord,
  QUESTION_NUMBER_MAX,
  SCHEMA_SETS,
} from "../src/index.ts";
import { draftRecordProblems, validateBoardMessage } from "../src/validate.ts";

const message = (record: unknown) => ({ version: BOARD_PROTOCOL_VERSION, type: "draft", record });
const withNumbers = (numbers: unknown, nextNumber?: unknown) =>
  ({ ...lifecycleDraftRecord, numbers, nextNumber }) as unknown as DraftRecord;
const pathsOf = (record: DraftRecord) =>
  draftRecordProblems(record, lifecycleBoardDocument).map((problem) => problem.path);
const header = async (path: string) =>
  (await Bun.file(new URL(path, import.meta.url)).text()).split("\nimport ")[0];

describe("the board protocol's minor", () => {
  test("is the base's minor plus one (1.11 to 1.12), and the set carries the constant", () => {
    // Later changes move the minor on: this one's is the floor (palettes holds 1.13).
    expect(Number(BOARD_PROTOCOL_VERSION.split(".")[1])).toBeGreaterThanOrEqual(12);
    expect(SCHEMA_SETS.find((set) => set.name === "board-protocol")?.version).toBe(
      BOARD_PROTOCOL_VERSION,
    );
  });

  test("the module's header names this change", async () => {
    expect(await header("../src/schemas/board-protocol/index.ts")).toContain(
      "answering-flow-visual",
    );
  });
});

describe("a draft record's short numbers", () => {
  test("QUESTION_NUMBER_MAX is 9,999", () => {
    expect(QUESTION_NUMBER_MAX).toBe(9_999);
  });

  test("the fixture validates in both directions and against its document", () => {
    for (const direction of ["toHost", "toPage"] as const) {
      expect(
        validateBoardMessage(direction, message(answeringFlowVisualDraftRecord)).ok,
        direction,
      ).toBe(true);
    }
    expect(pathsOf(answeringFlowVisualDraftRecord)).toEqual([]);
    expect(answeringFlowVisualDraftRecord.numbers).toEqual(answeringFlowVisualNumbers);
  });

  test("numbers with a gap validate", () => {
    const record = withNumbers({ region: 1, payment: 2, rollout: 4 }, 5);
    expect(validateBoardMessage("toHost", message(record)).ok).toBe(true);
    expect(pathsOf(record)).toEqual([]);
  });

  test("a number held twice is refused, naming /numbers", () => {
    expect(pathsOf(withNumbers({ region: 1, payment: 1 }, 5))).toEqual(["/numbers"]);
  });

  test("a number not below nextNumber is refused, naming /nextNumber", () => {
    expect(pathsOf(withNumbers({ region: 5 }, 5))).toEqual(["/nextNumber"]);
  });

  test("a key naming no question is refused, `constructor` included", () => {
    expect(pathsOf(withNumbers({ constructor: 1 }, 2))).toEqual(["/numbers/constructor"]);
    expect(pathsOf(withNumbers({ nothing: 1 }, 2))).toEqual(["/numbers/nothing"]);
  });

  test("numbers without nextNumber, and nextNumber without numbers, are refused by their checks", () => {
    expect(pathsOf(withNumbers({ region: 1 }, undefined))).toContain("/nextNumber");
    expect(pathsOf(withNumbers(undefined, 3))).toEqual([]);
  });

  test("0, 2.5, a string and a nextNumber past the maximum plus one fail, naming the field", () => {
    const bad: readonly [unknown, unknown, string][] = [
      [{ region: 0 }, 2, "/record/numbers/region"],
      [{ region: 2.5 }, 5, "/record/numbers/region"],
      [{ region: "1" }, 2, "/record/numbers/region"],
      [{ region: QUESTION_NUMBER_MAX + 1 }, 2, "/record/numbers/region"],
      [{ region: 1 }, 0, "/record/nextNumber"],
      [{ region: 1 }, QUESTION_NUMBER_MAX + 2, "/record/nextNumber"],
    ];
    for (const [numbers, next, path] of bad) {
      const result = validateBoardMessage("toHost", message(withNumbers(numbers, next)));
      expect(result.ok, path).toBe(false);
      expect(result.ok ? [] : result.problems.map((problem) => problem.path)).toContain(path);
    }
  });

  test("the maximum itself, with nextNumber at the maximum plus one, validates", () => {
    const record = withNumbers({ region: QUESTION_NUMBER_MAX }, QUESTION_NUMBER_MAX + 1);
    expect(validateBoardMessage("toHost", message(record)).ok).toBe(true);
  });

  test("a record of the previous minor, without either field, validates", () => {
    expect("numbers" in lifecycleDraftRecord).toBe(false);
    expect(validateBoardMessage("toHost", message(lifecycleDraftRecord)).ok).toBe(true);
    expect(pathsOf(lifecycleDraftRecord)).toEqual([]);
  });
});
