// The `assemble(boardDocument, manifest)` stand-in (AD-9): one pure function builds both a
// board's srcdoc and a Snapshot file, with AD-8's CSP, inlining only the chunks the board uses
// and the `askboard-data` block the view boots from.

import { join } from "node:path";
import type { Chunk, Kind, Manifest } from "./build.ts";
import { viewPolicy } from "./csp.ts";
import type { BoardDocument, Draft, Item } from "./port/index.ts";

export type Build = { manifest: Manifest; texts: ReadonlyMap<string, string> };

export type AssembleOptions = {
  renderer: string;
  // false for the control run: no CSP at all.
  csp?: boolean;
  draft?: Draft;
  theme?: "light" | "dark" | "system";
};

export type Assembled = {
  html: string;
  chunks: string[];
  scripts: { chunk: string; sha256: string }[];
  styles: { chunk: string; sha256: string }[];
  policy: string | null;
};

const ORDER: Record<Kind, number> = { probe: 0, shell: 1, library: 2, renderer: 3, component: 4 };

export const loadBuild = async (dist: string): Promise<Build> => {
  const file = Bun.file(join(dist, "manifest.json"));
  if (!(await file.exists())) throw new Error(`no ${dist}/manifest.json: run bun run build`);
  const manifest = (await file.json()) as Manifest;
  const texts = new Map<string, string>();
  for (const chunk of manifest.chunks) {
    for (const asset of [chunk.script, chunk.style]) {
      if (asset) texts.set(asset.file, await Bun.file(join(dist, asset.file)).text());
    }
  }
  return { manifest, texts };
};

const typesIn = (items: readonly Item[]): string[] =>
  items.flatMap((item) => [item.type, ...typesIn(item.children ?? [])]);

// The chunks a board uses: the shell, the renderer, each item type's chunk, and what they need.
export const chunksFor = (board: BoardDocument, manifest: Manifest, renderer: string): Chunk[] => {
  const byName = new Map(manifest.chunks.map((chunk) => [chunk.name, chunk]));
  const byType = new Map(
    manifest.chunks.flatMap((chunk) => chunk.components.map((type) => [type, chunk.name])),
  );
  const wanted = [
    "instrument",
    "shell",
    `renderer-${renderer}`,
    ...typesIn(board.items).flatMap((type) => byType.get(type) ?? []),
  ];
  const chosen = new Map<string, Chunk>();
  const visit = (name: string): void => {
    if (chosen.has(name)) return;
    const chunk = byName.get(name);
    if (!chunk) throw new Error(`assemble: no chunk ${name} in the manifest`);
    chosen.set(name, chunk);
    chunk.needs.forEach(visit);
  };
  wanted.forEach(visit);
  return [...chosen.values()].sort(
    (a, b) => ORDER[a.kind] - ORDER[b.kind] || a.name.localeCompare(b.name),
  );
};

// `<` is escaped so no string in the board document can end the data block.
const dataBlock = (data: unknown): string => JSON.stringify(data).replaceAll("<", "\\u003c");

const escapeHtml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const assemble = (
  board: BoardDocument,
  build: Build,
  options: AssembleOptions,
): Assembled => {
  const chunks = chunksFor(board, build.manifest, options.renderer);
  const text = (file: string): string => {
    const value = build.texts.get(file);
    if (value === undefined) throw new Error(`assemble: no text for ${file}`);
    return value;
  };
  const scripts = chunks.map((c) => ({ chunk: c.name, sha256: c.script.sha256 }));
  const styled = chunks.filter((c) => c.style !== null);
  const styles = styled.map((c) => ({ chunk: c.name, sha256: c.style?.sha256 as string }));
  const policy =
    options.csp === false
      ? null
      : viewPolicy(
          scripts.map((s) => s.sha256),
          styles.map((s) => s.sha256),
        );
  const [instrument, ...rest] = chunks;
  if (instrument?.name !== "instrument") throw new Error("assemble: instrument must come first");
  const data = {
    board,
    draft: options.draft ?? { values: {}, ui: {} },
    renderer: options.renderer,
    theme: options.theme ?? "system",
  };
  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    policy ? `<meta http-equiv="Content-Security-Policy" content="${policy}">` : "",
    `<title>${escapeHtml(board.title ?? board.id)}</title>`,
    `<script>${text(instrument.script.file)}</script>`,
    ...styled.map((c) => `<style>${text(c.style?.file as string)}</style>`),
    "</head>",
    "<body>",
    '<div id="root"></div>',
    `<script type="application/json" id="askboard-data">${dataBlock(data)}</script>`,
    ...rest.map((c) => `<script>${text(c.script.file)}</script>`),
    "</body>",
    "</html>",
  ]
    .filter(Boolean)
    .join("\n");
  return { html, chunks: chunks.map((c) => c.name), scripts, styles, policy };
};
