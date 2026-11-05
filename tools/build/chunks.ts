// The chunks the view build makes and how one is bundled (design decision 7): the shell, one
// library chunk per entry of `LIBRARY_CHUNKS`, and one component chunk per folder under
// `packages/view/src/catalog/` or `packages/widgets/src/` holding an `index.tsx`, named as the
// component it registers (design decision 8). Each is a classic-script IIFE from `Bun.build`, and
// none may hold `import.meta` (AD-9).

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ManifestChunk } from "@askboard/contract";
import type { BunPlugin } from "bun";
import { importMetaProblem } from "./checks.ts";
import { chunkInputs } from "./licences.ts";
import { CATALOG_DIR, SHELL_ENTRY, WIDGETS_SRC } from "./paths.ts";
import { LIBRARY_CHUNKS, libraryEntrySource } from "./shared-modules.ts";
import type { StylePlan } from "./styles.ts";

export type ChunkKind = ManifestChunk["kind"];

export type ChunkDefinition = {
  readonly name: string;
  readonly kind: ChunkKind;
  /** The entry module's path. */
  readonly entry: string;
  /** Loaded only by a view with a host, so never by a Snapshot (snapshot design decision 5). */
  readonly hostOnly?: true;
};

/**
 * The chunks only a view with a host loads (snapshot design decision 5): ext-apps, whose `App`
 * the shell takes from the shared-module registry when it has a parent. A board's selection adds
 * them, a Snapshot's leaves them out, and no other chunk may need them.
 */
export const HOST_ONLY_CHUNKS: ReadonlySet<string> = new Set(["ext-apps"]);

/** A document's styles for the shell, a component's own utilities, nothing for a library. */
export const stylePlanOf = (kind: ChunkKind): StylePlan | undefined =>
  (({ shell: "document", component: "utilities", library: undefined }) as const)[kind];

/** Where component chunks are found: the view's catalog, then the widgets (design decision 8). */
export const COMPONENT_ROOTS: readonly string[] = [CATALOG_DIR, WIDGETS_SRC];

const entryOf = (root: string, name: string) => join(root, name, "index.tsx");

// The folders of one root that hold an `index.tsx`.
const chunkFolders = async (root: string): Promise<string[]> => {
  const folders = await readdir(root, { withFileTypes: true });
  const named = folders.filter((folder) => folder.isDirectory()).map((folder) => folder.name);
  const withEntry = await Promise.all(
    named.map(async (name) => ((await Bun.file(entryOf(root, name)).exists()) ? [name] : [])),
  );
  return withEntry.flat();
};

/** One component chunk per folder of the roots holding an `index.tsx`; a name in two fails. */
export const componentChunks = async (
  roots: readonly string[] = COMPONENT_ROOTS,
): Promise<ChunkDefinition[]> => {
  const found = new Map<string, string>();
  for (const root of roots) {
    for (const name of await chunkFolders(root)) {
      const other = found.get(name);
      if (other !== undefined) {
        throw new Error(
          `the component chunk "${name}" is in two folders: ${join(other, name)} and ${join(root, name)}`,
        );
      }
      found.set(name, root);
    }
  }
  return [...found]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, root]) => ({ name, kind: "component", entry: entryOf(root, name) }));
};

// The component chunks that register more than the component they are named after: the context
// chunk registers the three context items' components (excerpts, design decision 6).
const CHUNK_COMPONENTS: Readonly<Record<string, readonly string[]>> = {
  context: ["excerpt", "image", "reference"],
};

/** The components a component chunk registers: its own name, unless the table above lists more. */
export const chunkComponents = (name: string): readonly string[] =>
  Object.hasOwn(CHUNK_COMPONENTS, name) ? (CHUNK_COMPONENTS[name] ?? [name]) : [name];

const HOST_ONLY = { hostOnly: true } as const;

/** Every chunk, writing the library chunks' generated entries into `work`. */
export const chunkDefinitions = async (
  work: string,
  roots: readonly string[] = COMPONENT_ROOTS,
): Promise<ChunkDefinition[]> => {
  const libraries = await Promise.all(
    Object.keys(LIBRARY_CHUNKS).map(async (name): Promise<ChunkDefinition> => {
      const entry = join(work, "entries", `${name}.js`);
      await Bun.write(entry, libraryEntrySource(name));
      return { name, kind: "library", entry, ...(HOST_ONLY_CHUNKS.has(name) ? HOST_ONLY : {}) };
    }),
  );
  return [
    { name: "shell", kind: "shell", entry: SHELL_ENTRY },
    ...libraries,
    ...(await componentChunks(roots)),
  ];
};

export type Bundle = {
  /** The minified IIFE, as the bundler wrote it. */
  readonly code: string;
  /** The files with code in the output, as absolute paths. */
  readonly inputs: readonly string[];
};

const messageOf = (error: unknown): string =>
  error instanceof AggregateError
    ? error.errors.map(String).join("\n")
    : error instanceof Error
      ? error.message
      : String(error);

/** Bundles one chunk as a classic script, failing with the chunk's name. */
export const bundleChunk = async (
  chunk: Pick<ChunkDefinition, "name" | "entry">,
  plugins: readonly BunPlugin[] = [],
): Promise<Bundle> => {
  let result: Bun.BuildOutput;
  try {
    result = await Bun.build({
      entrypoints: [chunk.entry],
      format: "iife",
      target: "browser",
      minify: true,
      metafile: true,
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [...plugins],
    });
  } catch (error) {
    throw new Error(`the chunk "${chunk.name}" did not build:\n${messageOf(error)}`);
  }
  const output = result.outputs.find((file) => file.kind === "entry-point");
  if (!result.success || output === undefined || result.metafile === undefined) {
    throw new Error(`the chunk "${chunk.name}" did not build:\n${result.logs.join("\n")}`);
  }
  const code = await output.text();
  const problem = importMetaProblem(chunk.name, code);
  if (problem !== undefined) throw new Error(problem);
  return { code, inputs: chunkInputs(result.metafile, process.cwd()) };
};
