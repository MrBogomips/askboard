import { describe, expect, test } from "bun:test";
import { VIEW_MANIFEST_VERSION, type ViewManifest } from "../src/index.ts";
import { validateViewManifest } from "../src/validate.ts";

const file = (path: string, digit: string) => ({ path, sha256: digit.repeat(64), bytes: 10 });
const notice = { package: "react", version: "19.3.1", licence: "MIT", path: "licences/react.txt" };

const manifest = (): ViewManifest => ({
  version: VIEW_MANIFEST_VERSION,
  boardPage: {
    html: file("board-page.html", "0"),
    script: file("board-page.js", "1"),
    styles: [file("board-page.css", "2")],
    licences: [],
  },
  chunks: {
    shell: {
      kind: "shell",
      script: file("chunks/shell.js", "3"),
      styles: [],
      needs: ["react"],
      licences: [],
    },
    react: {
      kind: "library",
      script: file("chunks/react.js", "4"),
      styles: [],
      needs: [],
      licences: [notice],
    },
    choice: {
      kind: "component",
      script: file("chunks/choice.js", "5"),
      styles: [file("chunks/choice.css", "6")],
      needs: ["react"],
      components: ["choice"],
      licences: [],
    },
  },
});

const library = (name: string, digit: string, needs: string[]) => ({
  kind: "library",
  script: file(`chunks/${name}.js`, digit),
  styles: [],
  needs,
  licences: [],
});
const withChunks = (chunks: Record<string, unknown>) => {
  const base = manifest();
  return { ...base, chunks: { ...base.chunks, ...chunks } };
};

const paths = (value: unknown) => {
  const result = validateViewManifest(value);
  return result.ok ? [] : result.problems.map((problem) => problem.path);
};
// A copy of the manifest with the value at `path` set, or removed when `value` is undefined.
const changed = (path: readonly (string | number)[], value?: unknown) => {
  const draft: Record<string | number, unknown> = structuredClone(manifest());
  let parent = draft;
  for (const step of path.slice(0, -1)) parent = parent[step] as Record<string | number, unknown>;
  const last = path.at(-1) ?? "";
  if (value === undefined) delete parent[last];
  else parent[last] = value;
  return draft;
};

describe("the view manifest (owner view)", () => {
  test("a manifest with the board page, a shell, a library and a component validates", () => {
    expect(validateViewManifest(manifest())).toEqual({ ok: true, value: manifest() });
  });

  test.each([
    ["a hash that is not SHA-256 hex", ["chunks", "react", "script", "sha256"], "ABC", ""],
    ["an absolute path", ["chunks", "react", "script", "path"], "/etc/passwd", ""],
    ["a path that climbs", ["boardPage", "script", "path"], "../board.js", ""],
    ["an unknown kind", ["chunks", "react", "kind"], "plugin", ""],
    ["an unknown field", ["chunks", "react", "integrity"], "x", ""],
    [
      "a chunk name that is not kebab-case",
      ["chunks", "React"],
      manifest().chunks.react,
      "/chunks",
    ],
    [
      "a licence notice without its path",
      ["chunks", "react", "licences", 0, "path"],
      undefined,
      "",
    ],
    ["a board page without its HTML", ["boardPage", "html"], undefined, ""],
  ] as const)("a manifest with %s fails, naming where", (_case, path, value, where) => {
    expect(paths(changed(path, value))).toContain(where || `/${path.join("/")}`);
  });

  test("every chunk a chunk needs is in the manifest, and there is exactly one shell", () => {
    expect(paths(changed(["chunks", "choice", "needs", 1], "radix"))).toEqual([
      "/chunks/choice/needs/1",
    ]);
    // The shell then also needs a chunk that is not a library.
    expect(paths(changed(["chunks", "react", "kind"], "shell"))).toEqual([
      "/chunks/shell/needs/0",
      "/chunks",
    ]);
    expect(paths(changed(["chunks", "shell", "kind"], "library"))).toEqual(["/chunks"]);
  });

  test("a component chunk names the components it registers, and only it does", () => {
    expect(paths(changed(["chunks", "choice", "components"]))).toEqual([
      "/chunks/choice/components",
    ]);
    expect(paths(changed(["chunks", "react", "components"], ["choice"]))).toEqual([
      "/chunks/react/components",
    ]);
  });

  test("a chunk named after an inherited property is not taken as in the manifest", () => {
    expect(paths(changed(["chunks", "choice", "needs", 1], "constructor"))).toEqual([
      "/chunks/choice/needs/1",
    ]);
  });

  test("a chunk that needs itself fails, naming the cycle", () => {
    const result = validateViewManifest(changed(["chunks", "react", "needs"], ["react"]));
    expect(result.ok ? [] : result.problems).toEqual([
      {
        path: "/chunks/react/needs",
        message: "the chunks need each other in a cycle: react → react",
      },
    ]);
  });

  test("chunks that need each other in a cycle fail, naming it once", () => {
    const looped = withChunks({
      react: library("react", "4", ["radix"]),
      radix: library("radix", "7", ["react"]),
    });
    const result = validateViewManifest(looped);
    expect(result.ok ? [] : result.problems).toEqual([
      {
        path: "/chunks/react/needs",
        message: "the chunks need each other in a cycle: react → radix → react",
      },
    ]);
  });

  test("a component that two chunks register fails, naming the second", () => {
    const twice = changed(["chunks", "choice-too"], {
      ...manifest().chunks.choice,
      script: file("chunks/choice-too.js", "8"),
      components: ["choice"],
    });
    const result = validateViewManifest(twice);
    expect(result.ok ? [] : result.problems).toEqual([
      {
        path: "/chunks/choice-too/components/0",
        message: 'the chunk "choice" registers the component "choice" too',
      },
    ]);
  });

  test("the shell and the library chunks need only library chunks", () => {
    const shell = validateViewManifest(changed(["chunks", "shell", "needs"], ["react", "choice"]));
    expect(shell.ok ? [] : shell.problems).toEqual([
      {
        path: "/chunks/shell/needs/1",
        message: 'the shell needs only library chunks, and "choice" is a component chunk',
      },
    ]);
    const radix = validateViewManifest(withChunks({ radix: library("radix", "7", ["choice"]) }));
    expect(radix.ok ? [] : radix.problems).toEqual([
      {
        path: "/chunks/radix/needs/0",
        message: 'a library chunk needs only library chunks, and "choice" is a component chunk',
      },
    ]);
  });

  test("a major-2 manifest is refused, naming the supported version", () => {
    const result = validateViewManifest({ ...manifest(), version: "2.0" });
    expect(result).toMatchObject({ ok: false, reason: "version" });
    expect(result.ok ? "" : result.problems[0]?.message).toContain(
      `supports version 1 (${VIEW_MANIFEST_VERSION})`,
    );
  });
});
