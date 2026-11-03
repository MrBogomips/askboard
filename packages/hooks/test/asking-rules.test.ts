import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ASKING_RULES } from "@askboard/contract";
import { sendsToAskBoard } from "../src/index.ts";

// The approved example of an AskUserQuestion input, read where the contract keeps the approved
// examples (review-model-contract), so there is one copy of it.
const plainChoiceQuestion: unknown = await Bun.file(
  join(import.meta.dir, "../../contract/test/fixtures/auq/plain-choice.json"),
).json();

// The asking rules' predicates (AD-16, FR-30), implemented once in `hooks` over an AskUserQuestion
// input: none and always. with-references' predicate comes with the rule's source (E8; design
// decision 1). The closed set itself is `contract`'s.
const inputs: [string, unknown][] = [
  ["the plain-choice question", plainChoiceQuestion],
  ["an empty input", {}],
  ["no input", undefined],
  ["a question that names a file", { questions: [{ question: "Keep src/order.ts as it is?" }] }],
];

describe("the asking rules' predicates", () => {
  test.each(inputs)("none never sends %s to AskBoard", (_case, input) => {
    expect(sendsToAskBoard("none", input)).toBe(false);
  });

  test.each(inputs)("always sends %s to AskBoard", (_case, input) => {
    expect(sendsToAskBoard("always", input)).toBe(true);
  });

  test("with-references has no predicate yet, so checking it throws", () => {
    expect(() => sendsToAskBoard("with-references", plainChoiceQuestion)).toThrow(
      "with-references",
    );
  });

  test.each(["sometimes", "", "None", "constructor", "toString"])(
    "the rule %p is refused as unknown",
    (rule) => {
      expect(() => sendsToAskBoard(rule, plainChoiceQuestion)).toThrow(
        `unknown asking rule ${JSON.stringify(rule)}`,
      );
    },
  );

  test("exist for every rule of the contract's closed set", () => {
    for (const rule of ASKING_RULES) {
      expect(() => sendsToAskBoard(rule, plainChoiceQuestion)).not.toThrow("unknown asking rule");
    }
  });
});
