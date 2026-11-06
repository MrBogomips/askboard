// The modules chunks share (design decision 7, renderer row 18). A library chunk carries code
// several chunks use and provides it through the view's shared-module registry
// (`packages/view/src/shared-modules.ts`); the shell provides the `CatalogRenderer` port the same
// way. In every other chunk, a bundler plugin compiles an import of a shared module to a shim
// that reads the registry, and records the providing chunk among the chunk's needs. Its resolve
// filter names only the modules it maps: a filter that matched every import made Bun ignore the
// packages' `sideEffects` and keep their unused modules (the spike's chart chunk doubled). Two
// shared modules are files that components import by a relative path, mapped by that path: the
// port, and the board graph (molecules, design decision 13).

import { dirname, resolve } from "node:path";
import type { BunPlugin } from "bun";
import {
  GRAPH_FILE,
  PORT_FILE,
  resolveFromView,
  SHARED_MODULES_FILE,
  WIDGETS_SRC,
  ZOD_JITLESS_FILE,
} from "./paths.ts";

/** The name the port is shared under, which is also its package export (AD-9). */
export const CATALOG_PORT = "@askboard/view/catalog";

/** The name the board graph is shared under; `widgets` exports no such entry. */
export const BOARD_GRAPH = "@askboard/widgets/graph";

/**
 * The shared modules imported by a relative path to their file, with the end of the paths that
 * can name it: components inside `view` import the port by its file name, the widgets the board
 * graph by its folder and file name.
 */
const BY_PATH: Readonly<Record<string, { readonly file: string; readonly tail: RegExp }>> = {
  [CATALOG_PORT]: { file: PORT_FILE, tail: /(^|\/)port\.ts$/ },
  [BOARD_GRAPH]: { file: GRAPH_FILE, tail: /(^|\/)graph\/index\.ts$/ },
};

/** `*`: the whole module, as one object; a list: exactly those exports, so another fails the build. */
type Names = "*" | readonly string[];

type LibraryChunk = {
  /** Modules that run before the library, by path. */
  readonly first?: readonly string[];
  readonly modules: Readonly<Record<string, Names>>;
  /** The package folder its modules resolve from, when the view does not declare them. */
  readonly from?: string;
};

/** The widgets' package, which declares `compute` (the tree-widget change's manifest). */
const WIDGETS_DIR = dirname(WIDGETS_SRC);

/**
 * The library chunks and the modules each provides. A component that needs another export of a
 * listed module, or another library, adds it here; the chunk-size check then asks the change to
 * record the new size.
 */
export const LIBRARY_CHUNKS: Readonly<Record<string, LibraryChunk>> = {
  react: {
    modules: { react: "*", "react-dom": "*", "react-dom/client": "*", "react/jsx-runtime": "*" },
  },
  // Radix's controls, Toggle Group among them for the Gantt plan's zoom (gantt-widget design
  // decision 10) and Switch for the Gantt's critical path (widget-editing-plus design decision 8).
  radix: {
    modules: {
      "radix-ui": [
        "AlertDialog",
        "Checkbox",
        "DropdownMenu",
        "RadioGroup",
        "Switch",
        "Tabs",
        "ToggleGroup",
      ],
    },
  },
  // zod's `jitless` before ext-apps loads (renderer rows 16 and 17); the chunk also carries zod and
  // the MCP client and core, which ext-apps imports.
  "ext-apps": {
    first: [ZOD_JITLESS_FILE],
    modules: { "@modelcontextprotocol/ext-apps": ["App"] },
  },
  // The engine for the widgets that compute (gantt-widget design decision 7), loaded only by
  // boards holding one; the chunk also carries the contract code `compute` imports.
  compute: {
    from: WIDGETS_DIR,
    modules: {
      "@askboard/compute": [
        "boardGraphSource",
        "buildGraph",
        "evaluateGraph",
        "firstWorkingDateFrom",
        "isFormulaError",
        "isWorkingDate",
        "roundNumber",
        "workingDaysBetween",
      ],
    },
  },
  // The board's graph, one module instance for every widget that computes on a board, so that
  // they read one live graph per draft update, and the rules that carry a Tree's edits into the
  // plans over it (molecules, design decisions 12 and 13).
  "board-graph": {
    modules: {
      [BOARD_GRAPH]: [
        "afterAdd",
        "afterDelete",
        "dependentsOf",
        "linkedEdit",
        "linkedPlans",
        "liveGraph",
        "sentGraph",
      ],
    },
  },
};

export type SharedModule = { readonly chunk: string; readonly names: Names };
export type SharedModules = ReadonlyMap<string, SharedModule>;

/** Every shared module by its import name, the port included with the names its file exports. */
export const sharedModules = (portNames: readonly string[]): SharedModules =>
  new Map<string, SharedModule>([
    ...Object.entries(LIBRARY_CHUNKS).flatMap(([chunk, { modules }]) =>
      Object.entries(modules).map(([module, names]): [string, SharedModule] => [
        module,
        { chunk, names },
      ]),
    ),
    [CATALOG_PORT, { chunk: "shell", names: portNames }],
  ]);

/** The names the port's file exports, read without running it. */
export const portExports = async (): Promise<string[]> =>
  new Bun.Transpiler({ loader: "ts" }).scan(await Bun.file(PORT_FILE).text()).exports;

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * The resolve filter: the shared modules' names, and the relative paths ending as those that name
 * a module shared by its file.
 */
export const sharedFilter = (modules: SharedModules): RegExp =>
  new RegExp(
    [
      `^(${[...modules.keys()].map(escaped).join("|")})$`,
      ...Object.values(BY_PATH).map(({ tail }) => tail.source),
    ].join("|"),
  );

/** The shared module a relative import of its file names, else the specifier itself. */
export const sharedNameOf = (specifier: string, importer: string): string => {
  if (!specifier.startsWith(".")) return specifier;
  const path = resolve(dirname(importer), specifier);
  const found = Object.entries(BY_PATH).find(
    ([, { file, tail }]) => tail.test(specifier) && path === file,
  );
  return found?.[0] ?? specifier;
};

/** The shared module an import names and the chunk providing it, unless it is `own`. */
export const providerOf = (
  modules: SharedModules,
  own: string,
  specifier: string,
  importer: string,
): { readonly module: string; readonly chunk: string } | undefined => {
  const module = sharedNameOf(specifier, importer);
  const shared = modules.get(module);
  if (shared === undefined || shared.chunk === own) return undefined;
  return { module, chunk: shared.chunk };
};

const REGISTRY_IMPORT = JSON.stringify(SHARED_MODULES_FILE);

/** The module an import of a shared module compiles to. */
export const shimSource = (module: string, names: Names): string => {
  const name = JSON.stringify(module);
  if (names === "*") {
    return `const { shared } = require(${REGISTRY_IMPORT});\nmodule.exports = shared(${name});\n`;
  }
  return [
    `import { shared } from ${REGISTRY_IMPORT};`,
    `const provided = shared(${name});`,
    ...names.map((export_) => `export const ${export_} = provided.${export_};`),
    "",
  ].join("\n");
};

const NAMESPACE = "askboard-shared";

/** Maps the shared modules a chunk imports to their providers, adding each to `needs`. */
export const sharedModulesPlugin = (
  own: string,
  modules: SharedModules,
  needs: Set<string>,
): BunPlugin => ({
  name: "askboard-shared-modules",
  setup(build) {
    build.onResolve({ filter: sharedFilter(modules) }, (args) => {
      const provider = providerOf(modules, own, args.path, args.importer);
      if (provider === undefined) return undefined;
      needs.add(provider.chunk);
      return { path: provider.module, namespace: NAMESPACE };
    });
    build.onLoad({ filter: /.*/, namespace: NAMESPACE }, (args) => {
      const shared = modules.get(args.path);
      if (shared === undefined) throw new Error(`no shared module ${args.path}`);
      return { contents: shimSource(args.path, shared.names), loader: "js" };
    });
  },
});

/**
 * A library chunk's generated entry: the modules that run first, then each module, provided
 * under its import name. The modules are imported by their file when shared by it, else by the
 * paths they resolve to from the view, or from the chunk's `from` folder.
 */
export const libraryEntrySource = (name: string): string => {
  const chunk = Object.hasOwn(LIBRARY_CHUNKS, name) ? LIBRARY_CHUNKS[name] : undefined;
  if (chunk === undefined) throw new Error(`there is no library chunk "${name}"`);
  const lines = [
    ...(chunk.first ?? []).map((path) => `import ${JSON.stringify(path)};`),
    `import { provide } from ${REGISTRY_IMPORT};`,
  ];
  const { from: folder } = chunk;
  Object.entries(chunk.modules).forEach(([module, names], index) => {
    const byPath = Object.hasOwn(BY_PATH, module) ? BY_PATH[module] : undefined;
    const path =
      byPath?.file ??
      (folder === undefined ? resolveFromView(module) : Bun.resolveSync(module, folder));
    const from = JSON.stringify(path);
    const local = `m${index}`;
    if (names === "*") {
      lines.push(
        `import * as ${local} from ${from};`,
        `provide(${JSON.stringify(module)}, ${local});`,
      );
      return;
    }
    const imported = names.map((export_) => `${export_} as ${local}_${export_}`).join(", ");
    const object = names.map((export_) => `${export_}: ${local}_${export_}`).join(", ");
    lines.push(
      `import { ${imported} } from ${from};`,
      `provide(${JSON.stringify(module)}, { ${object} });`,
    );
  });
  return `${lines.join("\n")}\n`;
};
