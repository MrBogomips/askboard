import { describe, expect, test } from "bun:test";
import type { Bundle } from "./chunks.ts";
import { assembleChunkStyles, BOARD_PAGE, finish } from "./view.ts";

// The URL check's reach (latex-kanban-timeline, task 3.6, group 3 review S-1): a chunk's own
// styles, the board page's and a package's stylesheet each pass through `assembleChunkStyles`, and
// `finish` fails the build on what it reports, with no build needed to see it.

const OWN = ".own{color:red}";
const PACKAGE = ".pkg{font-family:P}";

describe("the assembly of a chunk's styles (design decision 8)", () => {
  test("clean parts give no problem, and the styles are the own part then the package part", () => {
    expect(assembleChunkStyles({ chunk: "choice", own: OWN, packages: PACKAGE })).toEqual({
      css: `${OWN}\n${PACKAGE}`,
      problems: [],
    });
  });

  test("an empty part is left out, and no styles at all stay empty", () => {
    expect(assembleChunkStyles({ chunk: "choice", own: OWN }).css).toBe(OWN);
    expect(assembleChunkStyles({ chunk: "choice", own: "", packages: PACKAGE }).css).toBe(PACKAGE);
    expect(assembleChunkStyles({ chunk: "choice", own: "", packages: "" })).toEqual({
      css: "",
      problems: [],
    });
  });

  for (const chunk of ["choice", BOARD_PAGE]) {
    test(`own styles holding url(x.png) give a problem naming "${chunk}"`, () => {
      const { problems } = assembleChunkStyles({
        chunk,
        own: ".a{background:url(x.png)}",
        packages: PACKAGE,
      });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain(`"${chunk}"`);
      expect(problems[0]).toContain("x.png");
    });
  }

  test("an @import in the own part gives one", () => {
    const { problems } = assembleChunkStyles({
      chunk: "choice",
      own: '@import "b.css";.a{}',
      packages: PACKAGE,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("@import");
  });

  test("a package stylesheet's url( gives one, and so does an escaped one", () => {
    const named = assembleChunkStyles({ chunk: "latex", own: OWN, packages: ".p{b:url(f.svg)}" });
    expect(named.problems).toHaveLength(1);
    expect(named.problems[0]).toContain('"latex"');
    expect(named.problems[0]).toContain("f.svg");
    const escaped = assembleChunkStyles({
      chunk: "latex",
      own: OWN,
      packages: ".p{b:u\\72l(http://h/f.svg)}",
    });
    expect(escaped.problems).toHaveLength(1);
  });

  test("a style end tag in either part gives the inline problem", () => {
    for (const parts of [{ own: ".a{content:'</style>'}" }, { own: OWN, packages: "</STYLE >" }]) {
      const { problems } = assembleChunkStyles({ chunk: "choice", ...parts });
      expect(problems.join("\n")).toContain('"choice"');
    }
  });

  test("each part's problems are reported together", () => {
    const { problems } = assembleChunkStyles({
      chunk: "choice",
      own: ".a{b:url(x.png)}",
      packages: ".p{b:url(y.png)}",
    });
    expect(problems).toHaveLength(2);
  });
});

describe("`finish` fails the build on the assembly's problems, for every chunk and the board page", () => {
  const bundle: Bundle = { code: "var a=1;", inputs: [] };
  const run = (name: string, own: string, packages?: string) =>
    finish(
      name,
      name === BOARD_PAGE ? "document" : "utilities",
      bundle,
      "unused",
      {},
      packages === undefined ? undefined : { css: packages, files: [], fonts: [] },
      async () => own,
    );

  for (const name of ["choice", "shell", BOARD_PAGE]) {
    test(`own styles holding url(x.png) fail "${name}"`, async () => {
      const error = await run(name, ".a{background:url(x.png)}").catch((e) => e);
      expect(String(error)).toContain(`"${name}"`);
      expect(String(error)).toContain("x.png");
    });
  }

  test("an @import in a chunk's own part, or a url( in its package part, fails", async () => {
    expect(String(await run("choice", '@import "b.css";').catch((e) => e))).toContain("@import");
    expect(String(await run("choice", OWN, ".p{b:url(f.svg)}").catch((e) => e))).toContain("f.svg");
  });

  test("clean parts finish with the own part then the package part, and no font", async () => {
    const done = await run("choice", OWN, PACKAGE);
    expect(done.styles).toBe(`${OWN}\n${PACKAGE}`);
    expect(done.fonts).toEqual([]);
    expect(done.notices).toEqual([]);
    expect(done.script).toBe("var a=1;");
  });
});
