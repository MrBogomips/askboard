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

  test("none after it: says its own message is left out, with no count", () => {
    expect(closingUnresolvedWarning(first, 0).message).toBe(
      "The pointer of item-7 did not resolve (anchor-not-found); its message is left out.",
    );
  });

  test("keeps the item, the pointer and the reason of the first left out, and fits the schema", () => {
    for (const left of [0, 1, 12]) {
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
