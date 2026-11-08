// The outcome memo of the TextField's pattern check (form-widget, task 3.5; design decision 3: one
// pattern run per keystroke at most). Runs are counted through the module's own seam, never through
// `RegExp.prototype`.

import { beforeEach, describe, expect, test } from "bun:test";
import { textFieldPatternFailure } from "../src/index.ts";
import {
  clearPatternOutcomes,
  PATTERN_OUTCOMES_MAX,
  patternRunCount,
} from "../src/widgets/text-field/checks.ts";

const props = (pattern: string, extra: Record<string, unknown> = {}) => ({
  label: "Ticket",
  pattern,
  ...extra,
});

beforeEach(clearPatternOutcomes);

describe("the outcome of a pattern check is kept", () => {
  test("four calls with the same pattern and text run the pattern once; a changed text runs it once more", () => {
    const field = props("^[A-Z]{2}-\\d{4}$");
    const before = patternRunCount();
    for (let call = 0; call < 4; call += 1) {
      expect(textFieldPatternFailure("AB-1234", field)).toBeUndefined();
    }
    expect(patternRunCount() - before).toBe(1);
    for (let call = 0; call < 4; call += 1) {
      expect(textFieldPatternFailure("AB-123", field)).toEqual({ code: "pattern" });
    }
    expect(patternRunCount() - before).toBe(2);
  });

  test("a verdict that failed is kept like one that passed, and never turns", () => {
    const field = props("^a+$");
    expect(textFieldPatternFailure("b", field)).toEqual({ code: "pattern" });
    expect(textFieldPatternFailure("b", field)).toEqual({ code: "pattern" });
    expect(textFieldPatternFailure("a", field)).toBeUndefined();
    expect(textFieldPatternFailure("a", field)).toBeUndefined();
  });

  test("the same text under another pattern is another entry", () => {
    const before = patternRunCount();
    expect(textFieldPatternFailure("a", props("^a$"))).toBeUndefined();
    expect(textFieldPatternFailure("a", props("^b$"))).toEqual({ code: "pattern" });
    expect(patternRunCount() - before).toBe(2);
  });

  test("a pattern that ends where another text begins is not confused with it", () => {
    // The key is length-prefixed, so ("a", "bc") and ("ab", "c") are two entries.
    expect(textFieldPatternFailure("a", props("b|a"))).toBeUndefined();
    expect(textFieldPatternFailure("a", props("b"))).toEqual({ code: "pattern" });
    expect(textFieldPatternFailure("ba", props("b"))).toBeUndefined();
    expect(textFieldPatternFailure("a", props("ba"))).toEqual({ code: "pattern" });
    expect(textFieldPatternFailure("ab", props("b"))).toBeUndefined();
  });

  test("a pattern that does not compile fails and is kept", () => {
    const before = patternRunCount();
    expect(textFieldPatternFailure("abc", props("("))).toEqual({ code: "pattern" });
    expect(textFieldPatternFailure("abc", props("("))).toEqual({ code: "pattern" });
    expect(patternRunCount() - before).toBe(0);
  });

  test("a text over the limit never reaches the pattern or the memo", () => {
    const before = patternRunCount();
    const text = "a".repeat(101);
    expect(textFieldPatternFailure(text, props("^a+$"))).toEqual({ code: "pattern" });
    expect(textFieldPatternFailure(text, props("^a+$"))).toEqual({ code: "pattern" });
    expect(patternRunCount() - before).toBe(0);
  });

  test("keys that are names of an object's own members are text like any other", () => {
    for (const name of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(textFieldPatternFailure(name, props(`^${name}$`))).toBeUndefined();
      expect(textFieldPatternFailure(name, props(`^${name}$`))).toBeUndefined();
      expect(textFieldPatternFailure("other", props(`^${name}$`))).toEqual({ code: "pattern" });
    }
  });
});

describe("the memo is bounded", () => {
  test("at most PATTERN_OUTCOMES_MAX entries: the oldest used goes first", () => {
    expect(PATTERN_OUTCOMES_MAX).toBeLessThanOrEqual(64);
    const field = props("^x\\d+$");
    const texts = Array.from({ length: PATTERN_OUTCOMES_MAX + 1 }, (_, at) => `x${at}`);
    for (const text of texts) textFieldPatternFailure(text, field);
    const before = patternRunCount();
    // The newest is still kept ...
    textFieldPatternFailure(texts[texts.length - 1] as string, field);
    expect(patternRunCount() - before).toBe(0);
    // ... the oldest was dropped and runs again.
    textFieldPatternFailure(texts[0] as string, field);
    expect(patternRunCount() - before).toBe(1);
  });

  test("a use keeps an entry: the least recently used is the one dropped", () => {
    const field = props("^x\\d+$");
    for (let at = 0; at < PATTERN_OUTCOMES_MAX; at += 1) textFieldPatternFailure(`x${at}`, field);
    textFieldPatternFailure("x0", field); // x0 is now the newest
    textFieldPatternFailure("x-new", field); // drops x1
    const before = patternRunCount();
    textFieldPatternFailure("x0", field);
    expect(patternRunCount() - before).toBe(0);
    textFieldPatternFailure("x1", field);
    expect(patternRunCount() - before).toBe(1);
  });

  test("a stream of distinct texts keeps the verdicts right", () => {
    const field = props("^x\\d+$");
    for (let at = 0; at < PATTERN_OUTCOMES_MAX * 3; at += 1) {
      expect(textFieldPatternFailure(`x${at}`, field)).toBeUndefined();
      expect(textFieldPatternFailure(`y${at}`, field)).toEqual({ code: "pattern" });
    }
  });
});

describe("the last outcome of each field is kept with its props object (review X-1)", () => {
  // Past the memo's capacity, with a count the agent chooses: 200 fields, each with a pattern and
  // a text of its own, read in the same order again and again (a cyclic scan misses every time in
  // a memo one entry too small).
  const FIELDS = 200;
  const fields = Array.from({ length: FIELDS }, (_, at) => props(`^f${at}-\\d+$`));
  const textOf = (at: number) => `f${at}-1`;
  const readAll = () => {
    for (let at = 0; at < FIELDS; at += 1) {
      expect(textFieldPatternFailure(textOf(at), fields[at])).toBeUndefined();
    }
  };

  test("200 fields read four times run each pattern once", () => {
    const before = patternRunCount();
    readAll();
    expect(patternRunCount() - before).toBe(FIELDS);
    for (let pass = 0; pass < 3; pass += 1) readAll();
    expect(patternRunCount() - before).toBe(FIELDS);
  });

  test("a keystroke in one of 200 fields runs one pattern, and the next read of all runs none", () => {
    readAll();
    const before = patternRunCount();
    expect(textFieldPatternFailure("f7-x", fields[7])).toEqual({ code: "pattern" });
    for (let at = 0; at < FIELDS; at += 1) {
      const text = at === 7 ? "f7-x" : textOf(at);
      textFieldPatternFailure(text, fields[at]);
    }
    expect(patternRunCount() - before).toBe(1);
  });

  test("a props object whose pattern changed under the same identity is run again", () => {
    const field = props("^a$");
    expect(textFieldPatternFailure("a", field)).toBeUndefined();
    field.pattern = "^b$";
    expect(textFieldPatternFailure("a", field)).toEqual({ code: "pattern" });
  });

  test("a pattern that does not compile is kept with its object and never run", () => {
    const field = props("(");
    const before = patternRunCount();
    for (let pass = 0; pass < 3; pass += 1) {
      expect(textFieldPatternFailure("abc", field)).toEqual({ code: "pattern" });
    }
    expect(patternRunCount() - before).toBe(0);
  });

  test("a text over the limit still fails without a run, whatever the object kept", () => {
    const field = props("^a+$");
    expect(textFieldPatternFailure("aaa", field)).toBeUndefined();
    const before = patternRunCount();
    expect(textFieldPatternFailure("a".repeat(101), field)).toEqual({ code: "pattern" });
    expect(patternRunCount() - before).toBe(0);
    expect(textFieldPatternFailure("aaa", field)).toBeUndefined();
  });

  test("equal props in another object still share the bounded memo", () => {
    const before = patternRunCount();
    expect(textFieldPatternFailure("a", props("^a$"))).toBeUndefined();
    expect(textFieldPatternFailure("a", props("^a$"))).toBeUndefined();
    expect(patternRunCount() - before).toBe(1);
  });
});
