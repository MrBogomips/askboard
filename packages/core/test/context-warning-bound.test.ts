// The bound on the `unresolved-pointer` warnings (result-bound, design decisions 1, 2 and 4; core
// spec, "An unresolved pointer never blocks the board", "The closing unresolved-pointer warning";
// Refs #98), over `boundedUnresolvedWarnings` and the closing warning it builds.

import { describe, expect, test } from "bun:test";
import {
  POINTER_MAX_CHARS,
  RESULT_MAX_CHARS,
  SCHEMA_IDS,
  type UnresolvedPointerWarning,
  type UnresolvedReason,
} from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import {
  boundedUnresolvedWarnings,
  boundedUnresolvedWith,
  closingUnresolvedWarning,
  UNRESOLVED_MESSAGES,
  UNRESOLVED_WARNINGS_MAX_CHARS,
} from "../src/context/warnings.ts";

const warning = (
  n: number,
  pointer = `docs/missing-${n}.md#Intro`,
  reason: UnresolvedReason = "not-found",
): UnresolvedPointerWarning => ({
  code: "unresolved-pointer",
  itemId: `item-${n}`,
  pointer,
  reason,
  message: UNRESOLVED_MESSAGES[reason],
});

const json = (list: readonly unknown[]): number => JSON.stringify(list).length;

describe("the bound", () => {
  test("is 10,000 characters, a third of the result bound", () => {
    expect(UNRESOLVED_WARNINGS_MAX_CHARS).toBe(10_000);
    expect(UNRESOLVED_WARNINGS_MAX_CHARS * 3).toBeLessThanOrEqual(RESULT_MAX_CHARS);
  });

  test("a list within it comes back as it is, no warning closing", () => {
    const list = Array.from({ length: 5 }, (_, n) => warning(n));
    expect(boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS)).toBe(list);
  });
});

describe("the closing warning's words", () => {
  const first = warning(7, "docs/gone.md#Intro", "anchor-not-found");

  test("N more: counts the warnings after it and points to fetch", () => {
    expect(closingUnresolvedWarning(first, 9).message).toBe(
      "The pointer of item-7 did not resolve (anchor-not-found), and 9 more unresolved pointers are left out: fetch their questions to read each one's reason.",
    );
  });

  test("1 more: the singular", () => {
    expect(closingUnresolvedWarning(first, 1).message).toBe(
      "The pointer of item-7 did not resolve (anchor-not-found), and 1 more unresolved pointer is left out: fetch its question to read its reason.",
    );
  });

  test("keeps the item, the pointer and the reason of the first left out, and fits the schema", () => {
    for (const left of [1, 12]) {
      const closing = closingUnresolvedWarning(first, left);
      expect(closing).toMatchObject({
        code: "unresolved-pointer",
        itemId: "item-7",
        pointer: "docs/gone.md#Intro",
        reason: "anchor-not-found",
      });
      expect(validateAgainst(SCHEMA_IDS.warning, closing).ok).toBe(true);
    }
  });
});

describe("past the bound", () => {
  test("keeps the warnings in order, then one closing warning for the first left out", () => {
    const list = Array.from({ length: 200 }, (_, n) => warning(n));
    expect(json(list)).toBeGreaterThan(UNRESOLVED_WARNINGS_MAX_CHARS);
    const result = boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS);
    const kept = result.slice(0, -1);
    expect(kept.length).toBeGreaterThan(30);
    expect(kept).toEqual(list.slice(0, kept.length));
    const left = list.length - kept.length - 1;
    expect(result.at(-1)).toEqual(closingUnresolvedWarning(list[kept.length] as never, left));
    expect(json(result)).toBeLessThanOrEqual(UNRESOLVED_WARNINGS_MAX_CHARS);
    expect(validateAgainst(SCHEMA_IDS.warning, result.at(-1)).ok).toBe(true);
  });

  test("the room is the longest closing warning of the list, measured with its length as the count", () => {
    const long = warning(1, `${"a".repeat(POINTER_MAX_CHARS - 3)}.md`, "invalid-pointer");
    const list = [...Array.from({ length: 100 }, (_, n) => warning(n)), long];
    const room = json([closingUnresolvedWarning(long, list.length)]) - 2;
    const result = boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS);
    const kept = result.slice(0, -1);
    // One more kept warning would leave less room than that closing warning needs.
    expect(json(kept) + room).toBeLessThanOrEqual(UNRESOLVED_WARNINGS_MAX_CHARS);
    expect(json(list.slice(0, kept.length + 1)) + room).toBeGreaterThan(
      UNRESOLVED_WARNINGS_MAX_CHARS,
    );
  });

  test("the room holds the closing warning of any warning in the list, wherever it stands", () => {
    const controls = "\u0001".repeat(POINTER_MAX_CHARS);
    const listWithLongAt = (position: number) => {
      const list = Array.from({ length: 35 }, (_, n) => warning(n));
      list.splice(position, 0, warning(position, controls, "invalid-pointer"));
      return list;
    };
    for (let position = 0; position <= 35; position++) {
      const result = boundedUnresolvedWarnings(
        listWithLongAt(position),
        UNRESOLVED_WARNINGS_MAX_CHARS,
      );
      expect(json(result)).toBeLessThanOrEqual(UNRESOLVED_WARNINGS_MAX_CHARS);
    }
    const list = listWithLongAt(30);
    const result = boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS);
    expect(result).toHaveLength(22);
    expect(result.slice(0, 21)).toEqual(list.slice(0, 21));
    expect(result.at(-1)).toEqual(closingUnresolvedWarning(list[21] as never, 14));
  });

  test("ten pointers of 1,024 characters that JSON escapes give one closing warning counting 9", () => {
    const controls = "\u0001".repeat(POINTER_MAX_CHARS);
    const list = Array.from({ length: 10 }, (_, n) => warning(n, controls, "invalid-pointer"));
    expect(json([list[0]])).toBeGreaterThan(6_000);
    const result = boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(closingUnresolvedWarning(list[0] as never, 9));
    expect(result[0]?.message).toContain("9 more unresolved pointers");
    expect(json(result)).toBeLessThanOrEqual(UNRESOLVED_WARNINGS_MAX_CHARS);
  });

  test("the closing words hold no path but the pointer field", () => {
    const list = Array.from({ length: 200 }, (_, n) =>
      warning(n, "../../etc/passwd#L1-L2", "outside-root"),
    );
    const closing = boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS).at(-1);
    expect(closing?.pointer).toBe("../../etc/passwd#L1-L2");
    expect(closing?.message).not.toContain("/");
    expect(closing?.message).not.toContain("passwd");
    expect(closing?.message).not.toMatch(/\bexists?\b/);
  });

  test("whatever the pointers, the list with its closing warning stays within the bound", () => {
    const shapes = [
      "x".repeat(POINTER_MAX_CHARS),
      "\u0001".repeat(POINTER_MAX_CHARS),
      '"\\'.repeat(POINTER_MAX_CHARS / 2),
      "\ud800".repeat(POINTER_MAX_CHARS),
    ];
    for (const pointer of shapes) {
      for (const count of [2, 9, 40, 300]) {
        const list = Array.from({ length: count }, (_, n) =>
          warning(n, pointer, "invalid-pointer"),
        );
        const result = boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS);
        expect(json(result)).toBeLessThanOrEqual(UNRESOLVED_WARNINGS_MAX_CHARS);
      }
    }
  });
});

describe("a list past the room only by its last pointer", () => {
  test("comes back whole, the same array, none closing", () => {
    const build = (length: number) =>
      Array.from({ length: 8 }, (_, n) =>
        warning(n, `${"p".repeat(length - 4)}${String(n).padStart(4, "0")}`, "not-found"),
      );
    const roomOf = (list: UnresolvedPointerWarning[]) =>
      Math.max(...list.map((w) => json([closingUnresolvedWarning(w, list.length)]))) - 2;
    const length = Array.from({ length: POINTER_MAX_CHARS - 4 }, (_, i) => i + 5).find((l) => {
      const list = build(l);
      return (
        json(list) > UNRESOLVED_WARNINGS_MAX_CHARS - roomOf(list) &&
        json(list) <= UNRESOLVED_WARNINGS_MAX_CHARS
      );
    });
    expect(length).toBeDefined();
    const list = build(length as number);
    expect(boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS)).toBe(list);
  });
});

describe("the closing warning's comma is budgeted (review 1.3, X-1)", () => {
  /** 26 `not-found` excerpts `ex-00`..`ex-25`, each pointer `length` characters: every warning has the same size. */
  const sameSize = (count: number, length: number) =>
    Array.from({ length: count }, (_, n) => {
      const id = String(n).padStart(2, "0");
      return {
        ...warning(n, `${id}${"m".repeat(length - 5)}.md`, "not-found"),
        itemId: `ex-${id}`,
      };
    });

  test("26 pointers of 477 characters: the list with its closing warning is within the bound", () => {
    const list = sameSize(26, 477);
    const result = boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS);
    expect(result).not.toBe(list);
    expect(result.at(-1)?.message).toContain("more unresolved pointers are left out");
    expect(json(result)).toBeLessThanOrEqual(UNRESOLVED_WARNINGS_MAX_CHARS);
  });

  test("every pointer length from 1 to 1,024, for list sizes past the cut, stays within the bound", () => {
    let cut = 0;
    for (let length = 1; length <= POINTER_MAX_CHARS; length++) {
      const around = Math.ceil(
        UNRESOLVED_WARNINGS_MAX_CHARS / json([warning(0, "x".repeat(length))]),
      );
      for (const count of [around, around + 1, around + 2, around + 3, around + 12]) {
        const list = Array.from({ length: count }, (_, n) => ({
          ...warning(n, "x".repeat(length), "not-found"),
          itemId: `ex-${String(n).padStart(2, "0")}`,
        }));
        const result = boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS);
        expect(json(result)).toBeLessThanOrEqual(UNRESOLVED_WARNINGS_MAX_CHARS);
        if (result !== list) cut++;
      }
    }
    expect(cut).toBeGreaterThan(1_000);
  });
});

describe("the room measures every closing warning the cut could write (re-review 1.5, X-1)", () => {
  /** The closing warning with a singular 13 characters longer than the shipped one. */
  const longerSingular = (
    first: UnresolvedPointerWarning,
    left: number,
  ): UnresolvedPointerWarning => {
    const closing = closingUnresolvedWarning(first, left);
    return left === 1
      ? { ...closing, message: `${closing.message.slice(0, -1)} (see fetch!).` }
      : closing;
  };

  /** The review's list: one `not-found` warning of 3,487 characters of JSON, then two long `invalid-pointer` ones. */
  const reviewList = () => {
    const first = warning(0, "", "not-found");
    const pointer = "x".repeat(3_487 - json([first]) + 2);
    const control = String.fromCharCode(1).repeat(POINTER_MAX_CHARS);
    return [
      { ...first, pointer },
      ...[1, 2].map((n) => ({
        ...warning(n, control, "invalid-pointer"),
        itemId: `${n}`.repeat(64),
      })),
    ];
  };

  test("the review's list stays within the bound with a singular 13 characters longer (10,001 before the fix)", () => {
    const list = reviewList();
    expect(JSON.stringify(list[0]).length).toBe(3_487);
    expect(longerSingular(list[1] as never, 1).message.length).toBe(
      closingUnresolvedWarning(list[1] as never, 1).message.length + 13,
    );
    const result = boundedUnresolvedWith(longerSingular, list, UNRESOLVED_WARNINGS_MAX_CHARS);
    // The room now holds the longer singular, so the 3,487-character warning is no longer kept.
    expect(result).toEqual([longerSingular(list[0] as never, 2)]);
    expect(json(result)).toBeLessThanOrEqual(UNRESOLVED_WARNINGS_MAX_CHARS);
  });

  test("with the shipped words the same list comes out as it did, within the bound", () => {
    const list = reviewList();
    const result = boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(list[0] as never);
    expect(result[1]).toEqual(closingUnresolvedWarning(list[1] as never, 1));
    expect(json(result)).toBe(9_988);
  });

  test("on the existing 26 x 477 case the output is unchanged: 14 kept and the plural closing warning counting 11", () => {
    const list = Array.from({ length: 26 }, (_, n) => {
      const id = String(n).padStart(2, "0");
      return { ...warning(n, `${id}${"m".repeat(472)}.md`, "not-found"), itemId: `ex-${id}` };
    });
    const result = boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS);
    expect(result).toHaveLength(15);
    expect(result.slice(0, -1)).toEqual(list.slice(0, 14));
    expect(result[14]).toEqual(closingUnresolvedWarning(list[14] as never, 11));
  });
});

describe("the closing warning always counts the rest (decision 2's premise)", () => {
  test("for every reason, the closing warning with count 2 is longer than that reason's warning, its comma and the closing comma", () => {
    for (const reason of Object.keys(UNRESOLVED_MESSAGES) as UnresolvedReason[]) {
      const own = { ...warning(0, "x", reason), itemId: "a" };
      const closing = closingUnresolvedWarning(own, 2);
      // The warning and the comma after it (the cut keeps one more), and the comma before the closing one.
      expect(JSON.stringify(closing).length).toBeGreaterThan(JSON.stringify(own).length + 2);
    }
  });
});

describe("the closing warning always counts the rest (decision 2's sweep)", () => {
  test("over every reason, ID lengths, pointer lengths and list sizes, no closing warning counts fewer than 1", () => {
    const reasons = Object.keys(UNRESOLVED_MESSAGES) as UnresolvedReason[];
    const pointers = [1, 300, 1_024].flatMap((length) => [
      "x".repeat(length),
      "\u0001".repeat(length),
    ]);
    const counted = /, and (\d+) more unresolved pointers? (is|are) left out/;
    let closings = 0;
    for (const reason of reasons) {
      for (const idLength of [1, 64]) {
        for (const pointer of pointers) {
          const size = json([warning(0, pointer, reason)]);
          const around = Math.ceil(UNRESOLVED_WARNINGS_MAX_CHARS / size);
          for (let count = Math.max(1, around - 3); count <= around + 4; count++) {
            const list = Array.from({ length: count }, (_, n) => ({
              ...warning(n, pointer, reason),
              itemId: String(n % 10).repeat(idLength),
            }));
            const result = boundedUnresolvedWarnings(list, UNRESOLVED_WARNINGS_MAX_CHARS);
            expect(json(result)).toBeLessThanOrEqual(UNRESOLVED_WARNINGS_MAX_CHARS);
            if (result === list) continue;
            const message = result.at(-1)?.message ?? "";
            const match = counted.exec(message);
            expect(match).not.toBeNull();
            expect(Number(match?.[1])).toBeGreaterThanOrEqual(1);
            closings++;
          }
        }
      }
    }
    expect(closings).toBeGreaterThan(0);
  });
});
