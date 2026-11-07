import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { styleUrlProblems } from "./checks.ts";
import { resolveFromWidgets } from "./paths.ts";
import { CHUNK_STYLESHEETS, inlineFontFaces, loadChunkStylesheets } from "./stylesheets.ts";

// The stylesheets sit in a package folder under node_modules, as a real package's do: the build
// names the package of a stylesheet whose fonts it inlines (task 3.4).
let root = "";
let dir = "";
const WOFF2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 1, 2, 3]);
const base64 = Buffer.from(WOFF2).toString("base64");

const fixture = (name: string, css: string) => Bun.write(join(dir, name), css);
const resolver = (specifier: string) => join(dir, specifier);

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "askboard-stylesheets-"));
  dir = join(root, "node_modules", "pkg");
  await Bun.write(join(dir, "package.json"), '{"name":"pkg","version":"1.0.0"}');
  await mkdir(join(dir, "fonts"), { recursive: true });
  for (const name of ["a.woff2", "b.woff2"]) await Bun.write(join(dir, "fonts", name), WOFF2);
  for (const name of ["a.woff", "a.ttf", "b.woff", "b.ttf"]) {
    await Bun.write(join(dir, "fonts", name), new Uint8Array([9, 9]));
  }
  await fixture(
    "faces.css",
    '@font-face{font-family:A;src:url(fonts/a.woff2) format("woff2"),url(fonts/a.woff) format("woff"),url(fonts/a.ttf) format("truetype");font-weight:400}' +
      "@font-face{font-family:B;src:url('fonts/b.woff2') format('woff2'), url('fonts/b.woff') format('woff'), url('fonts/b.ttf') format('truetype')}" +
      ".katex{font:normal 1.21em A,B}",
  );
  await fixture("svg.css", "@font-face{font-family:C;src:url(fonts/a.svg) format('svg')}");
  await fixture("import.css", '@import "b.css";.a{color:red}');
  await fixture(
    "missing-font.css",
    "@font-face{font-family:D;src:url(fonts/none.woff2) format('woff2')}",
  );
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("the fonts of a package stylesheet (view spec, Package stylesheets in a chunk)", () => {
  test("woff2, woff and ttf sources give one data:font/woff2 URL per face, and no woff or ttf", async () => {
    const css = await inlineFontFaces(await Bun.file(join(dir, "faces.css")).text(), dir);
    expect(css.match(/url\(data:font\/woff2;base64,/g)).toHaveLength(2);
    expect(css.match(/url\(/g)).toHaveLength(2);
    expect(css).toContain(`url(data:font/woff2;base64,${base64})`);
    expect(css).not.toMatch(/woff\)|woff"\)|woff'\)|\.ttf|truetype/);
    expect(css).toContain("font-weight:400");
    expect(css).toContain(".katex{font:normal 1.21em A,B}");
    expect(styleUrlProblems("latex", css)).toEqual([]);
  });

  test("a stylesheet with no @font-face, or whose faces are inline already, is unchanged", async () => {
    const plain = ".a{color:red}";
    expect(await inlineFontFaces(plain, dir)).toBe(plain);
    const inlined =
      "@font-face{font-family:A;src:url(data:font/woff2;base64,AAAA) format('woff2')}";
    expect(await inlineFontFaces(inlined, dir)).toBe(inlined);
  });

  test("a face naming an svg keeps it, so the URL check fails on it", async () => {
    const css = await inlineFontFaces(await Bun.file(join(dir, "svg.css")).text(), dir);
    expect(css).toContain("url(fonts/a.svg)");
    expect(styleUrlProblems("latex", css).join("\n")).toContain("fonts/a.svg");
  });

  test("a font file that is missing fails, naming the file", async () => {
    await expect(
      inlineFontFaces(await Bun.file(join(dir, "missing-font.css")).text(), dir),
    ).rejects.toThrow("fonts/none.woff2");
  });

  test("a face outside the folder or at an address is not read", async () => {
    const css = "@font-face{font-family:E;src:url(https://example.com/e.woff2) format('woff2')}";
    expect(await inlineFontFaces(css, dir)).toBe(css);
    const up = "@font-face{font-family:E;src:url(../outside.woff2) format('woff2')}";
    await expect(inlineFontFaces(up, dir)).rejects.toThrow("../outside.woff2");
  });
});

describe("the chunks' package stylesheets (design decision 8)", () => {
  const chunks = new Set(["latex", "kanban"]);

  test("the table starts empty: no chunk carries a package stylesheet until one registers", () => {
    expect(CHUNK_STYLESHEETS).toEqual({});
  });

  test("a listed chunk gets its stylesheets, rewritten, in the order listed", async () => {
    const { styles, problems } = await loadChunkStylesheets(
      { latex: ["faces.css"], kanban: ["svg.css", "faces.css"] },
      chunks,
      resolver,
    );
    expect(problems).toEqual([]);
    expect([...styles.keys()].sort()).toEqual(["kanban", "latex"]);
    expect(styles.get("latex")).toContain("data:font/woff2;base64,");
    const kanban = styles.get("kanban") ?? "";
    expect(kanban.indexOf("fonts/a.svg")).toBeLessThan(kanban.indexOf("data:font/woff2"));
  });

  test("a listed chunk that does not exist fails, naming it", async () => {
    const { problems } = await loadChunkStylesheets({ latexx: ["faces.css"] }, chunks, resolver);
    expect(problems.join("\n")).toContain('"latexx"');
    expect(problems.join("\n")).toContain("no such chunk");
  });

  test("a missing stylesheet file fails, naming the chunk and the file", async () => {
    const { problems } = await loadChunkStylesheets({ latex: ["nope.css"] }, chunks, resolver);
    expect(problems.join("\n")).toContain('"latex"');
    expect(problems.join("\n")).toContain("nope.css");
  });

  test("a font file that is missing fails, naming the chunk", async () => {
    const { problems } = await loadChunkStylesheets(
      { latex: ["missing-font.css"] },
      chunks,
      resolver,
    );
    expect(problems.join("\n")).toContain('"latex"');
    expect(problems.join("\n")).toContain("fonts/none.woff2");
  });

  test("an @import in a listed stylesheet is left in for the URL check to fail", async () => {
    const { styles, problems } = await loadChunkStylesheets(
      { latex: ["import.css"] },
      chunks,
      resolver,
    );
    expect(problems).toEqual([]);
    expect(styleUrlProblems("latex", styles.get("latex") ?? "").join("\n")).toContain("b.css");
  });

  test("an empty table loads nothing", async () => {
    expect(await loadChunkStylesheets({}, chunks)).toEqual({
      styles: new Map(),
      files: new Map(),
      fonts: new Map(),
      problems: [],
    });
  });
});

describe("the package of a stylesheet whose fonts the build inlines (task 3.4, design decision 8)", () => {
  const chunks = new Set(["latex", "kanban"]);

  test("a stylesheet with inlined fonts reports its package version, once, and every listed file is reported", async () => {
    await fixture("plain.css", ".a{color:red}");
    const { files, fonts, problems } = await loadChunkStylesheets(
      { latex: ["faces.css", "faces.css", "plain.css"], kanban: ["plain.css", "svg.css"] },
      chunks,
      resolver,
    );
    expect(problems).toEqual([]);
    expect(fonts.get("latex")).toEqual(["pkg@1.0.0"]);
    expect(fonts.get("kanban")).toBeUndefined();
    expect(files.get("latex")).toEqual([
      join(dir, "faces.css"),
      join(dir, "faces.css"),
      join(dir, "plain.css"),
    ]);
    expect(files.get("kanban")).toEqual([join(dir, "plain.css"), join(dir, "svg.css")]);
  });

  test("a scoped package is named with its scope", async () => {
    const scoped = join(root, "node_modules", "@org", "fonts");
    await Bun.write(join(scoped, "package.json"), '{"name":"@org/fonts","version":"2.3.4"}');
    await Bun.write(join(scoped, "f.woff2"), WOFF2);
    await Bun.write(
      join(scoped, "s.css"),
      "@font-face{font-family:S;src:url(f.woff2) format('woff2')}",
    );
    const { fonts, problems } = await loadChunkStylesheets(
      { latex: ["s.css"] },
      chunks,
      (specifier) => join(scoped, specifier),
    );
    expect(problems).toEqual([]);
    expect(fonts.get("latex")).toEqual(["@org/fonts@2.3.4"]);
  });

  test("an inlined font in a stylesheet outside any package fails, naming the chunk and the stylesheet", async () => {
    const loose = join(root, "loose");
    await Bun.write(join(loose, "f.woff2"), WOFF2);
    await Bun.write(
      join(loose, "own.css"),
      "@font-face{font-family:L;src:url(f.woff2) format('woff2')}",
    );
    const { styles, problems } = await loadChunkStylesheets(
      { latex: ["own.css"] },
      chunks,
      (specifier) => join(loose, specifier),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"latex"');
    expect(problems[0]).toContain("own.css");
    expect(problems[0]).toContain("no package");
    expect(styles.has("latex")).toBe(false);
  });

  test("a stylesheet outside any package with no inlined font is fine", async () => {
    const loose = join(root, "loose-plain");
    await Bun.write(join(loose, "own.css"), ".a{color:red}");
    const { fonts, problems } = await loadChunkStylesheets(
      { latex: ["own.css"] },
      chunks,
      (specifier) => join(loose, specifier),
    );
    expect(problems).toEqual([]);
    expect(fonts.size).toBe(0);
  });
});

describe("KaTeX's real stylesheet (design decision 8)", () => {
  test("it resolves from the widgets package, and its 20 woff2 faces become data: URLs", async () => {
    const path = resolveFromWidgets("katex/dist/katex.min.css");
    expect(path.endsWith("katex/dist/katex.min.css")).toBe(true);
    const { styles, problems } = await loadChunkStylesheets(
      { latex: ["katex/dist/katex.min.css"] },
      new Set(["latex"]),
    );
    expect(problems).toEqual([]);
    const css = styles.get("latex") ?? "";
    expect(css.match(/url\(data:font\/woff2;base64,/g)).toHaveLength(20);
    expect(css.match(/url\(/g)).toHaveLength(20);
    expect(css).not.toMatch(/\.woff\b|\.ttf|truetype/);
    expect(css).toContain(".katex");
    expect(styleUrlProblems("latex", css)).toEqual([]);
    expect(css).not.toContain("\r");
    expect(css).not.toContain("</style");
  });
});
