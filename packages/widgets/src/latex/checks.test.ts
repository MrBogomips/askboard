// A LaTeX's props as the component takes them (latex-kanban-timeline, task 5.1; design decision 7):
// the contract's check, run on data the view hands over unchecked; a problem throws naming the item.

import { describe, expect, test } from "bun:test";
import { checkedLatexProps } from "./checks.ts";

describe("the LaTeX's props", () => {
  test("pass as they are when the contract's check passes them, an empty expression too", () => {
    const props = { expression: "x^2" };
    expect(checkedLatexProps("formula", props)).toBe(props);
    expect(checkedLatexProps("formula", { expression: "" })).toEqual({ expression: "" });
  });

  test.each([
    ["not an object", "x"],
    ["no expression", {}],
    ["an expression that is no text", { expression: 3 }],
    ["an unknown field", { expression: "x", extra: 1 }],
    ["an expression over the limit", { expression: "x".repeat(2_001) }],
    ["a macro definition", { expression: "\\def\\a{x}" }],
    ["an internal command", { expression: "\\current@color" }],
  ])("throw for %s, naming the item", (_name, props) => {
    expect(() => checkedLatexProps("formula", props)).toThrow('the LaTeX "formula" refuses');
  });
});
