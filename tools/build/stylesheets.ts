// Package stylesheets in a chunk (latex-kanban-timeline, design decision 8). A component chunk may
// carry a package's stylesheet, listed in `CHUNK_STYLESHEETS` and appended to the chunk's styles
// after Tailwind's. The build keeps each `@font-face` source's woff2 file as a `data:` URL and
// drops its woff and ttf sources, so the chunk loads no file (AD-8, AD-9, NFR-9); `styleUrlProblems`
// then fails on any other `url(` and on an `@import`. The rewrite is the renderer spike's
// `inlineFonts`, run on the file rather than as a Bun plugin.

import { dirname, isAbsolute, relative, resolve } from "node:path";
import { resolveFromWidgets } from "./paths.ts";

/** A chunk's name to the stylesheets it carries, as package paths resolved from the widgets. */
export type ChunkStylesheets = Readonly<Record<string, readonly string[]>>;

/** The package stylesheets by chunk. Task 5.1 of latex-kanban-timeline adds `latex`. */
export const CHUNK_STYLESHEETS: ChunkStylesheets = {};

const FONT_FACE = /@font-face\s*\{[^}]*\}/gi;
const SRC = /(\bsrc\s*:\s*)([^;}]*)/i;
const URL_IN_SOURCE = /url\(\s*(["']?)([^"')]*)\1\s*\)/i;

// The comma-separated sources of one `src` value; commas inside parentheses or quotes stay.
const sourcesOf = (value: string): string[] => {
  const sources: string[] = [];
  let depth = 0;
  let quote = "";
  let from = 0;
  for (let at = 0; at < value.length; at += 1) {
    const char = value[at] as string;
    if (quote !== "") quote = char === quote ? "" : quote;
    else if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      sources.push(value.slice(from, at));
      from = at + 1;
    }
  }
  sources.push(value.slice(from));
  return sources;
};

const extensionOf = (path: string): string => {
  const bare = path.split(/[?#]/)[0] as string;
  return bare.slice(bare.lastIndexOf(".") + 1).toLowerCase();
};

// A path the build reads from the stylesheet's folder: relative, no scheme, no address.
const isLocal = (path: string): boolean =>
  path !== "" && !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith("//") && !isAbsolute(path);

const fontData = async (path: string, dir: string): Promise<string> => {
  const file = resolve(dir, path.split(/[?#]/)[0] as string);
  const inside = relative(dir, file);
  if (inside.startsWith("..") || isAbsolute(inside)) {
    throw new Error(`the font ${path} lies outside the stylesheet's folder`);
  }
  const font = Bun.file(file);
  if (!(await font.exists())) throw new Error(`the font ${path} is not in the stylesheet's folder`);
  return `url(data:font/woff2;base64,${Buffer.from(await font.bytes()).toString("base64")})`;
};

// One source: a woff2 file is inlined, a woff or ttf is dropped, anything else stays.
const rewriteSource = async (source: string, dir: string): Promise<string | undefined> => {
  const path = URL_IN_SOURCE.exec(source)?.[2];
  if (path === undefined || !isLocal(path)) return source;
  const extension = extensionOf(path);
  if (extension === "woff" || extension === "ttf") return undefined;
  if (extension !== "woff2") return source;
  return source.replace(URL_IN_SOURCE, await fontData(path, dir));
};

const rewriteFace = async (face: string, dir: string): Promise<string> => {
  const match = SRC.exec(face);
  if (match === null) return face;
  const kept = (
    await Promise.all(sourcesOf(match[2] as string).map((source) => rewriteSource(source, dir)))
  ).filter((source) => source !== undefined);
  return face.replace(SRC, () => `${match[1]}${kept.join(",")}`);
};

/**
 * `css` with the woff2 source of each `@font-face` inlined as `url(data:font/woff2;base64,…)` and
 * its woff and ttf sources dropped; `dir` is the stylesheet's folder, which the fonts are read
 * from and may not leave. A source of another format, or at an address, stays for the URL check.
 */
export const inlineFontFaces = async (css: string, dir: string): Promise<string> => {
  const faces = css.match(FONT_FACE) ?? [];
  const rewritten = await Promise.all(faces.map((face) => rewriteFace(face, dir)));
  let next = 0;
  return css.replace(FONT_FACE, () => rewritten[next++] as string);
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// One chunk's stylesheets, read and rewritten; a failure names the chunk and the file.
const loadChunk = async (
  chunk: string,
  specifiers: readonly string[],
  resolveSpecifier: (specifier: string) => string,
): Promise<{ css?: string; problems: string[] }> => {
  const parts: string[] = [];
  const problems: string[] = [];
  for (const specifier of specifiers) {
    try {
      const path = resolveSpecifier(specifier);
      const file = Bun.file(path);
      if (!(await file.exists())) throw new Error("the file does not exist");
      parts.push(await inlineFontFaces(await file.text(), dirname(path)));
    } catch (error) {
      problems.push(`the chunk "${chunk}" lists the stylesheet ${specifier}: ${messageOf(error)}`);
    }
  }
  return problems.length > 0 ? { problems } : { css: parts.join("\n"), problems };
};

/**
 * The listed chunks' styles, by chunk name: each listed stylesheet in order, joined by a line
 * feed, with its fonts inlined. A listed chunk that does not exist, a stylesheet that cannot be
 * resolved or read and a font that is missing each give a problem naming the chunk.
 */
export const loadChunkStylesheets = async (
  table: ChunkStylesheets,
  chunks: ReadonlySet<string>,
  resolveSpecifier: (specifier: string) => string = resolveFromWidgets,
): Promise<{
  readonly styles: ReadonlyMap<string, string>;
  readonly problems: readonly string[];
}> => {
  const styles = new Map<string, string>();
  const problems: string[] = [];
  for (const [chunk, specifiers] of Object.entries(table)) {
    if (!chunks.has(chunk)) {
      problems.push(
        `CHUNK_STYLESHEETS lists the chunk "${chunk}", but the build has no such chunk`,
      );
      continue;
    }
    const loaded = await loadChunk(chunk, specifiers, resolveSpecifier);
    problems.push(...loaded.problems);
    if (loaded.css !== undefined) styles.set(chunk, loaded.css);
  }
  return { styles, problems };
};
