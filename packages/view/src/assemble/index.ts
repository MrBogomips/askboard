// `@askboard/view/assemble` (AD-9): one pure function builds a board's srcdoc, called by the board
// page, and every Snapshot, called by `snapshot`. It inlines only the chunks the board needs,
// writes AD-8's view policy as a meta tag, and puts the board document and the state in the
// `askboard-data` block the view boots from, with the fields of a view update the view also boots
// from (`bootFieldsOf`). Data that carries `snapshot` is a Snapshot (snapshot design decision 4):
// its block holds the Snapshot data whole, and the `askboard-licences` block ends the file. Plain
// ECMAScript only: no DOM, Node or Bun API.

import {
  cspHashSource,
  type ManifestFile,
  SNAPSHOT_LICENCES_ELEMENT,
  type SnapshotData,
  type ViewManifest,
} from "@askboard/contract";
import { BOOT_DATA_ID, type BootData, bootFieldsOf } from "../boot-data.ts";
import { htmlLang, languageOf } from "../strings/language.ts";
import { jsonBlock } from "./json-block.ts";
import { licenceNotices } from "./licences.ts";
import { FOR_BOARD, type SelectedChunk, type SelectionTarget, selectChunks } from "./select.ts";

export { type InlinedLicence, licenceNotices } from "./licences.ts";
export {
  FOR_BOARD,
  type SelectedChunk,
  type SelectionTarget,
  selectChunks,
  sourcesToFetch,
} from "./select.ts";

/** Each fetched script and style by its SHA-256 in lowercase hex, the chunk route's key. */
export type ChunkSources = Readonly<Record<string, string>>;

/** Each licence notice's text by its path in the view build's folder, as the manifest names it. */
export type LicenceTexts = Readonly<Record<string, string>>;

/** What a Snapshot inlines: the chunk files, as for a board, and the notice texts it ends with. */
export type SnapshotSources = { readonly chunks: ChunkSources; readonly licences: LicenceTexts };

export type Assembled = {
  /** The view's document: a board's, for the iframe's `srcdoc`, or a Snapshot's file. */
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

/** Data that carries `snapshot` is a Snapshot's (snapshot design decision 4). */
const isSnapshot = (data: BootData | SnapshotData): data is SnapshotData => "snapshot" in data;

// A chunk text is a string, so Snapshot sources are the ones whose `chunks` is an object.
const isSnapshotSources = (sources: ChunkSources | SnapshotSources): sources is SnapshotSources =>
  typeof (sources as { readonly chunks?: unknown }).chunks === "object";

/** Which chunks the data's view needs: a Snapshot's leave out what only a host loads. */
export const targetOf = (data: BootData | SnapshotData): SelectionTarget =>
  isSnapshot(data) ? { output: "snapshot", renders: data.renders ?? [] } : FOR_BOARD;

// The `askboard-data` block: a board's document, state and boot fields, or the Snapshot data whole.
const dataBlock = (data: BootData | SnapshotData): string =>
  jsonBlock(
    BOOT_DATA_ID,
    isSnapshot(data) ? data : { document: data.document, state: data.state, ...bootFieldsOf(data) },
  );

// A Snapshot's last block: the notices of the chunks it inlines, each with its text.
const licencesBlock = (
  selection: readonly SelectedChunk[],
  sources: ChunkSources | SnapshotSources,
): string => {
  if (!isSnapshotSources(sources)) {
    throw new Error("a Snapshot is assembled with its licence notices' texts, in sources.licences");
  }
  return jsonBlock(SNAPSHOT_LICENCES_ELEMENT, licenceNotices(selection, sources.licences));
};

const page = (lang: string, head: readonly string[], body: readonly string[]): string =>
  [
    "<!doctype html>",
    `<html lang="${lang}">`,
    "<head>",
    '<meta charset="utf-8">',
    ...head,
    "</head>",
    "<body>",
    '<div id="root"></div>',
    ...body,
    "</body>",
    "</html>",
    "",
  ].join("\n");

/**
 * The view's document: the policy first, then the `askboard-data` block and each selected chunk's
 * styles, then the root and each selected chunk's script, in load order; for a Snapshot, the
 * `askboard-licences` block last. A board's comes from E1's chunk sources, a Snapshot's from its
 * chunk sources and notice texts. The same input gives the same output.
 */
export function assemble(data: BootData, manifest: ViewManifest, sources: ChunkSources): Assembled;
export function assemble(
  data: SnapshotData,
  manifest: ViewManifest,
  sources: SnapshotSources,
): Assembled;
export function assemble(
  data: BootData | SnapshotData,
  manifest: ViewManifest,
  sources: ChunkSources | SnapshotSources,
): Assembled {
  const selection = selectChunks(data.document, manifest, targetOf(data));
  const fetched = isSnapshotSources(sources) ? sources.chunks : sources;
  const policy = viewPolicy(selection);
  const styles = selection.flatMap(({ name, chunk }) =>
    chunk.styles.map((style) => `<style>${textOf(name, style, fetched)}</style>`),
  );
  const scripts = selection.map(
    ({ name, chunk }) => `<script>${textOf(name, chunk.script, fetched)}</script>`,
  );
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  const licences = isSnapshot(data) ? [licencesBlock(selection, sources)] : [];
  const lang = htmlLang(languageOf(data.document));
  const srcdoc = page(lang, [meta, dataBlock(data), ...styles], [...scripts, ...licences]);
  return { srcdoc, policy, chunks: selection.map(({ name }) => name) };
}
