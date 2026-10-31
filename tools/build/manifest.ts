// The view manifest's file entries and the checks on a written build (AD-9): each listed file
// exists with the SHA-256 and size the manifest gives, the board page's HTML holds its script and
// styles exactly as their files do, and the manifest passes the contract's validation.

import type { ManifestFile, ViewManifest } from "@askboard/contract";
import { validateViewManifest } from "@askboard/contract/validate";

const sha256Hex = (data: string | Uint8Array): string =>
  new Bun.CryptoHasher("sha256").update(data).digest("hex");

/** A file's manifest entry: its path in the folder, SHA-256 in lowercase hex and size in bytes. */
export const fileEntry = (path: string, text: string): ManifestFile => ({
  path,
  sha256: sha256Hex(text),
  bytes: Buffer.byteLength(text),
});

/** Every file the manifest lists, each once: scripts, styles, the board page and the licences. */
export const listedFiles = (manifest: ViewManifest): string[] => {
  const { boardPage, chunks } = manifest;
  const groups = [boardPage, ...Object.values(chunks)];
  const paths = [
    boardPage.html.path,
    ...groups.flatMap((group) => [
      ...("script" in group ? [group.script.path] : []),
      ...group.styles.map((style) => style.path),
      ...group.licences.map((notice) => notice.path),
    ]),
  ];
  return [...new Set(paths)];
};

const entries = (manifest: ViewManifest): ManifestFile[] => {
  const { boardPage, chunks } = manifest;
  return [
    boardPage.html,
    boardPage.script,
    ...boardPage.styles,
    ...Object.values(chunks).flatMap((chunk) => [chunk.script, ...chunk.styles]),
  ];
};

type Read = (path: string) => Uint8Array | undefined;

const entryProblems = (entry: ManifestFile, read: Read): string[] => {
  const data = read(entry.path);
  if (data === undefined) return [];
  const problems: string[] = [];
  if (sha256Hex(data) !== entry.sha256) {
    problems.push(`${entry.path} does not match its SHA-256 in the manifest`);
  }
  if (data.byteLength !== entry.bytes) {
    problems.push(
      `${entry.path} is ${data.byteLength} bytes, and the manifest says ${entry.bytes}`,
    );
  }
  return problems;
};

const decoder = new TextDecoder();

// The board page is served as its HTML, and its CSP names the script's and styles' hashes.
const inlineProblems = ({ boardPage }: ViewManifest, read: Read): string[] => {
  const html = read(boardPage.html.path);
  if (html === undefined) return [];
  const page = decoder.decode(html);
  const inline = [
    { file: boardPage.script, tag: "script" },
    ...boardPage.styles.map((file) => ({ file, tag: "style" })),
  ];
  return inline.flatMap(({ file, tag }) => {
    const data = read(file.path);
    if (data === undefined || page.includes(`<${tag}>${decoder.decode(data)}</${tag}>`)) return [];
    return [`${boardPage.html.path} does not hold ${file.path} inline`];
  });
};

/** What fails in a written build, read through `read`; empty when every file matches. */
export const hashProblems = (manifest: ViewManifest, read: Read): string[] => {
  const missing = listedFiles(manifest)
    .filter((path) => read(path) === undefined)
    .map((path) => `${path} is listed in the manifest but missing`);
  const seen = new Set<string>();
  const mismatched = entries(manifest).flatMap((entry) => {
    if (seen.has(entry.path)) return [];
    seen.add(entry.path);
    return entryProblems(entry, read);
  });
  return [...missing, ...mismatched, ...inlineProblems(manifest, read)];
};

/** The contract's validation of the manifest, each problem at its JSON Pointer. */
export const manifestProblems = (manifest: ViewManifest): string[] => {
  const checked = validateViewManifest(manifest);
  return checked.ok ? [] : checked.problems.map(({ path, message }) => `${path}: ${message}`);
};
