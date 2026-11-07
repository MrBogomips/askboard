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
  test("styles with data: URLs and no import pass", () => {
    const css =
      '@font-face{font-family:A;src:url(data:font/woff2;base64,AAAA) format("woff2")}.a{background:url( "data:image/png;base64,AA" )}.b{color:red}';
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
    ["an escaped r", "u\\72l(http://h/x.png)"],
    ["an escaped r and a blank before l", "u\\72 l(http://h/x.png)"],
    ["an escaped u", "\\75rl(http://h/x.png)"],
    ["an escaped @import", '@\\69mport "http://h/b.css"'],
    ["a string in image-set()", 'image-set("http://h/x.png" 1x)'],
    ["a string in -webkit-image-set()", '-webkit-image-set("http://h/x.png" 1x)'],
    ["an escaped url in a font face", "@font-face{src:u\\72l(http://h/f.woff2)}"],
  ];

  for (const [what, css] of probes) {
    test(`${what} gives one problem naming the chunk: ${css}`, () => {
      const problems = styleUrlProblems("latex", `.a{background:${css}}`);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('"latex"');
      expect(problems[0]).toContain("http://h/");
    });
  }

  test("a problem shows the text as the author wrote it, escapes and all, cut", () => {
    const [problem] = styleUrlProblems("latex", `.a{b:u\\72l(http://h/${"x".repeat(500)}.png)}`);
    expect(problem).toContain("u\\72l(http://h/");
    expect(problem?.length ?? 0).toBeLessThan(300);
  });

  test("data: URLs pass, plain, escaped, inside url() of image-set(), and with an escaped letter", () => {
    const pass = [
      ".a{background:url(data:image/png;base64,AA)}",
      ".a{background:image-set(url(data:image/png;base64,AA) 1x)}",
      '.a{background:image-set(url("data:image/png;base64,AA") 1x, url(data:image/png;base64,BB) 2x)}',
      ".a{background:u\\72l(data:image/png;base64,AA)}",
      ".a{background:\\75\\72\\6c(data:image/png;base64,AA)}",
      ".a{background:url(d\\61ta:image/png;base64,AA)}",
    ];
    for (const css of pass) expect(styleUrlProblems("latex", css), css).toEqual([]);
  });

  test("a comment inside the name ends the identifier: no function, no at-rule, no problem", () => {
    expect(styleUrlProblems("latex", ".a{b:url/**/(http://h/x.png)}")).toEqual([]);
    expect(styleUrlProblems("latex", '@im/**/port "http://h/b.css";')).toEqual([]);
  });

  test("an escaped parenthesis or quote is not syntax, so a string never hides an image-set()", () => {
    expect(styleUrlProblems("latex", ".a{b:url\\28 x}")).toEqual([]);
    expect(styleUrlProblems("latex", '.a{content:"image-set(\\"x\\")"}')).toEqual([]);
    expect(styleUrlProblems("latex", ".a{b:image-set(\\22 x\\22  1x)}")).toEqual([]);
  });

  test("an unquoted url( body is one token: a comment opener or a quote in it hides no image-set()", () => {
    const sheets = [
      '#a{background:url(data:x/*);}#a{background-image:image-set("http://h/c.png" 1x)}#z{background:url(data:y*/)}',
      '#b{background:url(data:x"y);background-image:image-set("http://h/q.png" 1x)}',
      "#b{background:url(data:x'y);background-image:image-set('http://h/q.png' 1x)}",
    ];
    for (const sheet of sheets) expect(styleUrlProblems("latex", sheet), sheet).toHaveLength(1);
    // An escaped parenthesis stays inside the token; the unterminated body ends at the text's end.
    expect(styleUrlProblems("latex", ".a{b:url(data:x\\)y)}")).toEqual([]);
    expect(styleUrlProblems("latex", "url(data:x")).toEqual([]);
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
      styleUrlProblems("x", ".a{b:IMAGE-SET(url(data:a) 1x, 'http://h/y.png' 2x)}"),
    ).toHaveLength(1);
    expect(styleUrlProblems("x", '.a{b:image-set("a" 1x, "b" 2x)}')).toHaveLength(2);
    expect(styleUrlProblems("x", '.a{b:image-set(image-set("a" 1x) 1x)}')).toHaveLength(1);
    expect(styleUrlProblems("x", '.a{b:image-set(url(data:a) 1x)}.c{content:"x"}')).toEqual([]);
  });

  test("an unterminated string, an unterminated function and a trailing backslash do not throw", () => {
    expect(() => styleUrlProblems("x", '.a{b:image-set("http://h/x')).not.toThrow();
    expect(styleUrlProblems("x", '.a{b:image-set("http://h/x')).toHaveLength(1);
    expect(() => styleUrlProblems("x", ".a{b:url(")).not.toThrow();
    expect(styleUrlProblems("x", ".a{b:c\\")).toEqual([]);
  });

  test("escapes of no code point, a surrogate or past U+10FFFF read as U+FFFD, a hex run stops at six digits", () => {
    expect(styleUrlProblems("x", ".a{b:u\\0rl(http://h/x)}")).toEqual([]);
    expect(styleUrlProblems("x", ".a{b:u\\D800 rl(http://h/x)}")).toEqual([]);
    expect(styleUrlProblems("x", ".a{b:\\000075rl(http://h/x)}")).toHaveLength(1);
    expect(styleUrlProblems("x", ".a{b:\\0000075rl(http://h/x)}")).toEqual([]);
  });

  test("a long run of backslashes and blanks is read in one pass (no timing assertion)", () => {
    const hostile = `${"\\ ".repeat(50_000)}${" ".repeat(50_000)}url(${" ".repeat(50_000)}x)`;
    expect(styleUrlProblems("x", hostile).length).toBeGreaterThan(0);
  });
});
