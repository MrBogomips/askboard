// The safe-pattern check (form-widget, task 1.1; contract spec: Safe patterns; design decision 3):
// what a TextField's `pattern` may hold, decided in one pass over the pattern after a compile with
// the `u` flag, and what it says of each refusal.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  PATTERN_MAX_CHARS,
  PATTERN_MAX_REPEATS,
  PATTERN_TEXT_MAX_CHARS,
  patternProblem,
} from "../src/index.ts";

const accepted = (pattern: string) => expect(patternProblem(pattern)).toBeUndefined();
const refusedFor = (pattern: string, words: string) => {
  const problem = patternProblem(pattern);
  expect(problem).toBeString();
  expect(problem).toContain(words);
};

describe("the patterns inside the subset", () => {
  test.each([
    "^[A-Z][a-z]+$",
    "^\\+?\\d{6,15}$",
    "^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$",
    "^(?:[a-z0-9-]+\\.)?example\\.com$",
    "^(?<key>[A-Z]+)-\\d+$",
    "^(?:dev|test|prod)$",
    "[(+*)]",
  ])("accepts %s", (pattern) => accepted(pattern));

  test("accepts what a form needs of the u flag", () => {
    accepted("^\\p{L}+$");
    accepted("^\\u{1F600}+$");
    accepted("^[\\p{L}\\d]{1,20}$");
    accepted("^😀+$");
  });
});

describe("the patterns outside it", () => {
  test.each([
    ["(a)\\1", "backreference"],
    ["^(?<x>a)\\k<x>$", "backreference"],
    ["a(?=b)", "lookahead"],
    ["a(?!b)", "lookahead"],
    ["(?<=a)b", "lookbehind"],
    ["(?<!a)b", "lookbehind"],
    ["^(a+)+$", "repeated group"],
    ["^(\\d{2,})+$", "repeated group"],
    ["^((ab)*c)+$", "repeated group"],
    ["^(a|aa)*$", "repeated group"],
    ["^(?:x|y){2,}$", "repeated group"],
    ["(", "does not compile"],
  ])("refuses %s", (pattern, words) => refusedFor(pattern, words));
});

// The renderer spike's fixtures (spike-renderer, probe/pattern-check.ts): 8 accepted, 11 refused.
const SPIKE: readonly (readonly [string, string, boolean])[] = [
  ["f-name", "^[A-Z][a-z]+$", true],
  ["f-phone", "^\\d{3}-\\d{4}$", true],
  ["f-email", "^[\\w.+-]+@[\\w-]+\\.[a-z]{2,}$", true],
  ["f-host", "^(?:[a-z0-9-]+\\.)?example\\.org$", true],
  ["f-month", "^(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])$", true],
  ["f-choice", "^(?:red|green|blue)$", true],
  ["f-class", "^[(+*)\\]]+$", true],
  ["f-ticket", "^[A-Z]{2,5}-[0-9]+$", true],
  ["r-backref", "^(a)\\1$", false],
  ["r-named-backref", "^(?<x>a)\\k<x>$", false],
  ["r-lookahead", "^(?=.*\\d).+$", false],
  ["r-negative-lookahead", "^(?!admin$).*$", false],
  ["r-lookbehind", "(?<=\\$)\\d+", false],
  ["r-negative-lookbehind", "(?<!x)y", false],
  ["r-nested-plus", "^(a+)+$", false],
  ["r-nested-star", "^(?:\\w*\\s?)*$", false],
  ["r-nested-braces", "^(\\d{2,})+$", false],
  ["r-nested-deep", "^((ab)*c)+$", false],
  ["r-invalid", "^(abc$", false],
];

describe("the spike's 19 fixtures", () => {
  test("hold the spike's counts", () => {
    expect(SPIKE).toHaveLength(19);
    expect(SPIKE.filter(([, , accept]) => accept)).toHaveLength(8);
  });

  test.each(SPIKE)("%s gets its spike answer", (_id, pattern, accept) => {
    expect(patternProblem(pattern) === undefined).toBe(accept);
  });
});

describe("escaped and classed metacharacters", () => {
  test.each(["\\(", "\\|", "[|]", "[(]+", "[\\]*]", "^(?:\\(a\\))+$", "^(?:[|]a)+$"])(
    "%s is no group, alternation or quantifier",
    (pattern) => accepted(pattern),
  );

  test("a quantifier in a class does not make the group holding it repeat", () => {
    accepted("^(?:[+*]x)+$");
    accepted("^(?:\\+x)+$");
    accepted("^(?:\\{2,\\}x)+$");
  });

  test("an escaped parenthesis closes no group", () => {
    refusedFor("^(?:a+))+$", "does not compile");
    accepted("^(?:a\\)b)+$");
  });
});

describe("named groups and lookbehind", () => {
  test("a named group is accepted and a lookbehind refused", () => {
    accepted("(?<n>a)");
    refusedFor("(?<=a)", "lookbehind");
    refusedFor("(?<!a)", "lookbehind");
  });

  test("a repeated named group holding a quantifier is refused like any group", () => {
    refusedFor("^(?<n>a+)+$", "repeated group");
    accepted("^(?<n>a+)?$");
  });

  test("a modifier group is refused whether or not this engine compiles it", () => {
    refusedFor("(?i:a)", "group form");
    refusedFor("(?-i:a)", "group form");
    refusedFor("(?i-m:a)b", "group form");
    refusedFor("^(?s:a)$", "group form");
  });

  test("(?: and (?<name> stay inside the subset", () => {
    accepted("(?:a)");
    accepted("(?<name>a)");
    accepted("^(?<a>x)(?<b>y)$");
    accepted("^(?<a>x)(?:y)$");
  });

  test("a group name used twice is refused, in a row or in two branches", () => {
    refusedFor("(?<a>x)|(?<a>y)", "twice");
    // In one branch every engine refuses it at the compile; the check says so too.
    expect(patternProblem("^(?<a>x)(?<a>y)$")).toBeString();
    refusedFor("^(?:(?<a>x)|(?<a>y))$", "twice");
  });

  test("a group name spelled with an escape is refused, whatever it spells", () => {
    refusedFor("(?<\\u0061>x)|(?<a>y)", "escape");
  });
});

describe("lazy quantifiers", () => {
  test("a lazy marker is no second quantifier", () => {
    accepted("^a+?b*?c??d{2}?$");
    accepted("^(?:a+?)?b$");
    accepted("^(?:a+?){1}b$");
  });

  test("a group holding a lazy quantifier is still a group holding a quantifier", () => {
    refusedFor("^(?:a+?)*$", "repeated group");
    refusedFor("^(?:a+?)+?$", "repeated group");
    refusedFor("^(?:ab)*?(?:a*?)+$", "repeated group");
  });
});

describe("the repetitions a group may have", () => {
  test("?, {0} and {1} repeat nothing", () => {
    accepted("^(?:a+)?$");
    accepted("^(?:a+){0}$");
    accepted("^(?:a+){1}$");
    accepted("^(?:a|b)?$");
    accepted("^(?:a|b){0}$");
    accepted("^(?:a|b){1}$");
  });

  test("every other repetition of such a group is refused", () => {
    refusedFor("^(?:a+)*$", "repeated group");
    refusedFor("^(?:a+)+$", "repeated group");
    refusedFor("^(?:a+){2}$", "repeated group");
    refusedFor("^(?:a+){0,}$", "repeated group");
    refusedFor("^(?:a+){0,1}$", "repeated group");
    refusedFor("^(?:a|b)*$", "repeated group");
    refusedFor("^(?:a|b){3}$", "repeated group");
  });

  test("a repeated group that holds neither is accepted", () => {
    accepted("^(?:ab)*$");
    accepted("^(?:ab){2,5}$");
    accepted("^(ab)+$");
  });

  test("an inner group holding a quantifier or an alternation reaches the outer one", () => {
    refusedFor("^(?:(?:a|b)c)+$", "repeated group");
    refusedFor("^(?:(?:ab)*c)*$", "repeated group");
    refusedFor("^(?:(?:ab)?c)+$", "repeated group");
    refusedFor("^(?:x(?:y|z))*$", "repeated group");
    accepted("^(?:(?:a|b)c)?$");
    accepted("^(?:(?:ab)c)+$");
  });

  test("a quantifier after the repeated group is read once", () => {
    accepted("^(?:ab)?(?:b+)?$");
    refusedFor("^(?:a+)?(?:b|c)+$", "repeated group");
  });
});

describe("the cost budget", () => {
  const limit = `over the limit of ${PATTERN_MAX_REPEATS}`;

  test("the budget is 3", () => {
    expect(PATTERN_MAX_REPEATS).toBe(3);
  });

  test.each([
    ["^\\d*\\d*\\d*\\d*$", 4],
    ["\\d+\\d+\\d+x", 4],
    ["^(?:a|a)(?:a|a)(?:a|a)(?:a|a)$", 4],
    ["a?a?a?a?", 5],
  ] as const)("refuses %s, naming %p repetitions and the limit", (pattern, count) => {
    refusedFor(pattern, `costs ${count} repetitions`);
    refusedFor(pattern, limit);
  });

  test("refuses the unrolled shapes of the review, at their length", () => {
    refusedFor(`^${"\\d*".repeat(60)}$`, "costs 60 repetitions");
    refusedFor(`^${"(a|a)".repeat(30)}$`, "costs 30 repetitions");
  });

  test("accepts what spends exactly 3", () => {
    accepted("^\\d*\\d*\\d*$");
    accepted("\\d+\\d+x");
    accepted("^(?:a|a)(?:b|b)(?:c|c)$");
    accepted("^a?a?a?$");
    accepted("^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$");
    accepted("^(?:[a-z0-9-]+\\.)?[a-z0-9-]+$");
  });

  test("a pattern with no leading ^ pays one more", () => {
    accepted("^a*b*c*$");
    refusedFor("a*b*c*$", "costs 4");
    accepted("a*b*");
    refusedFor("a*b*c*", "costs 4");
    refusedFor("(?:^a*b*c*)$", "costs 4");
  });

  test("a group pays for its | and for its own quantifier, once each", () => {
    accepted("^(?:a|b)$");
    accepted("^(?:a|b|c|d|e|f|g|h|i|j)$");
    accepted("^(?:a|b)?c*$");
    refusedFor("^(?:a|b)?c*d*$", "costs 4");
    refusedFor("^(?:a|b)(?:c|d)(?:e|f)(?:g|h)$", "costs 4");
    refusedFor("^(?:(?:a|b)|(?:c|d))(?:e|f)(?:g|h)$", "costs 5");
  });

  test("a top-level | costs one, once", () => {
    accepted("^a$|^b$");
    refusedFor("^a*b*|c*$", "costs 4");
    refusedFor("^a|b|c|d*e*f*$", "costs 4");
  });

  test("a braced quantifier costs only when its count can vary", () => {
    accepted("^a{3}a{3}a{3}a{3}a{3}$");
    accepted("^a{2,2}a{2,2}a{2,2}a{2,2}$");
    accepted("^a{0}a{1}a{0,0}a{4}$");
    refusedFor("^a{2,3}a{2,3}a{2,3}a{2,3}$", "costs 4");
    refusedFor("^a{2,}a{2,}a{2,}a{2,}$", "costs 4");
    refusedFor("^a{0,1}a{0,1}a{0,1}a{0,1}$", "costs 4");
  });

  test("a lazy marker is no second quantifier", () => {
    accepted("^a*?b+?c??$");
    refusedFor("^a*?b+?c??d*?$", "costs 4");
  });

  test("escaped and classed metacharacters cost nothing", () => {
    accepted("^\\*\\+\\?\\|\\{2,\\}[*+?|]x$");
    accepted("^[*+?]*[*+?]*[*+?]*$");
    accepted("^\\(a\\)\\|\\p{L}{1,}$");
  });

  test("a quantifier on a group is read once, whatever the group holds", () => {
    accepted("^(?:ab)*(?:cd)*(?:ef)*$");
    refusedFor("^(?:ab)*(?:cd)*(?:ef)*(?:gh)*$", "costs 4");
  });

  test("the empty pattern pays only for the missing ^", () => {
    accepted("");
  });
});

describe("the bounds on the pattern", () => {
  test("a pattern of 200 code points is accepted, 201 is refused", () => {
    accepted("a".repeat(PATTERN_MAX_CHARS));
    refusedFor("a".repeat(PATTERN_MAX_CHARS + 1), `${PATTERN_MAX_CHARS}`);
  });

  test("code points count, not UTF-16 units", () => {
    accepted("😀".repeat(PATTERN_MAX_CHARS));
    refusedFor("😀".repeat(PATTERN_MAX_CHARS + 1), `${PATTERN_MAX_CHARS}`);
    accepted(`${"😀".repeat(100)}${"a".repeat(100)}`);
    refusedFor(`${"😀".repeat(100)}${"a".repeat(101)}`, `${PATTERN_MAX_CHARS}`);
  });

  test("the limits are the specified ones", () => {
    expect(PATTERN_MAX_CHARS).toBe(200);
    expect(PATTERN_TEXT_MAX_CHARS).toBe(100);
  });
});

describe("names that are not patterns", () => {
  test("__proto__ and constructor are patterns like any other text", () => {
    accepted("__proto__");
    accepted("^constructor$");
    accepted("^(?<__proto__>a)$");
  });

  test("an empty pattern compiles and is accepted", () => {
    accepted("");
  });
});

describe("the check is one pass", () => {
  test("a 200-character pattern is checked in under 5 ms", () => {
    const worst = `^${"(?:ab)".repeat(33)}`;
    expect(Array.from(worst).length).toBeLessThanOrEqual(PATTERN_MAX_CHARS);
    patternProblem(worst);
    const started = performance.now();
    for (let each = 0; each < 20; each += 1) patternProblem(worst);
    expect((performance.now() - started) / 20).toBeLessThan(5);
  });

  test("a deeply nested pattern is checked in under 5 ms", () => {
    const nested = `^${"(?:".repeat(39)}a${")".repeat(39)}$`;
    expect(Array.from(nested).length).toBeLessThanOrEqual(PATTERN_MAX_CHARS);
    const started = performance.now();
    expect(patternProblem(nested)).toBeUndefined();
    expect(performance.now() - started).toBeLessThan(5);
  });

  test("the module builds no RegExp but the compile check and runs no pattern", () => {
    const text = readFileSync(new URL("../src/widgets/shared/pattern.ts", import.meta.url), "utf8");
    const code = text
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(code.match(/RegExp/g) ?? []).toHaveLength(1);
    expect(code).toContain('new RegExp(pattern, "u")');
    for (const call of [".test(", ".exec(", ".match(", ".matchAll(", ".search(", ".replace("]) {
      expect(code).not.toContain(call);
    }
  });
});
