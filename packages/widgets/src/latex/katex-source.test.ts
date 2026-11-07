// KaTeX's source, read as the board relies on it (latex-kanban-timeline, tasks 4.5, 4.8, 4.9, 4.13
// and 4.14; design decisions 3 and 7). Each guard reads the pinned `katex.mjs` (0.19.1) or what KaTeX
// draws from it, so that a bump of KaTeX fails here and its lists, counts and lines are re-read. The
// guards moved out of `render.test.ts` in task 4.20, with no change of behaviour.

import { describe, expect, spyOn, test } from "bun:test";
import {
  LATEX_DEFINING_COMMANDS,
  LATEX_INFIX_COMMANDS,
  LATEX_LEVEL_CLOSERS,
  LATEX_LEVEL_OPENERS,
  LATEX_RAW_TOKEN_COMMANDS,
  scanLatex,
} from "@askboard/contract";
import katex from "katex";
import { parseProblem, renderOptions } from "./render.ts";
import { renderTree, treeSizeOf } from "./tree.ts";

const markupOf = (expression: string): string => katex.renderToString(expression, renderOptions());

// KaTeX's own verdict on an expression, with the render options and without the contract's scan:
// these tests pin what KaTeX does with the definitions and internal commands that `parseProblem`
// and `renderInto` now refuse before KaTeX runs.
const katexProblem = (expression: string): string | undefined => {
  try {
    markupOf(expression);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

// The control words KaTeX names: its functions' `names` and its `defineMacro` names.
const katexNames = async (): Promise<readonly string[]> => {
  const source = await Bun.file(Bun.resolveSync("katex", import.meta.dir)).text();
  const literals = (text: string) =>
    [...text.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map(
      ([, body]) => JSON.parse(`"${body}"`) as string,
    );
  const found = new Set<string>();
  for (const [, body] of source.matchAll(/names:\s*\[((?:[^\]"]|"(?:[^"\\\n]|\\.)*")*)\]/g)) {
    for (const name of literals(body ?? "")) found.add(name);
  }
  for (const [, name] of source.matchAll(/defineMacro\(("(?:[^"\\\n]|\\.)*")/g)) {
    found.add(JSON.parse(name ?? '""') as string);
  }
  return [...found].filter((name) => /^\\[A-Za-z@]+$/.test(name)).sort();
};

// Group 4 review S-1 (task 4.5) and the 4.7 re-review's X-1 (task 4.8): the contract refuses a macro
// definition (`LATEX_DEFINING_COMMANDS`) and every control word holding `@`, so the render's bound on
// work is the source. These guards read KaTeX 0.19.1, which a bump re-reads: every macro KaTeX
// defines by side effect holds `@` or has a fixed body, and no built-in command without `@`
// repeats what it is given.
describe("the macro definitions the contract refuses, read in KaTeX itself", () => {
  const withoutAnnotation = (markup: string) =>
    markup.replace(/<annotation[\s\S]*?<\/annotation>/, "");
  const drawn = (expression: string) => withoutAnnotation(markupOf(expression));

  test("the installed katex is 0.19.1: a bump re-reads the list and the next test", async () => {
    const manifest = JSON.parse(
      await Bun.file(`${Bun.resolveSync("katex/package.json", import.meta.dir)}`).text(),
    ) as { version: string };
    expect(manifest.version).toBe("0.19.1");
  });

  // Each command in a form of its own; the definition makes the name known in the same call.
  // `\renewcommand` needs a name that exists, so it redefines KaTeX's `\TeX`.
  const FORMS = [
    ["\\def", "\\def\\zq{x}\\zq", "\\zq"],
    ["\\gdef", "\\gdef\\zq{x}\\zq", "\\zq"],
    ["\\edef", "\\edef\\zq{x}\\zq", "\\zq"],
    ["\\xdef", "\\xdef\\zq{x}\\zq", "\\zq"],
    ["\\global", "\\global\\def\\zq{x}\\zq", "\\zq"],
    ["\\long", "\\long\\def\\zq{x}\\zq", "\\zq"],
    ["\\let", "\\let\\zq=x\\zq", "\\zq"],
    ["\\futurelet", "\\futurelet\\zq x x\\zq", "\\zq"],
    ["\\newcommand", "\\newcommand\\zq{x}\\zq", "\\zq"],
    ["\\renewcommand", "\\renewcommand\\TeX{x}\\TeX", "\\TeX"],
    ["\\providecommand", "\\providecommand\\zq{x}\\zq", "\\zq"],
  ] as const;

  test("every command of the list has a form here, and no other command does", () => {
    expect(FORMS.map(([command]) => String(command)).sort()).toEqual(
      [...LATEX_DEFINING_COMMANDS].sort(),
    );
  });

  test.each(FORMS)(
    "%s defines a name in the same render, which the name alone lacks",
    (command, form, name) => {
      expect(form).toContain(command);
      expect(katexProblem(form)).toBeUndefined();
      expect(scanLatex(form).refused).toBeDefined();
      // The definition took effect: the form draws what its body draws.
      const effect = drawn(form);
      expect(effect).toContain(">x<");
      if (name === "\\zq") {
        expect(katexProblem(name)).toContain("Undefined control sequence: \\zq");
      } else {
        expect(drawn(name)).not.toBe(effect);
      }
    },
  );

  test("no control word without @ repeats its argument: three deep, it draws at most 5 times", async () => {
    const names = await katexNames();
    // The names are read from the source: a few hundred, among them the ones the contract refuses.
    expect(names.length).toBeGreaterThan(300);
    for (const command of LATEX_DEFINING_COMMANDS) expect(names).toContain(command);
    const base = markupOf("x".repeat(200)).length;
    // `\show`, `\message` and `\errmessage` print to the console.
    const printed = (["log", "warn", "error"] as const).map((method) =>
      spyOn(console, method).mockImplementation(() => undefined),
    );
    let drew = 0;
    let worst = 0;
    for (const name of names) {
      if (name.includes("@")) continue; // refused by the contract: no author can call it
      const body = "x".repeat(200);
      const expression = `${name}{${name}{${name}{${body}}}}`;
      let markup: string | undefined;
      try {
        markup = markupOf(expression);
      } catch {
        continue; // it fails: a bound as good as any
      }
      drew += 1;
      worst = Math.max(worst, markup.length / base);
      expect({ name, ratio: markup.length / base <= 5 }).toEqual({ name, ratio: true });
    }
    for (const spy of printed) spy.mockRestore();
    expect(drew).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(5);
  });
});

// Task 4.8, source guards (a) to (c): the macros KaTeX defines by side effect, read in its source.
describe("the macros KaTeX defines by side effect, read in katex.mjs (0.19.1)", () => {
  type Literal = { readonly text: string; readonly line: number };

  const sourceLines = async (): Promise<readonly string[]> =>
    (await Bun.file(Bun.resolveSync("katex", import.meta.dir)).text()).split("\n");

  // Code lines only: a line that is a comment on its own is skipped, so a quote in a comment pairs
  // with nothing.
  const codeLines = (lines: readonly string[]) =>
    lines
      .map((text, at) => ({ text, line: at + 1 }))
      .filter(({ text }) => !/^\s*(\/\/|\/\*|\*)/.test(text));

  const STRING = /"((?:[^"\\\n]|\\.)*)"/g;
  const decoded = (body: string): string => JSON.parse(`"${body}"`) as string;

  // The first argument of each `macros.set(` that is a string literal, with the line it stands on.
  const setLiterals = (lines: readonly string[]): Literal[] =>
    codeLines(lines).flatMap(({ text, line }) =>
      [...text.matchAll(/macros\.set\(("(?:[^"\\\n]|\\.)*")/g)].map(([, name]) => ({
        text: JSON.parse(name ?? '""') as string,
        line,
      })),
    );

  // Each name that a `\gdef`, `\def`, `\edef`, `\xdef` or `\global\def` inside a string defines.
  const definedInStrings = (lines: readonly string[]): Literal[] =>
    codeLines(lines).flatMap(({ text, line }) =>
      [...text.matchAll(STRING)].flatMap(([, body]) =>
        [...decoded(body ?? "").matchAll(/\\(?:global\s*\\)?[gex]?def\s*(\\[A-Za-z@]+)/g)].map(
          ([, name]) => ({ text: name ?? "", line }),
        ),
      ),
    );

  // The names KaTeX sets to a fixed body that holds none of the author's text, with the lines they
  // were read at on 0.19.1 (the test checks each line still names the macro).
  const FIXED: Readonly<Record<string, readonly number[]>> = {
    "\\cr": [7461, 9422], // "\\\\\\relax"
    "\\color": [15391], // "\\textcolor", only with the colorIsTextColor setting
    "|": [14264, 14283], // the \middle handler's own macro
    "\\|": [14266, 14285],
  };

  test("every name set by side effect holds @ or has a fixed body, with its line", async () => {
    const lines = await sourceLines();
    const found = [...setLiterals(lines), ...definedInStrings(lines)];
    // The ones the review named, read from the source and not from this test.
    const names = new Set(found.map(({ text }) => text));
    for (const name of ["\\df@tag", "\\current@color", "\\@eqnsw"]) expect(names).toContain(name);
    for (const { text, line } of found) {
      if (text.includes("@")) continue;
      expect({ text, listed: FIXED[text]?.includes(line) ?? false }).toEqual({
        text,
        listed: true,
      });
    }
    for (const [name, at] of Object.entries(FIXED)) {
      for (const line of at) {
        expect(lines[line - 1]).toContain(`macros.set(${JSON.stringify(name)}`);
      }
    }
    expect(found.filter(({ text }) => !text.includes("@") && !(text in FIXED))).toEqual([]);
  });

  test("the macros.set calls with a name that is no literal are the refused commands' handlers", async () => {
    // `\let` and `\futurelet` (7851), `\def` and its family (7940), `\newcommand` and its family (13662).
    const lines = await sourceLines();
    const calls = codeLines(lines)
      .filter(({ text }) => /macros\.set\((?!")/.test(text))
      .map(({ line }) => line);
    expect(calls).toEqual([7851, 7940, 13662]);
  });

  test("no macro whose name lacks @ names, in its body, a name KaTeX defines with author text", async () => {
    const lines = await sourceLines();
    const text = lines.join("\n");
    const calls = [...text.matchAll(/^defineMacro\(("(?:[^"\\\n]|\\.)*")/gm)];
    expect(calls.length).toBeGreaterThan(300);
    const bodies = calls.map((call) => {
      const start = call.index ?? 0;
      const rest = text.slice(start + call[0].length);
      const end = rest.search(/\n[A-Za-z/]/);
      return {
        name: JSON.parse(call[1] ?? '""') as string,
        body: end === -1 ? rest : rest.slice(0, end),
      };
    });
    for (const { name, body } of bodies) {
      if (name.includes("@")) continue;
      for (const authored of ["df@tag", "current@color"]) {
        expect({ name, names: body.includes(authored) }).toEqual({ name, names: false });
      }
    }
    // The definitions with author text are the two the review named, nothing else.
    expect(bodies.some(({ name }) => name === "\\tag")).toBe(true);
  });
});

// Task 4.9, source guards (e) to (g) and the seeded property (h): the scan's depth is KaTeX's nesting.
describe("the depth the scan counts, read in KaTeX (0.19.1)", () => {
  const sourceText = async (): Promise<string> =>
    await Bun.file(Bun.resolveSync("katex", import.meta.dir)).text();
  const STRING = /"((?:[^"\\\n]|\\.)*)"/g;
  const literal = (body: string | undefined): string => JSON.parse(`"${body}"`) as string;
  // A statement of the source: from its opening to the next line that starts in column 0.
  const statementAt = (text: string, from: number): string => {
    const rest = text.slice(from);
    const end = rest.slice(1).search(/\n[A-Za-z/]/);
    return end === -1 ? rest : rest.slice(0, end + 1);
  };

  test("(e) a macro whose body's braces do not balance is an opener or a closer of the scan", async () => {
    const text = await sourceText();
    const unbalanced: string[] = [];
    const calls = [...text.matchAll(/^defineMacro\(("(?:[^"\\\n]|\\.)*")/gm)];
    expect(calls.length).toBeGreaterThan(300);
    for (const call of calls) {
      const name = JSON.parse(call[1] ?? '""') as string;
      if (name.includes("@")) continue; // refused: no author can call it
      const literals = [...statementAt(text, call.index ?? 0).matchAll(STRING)]
        .map(([, body]) => literal(body))
        .join("");
      const balance = [...literals.replace(/\\[\s\S]/g, "")].reduce(
        (sum, char) => sum + (char === "{" ? 1 : char === "}" ? -1 : 0),
        0,
      );
      if (balance !== 0) unbalanced.push(name);
    }
    expect(unbalanced.sort()).toEqual(["\\bgroup", "\\egroup"]);
    expect(LATEX_LEVEL_OPENERS).toContain("\\bgroup");
    expect(LATEX_LEVEL_CLOSERS).toContain("\\egroup");
  });

  test("(f) what reads a raw token is refused, an @ name, or in the scan's table", async () => {
    const lines = (await sourceText()).split("\n");
    const expander = lines.findIndex((line) => /^ {2}popToken\(\) \{/.test(line));
    expect(expander).toBeGreaterThan(0);
    // The unit (the last line starting in column 0 above it) of each popToken() call before the
    // expander's own methods.
    const units = new Map<number, string>();
    lines.slice(0, expander).forEach((line, at) => {
      if (!/\bpopToken\(\)/.test(line)) return;
      let header = at;
      while (header > 0 && !/^[A-Za-z]/.test(lines[header] ?? "")) header -= 1;
      units.set(header + 1, lines[header] ?? "");
    });
    expect([...units.values()]).toEqual([
      "var getRHS = parser => {", // \let and \futurelet: refused
      "defineFunction({", // \def and its family: refused
      "defineFunction({", // \let and its family: refused
      "defineFunction({", // \futurelet and its family: refused
      'defineMacro("\\\\noexpand", function (context) {', // pushes the token back
      'defineMacro("\\\\expandafter", function (context) {', // pushes the token back
      'defineMacro("\\\\char", function (context) {', // refused after a backquote
      'defineMacro("\\\\show", context => {', // refused
      "var braketHelper = one => context => {", // \bra@ket, \bra@set: @ names, only `|`
    ]);
    const typeable = (name: string) => !name.startsWith("\\\\");
    for (const [line, header] of units) {
      if (header !== "defineFunction({") continue;
      const list = /names:\s*\[([^\]]*)\]/.exec(lines.slice(line, line + 4).join("\n"))?.[1];
      const names = [...(list ?? "").matchAll(STRING)].map(([, body]) => literal(body));
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        const refused = (LATEX_DEFINING_COMMANDS as readonly string[]).includes(name);
        expect({ name, fine: refused || !typeable(name) }).toEqual({ name, fine: true });
      }
    }
    expect({ ...LATEX_RAW_TOKEN_COMMANDS }).toEqual({
      "\\char": "refusedWithBackquote",
      "\\show": "refused",
      "\\noexpand": "pushesBack",
      "\\expandafter": "pushesBack",
    });
  });

  test("(g) a command that takes arguments and is allowed in an argument fails as its own argument", async () => {
    const text = await sourceText();
    const names: string[] = [];
    for (const block of text.split("\ndefineFunction({").slice(1)) {
      const head = block.slice(0, block.search(/\n\s+handler/));
      if (!/allowedInArgument:\s*true/.test(head)) continue;
      if (Number(/numArgs:\s*(\d+)/.exec(head)?.[1] ?? "0") === 0) continue;
      const list = /names:\s*\[([\s\S]*?)\]/.exec(head)?.[1] ?? "";
      for (const [, body] of list.matchAll(STRING)) {
        const name = literal(body);
        if (/^\\[A-Za-z]+$/.test(name)) names.push(name);
      }
    }
    expect(names.length).toBeGreaterThan(20);
    for (const name of ["\\frac", "\\binom", "\\mathrm", "\\text", "\\genfrac"]) {
      expect(names).toContain(name);
    }
    for (const name of names) {
      const expression = `${name} ${name}${" x".repeat(8)}`;
      expect({ name, fails: parseProblem(expression) !== undefined }).toEqual({
        name,
        fails: true,
      });
    }
  });

  // The lines the `infix: true` functions of 0.19.1 stand on: a bump re-reads them.
  const INFIX_LINES = [10741, 10841];

  test("(i) the infix functions of KaTeX are exactly the scan's infix commands", async () => {
    const lines = (await sourceText()).split("\n");
    const names: string[] = [];
    const found: number[] = [];
    lines.forEach((line, at) => {
      if (!/^\s+infix:\s*true,?\s*$/.test(line)) return;
      found.push(at + 1);
      let header = at;
      while (header > 0 && lines[header] !== "defineFunction({") header -= 1;
      expect(lines[header]).toBe("defineFunction({");
      const list = /names:\s*\[([^\]]*)\]/.exec(lines.slice(header, at).join("\n"))?.[1];
      for (const [, body] of (list ?? "").matchAll(STRING)) names.push(literal(body));
    });
    expect(found).toEqual(INFIX_LINES);
    expect(names.length).toBeGreaterThan(0);
    expect([...names].sort()).toEqual([...LATEX_INFIX_COMMANDS].sort());
    for (const name of names) expect(scanLatex(`{a ${name} b}`).depth).toBe(2);
  });

  // (h) The depth of the MathML KaTeX builds, against the scan's depth. The elements of
  // `output: "mathml"` are counted by their tags; the annotation holds the source as escaped text.
  const mathDepth = (markup: string): number => {
    let level = 0;
    let deepest = 0;
    for (const [, closing, , selfClosing] of markup.matchAll(
      /<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g,
    )) {
      if (selfClosing) continue;
      level += closing ? -1 : 1;
      deepest = Math.max(deepest, level);
    }
    return deepest;
  };

  // The longest run of `mfrac` elements each the direct child of the one above: the chain that
  // doubles WebKit's MathML layout with each link (4.12 re-review X-1).
  const fracChain = (markup: string): number => {
    const stack: { tag: string; chain: number }[] = [];
    let longest = 0;
    for (const [, closing, tag, selfClosing] of markup.matchAll(
      /<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g,
    )) {
      if (selfClosing) continue;
      if (closing) {
        stack.pop();
        continue;
      }
      const parent = stack[stack.length - 1];
      const chain = tag === "mfrac" ? (parent?.tag === "mfrac" ? parent.chain + 1 : 1) : 0;
      longest = Math.max(longest, chain);
      stack.push({ tag: tag ?? "", chain });
    }
    return longest;
  };

  const mathOf = (expression: string): string =>
    katex.renderToString(expression, { ...renderOptions(), output: "mathml" });

  test("(h) the chain of directly nested mfrac is read as the review read it: 2n for n infix fractions", () => {
    const infix = (n: number) => [...Array(n).keys()].reduce((i) => `\\frac{${i}\\over y}{x}`, "x");
    const plain = (n: number) => [...Array(n).keys()].reduce((i) => `\\frac{${i}}{x}`, "x");
    expect(fracChain(mathOf(infix(3)))).toBe(6);
    expect(fracChain(mathOf(plain(3)))).toBe(3);
    expect(fracChain(mathOf("x^{\\frac{a}{b}}"))).toBe(1);
    expect(fracChain(mathOf("x"))).toBe(0);
    for (const n of [1, 2, 3, 7]) {
      expect(fracChain(mathOf(infix(n))), String(n)).toBeLessThanOrEqual(scanLatex(infix(n)).depth);
      expect(fracChain(mathOf(plain(n))), String(n)).toBeLessThanOrEqual(scanLatex(plain(n)).depth);
    }
  });

  const mulberry32 = (seed: number) => {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const builders: readonly ((e: () => string, atom: () => string) => string)[] = [
    (e) => `{${e()}}`,
    (e) => `x^{${e()}}`,
    (e) => `x_{${e()}}`,
    (_e, atom) => `x^${atom()}`,
    (e) => `\\frac{${e()}}{${e()}}`,
    (e) => `\\sqrt{${e()}}`,
    (e) => `\\left( ${e()} \\right)`,
    (e) => `\\begin{matrix} ${e()} & ${e()} \\\\ ${e()} & ${e()} \\end{matrix}`,
    (e) => `\\text{$${e()}$}`,
    (e) => `${e()} %{{\n ${e()}`,
    (e) => `\\verb|{x}| ${e()}`,
    (e) => `\\char\`a ${e()}`,
    (e) => `\\show x ${e()}`,
    (e) => `\\bgroup ${e()}\\egroup`,
    (e) => `\\begingroup ${e()}\\endgroup`,
    (e) => `{${e()} \\over ${e()}}`,
    (e) => `\\frac{${e()} \\over ${e()}}{${e()}}`,
    (e) => `{${e()} \\atop ${e()}}`,
    (e) => `\\char\` {${e()}}`,
    (e) => `\\char\`\n{${e()}}`,
    (e) => `\\show%\n {${e()}}`,
    (e) => `\\boxed{${e()}}`,
    (e) => `\\hat{${e()}}`,
    (e) => `\\overbrace{${e()}}^{${e()}}`,
    (e) => `\\binom{${e()}}{${e()}}`,
    (e) => `\\sqrt[3]{${e()}}`,
    (e) => `${e()} ${e()}`,
  ];

  // The 600 seeded expressions of at most 2,000 code points, the same on every run.
  const seededExpressions = (): string[] => {
    const random = mulberry32(20261107);
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
    const atom = () => pick(["x", "y", "1", "\\alpha", "a+b"]);
    const gen = (budget: number): string =>
      budget <= 0 ? atom() : pick(builders)(() => gen(budget - 1), atom);
    const expressions: string[] = [];
    for (let run = 0; run < 600; run += 1) {
      const expression = gen(1 + Math.floor(random() * 7));
      if (expression.length <= 2_000) expressions.push(expression);
    }
    return expressions;
  };

  // The smallest a and b the seeded run allows: the MathML's depth is at most A * depth + B. On
  // 0.19.1 the 600 expressions allow (1, 17), (2, 9), (3, 7), (4, 5) and (5, 5).
  const A = 4;
  const B = 5;

  test("(h) the MathML's element depth is at most A x the scan's depth + B and its mfrac chain at most the depth, over seeded expressions", () => {
    const printed = (["log", "warn", "error"] as const).map((method) =>
      spyOn(console, method).mockImplementation(() => undefined),
    );
    const rows: { depth: number; math: number; chain: number }[] = [];
    for (const expression of seededExpressions()) {
      let markup: string;
      try {
        markup = katex.renderToString(expression, { ...renderOptions(), output: "mathml" });
      } catch {
        continue; // KaTeX does not parse it: nothing is drawn
      }
      rows.push({
        depth: scanLatex(expression).depth,
        math: mathDepth(markup),
        chain: fracChain(markup),
      });
    }
    for (const spy of printed) spy.mockRestore();
    expect(rows.length).toBeGreaterThan(300);
    expect(Math.max(...rows.map(({ depth }) => depth))).toBeGreaterThanOrEqual(6);
    for (const { depth, math, chain } of rows) {
      expect(math).toBeLessThanOrEqual(A * depth + B);
      expect(chain).toBeLessThanOrEqual(depth);
    }
    expect(Math.max(...rows.map(({ chain }) => chain))).toBeGreaterThanOrEqual(3);
  });

  // The start tags of a markup string and the deepest nesting of its elements, a void element
  // (`<path/>`) counted at the level it stands on.
  const tagsOf = (markup: string): { starts: number; depth: number } => {
    let level = 0;
    let deepest = 0;
    let starts = 0;
    for (const [, closing, , selfClosing] of markup.matchAll(
      /<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g,
    )) {
      if (closing) {
        level -= 1;
        continue;
      }
      starts += 1;
      deepest = Math.max(deepest, level + 1);
      if (!selfClosing) level += 1;
    }
    return { starts, depth: deepest };
  };

  // Guard (k)'s and (m)'s expressions: every control word without `@` three deep around 200 glyphs,
  // and the seeded ones.
  const guardExpressions = async (): Promise<string[]> => {
    const names = (await katexNames()).filter((name) => !name.includes("@"));
    const body = "x".repeat(200);
    return [...names.map((name) => `${name}{${name}{${name}{${body}}}}`), ...seededExpressions()];
  };

  const quiet = () =>
    (["log", "warn", "error"] as const).map((method) =>
      spyOn(console, method).mockImplementation(() => undefined),
    );

  test("(k) the walk of a tree sees every element KaTeX emits: depth and nodes at least the markup's", async () => {
    const printed = quiet();
    const expressions = await guardExpressions();
    let measured = 0;
    let deepest = 0;
    for (const expression of expressions) {
      let tree: ReturnType<typeof renderTree>;
      try {
        tree = renderTree(expression, renderOptions());
      } catch {
        continue; // KaTeX does not parse it: nothing is drawn
      }
      const size = treeSizeOf(tree);
      const tags = tagsOf(tree.toMarkup());
      measured += 1;
      deepest = Math.max(deepest, tags.depth);
      expect({ expression, depth: size.depth >= tags.depth }).toEqual({ expression, depth: true });
      expect({ expression, nodes: size.nodes >= tags.starts }).toEqual({ expression, nodes: true });
    }
    for (const spy of printed) spy.mockRestore();
    expect(measured).toBeGreaterThan(600);
    expect(deepest).toBeGreaterThan(20);
  });

  // The deepest nesting of `<mfrac` elements in a markup string, a void element counted as no parent.
  const mfracChainOf = (markup: string): number => {
    const open: string[] = [];
    let fractions = 0;
    let deepest = 0;
    for (const [, closing, name, selfClosing] of markup.matchAll(
      /<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g,
    )) {
      if (closing) {
        if (open.pop() === "mfrac") fractions -= 1;
        continue;
      }
      if (selfClosing) continue;
      open.push(name as string);
      if (name === "mfrac") {
        fractions += 1;
        deepest = Math.max(deepest, fractions);
      }
    }
    return deepest;
  };

  test("(m) the fractions counted are the deepest nesting of <mfrac tags in the markup", async () => {
    const printed = quiet();
    const expressions = await guardExpressions();
    let measured = 0;
    let deepest = 0;
    let withFractions = 0;
    for (const expression of expressions) {
      let tree: ReturnType<typeof renderTree>;
      try {
        tree = renderTree(expression, renderOptions());
      } catch {
        continue; // KaTeX does not parse it: nothing is drawn
      }
      const chain = mfracChainOf(tree.toMarkup());
      measured += 1;
      deepest = Math.max(deepest, chain);
      if (chain > 0) withFractions += 1;
      expect({ expression, fractions: treeSizeOf(tree).fractions }).toEqual({
        expression,
        fractions: chain,
      });
    }
    for (const spy of printed) spy.mockRestore();
    expect(measured).toBeGreaterThan(600);
    expect(withFractions).toBeGreaterThan(20);
    expect(deepest).toBeGreaterThanOrEqual(3);
  });
});

// Task 4.14, source guard (j): the internal function the board measures with, read in KaTeX's
// source at the lines of 0.19.1 (a bump re-reads them).
describe("the internal tree function, read in katex.mjs (0.19.1)", () => {
  const sourceLines = async (): Promise<readonly string[]> =>
    (await Bun.file(Bun.resolveSync("katex", import.meta.dir)).text()).split("\n");
  const RENDER_LINE = 16312;
  const RENDER_ERROR_LINE = 16346;
  const DEFAULT_EXPORT_LINE = 16431;
  const NAMED_EXPORT_LINE = 16470;

  test("(j) __renderToDomTree is on the default export and exported by name", async () => {
    const lines = await sourceLines();
    expect(lines[DEFAULT_EXPORT_LINE - 1]).toBe("  __renderToDomTree: renderToDomTree,");
    expect(lines[NAMED_EXPORT_LINE - 1]).toContain("renderToDomTree as __renderToDomTree");
    expect(typeof (katex as unknown as Record<string, unknown>).__renderToDomTree).toBe("function");
  });

  test("(j) render empties its node, then appends renderToDomTree(expression, options).toNode()", async () => {
    const lines = await sourceLines();
    expect(lines.slice(RENDER_LINE - 1, RENDER_LINE + 4).map((line) => line.trim())).toEqual([
      "var render = function render(expression, baseNode, options) {",
      'baseNode.textContent = "";',
      "var node = renderToDomTree(expression, options).toNode();",
      "baseNode.appendChild(node);",
      "};",
    ]);
    // renderToDomTree is the function the default export names.
    expect(lines.filter((line) => /^var renderToDomTree = /.test(line))).toHaveLength(1);
  });

  test("(j) renderError rethrows under throwOnError", async () => {
    const lines = await sourceLines();
    expect(
      lines.slice(RENDER_ERROR_LINE - 1, RENDER_ERROR_LINE + 3).map((line) => line.trim()),
    ).toEqual([
      "var renderError = function renderError(error, expression, options) {",
      "if (options.throwOnError || !(error instanceof ParseError)) {",
      "throw error;",
      "}",
    ]);
    // Both of renderToDomTree's failure paths go through it.
    expect(
      lines.filter((line) => /return renderError\(error, expression, settings\);/.test(line)),
    ).toHaveLength(2);
  });
});

// Task 4.20, source guard (l): the board counts nested fractions as the nodes of type `mfrac` that
// KaTeX's MathML builder makes. Read in `katex.mjs` at the lines of 0.19.1 (a bump re-reads them and
// task 4.15's probe is re-run): one site makes `mfrac`, and the MathML element names KaTeX creates
// are a pinned list, so a release that adds an element or builds fractions elsewhere fails here.
describe("the MathML KaTeX builds, read in katex.mjs (0.19.1)", () => {
  const sourceLines = async (): Promise<readonly string[]> =>
    (await Bun.file(Bun.resolveSync("katex", import.meta.dir)).text()).split("\n");
  const MFRAC_LINE = 10630;
  // The three sites whose first argument is no literal: colorbox/cancel's `mpadded` or `menclose`,
  // an over or under accent's `mover` or `munder`, and the scripts' `nodeType`.
  const COMPUTED_LINES = [9080, 10983, 12887];
  const ELEMENT_NAMES = [
    "annotation",
    "math",
    "menclose",
    "mfrac",
    "mglyph",
    "mi",
    "mn",
    "mo",
    "mover",
    "mpadded",
    "mphantom",
    "mroot",
    "mrow",
    "mspace",
    "msqrt",
    "mstyle",
    "msub",
    "msubsup",
    "msup",
    "mtable",
    "mtd",
    "mtext",
    "mtr",
    "munder",
    "munderover",
    "semantics",
  ];

  const sites = (lines: readonly string[]) =>
    lines.flatMap((text, at) =>
      [...text.matchAll(/new MathNode\(\s*("([^"]*)"|[^,)]*)/g)].map(([, argument, literal]) => ({
        line: at + 1,
        literal,
        argument: argument as string,
      })),
    );

  test("(l) one site makes mfrac, in genfrac's MathML builder", async () => {
    const lines = await sourceLines();
    const fractions = sites(lines).filter((site) => site.literal === "mfrac");
    expect(fractions.map((site) => site.line)).toEqual([MFRAC_LINE]);
    expect(lines[MFRAC_LINE - 1]?.trim()).toBe(
      'var node = new MathNode("mfrac", [buildGroup(group.numer, options), buildGroup(group.denom, options)]);',
    );
    expect(lines[MFRAC_LINE - 2]?.trim()).toBe("var mathmlBuilder$3 = (group, options) => {");
    // The HTML half's fraction is a span of class mfrac, which has no type.
    expect(lines.filter((line) => line.includes('makeSpan(["mfrac"]'))).toHaveLength(1);
  });

  test("(l) the names of every new MathNode, literal and computed, are the pinned list", async () => {
    const lines = await sourceLines();
    const found = sites(lines);
    const computed = found.filter((site) => site.literal === undefined);
    expect(computed.map((site) => site.line)).toEqual(COMPUTED_LINES);
    const names = new Set(found.flatMap((site) => (site.literal ? [site.literal] : [])));
    // The computed sites choose among literal names on their own lines, and the scripts' builder
    // assigns `nodeType` from literals.
    for (const text of [lines[9079], lines[10982]]) {
      for (const [, name] of (text ?? "").matchAll(/"(m[a-z]+)"/g)) names.add(name as string);
    }
    for (const [, name] of lines.join("\n").matchAll(/nodeType = "(m[a-z]+)"/g)) {
      names.add(name as string);
    }
    expect([...names].sort()).toEqual(ELEMENT_NAMES);
  });
});
