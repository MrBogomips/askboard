import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PORT_FILE, VIEW_SRC } from "./paths.ts";
import {
  CATALOG_PORT,
  LIBRARY_CHUNKS,
  libraryEntrySource,
  providerOf,
  type SharedModules,
  sharedFilter,
  sharedModules,
  sharedModulesPlugin,
  shimSource,
} from "./shared-modules.ts";

const modules: SharedModules = sharedModules(["register", "componentFor"]);

const NAMED_IMPORT = /import\s+\{([^}]*)\}\s+from\s+"([^"]+)"/g;

// The value names the view's sources import from each module, as `<module>:<name>`.
const namedImports = async (): Promise<Set<string>> => {
  const found = new Set<string>();
  for await (const path of new Bun.Glob("**/*.{ts,tsx}").scan(VIEW_SRC)) {
    if (/\.test\.tsx?$/.test(path)) continue;
    const source = await Bun.file(join(VIEW_SRC, path)).text();
    for (const [, names = "", module] of source.matchAll(NAMED_IMPORT)) {
      const values = names
        .split(",")
        .map((name) => name.trim().split(/\s+as\s+/)[0] ?? "")
        .filter((name) => name !== "" && !name.startsWith("type "));
      for (const name of values) found.add(`${module}:${name}`);
    }
  }
  return found;
};

describe("the shared modules and the chunks that provide them", () => {
  test("React and React DOM come from the react chunk, Radix from radix, ext-apps from ext-apps", () => {
    expect(modules.get("react")?.chunk).toBe("react");
    expect(modules.get("react-dom/client")?.chunk).toBe("react");
    expect(modules.get("react/jsx-runtime")?.chunk).toBe("react");
    expect(modules.get("radix-ui")?.chunk).toBe("radix");
    expect(modules.get("@modelcontextprotocol/ext-apps")?.chunk).toBe("ext-apps");
  });

  test("the shell provides the CatalogRenderer port, with the names its module exports", () => {
    expect(modules.get(CATALOG_PORT)).toEqual({
      chunk: "shell",
      names: ["register", "componentFor"],
    });
  });

  test("the library chunks are React, Radix and ext-apps", () => {
    expect(Object.keys(LIBRARY_CHUNKS).sort()).toEqual(["ext-apps", "radix", "react"]);
  });

  test("every name a library chunk lists is imported by a view source, so none ships unused", async () => {
    const imported = await namedImports();
    const unused = Object.values(LIBRARY_CHUNKS).flatMap(({ modules }) =>
      Object.entries(modules).flatMap(([module, names]) =>
        names === "*" ? [] : names.filter((name) => !imported.has(`${module}:${name}`)),
      ),
    );
    expect(unused).toEqual([]);
  });
});

describe("the resolve filter names only the modules it maps (renderer row 18)", () => {
  const filter = sharedFilter(modules);

  test.each([
    "react",
    "react-dom",
    "react-dom/client",
    "radix-ui",
    CATALOG_PORT,
    "./port.ts",
    "../port.ts",
  ])("matches %s", (specifier) => {
    expect(filter.test(specifier)).toBe(true);
  });

  test.each([
    "reactx",
    "react-dom/server",
    "radix-ui/internal",
    "@modelcontextprotocol/ext-apps/app-bridge",
    "zod",
    "./portal.ts",
    "./export.ts",
  ])("leaves %s alone", (specifier) => {
    expect(filter.test(specifier)).toBe(false);
  });
});

describe("which chunk an import comes from", () => {
  const importer = join(VIEW_SRC, "catalog/choice/index.tsx");

  test("a shared module comes from its chunk, unless the importing chunk is that chunk", () => {
    expect(providerOf(modules, "choice", "radix-ui", importer)).toEqual({
      module: "radix-ui",
      chunk: "radix",
    });
    expect(providerOf(modules, "radix", "radix-ui", importer)).toBeUndefined();
  });

  test("a relative import of the port file comes from the shell", () => {
    expect(providerOf(modules, "choice", "../port.ts", importer)).toEqual({
      module: CATALOG_PORT,
      chunk: "shell",
    });
    expect(
      providerOf(modules, "shell", "../catalog/port.ts", join(VIEW_SRC, "shell/index.tsx")),
    ).toBeUndefined();
  });

  test("another file named port.ts is not the port", () => {
    expect(providerOf(modules, "choice", "./port.ts", importer)).toBeUndefined();
    expect(PORT_FILE.endsWith("catalog/port.ts")).toBe(true);
  });
});

describe("shims", () => {
  test("a module with named exports gets exactly those names, so another name fails the build", () => {
    const source = shimSource("radix-ui", ["Checkbox", "RadioGroup"]);
    expect(source).toContain('shared("radix-ui")');
    expect(source).toContain("export const Checkbox = provided.Checkbox;");
    expect(source).toContain("export const RadioGroup = provided.RadioGroup;");
  });

  test("a whole namespace is the provided module itself", () => {
    expect(shimSource("react", "*")).toContain('module.exports = shared("react");');
  });

  test("a library entry provides each module, after the modules it loads first", () => {
    const source = libraryEntrySource("ext-apps");
    expect(source.indexOf("zod-jitless.ts")).toBeLessThan(source.indexOf("ext-apps"));
    expect(source).toContain('provide("@modelcontextprotocol/ext-apps", {');
    expect(libraryEntrySource("react")).toContain('provide("react", m0);');
  });

  test("an unknown library has no entry", () => {
    expect(() => libraryEntrySource("table")).toThrow('"table"');
  });
});

describe("a chunk built with the plugin", () => {
  let dir = "";
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "askboard-shared-"));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const build = async (source: string) => {
    const entry = join(dir, `entry-${Math.random().toString(36).slice(2)}.tsx`);
    await Bun.write(entry, source);
    const needs = new Set<string>();
    const result = await Bun.build({
      entrypoints: [entry],
      format: "iife",
      target: "browser",
      plugins: [sharedModulesPlugin("probe", modules, needs)],
      throw: false,
    });
    return { result, needs };
  };

  test("leaves the shared libraries out and records the chunks it needs", async () => {
    const { result, needs } = await build(
      'import { RadioGroup } from "radix-ui";\nimport { useState } from "react";\n(globalThis as any).x = [RadioGroup, useState];\n',
    );
    expect(result.success).toBe(true);
    expect([...needs].sort()).toEqual(["radix", "react"]);
    const code = (await result.outputs[0]?.text()) ?? "";
    expect(code).toContain('shared("radix-ui")');
    expect(code.length).toBeLessThan(5_000);
  });

  test("fails on a name the library chunk does not provide", async () => {
    const { result } = await build(
      'import { Select } from "radix-ui";\n(globalThis as any).x = Select;\n',
    );
    expect(result.success).toBe(false);
    expect(result.logs.map(String).join("\n")).toContain("Select");
  });
});
