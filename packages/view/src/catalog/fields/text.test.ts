import { describe, expect, test } from "bun:test";
import { cutCodePoints, putting, textChange, typed } from "./text.ts";

// A field's text capped in code points, not UTF-16 units (atoms, design decision 7; task 5.3).
describe("cutting a text at a number of code points", () => {
  test("a text within the limit stays, at the limit included", () => {
    expect(cutCodePoints("abc", 3)).toBe("abc");
    expect(cutCodePoints("", 3)).toBe("");
  });

  test("a text past it keeps its first code points", () => {
    expect(cutCodePoints("abcdef", 3)).toBe("abc");
  });

  test("an astral character counts once, and is never cut in half", () => {
    const four = "😀😀😀😀";
    expect(four.length).toBe(8);
    expect(cutCodePoints(four, 4)).toBe(four);
    expect(cutCodePoints(`${four}x`, 4)).toBe(four);
    expect(cutCodePoints(four, 3)).toBe("😀😀😀");
    expect(cutCodePoints("a😀b", 2)).toBe("a😀");
  });

  test("a limit of 0 keeps nothing", () => {
    expect(cutCodePoints("abc", 0)).toBe("");
  });
});

describe("a field's handlers", () => {
  test("the typed text is cut and put; an empty text is put as none", () => {
    const put: unknown[] = [];
    const change = textChange(3, (result) => put.push(result));
    change("ab");
    change("abcdef");
    change("");
    expect(put).toEqual(["ab", "abc", undefined]);
  });

  test("an input's handler reads the text off the event's target", () => {
    const seen: string[] = [];
    typed((text) => seen.push(text))({ target: { value: "Ada" } });
    expect(seen).toEqual(["Ada"]);
  });

  test("a putting handler gives the value it was made with, whatever it is called with", () => {
    const put: unknown[] = [];
    putting((value: string | undefined) => put.push(value), undefined)();
    putting((value: boolean) => put.push(value), true)();
    expect(put).toEqual([undefined, true]);
  });
});
