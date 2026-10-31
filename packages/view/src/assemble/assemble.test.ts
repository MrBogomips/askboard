import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type BoardDocument,
  type BoardState,
  cspHashSource,
  type ManifestChunk,
  type ViewManifest,
} from "@askboard/contract";
import {
  fixtureViewFiles,
  fixtureViewManifest,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import type { BootData } from "../boot-data.ts";
import { assemble, type ChunkSources, selectChunks, sourcesToFetch, viewPolicy } from "./index.ts";

const state: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
const data: BootData = { document: plainChoiceBoardDocument, state };

// The fixture build's files by SHA-256, as the board page fetches them from `/c/<sha256>`.
const sourcesOf = (manifest: ViewManifest, files: Readonly<Record<string, string>>) => {
  const sources: Record<string, string> = {};
  for (const chunk of Object.values(manifest.chunks)) {
    for (const file of [chunk.script, ...chunk.styles]) {
      const text = files[file.path];
      if (text !== undefined) sources[file.sha256] = text;
    }
  }
  return sources;
};
const sources: ChunkSources = sourcesOf(fixtureViewManifest, fixtureViewFiles);

// A manifest with a component chunk the plain question does not use, and its own library.
const tableScript = '(function(){"use strict";globalThis.askboardTable={chunk:"table"};})();\n';
const tableLibrary = '(function(){"use strict";globalThis.TableLibrary={chunk:"table-lib"};})();\n';
const file = (path: string, digit: string, text: string) => ({
  path,
  sha256: digit.repeat(64),
  bytes: text.length,
});
const withUnused: ViewManifest = {
  ...fixtureViewManifest,
  chunks: {
    ...fixtureViewManifest.chunks,
    "table-lib": {
      kind: "library",
      script: file("chunks/table-lib.js", "a", tableLibrary),
      styles: [],
      needs: ["react"],
      licences: [],
    },
    table: {
      kind: "component",
      script: file("chunks/table.js", "b", tableScript),
      styles: [],
      needs: ["react", "table-lib"],
      components: ["table"],
      licences: [],
    },
  },
};
const withUnusedSources: ChunkSources = {
  ...sources,
  ["a".repeat(64)]: tableLibrary,
  ["b".repeat(64)]: tableScript,
};

const chunk = (name: string): ManifestChunk => {
  const found = fixtureViewManifest.chunks[name];
  if (found === undefined) throw new Error(`no fixture chunk ${name}`);
  return found;
};
const scriptOf = (name: string) => fixtureViewFiles[chunk(name).script.path] ?? "";
const policyOf = (srcdoc: string) =>
  /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(srcdoc)?.[1];
const inlineScripts = (srcdoc: string) =>
  [...srcdoc.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const dataBlock = (srcdoc: string) =>
  /<script type="application\/json" id="askboard-data">([\s\S]*?)<\/script>/.exec(srcdoc)?.[1];

describe("the selection step (design decision 8)", () => {
  test("a plain question needs the shell, the Choice chunk and their library chunks", () => {
    const names = selectChunks(plainChoiceBoardDocument, withUnused).map(({ name }) => name);
    expect(names.sort()).toEqual(["choice", "ext-apps", "radix", "react", "shell"]);
  });

  test("each chunk comes after the chunks it needs, libraries first, then the shell", () => {
    const names = selectChunks(plainChoiceBoardDocument, withUnused).map(({ name }) => name);
    expect(names).toEqual(["ext-apps", "react", "radix", "shell", "choice"]);
  });

  test("the files to fetch are each selected chunk's script and styles, each once", () => {
    const files = sourcesToFetch(selectChunks(plainChoiceBoardDocument, withUnused));
    const paths = files.map((entry) => entry.path).sort();
    expect(paths).toEqual([
      "chunks/choice.css",
      "chunks/choice.js",
      "chunks/ext-apps.js",
      "chunks/radix.js",
      "chunks/react.js",
      "chunks/shell.css",
      "chunks/shell.js",
    ]);
  });

  test("a component no chunk registers fails, naming it", () => {
    const { choice: _, ...chunks } = fixtureViewManifest.chunks;
    const manifest = { ...fixtureViewManifest, chunks };
    expect(() => selectChunks(plainChoiceBoardDocument, manifest)).toThrow('"choice"');
  });

  test("a needed chunk the manifest lacks fails, naming it", () => {
    const { radix: _, ...chunks } = fixtureViewManifest.chunks;
    const manifest = { ...fixtureViewManifest, chunks };
    expect(() => selectChunks(plainChoiceBoardDocument, manifest)).toThrow('"radix"');
  });

  test("chunks that need each other fail", () => {
    const manifest: ViewManifest = {
      ...fixtureViewManifest,
      chunks: { ...fixtureViewManifest.chunks, react: { ...chunk("react"), needs: ["radix"] } },
    };
    expect(() => selectChunks(plainChoiceBoardDocument, manifest)).toThrow("cycle");
  });

  test("a needed chunk named as an inherited property, such as constructor, is missing", () => {
    const manifest: ViewManifest = {
      ...fixtureViewManifest,
      chunks: {
        ...fixtureViewManifest.chunks,
        radix: { ...chunk("radix"), needs: ["constructor"] },
      },
    };
    expect(() => selectChunks(plainChoiceBoardDocument, manifest)).toThrow('"constructor"');
  });
});

describe("assemble (AD-9)", () => {
  test("inlines only the chunks the board needs", () => {
    const { srcdoc, chunks } = assemble(data, withUnused, withUnusedSources);
    expect(chunks).toEqual(["ext-apps", "react", "radix", "shell", "choice"]);
    for (const name of chunks) expect(srcdoc).toContain(scriptOf(name));
    expect(srcdoc).not.toContain(tableScript);
    expect(srcdoc).not.toContain(tableLibrary);
    expect(inlineScripts(srcdoc)).toEqual(chunks.map(scriptOf));
  });

  test("inlines each needed chunk's styles, in the same order", () => {
    const { srcdoc } = assemble(data, withUnused, withUnusedSources);
    const styles = [...srcdoc.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((match) => match[1]);
    expect(styles).toEqual([
      fixtureViewFiles["chunks/shell.css"],
      fixtureViewFiles["chunks/choice.css"],
    ]);
  });

  test("the same input gives the same output", () => {
    const reordered = Object.fromEntries(Object.entries(withUnusedSources).reverse());
    const first = assemble(data, withUnused, withUnusedSources);
    expect(assemble(data, withUnused, withUnusedSources)).toEqual(first);
    expect(assemble(data, withUnused, reordered).srcdoc).toBe(first.srcdoc);
  });

  test("the CSP meta tag is exactly AD-8's view policy", () => {
    const { srcdoc, policy } = assemble(data, withUnused, withUnusedSources);
    const names = ["ext-apps", "react", "radix", "shell", "choice"];
    const scripts = names.map((name) => cspHashSource(chunk(name).script.sha256)).join(" ");
    const styles = ["shell", "choice"]
      .flatMap((name) => chunk(name).styles.map((style) => cspHashSource(style.sha256)))
      .join(" ");
    expect(policy).toBe(
      `default-src 'none'; script-src ${scripts}; style-src ${styles}; ` +
        "img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; " +
        "frame-src 'none'; form-action 'none'; base-uri 'none'",
    );
    expect(policyOf(srcdoc)).toBe(policy);
  });

  test("the policy holds none of the forbidden keywords, no wildcard and no 'self'", () => {
    const { policy } = assemble(data, withUnused, withUnusedSources);
    for (const keyword of [
      "'unsafe-inline'",
      "'unsafe-eval'",
      "'unsafe-hashes'",
      "'wasm-unsafe-eval'",
      "'self'",
      "*",
      "http",
    ]) {
      expect(policy).not.toContain(keyword);
    }
  });

  test("the policy comes before every script and style, once", () => {
    const { srcdoc } = assemble(data, fixtureViewManifest, sources);
    const at = srcdoc.indexOf("Content-Security-Policy");
    expect(srcdoc.indexOf("Content-Security-Policy", at + 1)).toBe(-1);
    expect(at).toBeLessThan(srcdoc.indexOf("<script"));
    expect(at).toBeLessThan(srcdoc.indexOf("<style"));
  });

  test("a selection without styles admits none", () => {
    const selection = selectChunks(plainChoiceBoardDocument, fixtureViewManifest).map(
      ({ name, chunk: entry }) => ({ name, chunk: { ...entry, styles: [] } }),
    );
    expect(viewPolicy(selection)).toContain("style-src 'none';");
  });

  test("the askboard-data block holds the board document and the state", () => {
    const { srcdoc } = assemble(data, fixtureViewManifest, sources);
    expect(JSON.parse(dataBlock(srcdoc) ?? "")).toEqual(data);
    expect(srcdoc.indexOf('id="askboard-data"')).toBeLessThan(srcdoc.indexOf("<script>"));
    expect(srcdoc).toContain('<div id="root"></div>');
  });

  test("the askboard-data block escapes <, so agent text cannot close it", () => {
    const hostile = "</script><script>alert(1)</script><!-- <img src=x onerror=alert(1)>";
    const [question] = plainChoiceBoardDocument.items;
    const document: BoardDocument = {
      ...plainChoiceBoardDocument,
      title: hostile,
      items: [
        {
          ...question,
          props: { ...question.props, options: [{ label: hostile }, { label: "SQLite" }] },
        },
      ],
    };
    const { srcdoc, chunks } = assemble({ document, state }, fixtureViewManifest, sources);
    const block = dataBlock(srcdoc) ?? "";
    expect(block).not.toContain("<");
    expect(JSON.parse(block).document).toEqual(document);
    expect(srcdoc.match(/<\/script>/g)).toHaveLength(chunks.length + 1);
    expect(srcdoc).not.toContain("alert(1)</script>");
  });

  test("no agent text reaches the page outside the data block", () => {
    const { srcdoc } = assemble(data, fixtureViewManifest, sources);
    const outside = srcdoc.replace(dataBlock(srcdoc) ?? "", "");
    expect(outside).not.toContain(plainChoiceBoardDocument.title);
    expect(outside).not.toContain("PostgreSQL");
  });

  test("a source that was not fetched fails, naming the chunk and its file", () => {
    const { [chunk("radix").script.sha256]: _, ...missing } = sources;
    expect(() => assemble(data, fixtureViewManifest, missing)).toThrow("chunks/radix.js");
  });

  test("a source whose size is not the manifest's fails, naming its file", () => {
    const wrong = { ...sources, [chunk("radix").script.sha256]: `${scriptOf("radix")} ` };
    expect(() => assemble(data, fixtureViewManifest, wrong)).toThrow("chunks/radix.js");
  });

  test("a source with characters outside ASCII is measured in UTF-8 bytes", () => {
    const text = 'globalThis.x="é€😀";\n';
    const bytes = new TextEncoder().encode(text).length;
    expect(bytes).not.toBe(text.length);
    const radix = chunk("radix");
    const manifest: ViewManifest = {
      ...fixtureViewManifest,
      chunks: {
        ...fixtureViewManifest.chunks,
        radix: { ...radix, script: { ...radix.script, bytes } },
      },
    };
    const multibyte = { ...sources, [radix.script.sha256]: text };
    expect(assemble(data, manifest, multibyte).srcdoc).toContain(text);
  });
});

describe("assemble is pure ECMAScript (AD-9: the board page and snapshot both call it)", () => {
  const root = join(import.meta.dir, "../../../..");

  test("its modules import only the contract and each other", async () => {
    const transpiler = new Bun.Transpiler({ loader: "ts" });
    const modules = ["index.ts", "select.ts", "../boot-data.ts", "../catalog/components.ts"];
    for (const path of modules) {
      const source = await Bun.file(join(import.meta.dir, path)).text();
      for (const { path: specifier } of transpiler.scanImports(source)) {
        expect([path, specifier === "@askboard/contract" || specifier.startsWith(".")]).toEqual([
          path,
          true,
        ]);
      }
    }
  });

  test("it compiles without DOM, Node or Bun types", () => {
    const tsc = join(root, "node_modules/.bin/tsc");
    const flags = ["--noEmit", "--strict", "--target", "es2024", "--lib", "es2024", "--types", ""];
    const resolution = ["--module", "preserve", "--moduleResolution", "bundler"];
    const files = ["--allowImportingTsExtensions", "--resolveJsonModule", "--skipLibCheck"];
    const run = Bun.spawnSync([
      tsc,
      ...flags,
      ...resolution,
      ...files,
      join(import.meta.dir, "index.ts"),
    ]);
    expect(run.stdout.toString()).toBe("");
    expect(run.exitCode).toBe(0);
  });
});
