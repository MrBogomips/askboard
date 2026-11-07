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
