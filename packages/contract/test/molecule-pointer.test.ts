import { describe, expect, test } from "bun:test";
import { pointerOf, pointerTokens, valueAt } from "../src/molecules/pointer.ts";

// RFC 6901 JSON Pointers, as a definition's fills write them (design decision 2): `~1` is `/` and
// `~0` is `~`, and a place is found through own properties only.

describe("pointerTokens", () => {
  test("splits a pointer into its reference tokens, unescaping ~1 and then ~0", () => {
    expect(pointerTokens("")).toEqual([]);
    expect(pointerTokens("/0/props/nodes")).toEqual(["0", "props", "nodes"]);
    expect(pointerTokens("/a~1b/c~0d")).toEqual(["a/b", "c~d"]);
    expect(pointerTokens("/~01")).toEqual(["~1"]);
    expect(pointerTokens("/")).toEqual([""]);
    expect(pointerTokens("/a//b")).toEqual(["a", "", "b"]);
  });

  test("refuses what is no pointer", () => {
    for (const text of ["0/props", "/a~2", "/a~", "#/a"])
      expect(pointerTokens(text)).toBeUndefined();
  });

  test("pointerOf escapes what pointerTokens unescapes", () => {
    const tokens = ["0", "props", "a/b", "c~d", "~1", ""];
    expect(pointerOf(tokens)).toBe("/0/props/a~1b/c~0d/~01/");
    expect(pointerTokens(pointerOf(tokens))).toEqual(tokens);
    expect(pointerOf(["items", 0, "id"])).toBe("/items/0/id");
    expect(pointerOf([])).toBe("");
  });
});

describe("valueAt", () => {
  const root = [{ props: { "a/b": { x: 1 }, list: ["p", "q"], none: null } }];

  test("finds a value through objects and arrays", () => {
    expect(valueAt(root, [])).toEqual({ found: true, value: root });
    expect(valueAt(root, ["0", "props", "a/b", "x"])).toEqual({ found: true, value: 1 });
    expect(valueAt(root, ["0", "props", "list", "1"])).toEqual({ found: true, value: "q" });
    expect(valueAt(root, ["0", "props", "none"])).toEqual({ found: true, value: null });
  });

  test("finds nothing past a missing key, an index out of range or a scalar", () => {
    for (const tokens of [
      ["1"],
      ["0", "props", "missing"],
      ["0", "props", "list", "2"],
      ["0", "props", "list", "01"],
      ["0", "props", "list", "-"],
      ["0", "props", "none", "x"],
      ["0", "props", "a/b", "x", "y"],
    ]) {
      expect(valueAt(root, tokens)).toEqual({ found: false });
    }
  });

  test("never finds an inherited property", () => {
    for (const key of ["__proto__", "constructor", "toString", "length"]) {
      expect(valueAt(root, ["0", key])).toEqual({ found: false });
    }
  });
});
