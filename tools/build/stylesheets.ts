// Package stylesheets in a chunk (latex-kanban-timeline, design decision 8). A component chunk may
// carry a package's stylesheet, listed in `CHUNK_STYLESHEETS` and appended to the chunk's styles
// after Tailwind's. The build keeps each `@font-face` source's woff2 file as a `data:` URL and
// drops its woff and ttf sources, so the chunk loads no file (AD-8, AD-9, NFR-9); `styleUrlProblems`
// then fails on any other `url(` and on an `@import`. The rewrite is the renderer spike's
// `inlineFonts`, run on the file rather than as a Bun plugin. For each chunk the load also reports
// the listed files, which join the chunk's inputs for its licence notices, and the package version
// of every stylesheet whose fonts it inlined, whose font licence the build checks (task 3.4).

import { dirname, isAbsolute, relative, resolve } from "node:path";
import { packageVersionOf } from "./licences.ts";
import { resolveFromWidgets } from "./paths.ts";

/** A chunk's name to the stylesheets it carries, as package paths resolved from the widgets. */
export type ChunkStylesheets = Readonly<Record<string, readonly string[]>>;

/** The package stylesheets by chunk: KaTeX's, for the LaTeX (latex-kanban-timeline, task 5.1). */
export const CHUNK_STYLESHEETS: ChunkStylesheets = { latex: ["katex/dist/katex.min.css"] };

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

/** How many fonts a rewrite inlined. */
type Count = { inlined: number };

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
const rewriteSource = async (
  source: string,
  dir: string,
  count: Count,
): Promise<string | undefined> => {
  const path = URL_IN_SOURCE.exec(source)?.[2];
  if (path === undefined || !isLocal(path)) return source;
  const extension = extensionOf(path);
  if (extension === "woff" || extension === "ttf") return undefined;
  if (extension !== "woff2") return source;
  const data = await fontData(path, dir);
  count.inlined += 1;
  return source.replace(URL_IN_SOURCE, data);
};

const rewriteFace = async (face: string, dir: string, count: Count): Promise<string> => {
  const match = SRC.exec(face);
  if (match === null) return face;
  const kept = (
    await Promise.all(
      sourcesOf(match[2] as string).map((source) => rewriteSource(source, dir, count)),
    )
  ).filter((source) => source !== undefined);
  return face.replace(SRC, () => `${match[1]}${kept.join(",")}`);
};

// The rewrite and the number of fonts it inlined.
const inlineFonts = async (css: string, dir: string): Promise<{ css: string; inlined: number }> => {
  const count: Count = { inlined: 0 };
  const faces = css.match(FONT_FACE) ?? [];
  const rewritten = await Promise.all(faces.map((face) => rewriteFace(face, dir, count)));
  let next = 0;
  return {
    css: css.replace(FONT_FACE, () => rewritten[next++] as string),
    inlined: count.inlined,
  };
};

/**
 * `css` with the woff2 source of each `@font-face` inlined as `url(data:font/woff2;base64,…)` and
 * its woff and ttf sources dropped; `dir` is the stylesheet's folder, which the fonts are read
 * from and may not leave. A source of another format, or at an address, stays for the URL check.
 */
export const inlineFontFaces = async (css: string, dir: string): Promise<string> =>
  (await inlineFonts(css, dir)).css;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type LoadedChunk = {
  readonly css?: string;
  readonly files: readonly string[];
  readonly fonts: readonly string[];
  readonly problems: readonly string[];
};

// One chunk's stylesheets, read and rewritten; a failure names the chunk and the file. A
// stylesheet whose fonts were inlined must lie in a package, which licenses them.
const loadChunk = async (
  chunk: string,
  specifiers: readonly string[],
  resolveSpecifier: (specifier: string) => string,
): Promise<LoadedChunk> => {
  const parts: string[] = [];
  const files: string[] = [];
  const fonts = new Set<string>();
  const problems: string[] = [];
  for (const specifier of specifiers) {
    try {
      const path = resolveSpecifier(specifier);
      const file = Bun.file(path);
      if (!(await file.exists())) throw new Error("the file does not exist");
      const { css, inlined } = await inlineFonts(await file.text(), dirname(path));
      const owner = inlined > 0 ? await packageVersionOf(path) : undefined;
      if (inlined > 0 && owner === undefined) {
        throw new Error("it inlines fonts but lies in no package whose licence could cover them");
      }
      if (owner !== undefined) fonts.add(owner);
      files.push(path);
      parts.push(css);
    } catch (error) {
      problems.push(`the chunk "${chunk}" lists the stylesheet ${specifier}: ${messageOf(error)}`);
    }
  }
  return problems.length > 0
    ? { files, fonts: [...fonts], problems }
    : { css: parts.join("\n"), files, fonts: [...fonts], problems };
};

/**
 * The listed chunks' styles, by chunk name: each listed stylesheet in order, joined by a line
 * feed, with its fonts inlined; the stylesheets' files; and the package versions whose fonts were
 * inlined (a chunk with none has no entry). A listed chunk that does not exist, a stylesheet that
 * cannot be resolved or read, a font that is missing and a stylesheet with inlined fonts outside
 * any package each give a problem naming the chunk.
 */
export const loadChunkStylesheets = async (
  table: ChunkStylesheets,
  chunks: ReadonlySet<string>,
  resolveSpecifier: (specifier: string) => string = resolveFromWidgets,
): Promise<{
  readonly styles: ReadonlyMap<string, string>;
  readonly files: ReadonlyMap<string, readonly string[]>;
  readonly fonts: ReadonlyMap<string, readonly string[]>;
  readonly problems: readonly string[];
}> => {
  const styles = new Map<string, string>();
  const files = new Map<string, readonly string[]>();
  const fonts = new Map<string, readonly string[]>();
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
    files.set(chunk, loaded.files);
    if (loaded.fonts.length > 0) fonts.set(chunk, loaded.fonts);
  }
  return { styles, files, fonts, problems };
};
