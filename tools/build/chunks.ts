// The chunks the view build makes and how one is bundled (design decision 7): the shell, one
// library chunk per entry of `LIBRARY_CHUNKS`, and one component chunk per folder under
// `packages/view/src/catalog/` holding an `index.tsx`, named as the component it registers. Each
// is a classic-script IIFE from `Bun.build`, and none may hold `import.meta` (AD-9).

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ManifestChunk } from "@askboard/contract";
import type { BunPlugin } from "bun";
import { importMetaProblem } from "./checks.ts";
import { chunkInputs } from "./licences.ts";
import { CATALOG_DIR, SHELL_ENTRY } from "./paths.ts";
import { LIBRARY_CHUNKS, libraryEntrySource } from "./shared-modules.ts";
import type { StylePlan } from "./styles.ts";

export type ChunkKind = ManifestChunk["kind"];

export type ChunkDefinition = {
  readonly name: string;
  readonly kind: ChunkKind;
  /** The entry module's path. */
  readonly entry: string;
};

/** A document's styles for the shell, a component's own utilities, nothing for a library. */
export const stylePlanOf = (kind: ChunkKind): StylePlan | undefined =>
  (({ shell: "document", component: "utilities", library: undefined }) as const)[kind];

const componentChunks = async (): Promise<ChunkDefinition[]> => {
  const folders = await readdir(CATALOG_DIR, { withFileTypes: true });
  const named = folders.filter((folder) => folder.isDirectory()).map((folder) => folder.name);
  const withEntry = await Promise.all(
    named.map(async (name) =>
      (await Bun.file(join(CATALOG_DIR, name, "index.tsx")).exists()) ? [name] : [],
    ),
  );
  return withEntry
    .flat()
    .sort()
    .map((name) => ({ name, kind: "component", entry: join(CATALOG_DIR, name, "index.tsx") }));
};

/** Every chunk, writing the library chunks' generated entries into `work`. */
export const chunkDefinitions = async (work: string): Promise<ChunkDefinition[]> => {
  const libraries = await Promise.all(
    Object.keys(LIBRARY_CHUNKS).map(async (name): Promise<ChunkDefinition> => {
      const entry = join(work, "entries", `${name}.js`);
      await Bun.write(entry, libraryEntrySource(name));
      return { name, kind: "library", entry };
    }),
  );
  return [
    { name: "shell", kind: "shell", entry: SHELL_ENTRY },
    ...libraries,
    ...(await componentChunks()),
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
