import { describe, expect, test } from "bun:test";
import {
  type ManifestChunk,
  type ManifestFile,
  VIEW_MANIFEST_FILE,
  type ViewManifest,
} from "@askboard/contract";
import { fixtureViewFiles, fixtureViewManifest } from "@askboard/contract/fixtures";
import { fileEntry, hashProblems, listedFiles, manifestProblems } from "./manifest.ts";

const read = (files: Readonly<Record<string, string>>) => (path: string) => {
  const text = files[path];
  return text === undefined ? undefined : new TextEncoder().encode(text);
};

describe("file entries", () => {
  test("hold the path, the SHA-256 in lowercase hex and the size in bytes", () => {
    const text = fixtureViewFiles["chunks/shell.js"] ?? "";
    const expected: unknown = fixtureViewManifest.chunks.shell?.script;
    expect(fileEntry("chunks/shell.js", text)).toEqual(expected as ManifestFile);
  });

  test("count bytes, not characters", () => {
    expect(fileEntry("a.txt", "é").bytes).toBe(2);
  });
});

describe("each manifest hash matches its file", () => {
  test("the fixture build passes", () => {
    expect(hashProblems(fixtureViewManifest, read(fixtureViewFiles))).toEqual([]);
  });

  test("a changed chunk fails, naming its path", () => {
    const files = { ...fixtureViewFiles, "chunks/choice.js": "(function(){})();\n" };
    const problems = hashProblems(fixtureViewManifest, read(files));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((problem) => problem.includes("chunks/choice.js"))).toBe(true);
  });

  test("a missing licence file fails, naming its path", () => {
    const { "licences/zod-4.6.7.txt": _, ...files } = fixtureViewFiles;
    expect(hashProblems(fixtureViewManifest, read(files))).toEqual([
      "licences/zod-4.6.7.txt is listed in the manifest but missing",
    ]);
  });

  test("the board page's html holds its script and styles as listed", () => {
    const html = (fixtureViewFiles["board-page.html"] ?? "").replace("board-page", "board page");
    const files = { ...fixtureViewFiles, "board-page.html": html };
    const problems = hashProblems(fixtureViewManifest, read(files)).join("\n");
    expect(problems).toContain("board-page.html");
    expect(problems).toContain("does not hold board-page.js inline");
  });

  test("every listed file is named once, licences included", () => {
    const listed = listedFiles(fixtureViewManifest);
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed.sort()).toEqual(
      Object.keys(fixtureViewFiles)
        .filter((path) => path !== VIEW_MANIFEST_FILE)
        .sort(),
    );
  });
});

describe("the manifest validates against the contract's view manifest schema", () => {
  test("the fixture manifest passes", () => {
    expect(manifestProblems(fixtureViewManifest)).toEqual([]);
  });

  test("a manifest with two shells or a missing needed chunk fails, with JSON Pointers", () => {
    const broken = structuredClone(fixtureViewManifest) as unknown as {
      chunks: Record<string, { kind: string; needs: string[] }>;
    };
    if (broken.chunks.radix) broken.chunks.radix.kind = "shell";
    broken.chunks.choice?.needs.push("table");
    const problems = manifestProblems(broken as unknown as ViewManifest);
    expect(problems.some((problem) => problem.startsWith("/chunks:"))).toBe(true);
    expect(problems.some((problem) => problem.includes('"table"'))).toBe(true);
  });
});

describe("the build's manifest check on kept-render chunks (snapshot task 3.3)", () => {
  test("a keptRender naming a chunk the manifest lacks fails, naming both chunks", () => {
    const choice = fixtureViewManifest.chunks.choice as ManifestChunk;
    const renderer: ManifestChunk = {
      ...choice,
      components: ["probe-diagram"],
      keptRender: "probe-diagram-svg",
    };
    const manifest: ViewManifest = {
      ...fixtureViewManifest,
      chunks: { ...fixtureViewManifest.chunks, "probe-diagram": renderer },
    };
    expect(manifestProblems(manifest)).toEqual([
      '/chunks/probe-diagram/keptRender: the chunk "probe-diagram" names "probe-diagram-svg" as its kept-render chunk, which is not in the manifest',
    ]);
    const kept = { ...choice, components: ["probe-diagram-svg"] };
    const listed = { ...manifest, chunks: { ...manifest.chunks, "probe-diagram-svg": kept } };
    expect(manifestProblems(listed)).toEqual([]);
  });
});
