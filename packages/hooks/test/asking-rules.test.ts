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
// input: none, always and with-references (settings-languages, task 6.1). The closed set itself is
// `contract`'s.
const inputs: [string, unknown][] = [
  ["the plain-choice question", plainChoiceQuestion],
  ["an empty input", {}],
  ["no input", undefined],
  ["a question that names a file", { questions: [{ question: "Keep src/order.ts as it is?" }] }],
];

/** An AskUserQuestion input with one question, `fields` merged into it or into its one option. */
const asked = (fields: Record<string, unknown>, option: Record<string, unknown> = {}) => ({
  questions: [
    {
      question: "Which one?",
      header: "Choice",
      multiSelect: false,
      options: [{ label: "This", description: "The first", ...option }, { label: "That" }],
      ...fields,
    },
  ],
});

// The with-references predicate (settings-languages design decision 12; spec hooks, "The
// with-references predicate"): a URL or a project-file pointer in any of the five fields.
const withReferences: [string, unknown][] = [
  [
    "a pointer with lines in the question",
    asked({ question: "Keep the retry in `src/retry.ts#L40-L62`?" }),
  ],
  ["a pointer in the header", asked({ header: "src/order.ts" })],
  ["a pointer in an option's label", asked({}, { label: "Edit app.py:12" })],
  [
    "a URL in an option's description",
    asked({}, { description: "See https://example.com/adr/12" }),
  ],
  ["a pointer in an option's preview", asked({}, { preview: "packages/core/src/core.ts" })],
  ["a file at the root with an anchor", asked({ question: "See README.md#Install first?" })],
  [
    "a pointer in the second question",
    { questions: [asked({}).questions[0], asked({ question: "Open docs/prd.md?" }).questions[0]] },
  ],
];

const withoutReferences: [string, unknown][] = [
  ["the plain-choice question", plainChoiceQuestion],
  ["a plain question", asked({})],
  ["words with a dot", asked({ question: "Use Node.js or e.g. Bun?" })],
  ["a version number", asked({ question: "Upgrade to 1.5.2?" })],
  ["an empty input", {}],
  ["no input", undefined],
  ["questions that is not a list", { questions: "src/retry.ts" }],
  ["a question that is not an object", { questions: ["src/retry.ts", null] }],
  ["fields that are not text", asked({ question: ["src/retry.ts"], header: 7 }, { label: {} })],
  ["options that are not a list", asked({ options: { label: "src/retry.ts" } })],
  ["an option that is not an object", asked({ options: ["src/retry.ts", null] })],
  [
    "a pointer in a field the rule does not read",
    asked({ notes: "src/retry.ts" }, { id: "src/a.ts" }),
  ],
];

describe("the asking rules' predicates", () => {
  test.each(inputs)("none never sends %s to AskBoard", (_case, input) => {
    expect(sendsToAskBoard("none", input)).toBe(false);
  });

  test.each(inputs)("always sends %s to AskBoard", (_case, input) => {
    expect(sendsToAskBoard("always", input)).toBe(true);
  });

  test.each(withReferences)("with-references sends %s to AskBoard", (_case, input) => {
    expect(sendsToAskBoard("with-references", input)).toBe(true);
  });

  test.each(withoutReferences)("with-references lets %s proceed", (_case, input) => {
    expect(sendsToAskBoard("with-references", input)).toBe(false);
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
