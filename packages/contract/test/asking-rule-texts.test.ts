// The asking-rule texts (askboard-skills, task 1.1; contract spec, "Asking-rule texts"): one
// agent-facing text for each rule of the closed set, in its order, for the skill that describes the
// rules to agents. The hook's predicate (`hooks`) is untouched.

import { describe, expect, test } from "bun:test";
import { ASKING_RULE_TEXTS, ASKING_RULES, WITH_REFERENCES_DESCRIPTION } from "../src/index.ts";

describe("the asking-rule texts", () => {
  test("hold one text for each rule of the closed set, in its order", () => {
    expect(Object.keys(ASKING_RULE_TEXTS)).toEqual([...ASKING_RULES]);
  });

  test("are non-empty, single-line and hold no undefined", () => {
    for (const rule of ASKING_RULES) {
      const text = ASKING_RULE_TEXTS[rule];
      expect(text.trim()).not.toBe("");
      expect(text).not.toContain("undefined");
      expect(text).not.toContain("\n");
    }
  });

  test("give the with-references rule the text that describes the hook's predicate", () => {
    expect(ASKING_RULE_TEXTS["with-references"]).toBe(WITH_REFERENCES_DESCRIPTION);
  });

  test("are frozen", () => {
    expect(Object.isFrozen(ASKING_RULE_TEXTS)).toBe(true);
  });

  test("give each rule a text of its own", () => {
    const texts = ASKING_RULES.map((rule) => ASKING_RULE_TEXTS[rule]);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
