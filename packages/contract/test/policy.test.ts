import { describe, expect, test } from "bun:test";
import { fixtureViewManifest } from "../src/fixtures/index.ts";
import { boardPagePolicy, cspHashSource, type ViewManifest } from "../src/index.ts";

// The board page's policy, one rule for `board-host` and the view's test server (AD-8; design
// decision 5; board-host spec, The board page and its policy; Track B's request 1).

const manifest = fixtureViewManifest;
const chunks = Object.values(manifest.chunks);

const directives = (policy: string): Map<string, string[]> =>
  new Map(
    policy.split(";").map((part) => {
      const [name = "", ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    }),
  );

const hashes = (files: readonly { sha256: string }[]) =>
  [...new Set(files.map((file) => cspHashSource(file.sha256)))].sort();

describe("the board page's policy", () => {
  test("names exactly AD-8's directives, scripts and styles by hash only", () => {
    const parts = directives(boardPagePolicy(manifest));
    expect([...parts.keys()].sort()).toEqual(
      ["connect-src", "default-src", "font-src", "img-src", "script-src", "style-src"].sort(),
    );
    expect(parts.get("default-src")).toEqual(["'none'"]);
    expect([...(parts.get("script-src") ?? [])].sort()).toEqual(
      hashes([manifest.boardPage.script, ...chunks.map((chunk) => chunk.script)]),
    );
    expect([...(parts.get("style-src") ?? [])].sort()).toEqual(
      hashes([...manifest.boardPage.styles, ...chunks.flatMap((chunk) => chunk.styles)]),
    );
    expect(parts.get("connect-src")).toEqual(["'self'"]);
    expect(parts.get("img-src")).toEqual(["data:", "blob:"]);
    expect(parts.get("font-src")).toEqual(["data:"]);
  });

  test("holds no frame source, no unsafe keyword and no wildcard", () => {
    const policy = boardPagePolicy(manifest);
    expect(policy).not.toContain("frame-src");
    expect(policy).not.toContain("unsafe-");
    expect(policy).not.toContain("*");
    expect(policy).not.toContain(cspHashSource(manifest.boardPage.html.sha256));
  });

  test("names 'none' for styles when there are none", () => {
    const bare: ViewManifest = {
      ...manifest,
      boardPage: { ...manifest.boardPage, styles: [] },
      chunks: Object.fromEntries(
        Object.entries(manifest.chunks).map(([name, chunk]) => [name, { ...chunk, styles: [] }]),
      ),
    };
    expect(directives(boardPagePolicy(bare)).get("style-src")).toEqual(["'none'"]);
  });

  test("names a hash once, and does not depend on which chunk needs which", () => {
    const { choice, shell } = manifest.chunks;
    if (choice === undefined || shell === undefined) throw new Error("fixture changed");
    const reshaped: ViewManifest = {
      ...manifest,
      chunks: {
        ...manifest.chunks,
        // The real build's choice chunk also needs the shell, which holds the CatalogRenderer port.
        choice: { ...choice, needs: ["shell", ...choice.needs] },
        twin: { ...choice, components: ["twin"] },
      },
    };
    const policy = boardPagePolicy(reshaped);
    expect(policy.split(cspHashSource(choice.script.sha256))).toHaveLength(2);
    expect(directives(policy)).toEqual(directives(boardPagePolicy(manifest)));
  });

  test("is the same text for the same manifest", () => {
    expect(boardPagePolicy(manifest)).toBe(boardPagePolicy(structuredClone(manifest)));
  });
});
