// `assemble`'s selection step (design decision 8): the chunks a board needs, in the order the
// view loads them. The board page calls it first and fetches the selected chunks' sources by
// hash; `assemble` then selects again from the same input, so both agree. Names come from the
// manifest and the catalog, and are looked up as own properties only.

import type { ManifestChunk, ManifestFile, SnapshotRender, ViewManifest } from "@askboard/contract";
import { componentsOf } from "../catalog/components.ts";
import type { ViewDocument } from "../view-document.ts";
import { keptComponents } from "./kept-render.ts";

export type SelectedChunk = { readonly name: string; readonly chunk: ManifestChunk };

/**
 * What the chunks are selected for (snapshot design decision 4): a board, whose view has the board
 * page as its host, or a Snapshot, which has none, with the kept renders its data holds.
 */
export type SelectionTarget =
  | { readonly output: "board" }
  | { readonly output: "snapshot"; readonly renders: readonly SnapshotRender[] };

/** A board's selection, E1's: what the board page and its tests select. */
export const FOR_BOARD: SelectionTarget = { output: "board" };

type Chunks = ViewManifest["chunks"];

const chunkNamed = (chunks: Chunks, name: string, why: string): ManifestChunk => {
  const chunk = Object.hasOwn(chunks, name) ? chunks[name] : undefined;
  if (chunk === undefined) throw new Error(`${why} the chunk "${name}", which the manifest lacks`);
  return chunk;
};

// For a Snapshot, a component chunk naming a kept-render chunk gives way to it when the renders
// cover every item of its component, and is joined by it when they do not (snapshot design
// decision 4, Kept renders); a board ignores renders.
const componentRoots = (
  [name, chunk]: [string, ManifestChunk],
  component: string,
  kept: ReadonlySet<string> | undefined,
): string[] => {
  const keptRender = chunk.keptRender;
  if (kept === undefined || keptRender === undefined) return [name];
  return kept.has(component) ? [keptRender] : [name, keptRender];
};

// The shell, and the chunk registering each component the board's items render with, widget
// items included (design decision 7), or its kept-render chunk; for a board, every host-only chunk
// too, which only a view with a host loads (snapshot design decision 5).
const roots = (document: ViewDocument, chunks: Chunks, target: SelectionTarget): string[] => {
  const entries = Object.entries(chunks);
  const shell = entries.find(([, chunk]) => chunk.kind === "shell")?.[0];
  if (shell === undefined) throw new Error("the manifest has no shell chunk");
  const kept = target.output === "snapshot" ? keptComponents(document, target.renders) : undefined;
  const components = componentsOf(document).flatMap((component) => {
    const found = entries.find(([, chunk]) => chunk.components?.includes(component) === true);
    if (found === undefined) throw new Error(`no chunk of the manifest registers "${component}"`);
    return componentRoots(found, component, kept);
  });
  const hosted = target.output === "board" ? entries.filter(([, chunk]) => chunk.hostOnly) : [];
  return [shell, ...hosted.map(([name]) => name), ...components];
};

// Every chunk the roots need, directly or through another chunk. A Snapshot has no host, so a
// host-only chunk it would need is an error naming the chunk that needs it.
const closure = (
  start: readonly string[],
  chunks: Chunks,
  target: SelectionTarget,
): Map<string, ManifestChunk> => {
  const selected = new Map<string, ManifestChunk>();
  const pending = start.map((name) => ({ name, why: "the board needs" }));
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (selected.has(next.name)) continue;
    const chunk = chunkNamed(chunks, next.name, next.why);
    if (target.output === "snapshot" && chunk.hostOnly === true) {
      throw new Error(
        `${next.why} the host-only chunk "${next.name}", which a Snapshot leaves out`,
      );
    }
    selected.set(next.name, chunk);
    const why = `the chunk "${next.name}" needs`;
    pending.push(...chunk.needs.map((name) => ({ name, why })));
  }
  return selected;
};

const RANK: Readonly<Record<ManifestChunk["kind"], number>> = {
  library: 0,
  shell: 1,
  component: 2,
};

const before = (a: SelectedChunk, b: SelectedChunk): number =>
  RANK[a.chunk.kind] - RANK[b.chunk.kind] || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * The shell, the chunks of the components the board's items render with, and every chunk those
 * need, each after the chunks it needs: libraries first, then the shell, then the components,
 * by name within each kind. A board's take the host-only chunks too, a Snapshot's none, and a
 * Snapshot's take a kept-render chunk for a component its renders cover. The order depends only on
 * the input, so `assemble` is repeatable.
 */
export const selectChunks = (
  document: ViewDocument,
  manifest: ViewManifest,
  target: SelectionTarget = FOR_BOARD,
): readonly SelectedChunk[] => {
  const { chunks } = manifest;
  const selected = closure(roots(document, chunks, target), chunks, target);
  const ordered: SelectedChunk[] = [];
  const placed = new Set<string>();
  let unplaced = [...selected].map(([name, chunk]) => ({ name, chunk }));
  while (unplaced.length > 0) {
    const next = unplaced
      .filter(({ chunk }) => chunk.needs.every((name) => placed.has(name)))
      .sort(before)[0];
    if (next === undefined) {
      const names = unplaced.map(({ name }) => name).join(", ");
      throw new Error(`the chunks ${names} cannot be ordered: their needs form a cycle`);
    }
    ordered.push(next);
    placed.add(next.name);
    unplaced = unplaced.filter(({ name }) => name !== next.name);
  }
  return ordered;
};

/** What the board page fetches for a selection: each chunk's script and styles, each hash once. */
export const sourcesToFetch = (selection: readonly SelectedChunk[]): readonly ManifestFile[] => {
  const files = new Map<string, ManifestFile>();
  for (const { chunk } of selection) {
    for (const file of [chunk.script, ...chunk.styles]) files.set(file.sha256, file);
  }
  return [...files.values()];
};
