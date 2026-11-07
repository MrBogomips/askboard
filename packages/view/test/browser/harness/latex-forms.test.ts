import { beforeAll, describe, expect, test } from "bun:test";
import { LATEX_EXPRESSION_MAX_CHARS } from "@askboard/contract";
import {
  depthOfFixture,
  fixtureFor,
  katexControlWords,
  nestControlWord,
  SHAPES,
} from "./latex-fixtures.ts";
import {
  arityOf,
  controlWordConstructs,
  ENVIRONMENT_CONSTRUCTS,
  EXTRA_CONSTRUCTS,
  FLAT_KINDS,
  FLAT_SIZES,
  flatFixture,
  HIDDEN_CONSTRUCTS,
  INFIX_CONSTRUCTS,
  matrixOf,
  optionalArgumentWords,
  REALISTIC,
  STYLE_CONSTRUCTS,
} from "./latex-forms.ts";
import { LATEX_SOURCES, loadMeasurer, type Measurer } from "./latex-measure.ts";

const DEPTHS = [4, 5, 9, 14, 23];

let measure: Measurer;
let forms: ReturnType<typeof controlWordConstructs>;
let optional: ReadonlySet<string>;

beforeAll(async () => {
  measure = await loadMeasurer();
  optional = optionalArgumentWords(LATEX_SOURCES.katex);
  forms = controlWordConstructs(katexControlWords(LATEX_SOURCES.katex), measure, optional);
});

describe("the measurer", () => {
  test("gives the scan's depth and the output tree's size, pinned on KaTeX 0.19.1", () => {
    expect(measure("x")).toMatchObject({ scanDepth: 0, parses: true, treeDepth: 8, nodes: 14 });
    expect(measure("\\frac{x}{x}")).toMatchObject({ scanDepth: 1, parses: true });
  });

  test("says why KaTeX builds no tree, and what the scan refuses", () => {
    const open = measure("\\frac{1}{");
    expect(open.parses).toBe(false);
    expect(open.error).toContain("KaTeX parse error");
    expect(open.treeDepth).toBeUndefined();
    expect(measure("\\def\\a{x}\\a").refused).toBe("\\def");
  });

  test("keeps the console quiet for the words that print", () => {
    expect(measure("\\show\\a").scanDepth).toBe(0);
  });
});

describe("the constructs of task 4.15", () => {
  test("nine infix forms, three hidden-opener forms, five environments and one style form", () => {
    expect(INFIX_CONSTRUCTS).toHaveLength(9);
    expect(HIDDEN_CONSTRUCTS).toHaveLength(3);
    expect(ENVIRONMENT_CONSTRUCTS).toHaveLength(5);
    expect(STYLE_CONSTRUCTS).toHaveLength(1);
    expect(new Set(EXTRA_CONSTRUCTS.map(({ name }) => name)).size).toBe(EXTRA_CONSTRUCTS.length);
  });

  for (const c of EXTRA_CONSTRUCTS) {
    test(`${c.name}: every shape at every depth reads as that depth, fits the limit and parses`, () => {
      for (const shape of SHAPES) {
        for (const depth of DEPTHS) {
          const expression = fixtureFor(c, shape, depth);
          expect([...expression].length, `${shape} ${depth}`).toBeLessThanOrEqual(
            LATEX_EXPRESSION_MAX_CHARS,
          );
          expect(depthOfFixture(expression), `${shape} ${depth}`).toBe(depth);
          expect(measure(expression).parses, `${shape} ${depth}`).toBe(true);
        }
      }
    });
  }
});

describe("control words in each argument position", () => {
  test("nestControlWord puts the nest in the position asked, the other arguments x", () => {
    expect(nestControlWord("\\dfrac", 2, 0, 2)).toBe("\\dfrac{\\dfrac{x}{x}}{x}");
    expect(nestControlWord("\\dfrac", 2, 1, 2)).toBe("\\dfrac{x}{\\dfrac{x}{x}}");
    expect(nestControlWord("\\frac", 3)).toBe("\\frac{\\frac{\\frac{x}}}");
  });

  test("the arity is the fewest {x} that make a tree, and a word with no form has none", () => {
    expect(arityOf("\\frac", measure)).toBe(2);
    expect(arityOf("\\fcolorbox", measure)).toBe(3);
    expect(arityOf("\\hat", measure)).toBe(1);
    expect(arityOf("\\KaTeX", measure)).toBe(0);
    expect(arityOf("\\left", measure)).toBeUndefined();
  });

  test("the optional-argument words come from KaTeX's source", () => {
    expect(optional.has("\\xrightarrow")).toBe(true);
    expect(optional.has("\\sqrt")).toBe(true);
    expect(optional.has("\\smash")).toBe(true);
    expect(optional.has("\\xcancel")).toBe(false);
  });

  test("the forms hold the words the task names, each in its positions", () => {
    const names = new Set(forms.forms.map(({ name }) => name));
    expect(names.size).toBe(forms.forms.length);
    for (const name of [
      "\\dfrac arg 1 of 2",
      "\\dfrac arg 2 of 2",
      "\\tfrac arg 2 of 2",
      "\\cfrac arg 1 of 2",
      "\\overset arg 1 of 2",
      "\\underset arg 2 of 2",
      "\\textcolor {red}{ }",
      "\\colorbox {red}{ }",
      "\\fcolorbox {red}{blue}{ }",
      "\\raisebox {1pt}{ }",
      "\\genfrac (){1pt}{}{ }{x}",
      "\\genfrac (){1pt}{}{x}{ }",
      "\\xrightarrow optional x",
      "\\xrightarrow after [x]",
      "\\sqrt optional 3",
      "\\sqrt after [3]",
      "\\hat arg 1 of 1",
    ]) {
      expect(names.has(name), name).toBe(true);
    }
  });

  test("no word with an @, none that defines a macro and none of the silent ones is nested", () => {
    for (const { name } of forms.forms) {
      expect(name, name).not.toContain("@");
      expect(name, name).not.toMatch(/^\\(def|gdef|let|newcommand|show|message|errmessage) /);
    }
    expect(forms.skipped).toContain("\\KaTeX");
    expect(forms.skipped).toContain("\\left");
  });

  test("every form reads as the depth asked in every shape and parses", () => {
    expect(forms.forms.length).toBeGreaterThan(200);
    for (const c of forms.forms) {
      for (const shape of SHAPES) {
        for (const depth of [4, 9, 14]) {
          const expression = fixtureFor(c, shape, depth);
          expect([...expression].length, `${c.name} ${shape} ${depth}`).toBeLessThanOrEqual(
            LATEX_EXPRESSION_MAX_CHARS,
          );
          expect(depthOfFixture(expression), `${c.name} ${shape} ${depth}`).toBe(depth);
        }
      }
      expect(measure(fixtureFor(c, "alone", 6)).parses, c.name).toBe(true);
    }
  });
});

describe("flat content and the realistic set", () => {
  test("flat content grows in steps from 1,000 code points", () => {
    expect(FLAT_SIZES[0]).toBe(1_000);
    expect(FLAT_SIZES.every((size, at) => at === 0 || size > (FLAT_SIZES[at - 1] ?? 0))).toBe(true);
    expect(FLAT_KINDS).toEqual(["x", "\\le", "matrix of a cells", "\\frac{a}{b}"]);
  });

  test("each kind is about the size asked, and parses where KaTeX can", () => {
    expect(flatFixture("x", 2_000)).toHaveLength(2_000);
    expect(flatFixture("\\le", 1_998)).toBe("\\le".repeat(666));
    expect(flatFixture("\\frac{a}{b}", 2_000)).toBe("\\frac{a}{b}".repeat(181));
    expect([...flatFixture("matrix of a cells", 2_000)].length).toBeLessThan(2_100);
    expect(flatFixture("\\le", 1)).toBe("\\le");
    for (const kind of FLAT_KINDS) {
      expect(measure(flatFixture(kind, 2_000)).parses, kind).toBe(true);
    }
  });

  test("\\le is a symbol, not a macro: 64,000 code points of it count no expansion", () => {
    expect(measure(flatFixture("\\le", 64_000)).parses).toBe(true);
  });

  test("a matrix holds rows of cells", () => {
    expect(matrixOf(2, 3)).toBe("\\begin{matrix}a&a&a\\\\a&a&a\\end{matrix}");
  });

  test("the realistic set is the nine forms the task names, each parsed and none refused", () => {
    expect(REALISTIC.map(({ name }) => name)).toHaveLength(9);
    expect(REALISTIC[0]?.expression).toBe("x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}");
    for (const { name, expression } of REALISTIC) {
      const m = measure(expression);
      expect(m.parses, name).toBe(true);
      expect(m.refused, name).toBeUndefined();
      expect([...expression].length, name).toBeLessThanOrEqual(LATEX_EXPRESSION_MAX_CHARS);
    }
    expect(measure(matrixOf(20, 20)).nodes).toBeGreaterThan(3_000);
  });
});
