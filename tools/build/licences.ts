// Licence notices per chunk (AD-9, design decision 7): one per package of the files the bundler's
// metafile lists for the chunk's output, with the package's name, version and SPDX licence from its
// package.json and the text of its licence files. AskBoard's own packages carry the repository's
// MIT licence. A package with no licence file or no licence field fails the build: its notice
// cannot be shipped.

import { readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import type { LicenceNotice } from "@askboard/contract";

export type NoticeFile = { readonly notice: LicenceNotice; readonly text: string };

type Metafile = {
  readonly outputs: Readonly<
    Record<string, { readonly inputs?: Readonly<Record<string, { bytesInOutput: number }>> }>
  >;
};

// Plugin modules are keyed `<namespace>:<path>`; files by their path relative to the build's cwd.
const PLUGIN_MODULE = /^[a-z][a-z0-9-]*:/;

/**
 * The files the metafile lists for a chunk's output, as absolute paths. A module the output keeps
 * no byte of, such as `radix-ui`'s index of re-exports, still names the package the chunk is for.
 */
export const chunkInputs = (metafile: Metafile, cwd: string): string[] => {
  const files = Object.values(metafile.outputs).flatMap((output) =>
    Object.keys(output.inputs ?? {})
      .filter((path) => !PLUGIN_MODULE.test(path))
      .map((path) => resolve(cwd, path)),
  );
  return [...new Set(files)].sort();
};

const LICENCE_FILE = /^(licen[cs]e|copying|notice)([.-].*)?$/i;

/** The notice's file in the build: `licences/<name without @, / as ->-<version>.txt`. */
export const licencePath = (name: string, version: string): string =>
  `licences/${name.replace(/^@/, "").replaceAll("/", "-")}-${version}.txt`;

type PackageAt = { readonly dir: string; readonly workspace: boolean };

// The innermost package folder under node_modules, or an AskBoard package under packages/.
const packageOf = (file: string, root: string): PackageAt | undefined => {
  const parts = file.split(sep);
  const at = parts.lastIndexOf("node_modules");
  if (at !== -1) {
    const scoped = parts[at + 1]?.startsWith("@") === true;
    const end = at + (scoped ? 3 : 2);
    return end < parts.length
      ? { dir: parts.slice(0, end).join(sep), workspace: false }
      : undefined;
  }
  const [top, name] = relative(root, file).split(sep);
  if (top !== "packages" || name === undefined) return undefined;
  return { dir: join(root, "packages", name), workspace: true };
};

const licenceTexts = async (dir: string): Promise<string[]> => {
  const files = (await readdir(dir)).filter((file) => LICENCE_FILE.test(file)).sort();
  return Promise.all(files.map((file) => Bun.file(join(dir, file)).text()));
};

const spdxOf = (field: unknown): string | undefined => {
  if (typeof field === "string" && field !== "") return field;
  if (typeof field === "object" && field !== null && "type" in field) {
    return typeof field.type === "string" ? field.type : undefined;
  }
  return undefined;
};

const noticeOf = async (at: PackageAt, chunk: string, root: string): Promise<NoticeFile> => {
  const manifest = await Bun.file(join(at.dir, "package.json")).json();
  const name = String(manifest.name);
  const version = String(manifest.version);
  const where = `${name} ${version} in the chunk "${chunk}"`;
  const licence = spdxOf(manifest.license);
  if (licence === undefined) throw new Error(`${where} names no licence in its package.json`);
  // AskBoard's packages hold no licence file of their own: the repository's covers them.
  const own = await licenceTexts(at.dir);
  const texts = own.length > 0 || !at.workspace ? own : await licenceTexts(root);
  if (texts.length === 0) throw new Error(`${where} has no licence file`);
  return {
    notice: { package: name, version, licence, path: licencePath(name, version) },
    text: texts.map((text) => text.trimEnd()).join("\n\n"),
  };
};

/** The notices for a chunk's inputs, one per package, sorted by package name. */
export const collectNotices = async (
  chunk: string,
  inputs: readonly string[],
  root: string,
): Promise<NoticeFile[]> => {
  const packages = new Map<string, PackageAt>();
  for (const input of inputs) {
    const at = packageOf(input, root);
    if (at !== undefined) packages.set(at.dir, at);
  }
  const notices = await Promise.all([...packages.values()].map((at) => noticeOf(at, chunk, root)));
  // One package version linked twice, once per set of peers, is one notice.
  const unique = new Map(notices.map((file) => [file.notice.path, file]));
  return [...unique.values()].sort((a, b) => (a.notice.package < b.notice.package ? -1 : 1));
};
