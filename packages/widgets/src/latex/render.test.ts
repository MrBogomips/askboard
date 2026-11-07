// The LaTeX's render options and the one function that draws a preview (latex-kanban-timeline,
// task 4.1; view-and-widgets spec: LaTeX untrusted commands, LaTeX parse errors; design decision 7).
// KaTeX's markup is read through `renderToString`, which needs no DOM, so that Bun can look at what a
// command would put in the page; `renderInto` is run on stand-ins for the preview's element.

import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { LATEX_NESTING_MAX_DEPTH } from "@askboard/contract";
import katex from "katex";
import { parseProblem, renderInto, renderOptions } from "./render.ts";

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
    expect(katexProblem("\\gdef\\foo{1}")).toBeUndefined();
    expect(markupOf("\\gdef\\foo{1}\\foo")).toContain("1");
    const second = katexProblem("\\foo");
    expect(second).toContain("Undefined control sequence: \\foo");
  });

  test.each(["\\gdef\\a{\\a\\a}\\a", "\\def\\a{\\a}\\a"])(
    "%s expands without end and fails within a second",
    (expression) => {
      const started = performance.now();
      const problem = katexProblem(expression);
      expect(performance.now() - started).toBeLessThan(1_000);
      expect(problem).toContain("Too many expansions");
    },
  );
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

// Task 4.11 (view-and-widgets spec: LaTeX bounded work; design decisions 3 and 7): both functions run
// the contract's scan first, so a refused expression never reaches KaTeX.
describe("renderInto and parseProblem refuse before KaTeX", () => {
  const LIMIT = LATEX_NESTING_MAX_DEPTH;
  const nest = (depth: number) => `${"\\sqrt{".repeat(depth)}x${"}".repeat(depth)}`;
  const REFUSED = [
    ["a macro definition", "\\def\\a{x}\\a", { command: "\\def" }],
    ["an internal command", "\\color{x}\\current@color", { command: "\\current@color" }],
    ["one level past the limit", nest(LIMIT + 1), { depth: LIMIT + 1, limit: LIMIT }],
    ["a deep nest", `${"x^{".repeat(130)}y${"}".repeat(130)}`, { depth: 260, limit: LIMIT }],
    [
      "an infix fraction nest, two levels each",
      `${"\\frac{".repeat(8)}x${"\\over y}{x}".repeat(8)}`,
      { depth: 16, limit: LIMIT },
    ],
    [
      "the hidden form: a character code, a blank and an opener",
      `${"\\char` {".repeat(130)}x${"\\over}".repeat(130)}`,
      { depth: 260, limit: LIMIT },
    ],
  ] as const;
  let spies: ReturnType<typeof spyOn>[] = [];
  afterEach(() => {
    for (const spy of spies) spy.mockRestore();
    spies = [];
  });
  const watchKatex = () => {
    spies = [spyOn(katex, "render"), spyOn(katex, "renderToString")];
    return spies;
  };

  test.each(REFUSED)(
    "parseProblem gives the refusal for %s and KaTeX does not run",
    (_what, expression, refused) => {
      const [render, renderToString] = watchKatex();
      expect(parseProblem(expression)).toEqual({ refused });
      expect(render).not.toHaveBeenCalled();
      expect(renderToString).not.toHaveBeenCalled();
    },
  );

  test.each(REFUSED)(
    "renderInto gives the refusal for %s, KaTeX does not run, the element keeps its content",
    (_what, expression, refused) => {
      const host = hostHolding("last preview");
      const [render, renderToString] = watchKatex();
      expect(draw(host, expression)).toEqual({ refused });
      expect(render).not.toHaveBeenCalled();
      expect(renderToString).not.toHaveBeenCalled();
      expect(host.marks).toEqual(["last preview"]);
    },
  );

  test("an expression at the limit is not refused: KaTeX draws it", () => {
    expect(parseProblem(nest(LIMIT))).toBeUndefined();
    const host = hostHolding("old");
    spies = [
      spyOn(katex, "render").mockImplementation((_e, node) => {
        (node as unknown as Node).childNodes = ["new"];
      }),
    ];
    expect(draw(host, nest(LIMIT))).toEqual({});
    expect(host.marks).toEqual(["new"]);
  });

  test("a refusal and a parse error stay apart: the error is KaTeX's own message", () => {
    expect(parseProblem("\\frac{1}{")).toStartWith("KaTeX parse error:");
    expect(draw(hostHolding(), "\\frac{1}{").refused).toBeUndefined();
  });
});
