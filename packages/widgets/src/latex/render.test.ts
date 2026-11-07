// The LaTeX's render options and the one function that draws a preview (latex-kanban-timeline,
// task 4.1; view-and-widgets spec: LaTeX untrusted commands, LaTeX parse errors; design decision 7).
// KaTeX's markup is read through `renderToString`, which needs no DOM, so that Bun can look at what a
// command would put in the page; `renderInto` is run on stand-ins for the preview's element.

import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { LATEX_DEFINING_COMMANDS, latexDefiningCommand } from "@askboard/contract";
import katex from "katex";
import { parseProblem, renderInto, renderOptions } from "./render.ts";

const markupOf = (expression: string): string => katex.renderToString(expression, renderOptions());

describe("the render options", () => {
  test("do not trust the expression, and bound its size and expansion", () => {
    expect(renderOptions()).toEqual({
      displayMode: true,
      throwOnError: true,
      trust: false,
      strict: "ignore",
      maxExpand: 1000,
      maxSize: 20,
      output: "htmlAndMathml",
      macros: {},
    });
    expect(renderOptions().trust).toBe(false);
  });

  test("are a new object with a new macros table on each call", () => {
    const first = renderOptions();
    const second = renderOptions();
    expect(first).not.toBe(second);
    expect(first.macros).not.toBe(second.macros);
    (first.macros as Record<string, string>).x = "1";
    expect(renderOptions().macros).toEqual({});
  });

  test("write trust as the literal false in the source, never a function", async () => {
    const source = await Bun.file(`${import.meta.dir}/render.ts`).text();
    const code = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const mentions = [...code.matchAll(/\btrust\b[^,\n]*/g)].map(([text]) => text);
    expect(mentions.length).toBeGreaterThan(0);
    for (const mention of mentions) expect(mention).toMatch(/^trust: false$/);
  });
});

describe("commands that would reach outside the expression", () => {
  const COMMANDS = [
    ["\\href{https://example.com}{x}", "\\href"],
    ["\\url{https://example.com}", "\\url"],
    ["\\includegraphics{https://example.com/a.png}", "\\includegraphics"],
    ["\\htmlClass{evil-class}{x}", "\\htmlClass"],
    ["\\htmlId{evil-id}{x}", "\\htmlId"],
    ["\\htmlStyle{background:evil}{x}", "\\htmlStyle"],
    ["\\htmlData{evil=1}{x}", "\\htmlData"],
  ] as const;

  // The MathML annotation quotes the source as escaped text, so what the command did is read from the
  // rest of the markup: its elements' attributes and its text.
  const withoutAnnotation = (markup: string) =>
    markup.replace(/<annotation[\s\S]*?<\/annotation>/, "");
  const ATTRIBUTES = new Set(["class", "style", "aria-hidden", "xmlns", "display", "mathcolor"]);

  test.each(COMMANDS)(
    "%s gives no anchor, image, class, ID, style or data attribute",
    (expression, name) => {
      const markup = withoutAnnotation(markupOf(expression));
      expect(markup).not.toMatch(/<(a|img)[\s>]/);
      expect(markup).not.toContain("href=");
      expect(markup).not.toContain("example.com");
      expect(markup).not.toContain("evil");
      const attributes = [...markup.matchAll(/\s([A-Za-z][\w:-]*)="/g)].map(
        ([, attribute]) => attribute,
      );
      expect(attributes.filter((attribute) => !ATTRIBUTES.has(attribute as string))).toEqual([]);
      // The command is shown as the text it is, in KaTeX's error colour.
      expect(markup).toContain(name);
    },
  );

  test("markup typed into the expression is escaped text", () => {
    const markup = markupOf("<img src=x onerror=alert(1)>");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("&lt;");
  });
});

describe("macros", () => {
  test("one render defines does not exist in the next", () => {
    expect(parseProblem("\\gdef\\foo{1}")).toBeUndefined();
    expect(markupOf("\\gdef\\foo{1}\\foo")).toContain("1");
    const second = parseProblem("\\foo");
    expect(second).toContain("Undefined control sequence: \\foo");
  });

  test.each(["\\gdef\\a{\\a\\a}\\a", "\\def\\a{\\a}\\a"])(
    "%s expands without end and fails within a second",
    (expression) => {
      const started = performance.now();
      const problem = parseProblem(expression);
      expect(performance.now() - started).toBeLessThan(1_000);
      expect(problem).toContain("Too many expansions");
    },
  );
});

// Group 4 review S-1 (task 4.5): the contract refuses a macro definition (`LATEX_DEFINING_COMMANDS`),
// so the render's bound on work is the source. These guards read KaTeX 0.19.1, which a bump re-reads:
// the list holds every way KaTeX defines a macro, and no built-in command repeats what it is given.
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
      expect(parseProblem(form)).toBeUndefined();
      expect(latexDefiningCommand(form)).toBeDefined();
      // The definition took effect: the form draws what its body draws.
      const effect = drawn(form);
      expect(effect).toContain(">x<");
      if (name === "\\zq") {
        expect(parseProblem(name)).toContain("Undefined control sequence: \\zq");
      } else {
        expect(drawn(name)).not.toBe(effect);
      }
    },
  );

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

  test("no control word KaTeX names repeats its argument: three deep, it draws at most 5 times", async () => {
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

describe("parseProblem", () => {
  test("is KaTeX's own message for an expression that does not parse", () => {
    const problem = parseProblem("\\frac{1}{");
    let thrown = "";
    try {
      katex.renderToString("\\frac{1}{", renderOptions());
    } catch (error) {
      thrown = (error as Error).message;
    }
    expect(thrown).toStartWith("KaTeX parse error:");
    expect(problem).toBe(thrown);
  });

  test("gives nothing for an expression that renders, and for the empty one", () => {
    expect(parseProblem("a^2+b^2=c^2")).toBeUndefined();
    expect(parseProblem("")).toBeUndefined();
    expect(markupOf("")).toContain("katex-display");
  });

  test("gives a message for any error KaTeX throws, an Error or not", () => {
    for (const [thrown, message] of [
      [new RangeError("deep"), "deep"],
      ["plain text", "The expression could not be drawn."],
    ] as const) {
      const spy = spyOn(katex, "renderToString").mockImplementation(() => {
        throw thrown;
      });
      expect(parseProblem("x")).toBe(message);
      spy.mockRestore();
    }
  });
});

// A stand-in for an element of the page: its content is a list of marks, and it makes scratch
// nodes of its own document.
type Node = { marks: string[]; textContent: string; childNodes: string[] };
const newNode = (marks: string[] = []): Node => ({ marks, textContent: "", childNodes: marks });
const hostHolding = (...marks: string[]) => {
  const scratch = newNode();
  const host = {
    marks,
    scratch,
    // As an element's: KaTeX empties its target before it parses.
    set textContent(_text: string) {
      host.marks = [];
    },
    ownerDocument: { createElement: () => scratch },
    replaceChildren(...nodes: string[]) {
      host.marks = nodes;
    },
  };
  return host;
};
const draw = (host: ReturnType<typeof hostHolding>, expression: string) =>
  renderInto(host as unknown as HTMLElement, expression);

describe("renderInto", () => {
  let spy: ReturnType<typeof spyOn> | undefined;
  afterEach(() => spy?.mockRestore());

  test("puts what KaTeX built into the element, through a scratch node of its document", () => {
    const host = hostHolding("old");
    let target: unknown;
    spy = spyOn(katex, "render").mockImplementation((_expression, node) => {
      target = node;
      (node as unknown as Node).childNodes = ["new"];
    });
    expect(draw(host, "x")).toEqual({});
    expect(target).toBe(host.scratch);
    expect(target).not.toBe(host);
    expect(host.marks).toEqual(["new"]);
  });

  test("draws with the render options, trust false among them", () => {
    const host = hostHolding();
    let options: unknown;
    spy = spyOn(katex, "render").mockImplementation((_e, _n, given) => {
      options = given;
    });
    draw(host, "x");
    expect(options).toEqual(renderOptions());
  });

  test("keeps the last content when the expression does not parse, KaTeX's own error", () => {
    const host = hostHolding("last preview");
    const result = draw(host, "\\frac{1}{");
    expect(result.error).toStartWith("KaTeX parse error:");
    expect(host.marks).toEqual(["last preview"]);
  });

  test.each([
    ["a ParseError", new katex.ParseError("bad brace"), "KaTeX parse error: bad brace"],
    [
      "a RangeError",
      new RangeError("Maximum call stack size exceeded"),
      "Maximum call stack size exceeded",
    ],
    ["a TypeError", new TypeError("odd"), "odd"],
    ["a string", "boom", "The expression could not be drawn."],
    ["undefined", undefined, "The expression could not be drawn."],
    ["an object", { message: "not an Error" }, "The expression could not be drawn."],
  ] as const)("catches %s thrown by KaTeX and keeps the last content", (_name, thrown, error) => {
    const host = hostHolding("last preview");
    spy = spyOn(katex, "render").mockImplementation(() => {
      throw thrown;
    });
    expect(draw(host, "x")).toEqual({ error });
    expect(host.marks).toEqual(["last preview"]);
  });

  test("catches an error of the element itself", () => {
    const host = hostHolding("last preview");
    spy = spyOn(katex, "render").mockImplementation(() => undefined);
    host.replaceChildren = () => {
      throw new RangeError("no room");
    };
    expect(draw(host, "x")).toEqual({ error: "no room" });
    expect(host.marks).toEqual(["last preview"]);
  });
});
