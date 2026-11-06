import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GRAPH_FILE, PORT_FILE, ROOT, VIEW_DIR, VIEW_SRC, WIDGETS_SRC } from "./paths.ts";
import {
  BOARD_GRAPH,
  CATALOG_PORT,
  LIBRARY_CHUNKS,
  libraryEntrySource,
  portExports,
  providerOf,
  type SharedModules,
  sharedFilter,
  sharedModules,
  sharedModulesPlugin,
  sharedNameOf,
  shimSource,
} from "./shared-modules.ts";

const modules: SharedModules = sharedModules(["register", "componentFor"]);

// The value names `@askboard/view/catalog` exports: the file the package's `./catalog` maps to.
const catalogEntryExports = async (): Promise<string[]> => {
  const manifest = (await Bun.file(join(VIEW_DIR, "package.json")).json()) as {
    exports: Record<string, string>;
  };
  const entry = join(VIEW_DIR, manifest.exports["./catalog"] ?? "");
  return new Bun.Transpiler({ loader: "ts" }).scan(await Bun.file(entry).text()).exports;
};

const NAMED_IMPORT = /import\s+\{([^}]*)\}\s+from\s+"([^"]+)"/g;

// A host-only module read from the registry where it is used, as the shell reads ext-apps' `App`
// (snapshot design decision 5): `const { App } = shared("@modelcontextprotocol/ext-apps")`.
const REGISTRY_LOOKUP = /const\s+\{([^}]*)\}\s*=\s*shared\(\s*"([^"]+)"\s*\)/g;

// The sources whose chunks import the shared modules: the view's, and the widgets' (design
// decision 8 of the tree-widget change).
const SOURCE_ROOTS = [VIEW_SRC, WIDGETS_SRC];

// The value names the view's and the widgets' sources import from each module, or read from it
// through the registry, as `<module>:<name>`, a module imported by the path to its file under its
// shared name.
const namedImports = async (): Promise<Set<string>> => {
  const found = new Set<string>();
  for (const root of SOURCE_ROOTS) {
    for await (const path of new Bun.Glob("**/*.{ts,tsx}").scan(root)) {
      if (/\.test\.tsx?$/.test(path)) continue;
      const file = join(root, path);
      const source = await Bun.file(file).text();
      const uses = [
        ...[...source.matchAll(NAMED_IMPORT)].map(
          ([, names = "", specifier = ""]) => [names, sharedNameOf(specifier, file)] as const,
        ),
        ...[...source.matchAll(REGISTRY_LOOKUP)].map(
          ([, names = "", module = ""]) => [names, module] as const,
        ),
      ];
      for (const [names, module] of uses) {
        const values = names
          .split(",")
          .map((name) => name.trim().split(/\s+as\s+/)[0] ?? "")
          .filter((name) => name !== "" && !name.startsWith("type "));
        for (const name of values) found.add(`${module}:${name}`);
      }
    }
  }
  return found;
};

// The relative paths each source imports at run time, resolved, with the importing file.
const runTimeImports = async (root: string): Promise<{ file: string; target: string }[]> => {
  const found: { file: string; target: string }[] = [];
  const statement = /import\s+(type\s)?[^"]*"(\.[^"]+)"/g;
  for await (const path of new Bun.Glob("**/*.{ts,tsx}").scan(root)) {
    if (/\.test\.tsx?$/.test(path)) continue;
    const file = join(root, path);
    const source = await Bun.file(file).text();
    for (const [, typeOnly, specifier = ""] of source.matchAll(statement)) {
      if (typeOnly === undefined) found.push({ file, target: join(file, "..", specifier) });
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

  test("compute comes from the compute chunk (gantt-widget design decision 7)", () => {
    expect(modules.get("@askboard/compute")?.chunk).toBe("compute");
  });

  test("the board graph comes from the board-graph chunk, under a name of its own (molecules, design decision 13)", () => {
    expect(modules.get(BOARD_GRAPH)?.chunk).toBe("board-graph");
    expect(BOARD_GRAPH).toBe("@askboard/widgets/graph");
    expect(GRAPH_FILE).toBe(join(WIDGETS_SRC, "graph/index.ts"));
  });

  test("the shell provides the CatalogRenderer port, with the names its module exports", () => {
    expect(modules.get(CATALOG_PORT)).toEqual({
      chunk: "shell",
      names: ["register", "componentFor"],
    });
  });

  test("the library chunks are React, Radix, ext-apps, compute and the board graph", () => {
    expect(Object.keys(LIBRARY_CHUNKS).sort()).toEqual([
      "board-graph",
      "compute",
      "ext-apps",
      "radix",
      "react",
    ]);
  });

  test("Radix provides the components that sources import, and no other yet", () => {
    // Toggle Group joined with its first control, the Gantt plan's zoom (gantt-widget design
    // decision 10); Switch with the Gantt's critical path switch (widget-editing-plus decision 8).
    expect(LIBRARY_CHUNKS.radix?.modules["radix-ui"]).toEqual([
      "AlertDialog",
      "Checkbox",
      "DropdownMenu",
      "Popover",
      "RadioGroup",
      "Switch",
      "Tabs",
      "ToggleGroup",
    ]);
  });

  test("compute provides exactly the names the widgets' sources import from it", async () => {
    const imported = [...(await namedImports())]
      .filter((entry) => entry.startsWith("@askboard/compute:"))
      .map((entry) => entry.slice("@askboard/compute:".length))
      .sort();
    expect(imported).toContain("boardGraphSource");
    expect(LIBRARY_CHUNKS.compute?.modules["@askboard/compute"]).toEqual(imported);
  });

  test("the board graph provides exactly the names the widgets' sources import from it, the Tree and the Gantt among them", async () => {
    const imported = [...(await namedImports())]
      .filter((entry) => entry.startsWith(`${BOARD_GRAPH}:`))
      .map((entry) => entry.slice(BOARD_GRAPH.length + 1))
      .sort();
    expect(imported).toContain("liveGraph");
    expect(LIBRARY_CHUNKS["board-graph"]?.modules[BOARD_GRAPH]).toEqual(imported);
  });

  test("a widget reaches the board graph's modules at run time only through its index, so one module instance holds the memo", async () => {
    const graph = join(WIDGETS_SRC, "graph");
    const around = (await runTimeImports(WIDGETS_SRC)).filter(
      ({ file, target }) => !file.startsWith(`${graph}/`) && target.startsWith(`${graph}/`),
    );
    expect(around.length).toBeGreaterThan(0);
    expect(around.filter(({ target }) => target !== GRAPH_FILE)).toEqual([]);
  });

  test("every name a library chunk lists is imported by a view or widget source, so none ships unused", async () => {
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
    "@askboard/compute",
    CATALOG_PORT,
    "./port.ts",
    "../port.ts",
    BOARD_GRAPH,
    "../graph/index.ts",
    "../../graph/index.ts",
  ])("matches %s", (specifier) => {
    expect(filter.test(specifier)).toBe(true);
  });

  test.each([
    "reactx",
    "react-dom/server",
    "radix-ui/internal",
    "@modelcontextprotocol/ext-apps/app-bridge",
    "zod",
    "@askboard/compute/src/index.ts",
    "@askboard/contract",
    "./portal.ts",
    "./export.ts",
    "./index.ts",
    "../graph/board-graph.ts",
    "@askboard/widgets",
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

  test("a relative import of the board graph's index comes from the board-graph chunk, unless the chunk is that one (molecules, design decision 13)", () => {
    const tree = join(WIDGETS_SRC, "tree/index.tsx");
    const plan = join(WIDGETS_SRC, "gantt/model/plan.ts");
    expect(providerOf(modules, "tree", "../graph/index.ts", tree)).toEqual({
      module: BOARD_GRAPH,
      chunk: "board-graph",
    });
    expect(providerOf(modules, "gantt", "../../graph/index.ts", plan)?.chunk).toBe("board-graph");
    expect(providerOf(modules, "board-graph", "../graph/index.ts", tree)).toBeUndefined();
  });

  test("another graph/index.ts, or another file of the graph, is not the board graph", () => {
    const elsewhere = join(VIEW_SRC, "catalog/choice/index.tsx");
    expect(providerOf(modules, "choice", "../graph/index.ts", elsewhere)).toBeUndefined();
    const tree = join(WIDGETS_SRC, "tree/index.tsx");
    expect(providerOf(modules, "tree", "../graph/board-graph.ts", tree)).toBeUndefined();
  });

  test("a shared name is the module a relative import of its file names, else the specifier", () => {
    const tree = join(WIDGETS_SRC, "tree/index.tsx");
    expect(sharedNameOf("../graph/index.ts", tree)).toBe(BOARD_GRAPH);
    expect(sharedNameOf("../port.ts", importer)).toBe(CATALOG_PORT);
    expect(sharedNameOf("./widget.tsx", tree)).toBe("./widget.tsx");
    expect(sharedNameOf("react", tree)).toBe("react");
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

  test("compute's entry imports it as the widgets resolve it, since the view declares no compute", () => {
    const source = libraryEntrySource("compute");
    expect(source).toContain(JSON.stringify(join(ROOT, "packages/compute/src/index.ts")));
    expect(source).toContain(
      'provide("@askboard/compute", { boardGraphSource: m0_boardGraphSource',
    );
  });

  test("the board graph's entry imports its index by path, the chunk mapping it as it maps the port", () => {
    const source = libraryEntrySource("board-graph");
    expect(source).toContain(JSON.stringify(GRAPH_FILE));
    expect(source).toContain(`provide("${BOARD_GRAPH}", { afterAdd: m0_afterAdd`);
    expect(source).toContain("liveGraph: m0_liveGraph");
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

  const build = async (source: string, shared: SharedModules = modules) => {
    const entry = join(dir, `entry-${Math.random().toString(36).slice(2)}.tsx`);
    await Bun.write(entry, source);
    const needs = new Set<string>();
    const result = await Bun.build({
      entrypoints: [entry],
      format: "iife",
      target: "browser",
      plugins: [sharedModulesPlugin("probe", shared, needs)],
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

  // A component outside `view`, such as a widget, imports the port by the package's entry (AD-9).
  test("a component builds importing each name the package's catalog entry exports", async () => {
    const real = sharedModules(await portExports());
    const names = await catalogEntryExports();
    expect(names).toContain("register");
    const failing: string[] = [];
    for (const name of names) {
      const source = `import { ${name} } from "${CATALOG_PORT}";\n(globalThis as any).x = ${name};\n`;
      const { result, needs } = await build(source, real);
      if (!result.success || !needs.has("shell")) failing.push(name);
    }
    expect(failing).toEqual([]);
  });

  test("a widget importing compute leaves it out and needs the compute chunk", async () => {
    const { result, needs } = await build(
      'import { buildGraph } from "@askboard/compute";\n(globalThis as any).x = buildGraph;\n',
    );
    expect(result.success).toBe(true);
    expect([...needs]).toEqual(["compute"]);
    const code = (await result.outputs[0]?.text()) ?? "";
    expect(code).toContain('shared("@askboard/compute")');
    expect(code).not.toContain("WORKDAY");
  });

  test("fails on a name of compute the chunk does not provide", async () => {
    const { result } = await build(
      'import { addWorkingDays } from "@askboard/compute";\n(globalThis as any).x = addWorkingDays;\n',
    );
    expect(result.success).toBe(false);
    expect(result.logs.map(String).join("\n")).toContain("addWorkingDays");
  });

  test("fails on a name the library chunk does not provide", async () => {
    const { result } = await build(
      'import { Select } from "radix-ui";\n(globalThis as any).x = Select;\n',
    );
    expect(result.success).toBe(false);
    expect(result.logs.map(String).join("\n")).toContain("Select");
  });
});
