// The LaTeX's render options and the functions that draw a preview (latex-kanban-timeline, task
// 4.1; latex-public-api, task 2.1; view-and-widgets spec: LaTeX source and preview, LaTeX untrusted
// commands, LaTeX parse errors, LaTeX bounded work). Only KaTeX's documented interface is used here:
// `render`, `renderToString`, `ParseError` and the options. KaTeX's markup is read through
// `renderToString`, which needs no DOM, so that Bun can look at what a command would put in the
// page; `renderInto` is run on stand-ins for the preview's element and its document, with a spy on
// `katex.render`.

import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { LATEX_NESTING_MAX_DEPTH } from "@askboard/contract";
import katex from "katex";
import { parseProblem, renderInto, renderOptions } from "./render.ts";

const markupOf = (expression: string): string => katex.renderToString(expression, renderOptions());

// KaTeX's own verdict on an expression, with the render options and without the contract's scan:
// what KaTeX does with the definitions that `parseProblem` and `renderInto` refuse before it runs.
const thrownBy = (expression: string): unknown => {
  try {
    markupOf(expression);
    return undefined;
  } catch (error) {
    return error;
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

  test.each(COMMANDS)(
    "%s gives no anchor, image, class, ID, style or data attribute",
    (expression, name) => {
      const markup = withoutAnnotation(markupOf(expression));
      expect(markup).not.toMatch(/<(a|img)[\s>]/);
      expect(markup).not.toContain("href=");
      expect(markup).not.toContain("example.com");
      expect(markup).not.toContain("evil");
      const attributes = [...markup.matchAll(/\s([A-Za-z][\w:-]*)="/g)].map(
        ([, attribute]) => attribute as string,
      );
      expect(attributes.filter((name) => /^(id|href|src|data-.*|on.*)$/.test(name))).toEqual([]);
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
    expect(thrownBy("\\gdef\\foo{1}")).toBeUndefined();
    expect(thrownBy("\\gdef\\foo{1}\\foo")).toBeUndefined();
    expect(thrownBy("\\foo")).toBeInstanceOf(katex.ParseError);
  });

  test.each(["\\gdef\\a{\\a\\a}\\a", "\\def\\a{\\a}\\a"])(
    "%s expands without end and fails within a second",
    (expression) => {
      const started = performance.now();
      const problem = thrownBy(expression);
      expect(performance.now() - started).toBeLessThan(1_000);
      expect(problem).toBeInstanceOf(katex.ParseError);
    },
  );
});

describe("parseProblem", () => {
  let spy: ReturnType<typeof spyOn> | undefined;
  afterEach(() => spy?.mockRestore());

  test("is KaTeX's own message for an expression that does not parse", () => {
    const problem = parseProblem("\\frac{1}{");
    const thrown = thrownBy("\\frac{1}{");
    expect(thrown).toBeInstanceOf(katex.ParseError);
    expect(typeof problem).toBe("string");
    expect(problem).toBe((thrown as Error).message);
    expect(problem).not.toBe("");
  });

  test("gives nothing for an expression that is drawn, and for the empty one", () => {
    expect(parseProblem("a^2+b^2=c^2")).toBeUndefined();
    expect(parseProblem("")).toBeUndefined();
  });

  test("gives the refusal of the scan, and KaTeX does not run", () => {
    spy = spyOn(katex, "renderToString");
    expect(parseProblem("\\def\\a{x}\\a")).toEqual({ refused: { command: "\\def" } });
    expect(spy).not.toHaveBeenCalled();
  });

  test("gives a message for any Error KaTeX throws, and no text for a value that is none (the component shows the string tables' fallback)", () => {
    for (const [thrown, message] of [
      [new RangeError("deep"), "deep"],
      [new katex.ParseError("bad"), new katex.ParseError("bad").message],
      ["plain text", ""],
      [undefined, ""],
      [{ message: "not an Error" }, ""],
    ] as const) {
      spy = spyOn(katex, "renderToString").mockImplementation(() => {
        throw thrown;
      });
      expect(parseProblem("x")).toBe(message);
      spy.mockRestore();
    }
  });

  test("runs KaTeX with the render options", () => {
    let options: unknown;
    spy = spyOn(katex, "renderToString").mockImplementation((_expression, given) => {
      options = given;
      return "";
    });
    expect(parseProblem("x")).toBeUndefined();
    expect(options).toEqual(renderOptions());
  });
});

// Stand-ins for the preview's element and its document (Bun has no DOM): the document makes the
// scratch element, which holds what a spy on `katex.render` puts in it; the element's content is a
// list of marks.
type Scratch = { childNodes: string[] };
const hostHolding = (marks: string[] = []) => {
  const scratches: Scratch[] = [];
  const host = {
    marks,
    scratches,
    ownerDocument: {
      createElement: (tag: string) => {
        const scratch: Scratch = { childNodes: [] };
        scratches.push(scratch);
        expect(tag).toBe("span");
        return scratch;
      },
    },
    replaceChildren(...nodes: string[]) {
      host.marks = nodes;
    },
  };
  return host;
};
const draw = (host: ReturnType<typeof hostHolding>, expression: string) =>
  renderInto(host as unknown as HTMLElement, expression);

describe("renderInto", () => {
  let spies: ReturnType<typeof spyOn>[] = [];
  afterEach(() => {
    for (const spy of spies) spy.mockRestore();
    spies = [];
  });

  test("draws into an element outside the page with the render options, then replaces the element's children", () => {
    const host = hostHolding(["old"]);
    const calls: { expression: unknown; target: unknown; options: unknown; seen: string[] }[] = [];
    spies = [
      spyOn(katex, "render").mockImplementation((expression, target, options) => {
        // The element still holds its last render while KaTeX draws.
        calls.push({ expression, target, options, seen: [...host.marks] });
        (target as unknown as Scratch).childNodes = ["new 1", "new 2"];
      }),
    ];
    expect(draw(host, "\\frac{a}{b}")).toEqual({});
    expect(calls).toHaveLength(1);
    expect(calls[0]?.expression).toBe("\\frac{a}{b}");
    expect(calls[0]?.options).toEqual(renderOptions());
    expect(calls[0]?.target).toBe(host.scratches[0] as unknown);
    expect(calls[0]?.seen).toEqual(["old"]);
    expect(host.scratches).toHaveLength(1);
    expect(host.marks).toEqual(["new 1", "new 2"]);
  });

  test("keeps the last content when the expression does not parse, KaTeX's own ParseError", () => {
    const host = hostHolding(["last preview"]);
    const parseError = new katex.ParseError("bad brace");
    spies = [
      spyOn(katex, "render").mockImplementation((_e, target) => {
        // KaTeX empties its target before it parses.
        (target as unknown as Scratch).childNodes = [];
        throw parseError;
      }),
    ];
    expect(draw(host, "\\frac{1}{")).toEqual({ error: parseError.message });
    expect(host.marks).toEqual(["last preview"]);
  });

  test.each([
    [
      "a RangeError",
      new RangeError("Maximum call stack size exceeded"),
      "Maximum call stack size exceeded",
    ],
    ["a TypeError", new TypeError("odd"), "odd"],
    ["a string", "boom", ""],
    ["undefined", undefined, ""],
    ["an object", { message: "not an Error" }, ""],
  ] as const)("catches %s thrown by KaTeX and keeps the last content", (_name, thrown, error) => {
    const host = hostHolding(["last preview"]);
    spies = [
      spyOn(katex, "render").mockImplementation(() => {
        throw thrown;
      }),
    ];
    expect(draw(host, "x")).toEqual({ error });
    expect(host.marks).toEqual(["last preview"]);
  });

  test("catches an error of the element itself and of its document", () => {
    const host = hostHolding(["last preview"]);
    spies = [spyOn(katex, "render").mockImplementation(() => undefined)];
    host.replaceChildren = () => {
      throw new RangeError("no room");
    };
    expect(draw(host, "x")).toEqual({ error: "no room" });
    expect(host.marks).toEqual(["last preview"]);
    host.ownerDocument.createElement = () => {
      throw new TypeError("no document");
    };
    expect(draw(host, "x")).toEqual({ error: "no document" });
    expect(host.marks).toEqual(["last preview"]);
  });
});

// view-and-widgets spec: LaTeX untrusted commands, "The expression is the only KaTeX caller": in
// `packages/widgets/src`, `render.ts` alone imports `katex`, so every draw passes the scan.
describe("only render.ts imports katex", () => {
  test("in packages/widgets/src, tests aside", async () => {
    const root = `${import.meta.dir}/../..`;
    const sources = [...new Bun.Glob("**/*.{ts,tsx}").scanSync(root)].filter(
      (file) => !/\.test\.tsx?$/.test(file),
    );
    expect(sources).toContain("src/latex/render.ts");
    const importers: string[] = [];
    for (const file of sources) {
      const code = (await Bun.file(`${root}/${file}`).text())
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      if (/from\s*["']katex["']|require\(\s*["']katex["']|import\(\s*["']katex["']/.test(code)) {
        importers.push(file);
      }
    }
    expect(importers).toEqual(["src/latex/render.ts"]);
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
      `${"\\frac{".repeat(11)}x${"\\over y}{x}".repeat(11)}`,
      { depth: 22, limit: LIMIT },
    ],
    [
      "the hidden form: a character code, a blank and an opener",
      `${"\\char` {".repeat(130)}x${"\\over}".repeat(130)}`,
      { command: "\\char`" },
    ],
    [
      "\\show taking a \\verb token whole, in fractions",
      `${"\\frac{\\show\\verb|}|".repeat(18)}x${"}{x}".repeat(18)}`,
      { command: "\\show" },
    ],
    [
      "\\show taking a \\verb token whole, in batches of \\sqrt{",
      `${`${"\\sqrt{".repeat(11)}\\show\\verb|${"}".repeat(11)}|`.repeat(12)}x${"}".repeat(132)}`,
      { command: "\\show" },
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
      const watched = watchKatex();
      expect(parseProblem(expression)).toEqual({ refused });
      for (const spy of watched) expect(spy).not.toHaveBeenCalled();
    },
  );

  test.each(REFUSED)(
    "renderInto gives the refusal for %s, KaTeX does not run, the element keeps its content",
    (_what, expression, refused) => {
      const host = hostHolding(["last preview"]);
      const watched = watchKatex();
      expect(draw(host, expression)).toEqual({ refused });
      for (const spy of watched) expect(spy).not.toHaveBeenCalled();
      expect(host.marks).toEqual(["last preview"]);
    },
  );

  test("an expression at the limit is not refused: KaTeX draws it", () => {
    expect(parseProblem(nest(LIMIT))).toBeUndefined();
    const host = hostHolding(["old"]);
    spies = [
      spyOn(katex, "render").mockImplementation((_e, target) => {
        (target as unknown as Scratch).childNodes = ["new"];
      }),
    ];
    expect(draw(host, nest(LIMIT))).toEqual({});
    expect(host.marks).toEqual(["new"]);
  });

  test("a refusal and a parse error stay apart: the error is KaTeX's own message", () => {
    expect(typeof parseProblem("\\frac{1}{")).toBe("string");
    expect(parseProblem("\\frac{1}{")).not.toBe("");
    expect(parseProblem("\\frac{1}{")).toBe((thrownBy("\\frac{1}{") as Error).message);
  });

  test("stacked combining marks past the limit are refused before KaTeX, like any nest", () => {
    const expression = `a${"\u0301".repeat(48)}`;
    expect(parseProblem(expression)).toEqual({ refused: { depth: 49, limit: LIMIT } });
    const host = hostHolding(["last preview"]);
    const watched = watchKatex();
    expect(draw(host, expression)).toEqual({ refused: { depth: 49, limit: LIMIT } });
    for (const spy of watched) expect(spy).not.toHaveBeenCalled();
    expect(host.marks).toEqual(["last preview"]);
  });
});
