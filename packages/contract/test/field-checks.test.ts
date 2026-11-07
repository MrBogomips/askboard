// Field checks on the input atoms (form-widget, task 1.2; contract spec: Required fields, A
// TextField's length and pattern, A value that fails a check still fits, Form fields in the schema
// sets; design decisions 2, 3 and 9): `required` on the five input atoms, `minLength` and `pattern`
// on the TextField, the check each type gives the registry, and what a request says of a prop that
// is out of bounds.

import { describe, expect, test } from "bun:test";
import {
  type FieldCheckFailure,
  fieldCheckMessage,
  PATTERN_TEXT_MAX_CHARS,
  requiredFailure,
  textFieldFieldCheck,
  textFieldPatternFailure,
  WIDGET_TYPES,
  widgetFieldCheck,
  widgetResultFits,
} from "../src/index.ts";
import { validateAskRequest } from "../src/validate.ts";

type Item = { readonly type: string; readonly id: string; readonly props: unknown };

const textField = (props: Record<string, unknown>, id = "ticket"): Item => ({
  type: "text-field",
  id,
  props: { label: "Ticket", ...props },
});
const check = (item: Item, result?: unknown): FieldCheckFailure | undefined =>
  widgetFieldCheck(item, result, WIDGET_TYPES);
const textCheck = (props: Record<string, unknown>, result?: unknown) =>
  check(textField(props), result);
const patternFailure = (props: Record<string, unknown>, result?: unknown) =>
  textFieldPatternFailure(result, { label: "Ticket", ...props });

const group = (id: string, ...items: Item[]): Item => ({
  type: "group",
  id,
  props: { title: id, items },
});
const askOf = (...items: Item[]) => ({
  askId: "field-checks-a1b2",
  items: [{ type: "question", id: "q", props: { text: "Which?", items } }],
});
const problemsOf = (...items: Item[]) => {
  const result = validateAskRequest(askOf(...items));
  return result.ok ? [] : result.problems;
};

describe("required fields", () => {
  test("a required Toggle fails with no result and passes with false", () => {
    const toggle: Item = {
      type: "toggle",
      id: "agree",
      props: { label: "I agree", required: true },
    };
    expect(check(toggle)).toEqual({ code: "required" });
    expect(check(toggle, true)).toBeUndefined();
    expect(check(toggle, false)).toBeUndefined();
  });

  test("a field without required passes with no result", () => {
    const number: Item = { type: "number-field", id: "n", props: { label: "Count" } };
    expect(check(number)).toBeUndefined();
    expect(check({ ...number, props: { label: "Count", required: false } })).toBeUndefined();
  });

  test.each([
    ["number-field", 0],
    ["money-field", { amount: "0", currency: "EUR" }],
    ["date-field", "2026-03-02"],
    ["toggle", false],
    ["text-field", "a"],
  ])(
    "a required %s fails with no result and passes with a result, 0 and false included",
    (type, result) => {
      const item: Item = { type, id: "f", props: { label: "Field", required: true } };
      expect(check(item)).toEqual({ code: "required" });
      expect(check(item, result)).toBeUndefined();
    },
  );

  test("requiredFailure reads only a boolean true and a missing result", () => {
    expect(requiredFailure({ required: true }, undefined)).toEqual({ code: "required" });
    expect(requiredFailure({ required: true }, 0)).toBeUndefined();
    expect(requiredFailure({ required: true }, "")).toBeUndefined();
    expect(requiredFailure({ required: "yes" }, undefined)).toBeUndefined();
    expect(requiredFailure(undefined, undefined)).toBeUndefined();
    expect(requiredFailure(null, undefined)).toBeUndefined();
    expect(requiredFailure({}, undefined)).toBeUndefined();
  });

  test("a type that registers no field check never fails one", () => {
    expect(check({ type: "tree", id: "t", props: {} })).toBeUndefined();
    expect(check({ type: "no-such-type", id: "t", props: {} })).toBeUndefined();
  });
});

describe("a TextField's length", () => {
  test("too short fails naming the length, and long enough passes", () => {
    expect(textCheck({ minLength: 3 }, "ab")).toEqual({ code: "min-length", min: 3 });
    expect(textCheck({ minLength: 3 }, "abc")).toBeUndefined();
    expect(textCheck({ minLength: 3 })).toBeUndefined();
  });

  test("the length counts code points, not UTF-16 units", () => {
    expect(textCheck({ minLength: 3 }, "😀😀")).toEqual({ code: "min-length", min: 3 });
    expect(textCheck({ minLength: 3 }, "😀😀😀")).toBeUndefined();
  });

  test("a required field with no text fails as required before any length", () => {
    expect(textCheck({ minLength: 3, required: true })).toEqual({ code: "required" });
    expect(textCheck({ minLength: 3, required: true }, "ab")).toEqual({
      code: "min-length",
      min: 3,
    });
  });

  test("the registry's check never reads the pattern", () => {
    expect(textCheck({ pattern: "^[A-Z]+$" }, "ab")).toBeUndefined();
    expect(textFieldFieldCheck("ab", { label: "T", pattern: "^[A-Z]+$" })).toBeUndefined();
  });
});

describe("a TextField's pattern, which only the board runs", () => {
  test("a ticket key passes, a lowercase one fails and no result passes", () => {
    const props = { pattern: "^[A-Z]{2}-\\d{4}$" };
    expect(patternFailure(props, "AB-1234")).toBeUndefined();
    expect(patternFailure(props, "ab-1234")).toEqual({ code: "pattern" });
    expect(patternFailure(props)).toBeUndefined();
  });

  test("the pattern is unanchored and read with the u flag", () => {
    expect(patternFailure({ pattern: "\\p{L}" }, "123é")).toBeUndefined();
    expect(patternFailure({ pattern: "\\p{L}" }, "123")).toEqual({ code: "pattern" });
    expect(patternFailure({ pattern: "[A-Z]{2}" }, "x AB y")).toBeUndefined();
    expect(patternFailure({ pattern: "^😀$" }, "😀")).toBeUndefined();
  });

  test("a field with no pattern, or props that are no TextField's, never fails it", () => {
    expect(patternFailure({}, "anything")).toBeUndefined();
    expect(textFieldPatternFailure("x", undefined)).toBeUndefined();
    expect(textFieldPatternFailure("x", { label: "T", pattern: 7 })).toBeUndefined();
    expect(textFieldPatternFailure(7, { label: "T", pattern: "a" })).toBeUndefined();
  });

  test("a pattern that does not compile fails the check, never passes", () => {
    expect(patternFailure({ pattern: "(" }, "abc")).toEqual({ code: "pattern" });
    expect(patternFailure({ pattern: "(" }, "abc")).toEqual({ code: "pattern" });
  });

  test("__proto__ and constructor are text and patterns like any other", () => {
    expect(patternFailure({ pattern: "^__proto__$" }, "__proto__")).toBeUndefined();
    expect(patternFailure({ pattern: "^__proto__$" }, "other")).toEqual({ code: "pattern" });
    expect(patternFailure({ pattern: "^constructor$" }, "constructor")).toBeUndefined();
    const named = textField({ label: "__proto__" }, "proto");
    expect(problemsOf(named)).toEqual([]);
    expect(check(named, "x")).toBeUndefined();
  });

  test("many distinct patterns each keep their own verdict", () => {
    for (let at = 0; at < 150; at += 1) {
      const props = { pattern: `^x${at}$` };
      expect(patternFailure(props, `x${at}`)).toBeUndefined();
      expect(patternFailure(props, "y")).toEqual({ code: "pattern" });
    }
    expect(patternFailure({ pattern: "^x0$" }, "x0")).toBeUndefined();
  });
});

describe("a value that fails a check still fits", () => {
  const fits = (item: Item, result: unknown) =>
    widgetResultFits(item, result, item.props, WIDGET_TYPES);

  test("a text against its pattern or its minimum length", () => {
    const patterned = textField({ pattern: "^[A-Z]{2}-\\d{4}$" });
    expect(fits(patterned, "ab-1234")).toBe(true);
    expect(patternFailure(patterned.props as Record<string, unknown>, "ab-1234")).toEqual({
      code: "pattern",
    });
    const short = textField({ minLength: 3 });
    expect(fits(short, "ab")).toBe(true);
    expect(check(short, "ab")).toEqual({ code: "min-length", min: 3 });
  });

  test("a value of each type that holds one while it fails nothing else", () => {
    for (const [type, result] of [
      ["number-field", 0],
      ["money-field", { amount: "0", currency: "EUR" }],
      ["date-field", "2026-03-02"],
      ["toggle", false],
      ["text-field", "a"],
    ] as const) {
      const props = {
        label: "Field",
        required: true,
        ...(type === "money-field" ? { currency: "EUR" } : {}),
      };
      const item: Item = { type, id: "f", props };
      expect(fits(item, result), type).toBe(true);
    }
  });

  test("a result the type's own checks refuse stays unfit, whatever its field check says", () => {
    const refused: readonly (readonly [Item, unknown])[] = [
      [textField({ maxLength: 5 }), "abcdef"],
      [{ type: "number-field", id: "n", props: { label: "N", max: 10 } }, 11],
      [{ type: "date-field", id: "d", props: { label: "D", max: "2026-01-01" } }, "2026-02-01"],
      [
        { type: "money-field", id: "m", props: { label: "M", currency: "EUR" } },
        { amount: "5", currency: "USD" },
      ],
      [{ type: "toggle", id: "t", props: { label: "T" } }, "yes"],
    ];
    for (const [item, result] of refused) expect(fits(item, result), item.type).toBe(false);
  });

  test("a text over the limit a pattern sets is unfit", () => {
    const patterned = textField({ pattern: "^a+$" });
    expect(fits(patterned, "a".repeat(PATTERN_TEXT_MAX_CHARS))).toBe(true);
    expect(fits(patterned, "a".repeat(PATTERN_TEXT_MAX_CHARS + 1))).toBe(false);
    expect(fits(textField({}), "a".repeat(PATTERN_TEXT_MAX_CHARS + 1))).toBe(true);
  });
});

describe("the wording of a failure", () => {
  test("each code has a sentence that names what it needs", () => {
    expect(fieldCheckMessage({ code: "required" })).toContain("required");
    expect(fieldCheckMessage({ code: "min-length", min: 3 })).toContain("3 characters");
    expect(fieldCheckMessage({ code: "pattern" })).toContain("pattern");
    expect(fieldCheckMessage({ code: "min-items", min: 2 })).toContain("at least 2");
    expect(fieldCheckMessage({ code: "max-items", max: 4 })).toContain("at most 4");
  });
});

describe("what a request says of the props", () => {
  const at = (path: string, ...items: Item[]) =>
    problemsOf(...items).filter((problem) => problem.path.endsWith(path));

  test("a minimum length over the maximum is refused at minLength, naming the item", () => {
    const [problem, ...rest] = at("/minLength", textField({ minLength: 50, maxLength: 40 }));
    expect(rest).toEqual([]);
    expect(problem?.message).toContain("ticket");
    expect(problem?.message).toContain("40");
  });

  test("a pattern beside no maxLength limits the text to 1,000, which a minimum cannot pass", () => {
    expect(at("/minLength", textField({ pattern: "^a+$", minLength: 1_000 }))).toEqual([]);
    expect(at("/minLength", textField({ pattern: "^a+$", minLength: 1_001 }))).toHaveLength(1);
    expect(at("/minLength", textField({ minLength: 1_001 }))).toEqual([]);
  });

  test("a pattern outside the subset is refused at pattern, naming the item and the rule", () => {
    const [problem] = at("/pattern", textField({ pattern: "^(a+)+$" }));
    expect(problem?.message).toContain("ticket");
    expect(problem?.message).toContain("repeated group");
    expect(at("/pattern", textField({ pattern: "(" }))[0]?.message).toContain("does not compile");
    expect(at("/pattern", textField({ pattern: "x".repeat(201) }))).toHaveLength(1);
  });

  test("a field with a pattern holds at most 1,000 characters", () => {
    const [problem] = at("/maxLength", textField({ pattern: "^[^@]+@[^@]+$", maxLength: 5_000 }));
    expect(problem?.message).toContain("ticket");
    expect(problem?.message).toContain("1000");
    expect(at("/maxLength", textField({ pattern: "^a+$", maxLength: 1_000 }))).toEqual([]);
    expect(at("/maxLength", textField({ maxLength: 5_000 }))).toEqual([]);
  });

  test("the refusals name the inner item, two layouts deep", () => {
    const inner = textField({ pattern: "^(a+)+$", minLength: 50, maxLength: 40 }, "inner");
    const problems = problemsOf(group("outer", group("middle", inner)));
    const paths = problems.map((problem) => problem.path);
    expect(paths.some((path) => path.endsWith("/pattern"))).toBe(true);
    expect(paths.some((path) => path.endsWith("/minLength"))).toBe(true);
    for (const problem of problems) expect(problem.message).toContain("inner");
  });

  test("a prop the field does not take is refused, and each takes its own", () => {
    expect(
      at("/pattern", { type: "toggle", id: "t", props: { label: "T", pattern: "a" } }),
    ).toHaveLength(1);
    expect(
      at("/minLength", { type: "number-field", id: "n", props: { label: "N", minLength: 1 } }),
    ).toHaveLength(1);
    expect(
      problemsOf(
        { type: "toggle", id: "t", props: { label: "T", required: true } },
        { type: "number-field", id: "n", props: { label: "N", required: true } },
        { type: "money-field", id: "m", props: { label: "M", currency: "EUR", required: true } },
        { type: "date-field", id: "d", props: { label: "D", required: true } },
        textField({ required: true, minLength: 1, pattern: "^a$", maxLength: 10 }, "t2"),
      ),
    ).toEqual([]);
  });

  test("required is a boolean, minLength a whole number from 1 to 10,000 and pattern a text", () => {
    expect(at("/required", textField({ required: "yes" }))).toHaveLength(1);
    expect(at("/minLength", textField({ minLength: 0 }))).toHaveLength(1);
    expect(at("/minLength", textField({ minLength: 1.5 }))).toHaveLength(1);
    expect(at("/minLength", textField({ minLength: 10_001 }))).toHaveLength(1);
    expect(at("/pattern", textField({ pattern: 7 }))).toHaveLength(1);
    expect(at("/pattern", textField({ pattern: "" }))).toHaveLength(1);
  });

  test("an earlier ask, with no new prop, is accepted unchanged", () => {
    expect(
      problemsOf(textField({ maxLength: 80 }), {
        type: "number-field",
        id: "n",
        props: { label: "N", min: 0 },
      }),
    ).toEqual([]);
  });
});
