// The LaTeX's render options and the one function that draws a preview (latex-kanban-timeline,
// task 4.1; view-and-widgets spec: LaTeX untrusted commands, LaTeX parse errors; design decision 7).
// KaTeX's markup is read through `renderToString`, which needs no DOM, so that Bun can look at what a
// command would put in the page; `renderInto` is run on stand-ins for the preview's element.

import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { LATEX_NESTING_MAX_DEPTH } from "@askboard/contract";
import katex from "katex";
import { parseProblem, renderInto, renderOptions } from "./render.ts";
import {
  type KatexTree,
  LATEX_TREE_BOUNDS,
  LATEX_TREE_MAX_DEPTH,
  LATEX_TREE_MAX_FRACTIONS,
  LATEX_TREE_MAX_NODES,
  renderTree,
  type TreeBounds,
  treeSizeOf,
} from "./tree.ts";

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

// KaTeX's internal tree builder, which `renderTree` looks up on every call: tests put a stand-in or a
// spy in its place, as the earlier tests did with `katex.render`.
type Builder = (expression: string, options: unknown) => KatexTree;
const internals = katex as unknown as { __renderToDomTree: Builder };
const original = internals.__renderToDomTree;

describe("parseProblem", () => {
  let spy: ReturnType<typeof spyOn> | undefined;
  afterEach(() => spy?.mockRestore());

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
      spy = spyOn(internals, "__renderToDomTree").mockImplementation(() => {
        throw thrown;
      });
      expect(parseProblem("x")).toBe(message);
      spy.mockRestore();
    }
  });

  test("builds no node of the page: the tree's toNode is not called", () => {
    let toNode: ReturnType<typeof spyOn> | undefined;
    spy = spyOn(internals, "__renderToDomTree").mockImplementation((expression, options) => {
      const tree = original(expression, options);
      toNode = spyOn(tree, "toNode");
      return tree;
    });
    expect(parseProblem("x^2")).toBeUndefined();
    expect(toNode).toBeDefined();
    expect(toNode).not.toHaveBeenCalled();
  });
});

// A stand-in for an element of the page: its content is a list of marks. `compatMode` is the
// document's: `renderInto` refuses to draw outside standards mode, as `katex.render` does.
const hostHolding = (marks: string[] = [], compatMode = "CSS1Compat") => {
  const host = {
    marks,
    ownerDocument: { compatMode },
    replaceChildren(...nodes: string[]) {
      host.marks = nodes;
    },
  };
  return host;
};
const draw = (host: ReturnType<typeof hostHolding>, expression: string, bounds?: TreeBounds) =>
  renderInto(host as unknown as HTMLElement, expression, bounds);

// A tree whose nodes are the marks the stand-in element holds, measured as the real one is.
const fakeTree = (mark: string, children: unknown[] = []): KatexTree =>
  ({ children, toNode: () => mark, toMarkup: () => mark }) as unknown as KatexTree;

// Bun has no DOM, so the nodes a real tree makes are drawn in the browser file; here a real tree's
// `toNode` is replaced by a spy giving a mark.
const watchTrees = (mark = "drawn") => {
  const toNodes: ReturnType<typeof spyOn>[] = [];
  const spy = spyOn(internals, "__renderToDomTree").mockImplementation((expression, options) => {
    const tree = original(expression, options);
    toNodes.push(spyOn(tree, "toNode").mockImplementation(() => mark as unknown as Node));
    return tree;
  });
  return { spy, toNodes };
};

describe("renderInto", () => {
  let spies: ReturnType<typeof spyOn>[] = [];
  afterEach(() => {
    for (const spy of spies) spy.mockRestore();
    spies = [];
  });

  test("puts the tree it measured into the element, with the render options, and builds it once", () => {
    const host = hostHolding(["old"]);
    let options: unknown;
    const spy = spyOn(internals, "__renderToDomTree").mockImplementation((_e, given) => {
      options = given;
      return fakeTree("new");
    });
    spies = [spy];
    expect(draw(host, "x")).toEqual({});
    expect(spy).toHaveBeenCalledTimes(1);
    expect(options).toEqual(renderOptions());
    expect(host.marks).toEqual(["new"]);
  });

  test("draws what katex.render would: KaTeX's own tree for the expression, once", () => {
    const host = hostHolding(["old"]);
    const { spy, toNodes } = watchTrees();
    spies = [spy];
    expect(draw(host, "\\frac{a}{b}")).toEqual({});
    expect(toNodes).toHaveLength(1);
    expect(toNodes[0]).toHaveBeenCalledTimes(1);
    expect(host.marks).toEqual(["drawn"]);
  });

  test("keeps the last content when the expression does not parse, KaTeX's own error", () => {
    const host = hostHolding(["last preview"]);
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
    const host = hostHolding(["last preview"]);
    spies = [
      spyOn(internals, "__renderToDomTree").mockImplementation(() => {
        throw thrown;
      }),
    ];
    expect(draw(host, "x")).toEqual({ error });
    expect(host.marks).toEqual(["last preview"]);
  });

  test("catches an error of the element itself", () => {
    const host = hostHolding(["last preview"]);
    spies = [spyOn(internals, "__renderToDomTree").mockImplementation(() => fakeTree("new"))];
    host.replaceChildren = () => {
      throw new RangeError("no room");
    };
    expect(draw(host, "x")).toEqual({ error: "no room" });
    expect(host.marks).toEqual(["last preview"]);
  });

  test("catches an error of the tree's own nodes and keeps the last content", () => {
    const host = hostHolding(["last preview"]);
    const tree = fakeTree("new");
    (tree as unknown as { toNode: () => never }).toNode = () => {
      throw new RangeError("no stack");
    };
    spies = [spyOn(internals, "__renderToDomTree").mockImplementation(() => tree)];
    expect(draw(host, "x")).toEqual({ error: "no stack" });
    expect(host.marks).toEqual(["last preview"]);
  });

  test("refuses a document that is not in standards mode, as katex.render does, and fails closed", () => {
    const host = hostHolding(["last preview"], "BackCompat");
    const { spy, toNodes } = watchTrees();
    spies = [spy];
    expect(draw(host, "x")).toEqual({ error: "KaTeX doesn't work in quirks mode." });
    expect(host.marks).toEqual(["last preview"]);
    for (const toNode of toNodes) expect(toNode).not.toHaveBeenCalled();
  });
});

// Task 4.16 (view-and-widgets spec: LaTeX output bounded; design decision 7, Bounded output): the
// output KaTeX builds is measured against the bounds before any node of it is made.
describe("an output past the bounds", () => {
  const sizeOf = (expression: string) => treeSizeOf(renderTree(expression, renderOptions()));
  const nestFrac = (levels: number) => `${"\\frac{".repeat(levels)}a${"}{b}".repeat(levels)}`;
  const scenario = [
    "\\frac{\\frac{\\frac{\\frac{a}{b}}{c}}{d}}{e}",
    "\\frac{\\frac{\\frac{a}{b}}{c}}{d}",
    "\\frac{a}{b}\\frac{c}{d}\\frac{e}{f}\\frac{g}{h}",
  ] as const;
  let spies: ReturnType<typeof spyOn>[] = [];
  afterEach(() => {
    for (const spy of spies) spy.mockRestore();
    spies = [];
  });

  test("LATEX_TREE_BOUNDS holds the measured values", () => {
    expect(LATEX_TREE_MAX_NODES).toBe(21_344);
    expect(LATEX_TREE_MAX_FRACTIONS).toBe(11);
    expect(LATEX_TREE_MAX_DEPTH).toBe(245);
    expect(LATEX_TREE_BOUNDS).toEqual({ depth: 245, nodes: 21_344, fractions: 11 });
    expect(Object.isFrozen(LATEX_TREE_BOUNDS)).toBe(true);
  });

  test.each([
    ["\\frac{a}{b} under a depth of 5", "\\frac{a}{b}", { depth: 5, nodes: 1_000, fractions: 11 }],
    ["2,000 glyphs under 100 nodes", "x".repeat(2_000), { depth: 100, nodes: 100, fractions: 11 }],
    [
      "four nested fractions under a fraction bound of 3",
      scenario[0],
      { depth: 1_000, nodes: 100_000, fractions: 3 },
    ],
  ] as const)(
    "%s: parseProblem and renderInto give tooComplex with the size, and no node is made",
    (_name, expression, bounds) => {
      const size = sizeOf(expression);
      const { spy, toNodes } = watchTrees();
      spies = [spy];
      expect(parseProblem(expression, bounds)).toEqual({ tooComplex: size });
      const host = hostHolding(["last preview"]);
      expect(draw(host, expression, bounds)).toEqual({ tooComplex: size });
      expect(host.marks).toEqual(["last preview"]);
      expect(toNodes.length).toBeGreaterThan(0);
      for (const toNode of toNodes) expect(toNode).not.toHaveBeenCalled();
    },
  );

  test("the size it gives names the three dimensions", () => {
    expect(sizeOf(scenario[0])).toMatchObject({ fractions: 4 });
    expect(Object.keys(sizeOf("x")).sort()).toEqual(["depth", "fractions", "nodes"]);
  });

  test("the scenario: with the fraction bound at 3, four nested fractions are too complex, three and four side by side render", () => {
    const bounds = { depth: 1_000, nodes: 100_000, fractions: 3 };
    const { spy, toNodes } = watchTrees();
    spies = [spy];
    const results = scenario.map((expression) => {
      const host = hostHolding(["last preview"]);
      return { result: draw(host, expression, bounds), marks: host.marks };
    });
    expect(results[0]?.result.tooComplex).toBeDefined();
    expect(results[0]?.marks).toEqual(["last preview"]);
    expect(results[1]).toEqual({ result: {}, marks: ["drawn"] });
    expect(results[2]).toEqual({ result: {}, marks: ["drawn"] });
    expect(toNodes.map((toNode) => toNode.mock.calls.length)).toEqual([0, 1, 1]);
  });

  test("a size at a bound is drawn and one past it is not, for each of the three bounds", () => {
    const expression = nestFrac(6);
    const size = sizeOf(expression);
    const at = { depth: size.depth, nodes: size.nodes, fractions: size.fractions };
    const past = [
      { ...at, depth: size.depth - 1 },
      { ...at, nodes: size.nodes - 1 },
      { ...at, fractions: size.fractions - 1 },
    ];
    expect(parseProblem(expression, at)).toBeUndefined();
    for (const bounds of past)
      expect(parseProblem(expression, bounds)).toEqual({ tooComplex: size });
  });

  test("at the default bounds a flat expression at the node bound is drawn and 60 glyphs more are not", () => {
    // 2 nodes for each glyph past a base of 12; the bound is 21,344 nodes.
    const within = "x".repeat(10_666);
    const past = "x".repeat(10_700);
    expect(sizeOf(within).nodes).toBeLessThanOrEqual(LATEX_TREE_MAX_NODES);
    expect(sizeOf(past).nodes).toBeGreaterThan(LATEX_TREE_MAX_NODES);
    expect(parseProblem(within)).toBeUndefined();
    expect(parseProblem(past)).toEqual({ tooComplex: sizeOf(past) });
  });

  test("at the default bounds the deepest nest the scan admits is drawn", () => {
    const limit = LATEX_NESTING_MAX_DEPTH;
    for (const expression of [
      nestFrac(limit),
      `${"x^{".repeat(Math.floor(limit / 2))}y${"}".repeat(Math.floor(limit / 2))}`,
    ]) {
      const size = sizeOf(expression);
      expect(size.depth, expression).toBeLessThanOrEqual(LATEX_TREE_MAX_DEPTH);
      expect(size.fractions, expression).toBeLessThanOrEqual(LATEX_TREE_MAX_FRACTIONS);
      expect(parseProblem(expression), expression).toBeUndefined();
    }
  });

  test("a refusal by the scan comes before the bounds, and a parse error stays KaTeX's own", () => {
    expect(parseProblem(nestFrac(LATEX_NESTING_MAX_DEPTH + 1))).toEqual({
      refused: { depth: LATEX_NESTING_MAX_DEPTH + 1, limit: LATEX_NESTING_MAX_DEPTH },
    });
    expect(parseProblem("\\frac{1}{", { depth: 1, nodes: 1, fractions: 0 })).toStartWith(
      "KaTeX parse error:",
    );
  });
});

describe("no module of the package calls katex.render or katex.renderToString", () => {
  test("in packages/widgets/src, tests aside", async () => {
    const sources = [...new Bun.Glob("**/*.{ts,tsx}").scanSync(`${import.meta.dir}/../..`)].filter(
      (file) => !/\.test\.tsx?$/.test(file),
    );
    expect(sources.length).toBeGreaterThan(5);
    for (const file of sources) {
      const code = (await Bun.file(`${import.meta.dir}/../../${file}`).text())
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/\bkatex\s*\.\s*render(ToString)?\b/);
      expect(code, file).not.toMatch(
        /import\s*\{[^}]*\brender(ToString)?\b[^}]*\}\s*from\s*["']katex["']/,
      );
    }
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
      { depth: 260, limit: LIMIT },
    ],
  ] as const;
  let spies: ReturnType<typeof spyOn>[] = [];
  afterEach(() => {
    for (const spy of spies) spy.mockRestore();
    spies = [];
  });
  const watchKatex = () => {
    spies = [
      spyOn(internals, "__renderToDomTree"),
      spyOn(katex, "render"),
      spyOn(katex, "renderToString"),
    ];
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
    const { spy } = watchTrees("new");
    spies = [spy];
    expect(draw(host, nest(LIMIT))).toEqual({});
    expect(host.marks).toEqual(["new"]);
  });

  test("a refusal and a parse error stay apart: the error is KaTeX's own message", () => {
    expect(parseProblem("\\frac{1}{")).toStartWith("KaTeX parse error:");
    expect(draw(hostHolding(), "\\frac{1}{").refused).toBeUndefined();
  });
});
