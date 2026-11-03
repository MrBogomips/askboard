// `@askboard/view/assemble` (AD-9): one pure function builds a board's srcdoc, called by the board
// page, and later every Snapshot, called by `snapshot`. It inlines only the chunks the board
// needs, writes AD-8's view policy as a meta tag, and puts the board document and the state in
// the `askboard-data` block the view boots from, with the fields of a view update the view also
// boots from (`bootFieldsOf`). Plain ECMAScript only: no DOM, Node or Bun API.

import { cspHashSource, type ManifestFile, type ViewManifest } from "@askboard/contract";
import { BOOT_DATA_ID, type BootData, bootFieldsOf } from "../boot-data.ts";
import { type SelectedChunk, selectChunks } from "./select.ts";

export { type SelectedChunk, selectChunks, sourcesToFetch } from "./select.ts";

/** Each fetched script and style by its SHA-256 in lowercase hex, the chunk route's key. */
export type ChunkSources = Readonly<Record<string, string>>;

export type Assembled = {
  /** The view's document, for the iframe's `srcdoc`. */
  readonly srcdoc: string;
  /** The CSP its meta tag carries. */
  readonly policy: string;
  /** The chunks inlined, in load order. */
  readonly chunks: readonly string[];
};

const sources = (hashes: readonly string[]): string =>
  hashes.length === 0 ? "'none'" : hashes.map(cspHashSource).join(" ");

/**
 * AD-8's view policy: scripts and styles only by the hashes of the inlined chunks, the view's
 * media sources, and nothing else: no connection, object, frame, form target or base URL.
 */
export const viewPolicy = (selection: readonly SelectedChunk[]): string => {
  const scripts = selection.map(({ chunk }) => chunk.script.sha256);
  const styles = selection.flatMap(({ chunk }) => chunk.styles.map((style) => style.sha256));
  return [
    "default-src 'none'",
    `script-src ${sources(scripts)}`,
    `style-src ${sources(styles)}`,
    "img-src data: blob:",
    "font-src data:",
    "connect-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");
};

// UTF-8 bytes, as the manifest counts them; a lone surrogate counts as its replacement's 3.
const utf8Bytes = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
};

// A file's fetched text. The CSP admits it only by its hash; a missing or resized text fails here.
const textOf = (name: string, file: ManifestFile, fetched: ChunkSources): string => {
  const text = Object.hasOwn(fetched, file.sha256) ? fetched[file.sha256] : undefined;
  if (text === undefined) throw new Error(`no source for ${file.path} of the chunk "${name}"`);
  const bytes = utf8Bytes(text);
  if (bytes !== file.bytes) {
    throw new Error(`${file.path} of the chunk "${name}" is ${bytes} bytes, not ${file.bytes}`);
  }
  return text;
};

/** The data as JSON with every `<` escaped: no agent string can end the block or open a tag. */
const dataBlock = (data: BootData): string =>
  JSON.stringify({ document: data.document, state: data.state, ...bootFieldsOf(data) }).replaceAll(
    "<",
    "\\u003c",
  );

/**
 * The view's srcdoc for a board: the policy first, then the `askboard-data` block and each
 * selected chunk's styles, then the root and each selected chunk's script, in load order. The
 * same input gives the same output.
 */
export const assemble = (
  data: BootData,
  manifest: ViewManifest,
  fetched: ChunkSources,
): Assembled => {
  const selection = selectChunks(data.document, manifest);
  const policy = viewPolicy(selection);
  const styles = selection.flatMap(({ name, chunk }) =>
    chunk.styles.map((style) => `<style>${textOf(name, style, fetched)}</style>`),
  );
  const scripts = selection.map(
    ({ name, chunk }) => `<script>${textOf(name, chunk.script, fetched)}</script>`,
  );
  const srcdoc = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
    `<script type="application/json" id="${BOOT_DATA_ID}">${dataBlock(data)}</script>`,
    ...styles,
    "</head>",
    "<body>",
    '<div id="root"></div>',
    ...scripts,
    "</body>",
    "</html>",
    "",
  ].join("\n");
  return { srcdoc, policy, chunks: selection.map(({ name }) => name) };
};
