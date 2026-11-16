import { describe, expect, test } from "bun:test";
import type { ViewQuestion } from "../view-document.ts";
import { nothingChosenOf } from "./reason.ts";

// "Choose an option" (answering-flow-visual, design decision 9; requirement "A blocked primary
// with nothing chosen").
const withOptions = {
  id: "q",
  rev: 1,
  props: { text: "Which?", options: [{ id: "a", label: "A" }] },
} as unknown as ViewQuestion;
const widgetOnly = {
  id: "w",
  rev: 1,
  props: { text: "Rate", items: [{ type: "scale", id: "s", props: {} }] },
} as unknown as ViewQuestion;
const NOTHING = new Map<string, unknown>();

describe("nothingChosenOf", () => {
  test("true for a question with options and nothing chosen, no Other text, no note", () => {
    expect(nothingChosenOf(withOptions, NOTHING, undefined, false)).toBe(true);
    expect(nothingChosenOf(withOptions, NOTHING, { rev: 1 }, false)).toBe(true);
    expect(nothingChosenOf(withOptions, NOTHING, { rev: 1, note: "" }, false)).toBe(true);
  });

  test("false once an option is chosen", () => {
    expect(nothingChosenOf(withOptions, new Map([["q", ["a"]]]), undefined, false)).toBe(false);
  });

  test("false with Other text, an option note or a note", () => {
    expect(nothingChosenOf(withOptions, NOTHING, { rev: 1, other: "x" }, false)).toBe(false);
    expect(nothingChosenOf(withOptions, NOTHING, { rev: 1, optionNotes: { a: "n" } }, false)).toBe(
      false,
    );
    expect(nothingChosenOf(withOptions, NOTHING, { rev: 1, note: "why" }, false)).toBe(false);
  });

  test("false with a field reason to show", () => {
    expect(nothingChosenOf(withOptions, NOTHING, undefined, true)).toBe(false);
  });

  test("false for a widget-only question, with or without a result", () => {
    expect(nothingChosenOf(widgetOnly, NOTHING, undefined, false)).toBe(false);
    expect(nothingChosenOf(widgetOnly, NOTHING, undefined, false, new Map([["s", 3]]))).toBe(false);
  });

  test("false once a widget result or an entry is held on a question with options", () => {
    const both = {
      ...withOptions,
      props: { ...withOptions.props, items: [{ type: "scale", id: "s", props: {} }] },
    } as unknown as ViewQuestion;
    expect(nothingChosenOf(both, NOTHING, undefined, false, new Map([["s", 3]]))).toBe(false);
  });
});
