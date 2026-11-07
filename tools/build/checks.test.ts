import { describe, expect, test } from "bun:test";
import {
  boardPageInputProblems,
  hostOnlyNeedProblems,
  importMetaProblem,
  inlineScript,
  inlineStyleProblem,
  styleUrlProblems,
} from "./checks.ts";

describe("import.meta in a chunk (AD-9)", () => {
  test("a chunk holding import.meta fails, naming the chunk", () => {
    const problem = importMetaProblem("graph", "(()=>{var u=import.meta.url;console.log(u)})();");
    expect(problem).toContain('"graph"');
    expect(problem).toContain("import.meta");
  });

  test("import.meta with spaces around the dot counts too", () => {
    expect(importMetaProblem("shell", "var x = import . meta;")).toContain('"shell"');
  });

  test("a chunk without it passes, even with an import-like word", () => {
    expect(importMetaProblem("shell", "(()=>{var important={meta:1};})();")).toBeUndefined();
  });
});

describe("inline scripts", () => {
  test("a script end in a string is escaped, so the inline script does not end early", () => {
    const { code, problems } = inlineScript("react", 'var s="</script>",t="</SCRIPT ";');
    expect(problems).toEqual([]);
    expect(code).toBe('var s="<\\/script>",t="<\\/SCRIPT ";');
  });

  test("an HTML comment opener is escaped, so the parser stays in script data", () => {
    const { code } = inlineScript("react", 'var s="<!--";');
    expect(code).toBe('var s="\\x3C!--";');
  });

  test("a raw carriage return or NUL fails, since the HTML parser would change the hashed text", () => {
    expect(inlineScript("react", "var a=1;\r\nvar b=2;").problems[0]).toContain('"react"');
    expect(inlineScript("react", "var a='\0';").problems[0]).toContain("NUL");
  });

  test("a style holding a style end tag fails, naming the chunk", () => {
    expect(inlineStyleProblem("choice", ".a{content:'</style>'}")).toContain('"choice"');
    expect(inlineStyleProblem("choice", ".a{color:red}")).toBeUndefined();
  });

  test("a style with a raw carriage return fails", () => {
    expect(inlineStyleProblem("choice", ".a{}\r\n.b{}")).toContain("carriage return");
  });
});

describe("the board page bundles no schema compiler", () => {
  test("Ajv's run-time helpers pass", () => {
    const inputs = [
      "packages/view/src/board-page/index.ts",
      "node_modules/.bun/ajv@8.20.0/node_modules/ajv/dist/runtime/ucs2length.js",
    ];
    expect(boardPageInputProblems(inputs)).toEqual([]);
  });

  test("Ajv's compiler and the contract's validation module fail, naming each input", () => {
    const inputs = [
      "node_modules/.bun/ajv@8.20.0/node_modules/ajv/dist/compile/index.js",
      "packages/contract/src/validate.ts",
    ];
    const problems = boardPageInputProblems(inputs);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("ajv/dist/compile/index.js");
    expect(problems[1]).toContain("packages/contract/src/validate.ts");
  });
});

describe("host-only chunks are needed only by host-only chunks (snapshot design decision 5)", () => {
  const extApps = { name: "ext-apps", hostOnly: true, needs: [] };

  test("chunks that do not need them pass, and so does a host-only chunk needing one", () => {
    const channel = { name: "channel", hostOnly: true, needs: ["ext-apps"] };
    const shell = { name: "shell", needs: ["radix", "react"] };
    expect(hostOnlyNeedProblems([extApps, channel, shell])).toEqual([]);
  });

  test("a chunk that is not host-only and needs one fails, naming both", () => {
    const shell = { name: "shell", needs: ["ext-apps", "react"] };
    const choice = { name: "choice", hostOnly: undefined, needs: ["ext-apps"] };
    expect(hostOnlyNeedProblems([shell, extApps, choice])).toEqual([
      'the chunk "shell" needs the host-only chunk "ext-apps", which only a view with a host loads: take it from the shared-module registry when there is one, never by an import',
      'the chunk "choice" needs the host-only chunk "ext-apps", which only a view with a host loads: take it from the shared-module registry when there is one, never by an import',
    ]);
  });
});

describe("styles that request nothing (design decision 8; view spec, Package stylesheets in a chunk)", () => {
  test("a font face holding a woff2 data: URL, and plain styles, pass", () => {
    const css =
      '@font-face{font-family:A;src:url(data:font/woff2;base64,AAAA) format("woff2")}.a{color:red}.b{content:"url(x.png)"}';
    expect(styleUrlProblems("latex", css)).toEqual([]);
    expect(styleUrlProblems("latex", "")).toEqual([]);
  });

  test("a url naming a file fails, naming the chunk and the URL", () => {
    const [problem, ...rest] = styleUrlProblems("latex", ".a{src:url(fonts/a.svg)}");
    expect(rest).toEqual([]);
    expect(problem).toContain('"latex"');
    expect(problem).toContain("fonts/a.svg");
  });

  test("quoted, spaced and upper-case urls fail too, each once", () => {
    const problems = styleUrlProblems(
      "kanban",
      ".a{background:url(\"x.png\")}.b{background:URL( 'y.png' )}.c{background:url(https://example.com/z.png)}",
    );
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toContain("x.png");
    expect(problems.join("\n")).toContain("y.png");
    expect(problems.join("\n")).toContain("https://example.com/z.png");
  });

  test("an @import fails, naming the chunk and the import, with a string or a url", () => {
    const [first] = styleUrlProblems("shell", '@import "b.css";.a{}');
    expect(first).toContain('"shell"');
    expect(first).toContain("@import");
    expect(first).toContain("b.css");
    expect(styleUrlProblems("shell", "@IMPORT url(data:text/css,a{});").length).toBeGreaterThan(0);
  });

  test("a very long url is cut in the message", () => {
    const [problem] = styleUrlProblems("x", `.a{background:url(${"a".repeat(500)})}`);
    expect(problem?.length ?? 0).toBeLessThan(300);
  });
});

// The group 3 review's probe forms (X-2): CSS Syntax decodes an identifier's escapes before it reads
// `url(` and an at-rule's name, and `image-set()` reads a quoted string as a URL.
describe("escaped and string URLs in styles (latex-kanban-timeline, task 3.5, review X-2)", () => {
  const probes: [string, string][] = [
    ["an escaped r", ".a{background:u\\72l(http://h/x.png)}"],
    ["an escaped r and a blank before l", ".a{background:u\\72 l(http://h/x.png)}"],
    ["an escaped u", ".a{background:\\75rl(http://h/x.png)}"],
    ["an escaped @import", '@\\69mport "http://h/b.css";'],
    ["a string in image-set()", '.a{background:image-set("http://h/x.png" 1x)}'],
    ["a string in -webkit-image-set()", '.a{background:-webkit-image-set("http://h/x.png" 1x)}'],
    ["an escaped url in a font face", "@font-face{src:u\\72l(http://h/f.woff2)}"],
  ];

  for (const [what, css] of probes) {
    test(`${what} gives one problem naming the chunk: ${css}`, () => {
      const problems = styleUrlProblems("latex", css);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('"latex"');
      expect(problems[0]).toContain("http://h/");
    });
  }

  test("a problem shows the URL as decoded, cut", () => {
    const [problem] = styleUrlProblems("latex", `.a{b:u\\72l(http://h/${"x".repeat(500)}.png)}`);
    expect(problem).toContain("http://h/xxx");
    expect(problem).not.toContain("u\\72l");
    expect(problem?.length ?? 0).toBeLessThan(300);
  });

  test("a comment inside the name ends the identifier: url/**/( is no url, and may only refuse more", () => {
    expect(() => styleUrlProblems("latex", ".a{b:url/**/(http://h/x.png)}")).not.toThrow();
    expect(() => styleUrlProblems("latex", '@im/**/port "http://h/b.css";')).not.toThrow();
  });

  test("an escaped parenthesis or quote is not syntax, so a string never hides an image-set()", () => {
    expect(styleUrlProblems("latex", ".a{b:url\\28 x}")).toEqual([]);
    expect(styleUrlProblems("latex", '.a{content:"image-set(\\"x\\")"}')).toEqual([]);
    expect(styleUrlProblems("latex", ".a{b:image-set(\\22 x\\22  1x)}")).toEqual([]);
  });

  test("an unquoted url( body is one token: a comment opener or a quote in it hides no image-set()", () => {
    const sheet =
      '#a{background:url(data:x/*);}#a{background-image:image-set("http://h/c.png" 1x)}#z{background:url(data:y*/)}';
    expect(styleUrlProblems("latex", sheet).join("\n")).toContain("http://h/c.png");
    // A quote inside an unquoted body is a bad url: the styles do not parse, which is a problem.
    for (const bad of [
      '#b{background:url(data:x"y);background-image:image-set("http://h/q.png" 1x)}',
      "#b{background:url(data:x'y);background-image:image-set('http://h/q.png' 1x)}",
    ]) {
      expect(styleUrlProblems("latex", bad).join("\n"), bad).toContain("do not parse");
    }
    // An escaped parenthesis stays inside the token; an unterminated body is no valid URL.
    expect(styleUrlProblems("latex", ".a{b:url(data:x\\)y)}")).toHaveLength(1);
    expect(styleUrlProblems("latex", "url(data:x")).not.toEqual([]);
  });

  test("an apostrophe in a comment or a string does not swallow an image-set() that follows", () => {
    for (const lead of ["/* it's */", '.a{content:"it\'s"}', "/* a */ /* b' */"]) {
      const problems = styleUrlProblems(
        "latex",
        `${lead}.b{b:image-set("http://h/x.png" 1x)}/* c' */`,
      );
      expect(problems, lead).toHaveLength(1);
    }
  });

  test("image-set() with a string in any of its sources, any case, or nested, is refused once per string", () => {
    expect(
      styleUrlProblems("x", ".a{b:IMAGE-SET(url(data:a) 1x, 'http://h/y.png' 2x)}").join("\n"),
    ).toContain("http://h/y.png");
    expect(styleUrlProblems("x", '.a{--b:image-set("a" 1x, "b" 2x)}')).toHaveLength(2);
    expect(styleUrlProblems("x", '.a{--b:image-set(image-set("a" 1x) 1x)}')).toHaveLength(1);
    expect(styleUrlProblems("x", '.a{--b:image-set(foo("a") 1x)}')).toHaveLength(1);
    expect(styleUrlProblems("x", '.a{--b:foo("a") 1x}.c{content:"x"}')).toEqual([]);
  });

  test("an unterminated string, an unterminated function and a trailing backslash do not throw", () => {
    expect(() => styleUrlProblems("x", '.a{b:image-set("http://h/x')).not.toThrow();
    expect(styleUrlProblems("x", '.a{b:image-set("http://h/x').length).toBeGreaterThan(0);
    expect(() => styleUrlProblems("x", ".a{b:url(")).not.toThrow();
    expect(() => styleUrlProblems("x", ".a{b:c\\")).not.toThrow();
  });

  test("a long run of backslashes and blanks ends in a problem (no timing assertion)", () => {
    const hostile = `${"\\ ".repeat(50_000)}${" ".repeat(50_000)}url(${" ".repeat(50_000)}x)`;
    expect(styleUrlProblems("x", hostile).length).toBeGreaterThan(0);
  });
});

// The 4.7 re-review's X-3: a function whose name only ends in `url` opens a function with strings
// of its own, which a tokenizer written beside CSS Syntax read as a url token (task 3.9).
describe("styles are parsed, not tokenized (latex-kanban-timeline, task 3.9, review X-3)", () => {
  const hide = (call: string) =>
    `#a{--v:${call}}#b{background-image:image-set("http://h/x.png" 1x)}`;

  test("a function whose name ends in url hides no image-set(): xurl, myurl and --url", () => {
    const forms = [hide('xurl(data:a ")")'), hide("myurl(data:a ')')"), hide('--url(data:a ")")')];
    for (const css of forms) {
      const problems = styleUrlProblems("latex", css);
      expect(problems, css).toHaveLength(1);
      expect(problems[0]).toContain('"latex"');
      expect(problems[0]).toContain("http://h/x.png");
    }
  });

  test("a data: URL outside a font face is a problem: plain, in image-set(), escaped", () => {
    const forms = [
      "a{background:url(data:image/png;base64,AAAA)}",
      "a{background:image-set(url(data:image/png;base64,AAAA) 1x)}",
      "a{background:u\\72l(data:image/png;base64,AAAA)}",
      'a{background:url( "data:image/png;base64,AAAA" )}',
    ];
    for (const css of forms) {
      const problems = styleUrlProblems("latex", css);
      expect(problems, css).toHaveLength(1);
      expect(problems[0]).toContain('"latex"');
      expect(problems[0]).toContain("data:image/png");
    }
  });

  test("a font face passes only with a woff2 data: URL, as the font rewrite makes it", () => {
    const face = (src: string) => `@font-face{font-family:A;src:${src}}`;
    expect(
      styleUrlProblems("latex", face('url(data:font/woff2;base64,AAAA) format("woff2")')),
    ).toEqual([]);
    expect(
      styleUrlProblems(
        "latex",
        face('local("A"), url(data:font/woff2;base64,AAAA) format("woff2")'),
      ),
    ).toEqual([]);
    for (const src of [
      "url(data:font/woff;base64,AAAA)",
      "url(data:image/png;base64,AAAA)",
      "url(f.woff2)",
      'url(data:font/woff2;base64,AAAA), url("http://h/f.woff2")',
    ]) {
      expect(styleUrlProblems("latex", face(src)), src).toHaveLength(1);
    }
    // Only the source of a font face is the exception, not another property or a custom property.
    expect(
      styleUrlProblems("latex", "@font-face{font-family:A;--q:url(data:font/woff2;base64,AAAA)}"),
    ).toHaveLength(1);
    expect(styleUrlProblems("latex", ".a{src:url(data:font/woff2;base64,AAAA)}")).toHaveLength(1);
  });

  test("styles that do not parse are one problem naming the chunk and the parser's message", () => {
    const problems = styleUrlProblems("latex", "a{background:url(http://h/x y.png)}");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"latex"');
    expect(problems[0]).toContain("BadUrl");
  });

  test("an escaped function name and rules inside @media, @supports and @layer are reached", () => {
    const forms = [
      '.a{--w:imag\\65-set("http://h/y.png" 1x)}',
      '@media (min-width:1px){.a{background:url("http://h/y.png")}}',
      '@supports (display:grid){.a{--w:image-set("http://h/y.png" 1x)}}',
      "@layer a{@media print{.a{background:url(http://h/y.png)}}}",
      ".a{.b{background:url(http://h/y.png)}}",
      "@unknown url(http://h/y.png){.a{color:red}}",
      "@property --x{syntax:'*';inherits:false;initial-value:url(http://h/y.png)}",
      ".a{cursor:url(http://h/y.png) 1 1,auto}",
      ".a{--z:foo(url(http://h/y.png))}",
    ];
    for (const css of forms) {
      const problems = styleUrlProblems("latex", css);
      expect(problems, css).toHaveLength(1);
      expect(problems[0]).toContain("http://h/y.png");
    }
  });

  test("an @import in any spelling is one problem, with the import named", () => {
    for (const css of ['@import "http://h/b.css";', '@\\69mport url("http://h/b.css");']) {
      const problems = styleUrlProblems("latex", css);
      expect(problems, css).toHaveLength(1);
      expect(problems[0]).toContain("@import");
      expect(problems[0]).toContain("http://h/b.css");
    }
  });

  test("a deeply nested value ends in a problem or an error, never a pass", () => {
    const nested = `.a{--v:${"image-set(".repeat(5_000)}"http://h/x.png"${")".repeat(5_000)}}`;
    let verdict: string[] | undefined;
    try {
      verdict = styleUrlProblems("latex", nested);
    } catch {
      verdict = undefined;
    }
    if (verdict !== undefined) expect(verdict.length).toBeGreaterThan(0);
  });
});
