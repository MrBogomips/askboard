import { describe, expect, test } from "bun:test";
import { checkedProps } from "./props.ts";

// A Document review's props as the component takes them (view-and-widgets spec: A Document review's
// document; AD-10): the view hands them over unchecked, the contract's checks run, and a problem
// throws, naming the item, so the item's error boundary fails it.
describe("checkedProps", () => {
  test("gives back the very props object an agent's Document review has, which keeps its reading", () => {
    const props = { markdown: "# A title\n\nSome text.", title: "Notes" };
    expect(checkedProps("review", props)).toBe(props);
  });

  test("throws naming the item and each problem for props the contract refuses", () => {
    expect(() => checkedProps("review", { markdown: "" })).toThrow(/Document review "review"/);
    expect(() => checkedProps("review", { markdown: "a‮b" })).toThrow(/refuses its props/);
    expect(() => checkedProps("review", { markdown: "ok", extra: 1 })).toThrow(/extra/);
    expect(() => checkedProps("review", null)).toThrow(/object/);
    expect(() => checkedProps("review", "text")).toThrow(/Document review "review"/);
  });

  test("never names the agent's text in the error", () => {
    try {
      checkedProps("review", { markdown: "secret‮" });
    } catch (error) {
      expect(String(error)).not.toContain("secret");
    }
  });
});
