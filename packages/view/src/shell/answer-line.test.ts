import { describe, expect, test } from "bun:test";
import { answerLineOf, answerPartsOf } from "./answered-look.ts";

// The answer a card names on its answered look (answering-flow-visual, design decision 7; spec:
// "The answer's line"): the labels and the "Other…" text, as the status message joins them.
describe("answerLineOf", () => {
  test("names the chosen labels, joined with a comma, then the Other text", () => {
    expect(answerLineOf(["PostgreSQL"], undefined)).toBe("PostgreSQL");
    expect(answerLineOf(["A", "B"], "my own")).toBe("A, B, my own");
    expect(answerLineOf([], "only mine")).toBe("only mine");
  });

  test("none when the answer names no choice", () => {
    expect(answerLineOf(undefined, undefined)).toBeUndefined();
    expect(answerLineOf([], "")).toBeUndefined();
  });

  test("cuts a long answer at the agent-label length, with an ellipsis", () => {
    const line = answerLineOf(["x".repeat(200)], undefined) ?? "";
    expect(Array.from(line)).toHaveLength(80);
    expect(line.endsWith("…")).toBe(true);
  });
});

describe("answerPartsOf", () => {
  test("gives each chosen label and the Other text apart, none for no choice", () => {
    expect(answerPartsOf(["A", "B"], "my own")).toEqual(["A", "B", "my own"]);
    expect(answerPartsOf([], "")).toBeUndefined();
    expect(answerPartsOf(undefined, undefined)).toBeUndefined();
  });

  test("cuts each part at the agent-label length", () => {
    const [part] = answerPartsOf(["x".repeat(200)], undefined) ?? [];
    expect(Array.from(part ?? "")).toHaveLength(80);
  });
});
