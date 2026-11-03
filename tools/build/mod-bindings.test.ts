import { describe, expect, test } from "bun:test";
import { scan } from "./js-scan.ts";
import { constFunctionBindings, modBindingProblems } from "./mod-bindings.ts";

// The mod build's top-level function bindings (task 13.3; design decision 7, review fix of
// 2026-11-01): Claude Code's module check accepts `$` passed only to a function declaration or a
// const bound to a function at the top of the file, and Bun's bundler writes top-level bindings as
// `var`. The built module itself is checked in mod.test.ts.

describe("the scanner", () => {
  const texts = (source: string) => scan(source).tokens.map((token) => token.text);
  const depths = (source: string) => scan(source).tokens.map((token) => token.depth);

  test("skips comments and a hashbang, and keeps strings, numbers and punctuators whole", () => {
    expect(
      texts("#!/usr/bin/env node\n// one\nconst a = \"x;y\" + 'z'; /* two */ a >>>= 0x1F;"),
    ).toEqual(["const", "a", "=", '"x;y"', "+", "'z'", ";", "a", ">>>=", "0x1F", ";"]);
  });

  test("tells a regular expression from division by the token before it", () => {
    expect(scan("const r = /a[/]b/g.test(x) / 2; return /c/;").tokens.map((t) => t.kind)).toEqual([
      "name",
      "name",
      "punct",
      "regex",
      "punct",
      "name",
      "punct",
      "name",
      "punct",
      "punct",
      "number",
      "punct",
      "name",
      "regex",
      "punct",
    ]);
  });

  test("reads a template's substitutions as code, one level down", () => {
    const source = "const t = `a \u0024{f({ b: 1 })} c \u0024{d}`;";
    expect(texts(source)).toEqual([
      "const",
      "t",
      "=",
      "`a ${",
      "f",
      "(",
      "{",
      "b",
      ":",
      "1",
      "}",
      ")",
      "} c ${",
      "d",
      "}`",
      ";",
    ]);
    expect(depths(source)).toEqual([0, 0, 0, 0, 1, 1, 2, 3, 3, 3, 2, 1, 0, 1, 0, 0]);
  });

  test("pairs each bracket with its partner, and gives each token the opener it sits in", () => {
    const { tokens, partner } = scan("f(a, [b]);");
    expect(partner.get(1)).toBe(7);
    expect(partner.get(7)).toBe(1);
    expect(tokens.map((token) => token.parent)).toEqual([-1, -1, 1, 1, 1, 4, 1, -1, -1]);
  });

  test.each([
    ['"open', "an unterminated string"],
    ["`open \u0024{a}", "an unterminated template literal"],
    ["x = /open", "an unterminated regular expression"],
    ["f(a]", "an unmatched ]"],
    ["f(a", "left open"],
    ["a \\ b", "an unexpected character"],
  ])("refuses %j", (source, problem) => {
    expect(() => scan(source)).toThrow(problem);
  });
});

/** A small module of the shape Bun writes: top-level helpers as `var`, the hooks in `register`. */
const BUNDLED = `
var debug = ($, line) => {
  $.ui.log(line);
};
var start = async (memory, $) => {
  debug($, "start");
};
var LIMIT = 3;
var tick = function($) { return LIMIT; };
function register(on) {
  on("session.start", async ($, e, next) => {
    await start({}, $);
    return next(e);
  });
}
export { register };
`;

describe("binding the top-level functions with const", () => {
  test("rewrites each top-level var bound to a function, and leaves the others", () => {
    const { code, problems } = constFunctionBindings(BUNDLED);
    expect(problems).toEqual([]);
    expect(code).toContain("const debug = ($, line) =>");
    expect(code).toContain("const start = async (memory, $) =>");
    expect(code).toContain("const tick = function($)");
    expect(code).toContain("var LIMIT = 3;");
    expect(modBindingProblems(code)).toEqual([]);
  });

  test.each([
    ["an arrow of one parameter", "var f = x => x;", "const f = x => x;"],
    ["an async arrow of one parameter", "var f = async x => x;", "const f = async x => x;"],
    ["an async function", "var f = async function() {};", "const f = async function() {};"],
    [
      "functions alone, together",
      "var f = () => 1, g = () => 2;",
      "const f = () => 1, g = () => 2;",
    ],
  ])("rewrites %s", (_case, source, expected) => {
    expect(constFunctionBindings(source)).toEqual({ code: expected, problems: [] });
  });

  test("leaves a nested var, a parenthesised value and a function bound beside a value", () => {
    const source = "function f() { var g = () => 1; } var h = (1, 2); var i = () => 1, j = 2;";
    expect(constFunctionBindings(source).code).toBe(source);
  });

  test("keeps a var the module assigns again, in any scope, and the check refuses it", () => {
    const source =
      "var f = () => 1;\nvar g = () => 2;\nvar k = () => 4;\nfunction h() { f = () => 3; }\nk++;\n";
    const { code, problems } = constFunctionBindings(source);
    expect(problems).toEqual([]);
    expect(code).toBe(source.replace("var g", "const g"));
    expect(modBindingProblems(code)).toEqual([
      "the mod binds f to a function with a top-level var at line 1, not a const",
      "the mod binds k to a function with a top-level var at line 3, not a const",
    ]);
  });

  test("keeps a var whose name a parameter hides, and rewrites it", () => {
    const source = "var f = () => 1;\nfunction h(f) { f = 3; }\n";
    expect(constFunctionBindings(source).code).toBe(source.replace("var f", "const f"));
  });

  test("names a problem other than an assignment that Bun's parser finds", () => {
    const { problems } = constFunctionBindings("const a = 1;\na = 2;\nvar f = () => 1;\n");
    expect(problems).toEqual([
      'the mod does not parse: Cannot assign to "a" because it is a constant',
    ]);
  });
});

describe("the check of where $ is passed", () => {
  test("refuses a module that passes $ to a top-level var: the review's case", () => {
    expect(modBindingProblems(BUNDLED)).toEqual([
      "the mod binds debug to a function with a top-level var at line 2, not a const",
      "the mod binds start to a function with a top-level var at line 5, not a const",
      "the mod binds tick to a function with a top-level var at line 9, not a const",
      'the mod passes $ at line 6 to "debug", which is not a function declared at the top of the module (a function declaration, or a const bound to one)',
      'the mod passes $ at line 12 to "start", which is not a function declared at the top of the module (a function declaration, or a const bound to one)',
    ]);
  });

  test("passes a module that passes $ to function declarations and consts bound to functions", () => {
    const source = `
function debug($, line) { $.ui.log(line); }
const start = async (memory, $) => { debug($, "start"); };
export function register(on) {
  on("turn.step", async function* ($, e, next) { return yield* next(e); });
  on("session.start", async ($, e, next) => { await start({}, $); return next(e); });
}
`;
    expect(modBindingProblems(source)).toEqual([]);
  });

  test.each([
    ["a const bound to a value", "const f = g(1);\nf(1, $);", '"f"'],
    [
      "a name a nested declaration hides",
      "const f = () => 1;\nfunction h() { const f = 2; f($); }",
      '"f"',
    ],
    ["a name a parameter hides", "const f = () => 1;\nconst h = (f) => f($);", '"f"'],
    ["a name not declared", "missing($);", '"missing"'],
    ["a method", "const o = {};\no.f($);", "a callee that is not a name"],
    ["a call's result", "const f = () => () => 1;\nf()($);", "a callee that is not a name"],
  ])("refuses $ passed to %s", (_case, source, what) => {
    const problems = modBindingProblems(source);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`to ${what}, which is not a function declared at the top`);
  });

  test("ignores $ where it is no argument: parameters, members, groups and other names", () => {
    const source = `
function f($) { return $.ui; }
const g = ($ = 1) => ($, 2);
const h = { m($) {} };
if ($) { $.x($a, a$); }
`;
    expect(modBindingProblems(source)).toEqual([]);
  });
});
