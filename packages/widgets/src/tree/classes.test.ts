import { describe, expect, test } from "bun:test";
import { TREE_MAX_DEPTH } from "@askboard/contract";
import { INDENT, indentOf } from "./classes.ts";

describe("the Tree's indent classes", () => {
  test("one class per level of the contract, 16px a level below the first", () => {
    expect(INDENT).toHaveLength(TREE_MAX_DEPTH);
    expect(Array.from({ length: TREE_MAX_DEPTH }, (_, at) => indentOf(at + 1))).toEqual([
      "pl-0",
      "pl-[16px]",
      "pl-[32px]",
      "pl-[48px]",
      "pl-[64px]",
      "pl-[80px]",
      "pl-[96px]",
      "pl-[112px]",
    ]);
  });

  test("a level outside 1 to 8 takes the nearest class", () => {
    expect(indentOf(0)).toBe("pl-0");
    expect(indentOf(9)).toBe("pl-[112px]");
  });
});
