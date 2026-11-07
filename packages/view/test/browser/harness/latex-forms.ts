// The LaTeX forms task 4.15 measures beyond task 4.10's seventeen constructs (latex-kanban-timeline,
// design decision 7, Measuring): the infix forms, the hidden-opener forms, environments and a
// style-wrapped form; every control word with arguments, nested in each argument position in turn
// (its other arguments `x`); flat content past 2,000 code points; and the realistic set. Each nest is
// a `Construct` of `latex-fixtures.ts`, so the sweep treats them all alike. No browser here.

import { readFileSync } from "node:fs";
import { type Construct, construct, nestAlone } from "./latex-fixtures.ts";
import type { Measurer } from "./latex-measure.ts";

/** The infix forms: an infix inside a level adds a level of the scan's count (task 4.13). */
export const INFIX_CONSTRUCTS: readonly Construct[] = [
  construct("\\frac{ \\over y}{x}", "\\frac{", "\\over y}{x}", 2),
  construct("\\frac{ \\atop y}{x}", "\\frac{", "\\atop y}{x}", 2),
  construct("\\frac{ \\above1pt y}{x}", "\\frac{", "\\above1pt y}{x}", 2),
  construct("{ \\choose x}", "{", "\\choose x}", 2),
  construct("{ \\brace x}", "{", "\\brace x}", 2),
  construct("{ \\brack x}", "{", "\\brack x}", 2),
  construct("\\boxed{ \\over y}", "\\boxed{", "\\over y}", 2),
  construct("\\sqrt{ \\over y}", "\\sqrt{", "\\over y}", 2),
  construct("\\left( \\over y\\right)", "\\left(", "\\over y\\right)", 2),
];

/** The openers a character code or `\show` hides from a reader that takes the next token (task 4.13). */
export const HIDDEN_CONSTRUCTS: readonly Construct[] = [
  construct("\\char` { \\over}", "\\char` {", "\\over}", 2),
  construct("\\char`<LF>{ \\over}", "\\char`\n{", "\\over}", 2),
  construct("\\show%<LF> { \\over}", "\\show%\n {", "\\over}", 2),
];

/** The environments of the realistic set, a cell holding the next level. */
export const ENVIRONMENT_CONSTRUCTS: readonly Construct[] = [
  construct("\\begin{matrix}", "\\begin{matrix}", "\\end{matrix}"),
  construct("\\begin{pmatrix}", "\\begin{pmatrix}", "\\end{pmatrix}"),
  construct("\\begin{array}{c}", "\\begin{array}{c}", "\\end{array}", 1, 1),
  construct("\\begin{aligned}", "\\begin{aligned}", "\\end{aligned}"),
  construct("\\begin{cases}", "\\begin{cases}", "\\end{cases}"),
];

/** Free style commands wrapped around each level (the review's form). */
export const STYLE_CONSTRUCTS: readonly Construct[] = [
  construct(
    "\\frac{\\displaystyle\\color{red}\\Huge }{x}",
    "\\frac{\\displaystyle\\color{red}\\Huge ",
    "}{x}",
    1,
    1,
  ),
];

/** Task 4.15's constructs that are not control words, after task 4.10's seventeen. */
export const EXTRA_CONSTRUCTS: readonly Construct[] = [
  ...INFIX_CONSTRUCTS,
  ...HIDDEN_CONSTRUCTS,
  ...ENVIRONMENT_CONSTRUCTS,
  ...STYLE_CONSTRUCTS,
];

/** Control words whose arguments are not all `x`: the arguments before the nested one, spelled out. */
const SPECIAL_ARGUMENTS: Readonly<Record<string, readonly { prefix: string; suffix: string }[]>> = {
  "\\textcolor": [{ prefix: "{red}", suffix: "" }],
  "\\colorbox": [{ prefix: "{red}", suffix: "" }],
  "\\fcolorbox": [{ prefix: "{red}{blue}", suffix: "" }],
  "\\raisebox": [{ prefix: "{1pt}", suffix: "" }],
  "\\genfrac": [
    { prefix: "(){1pt}{}", suffix: "{x}" },
    { prefix: "(){1pt}{}{x}", suffix: "" },
  ],
};

/** Words whose first argument is optional, with the text the probe puts in it. */
const OPTIONAL_ARGUMENT: Readonly<Record<string, string>> = { "\\sqrt": "3", "\\smash": "t" };

/**
 * The words with an optional first argument in KaTeX's source: `\\sqrt`, `\\smash` and the extensible
 * arrows (the `xArrow` function's names).
 */
export const optionalArgumentWords = (katexModule: string): ReadonlySet<string> => {
  const source = readFileSync(katexModule, "utf8");
  const block = /type: "xArrow",\s*names: \[([^\]]*)\]/.exec(source)?.[1] ?? "";
  const arrows = [...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(
    ([, body]) => JSON.parse(`"${body}"`) as string,
  );
  return new Set([...Object.keys(OPTIONAL_ARGUMENT), ...arrows]);
};

const wordForm = (word: string, label: string, open: string, close: string): Construct =>
  construct(`${word} ${label}`, open, close);

// The forms of one word: each required argument in turn, the optional one, and the special forms.
const formsOf = (word: string, arity: number, optional: ReadonlySet<string>): Construct[] => {
  const forms: Construct[] = [];
  const special = SPECIAL_ARGUMENTS[word];
  if (special !== undefined) {
    for (const { prefix, suffix } of special)
      forms.push(wordForm(word, `${prefix}{ }${suffix}`, `${word}${prefix}{`, `}${suffix}`));
    return forms;
  }
  for (let at = 0; at < arity; at += 1) {
    forms.push(
      wordForm(
        word,
        `arg ${at + 1} of ${arity}`,
        `${word}${"{x}".repeat(at)}{`,
        `}${"{x}".repeat(arity - 1 - at)}`,
      ),
    );
  }
  if (optional.has(word)) {
    const optional = OPTIONAL_ARGUMENT[word] ?? "x";
    forms.push(wordForm(word, `optional ${optional}`, `${word}[{`, "}]{x}"));
    forms.push(wordForm(word, `after [${optional}]`, `${word}[${optional}]{`, "}"));
  }
  return forms;
};

/** Words that print to the console and draw nothing, which no nest can deepen. */
const SILENT_WORDS = new Set(["\\message", "\\errmessage", "\\show"]);

/**
 * The arity of a control word: the fewest `{x}` after it that KaTeX builds a tree for, from 0 to 6,
 * or `undefined` when none does (a word taking a delimiter, a size or a name).
 */
export const arityOf = (word: string, measure: Measurer): number | undefined => {
  for (let count = 0; count <= 6; count += 1) {
    if (measure(`${word}${"{x}".repeat(count)}`).parses) return count;
  }
  return undefined;
};

/** A word's nests that KaTeX builds a tree for with two levels: the form must parse to be timed. */
const parsing = (forms: readonly Construct[], measure: Measurer): Construct[] =>
  forms.filter((form) => measure(nestAlone(form, 2 * form.levelDepth)).parses);

/**
 * Every control word with arguments, in each argument position (and its optional argument, and the
 * special forms of a word that needs a colour, a size or delimiters), as the nests KaTeX parses.
 * `skipped` lists the words with no argument and those with no parsing form.
 */
export const controlWordConstructs = (
  words: readonly string[],
  measure: Measurer,
  optional: ReadonlySet<string>,
): { readonly forms: Construct[]; readonly skipped: string[] } => {
  const forms: Construct[] = [];
  const skipped: string[] = [];
  for (const word of words) {
    if (word.includes("@") || SILENT_WORDS.has(word)) continue;
    const arity = word in SPECIAL_ARGUMENTS ? 1 : arityOf(word, measure);
    const own =
      arity === undefined || arity === 0 ? [] : parsing(formsOf(word, arity, optional), measure);
    if (own.length === 0) skipped.push(word);
    forms.push(...own);
  }
  return { forms, skipped };
};

/** Kinds of flat content: no nest, only width. */
export type FlatKind = "x" | "\\le" | "matrix of a cells" | "\\frac{a}{b}";

export const FLAT_KINDS: readonly FlatKind[] = ["x", "\\le", "matrix of a cells", "\\frac{a}{b}"];

/** The sizes the flat sweep grows through, in code points of source. */
export const FLAT_SIZES: readonly number[] = [
  1_000, 2_000, 3_000, 4_000, 6_000, 8_000, 12_000, 16_000, 24_000, 32_000, 48_000, 64_000,
];

const MATRIX_COLUMNS = 20;

/** A `matrix` of `rows` rows of `columns` cells `a`. */
export const matrixOf = (rows: number, columns: number): string => {
  const row = `${"a&".repeat(columns - 1)}a`;
  return `\\begin{matrix}${Array.from({ length: rows }, () => row).join("\\\\")}\\end{matrix}`;
};

/** Flat content of about `size` code points (a whole number of its unit, at least one). */
export const flatFixture = (kind: FlatKind, size: number): string => {
  switch (kind) {
    case "x":
      return "x".repeat(size);
    case "\\le":
      return "\\le".repeat(Math.max(1, Math.floor(size / 3)));
    case "\\frac{a}{b}":
      return "\\frac{a}{b}".repeat(Math.max(1, Math.floor(size / 11)));
    case "matrix of a cells":
      return matrixOf(Math.max(1, Math.floor(size / (MATRIX_COLUMNS * 2 + 1))), MATRIX_COLUMNS);
  }
};

const rowsOf = (count: number, row: (at: number) => string): string =>
  Array.from({ length: count }, (_, at) => row(at + 1)).join("\\\\");

/** The realistic set (design decision 7, rule 4): a form must pass the scan and both bounds. */
export const REALISTIC: readonly { readonly name: string; readonly expression: string }[] = [
  { name: "the skill's example", expression: "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" },
  {
    name: "\\cfrac nested five deep",
    expression:
      "a_0 + \\cfrac{1}{a_1 + \\cfrac{1}{a_2 + \\cfrac{1}{a_3 + \\cfrac{1}{a_4 + \\cfrac{1}{a_5}}}}}",
  },
  {
    name: "a 3x3 pmatrix of fractions",
    expression: `\\begin{pmatrix}${rowsOf(3, () => "\\frac{a}{b}&\\frac{a}{b}&\\frac{a}{b}")}\\end{pmatrix}`,
  },
  {
    name: "an aligned environment of 10 rows",
    expression: `\\begin{aligned}${rowsOf(10, (at) => `f_{${at}}(x) &= \\frac{x^2 + ${at}}{${at} + 1} + \\sqrt{x}`)}\\end{aligned}`,
  },
  {
    name: "a sum with limits",
    expression: "\\sum_{i=1}^{n}\\frac{1}{i^2}=\\frac{\\pi^2}{6}",
  },
  {
    name: "the Gaussian integral",
    expression: "\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}",
  },
  { name: "2,000 glyphs", expression: flatFixture("x", 2_000) },
  { name: "666 \\le", expression: "\\le".repeat(666) },
  { name: "a matrix of 400 cells", expression: matrixOf(20, 20) },
];
