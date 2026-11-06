import { describe, expect, test } from "bun:test";
import { rowHeightOf } from "./row-height.ts";

describe("the row height from the density token (review F-23)", () => {
  test("reads the token's pixels: 32 compact, 40 comfortable", () => {
    expect(rowHeightOf("32px")).toBe(32);
    expect(rowHeightOf(" 40px ")).toBe(40);
  });

  test("falls back to the compact height for anything that is no height", () => {
    for (const value of ["", "auto", "0px", "2rem", "-4px"]) expect(rowHeightOf(value)).toBe(32);
  });
});
