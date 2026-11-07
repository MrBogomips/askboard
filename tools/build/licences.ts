// Licence notices per chunk (AD-9, design decision 7): one per package of the files the bundler's
// metafile lists for the chunk's output, with the package's name, version and SPDX licence from its
// package.json and the text of its licence files. AskBoard's own packages carry the repository's
// MIT licence. A package whose published files hold no licence file takes the text recorded for
// that exact version in `tools/licence-texts.json`, with its source at a commit, its date and why,
// under the licence its package.json names (ask-lifecycle, task 6.6); the build never fetches one.
// A package with no licence file and no recorded text, or no licence field, fails the build: its
// notice cannot be shipped. Its own licence files are the root ones; the texts of a `licenses/`
// folder (code it embeds) follow them and never count as its own (chart-widget, task 7.4). So does a recorded text with nothing to do: one for a package that
// ships its own licence file, or one no chunk used.
//
// A package's fonts, and package code holding glyph outlines derived from them, can carry a
// licence other than the package's: `tools/font-licences.json` records it by package version, and
// the notice of that package version then reads `<package licence> AND <entry licence>`, with the
// package's text and the entry's (latex-kanban-timeline, design decision 8, task 3.4).

import { lstat, readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import type { LicenceNotice } from "@askboard/contract";
import { classify, type LicenceException } from "../check-licences.ts";
import fontLicenceTable from "../font-licences.json" with { type: "json" };
import exceptionTable from "../licence-exceptions.json" with { type: "json" };
import recorded from "../licence-texts.json" with { type: "json" };

/** A licence text recorded for a package version that ships none, with where it comes from. */
export type LicenceText = {
  readonly licence: string;
  /** The licence file at a commit of the package's repository. */
  readonly source: string;
  /** The date of that commit. */
  readonly date: string;
  readonly reason: string;
  readonly text: string;
};

const TEXTS_FILE = "tools/licence-texts.json";

/** The recorded texts, by `<name>@<version>`. */
export type LicenceTexts = Readonly<Record<string, LicenceText>>;

export const LICENCE_TEXTS: LicenceTexts = recorded;

/** The licence of a package version's fonts and of the glyph outlines derived from them. */
export type FontLicence = {
  /** `OFL-1.1`, or an SPDX expression `classify` calls permissive. */
  readonly licence: string;
  /**
   * The font folder within the package; none for an entry that speaks only for derived code, such
   * as a helper's licence text the package does not carry (atoms, task 5.1).
   */
  readonly fonts?: string;
  /**
   * The package's files whose code holds outlines its upstream derived from the fonts, or code
   * under the licence this entry records.
   */
  readonly derived: readonly string[];
  /** The licence text at a commit of the repository it comes from. */
  readonly source: string;
  /** The date of that commit. */
  readonly date: string;
  readonly reason: string;
  /** The whole notice for the fonts: what they are, their copyright lines, the licence text. */
  readonly text: string;
};

const FONTS_FILE = "tools/font-licences.json";

/** The font licences, by `<name>@<version>`. */
export type FontLicences = Readonly<Record<string, FontLicence>>;

export const FONT_LICENCES: FontLicences = fontLicenceTable;

/** The addendum's named licence exceptions (atoms, design decision 9). */
export const LICENCE_EXCEPTIONS: readonly LicenceException[] = exceptionTable;

/**
 * A chunk whose notices name an excepted package fails the build: the exception holds only while
 * nothing ships the package.
 */
export const exceptedPackageProblems = (
  exceptions: readonly LicenceException[],
  chunks: readonly { readonly name: string; readonly notices: readonly NoticeFile[] }[],
): string[] =>
  chunks.flatMap(({ name, notices }) =>
    notices
      .filter(({ notice }) => exceptions.some((entry) => entry.name === notice.package))
      .map(
        ({ notice }) =>
          `the chunk "${name}" ships ${notice.package} ${notice.version}, which only a named licence exception in tools/licence-exceptions.json admits, for a package no chunk contains`,
      ),
  );

export type NoticeFile = {
  readonly notice: LicenceNotice;
  readonly text: string;
  /** The key of the recorded text it took, if it took one. */
  readonly recorded?: string;
  /** The font licence entry it took, and whether a `derived` file of it is among the inputs. */
  readonly font?: { readonly key: string; readonly derived: boolean };
};

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

// The licence files of a folder, by name.
const licenceFilesIn = async (dir: string): Promise<string[]> =>
  (await readdir(dir)).filter((file) => LICENCE_FILE.test(file)).sort();

// The texts of a package's `licenses/` folder, where echarts keeps the licence of the d3 code that
// its `scale/Time.js` and `util/number.js` embed (chart-widget group 5, X-1). They are the licences
// of code the package embeds, not its own: only a missing folder means none, and a folder that is
// a file or a link, a licence file that is a link or anything else not a regular file, or an
// error reading either, is reported, never skipped (chart-widget task 7.4, X-1).
const embeddedTexts = async (dir: string): Promise<string[]> => {
  const folder = join(dir, "licenses");
  const found = await lstat(folder).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw new Error(`the licence folder ${folder} cannot be read: ${error.code ?? error.message}`);
  });
  if (found === undefined) return [];
  if (!found.isDirectory()) {
    throw new Error(`${folder} is not a folder (a file or a link): its texts are not read`);
  }
  const entries = await readdir(folder, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      throw new Error(
        `the licence folder ${folder} cannot be read: ${error.code ?? error.message}`,
      );
    },
  );
  const names = entries.filter(({ name }) => LICENCE_FILE.test(name));
  const odd = names.find((entry) => !entry.isFile());
  if (odd !== undefined) {
    throw new Error(`${join(folder, odd.name)} is not a file (a link or a folder): it is not read`);
  }
  const files = names.map(({ name }) => join(folder, name)).sort();
  return Promise.all(files.map((file) => Bun.file(file).text()));
};

// A package's own licence files, by name: the root files decide whether it has a licence.
const ownTexts = async (dir: string): Promise<string[]> =>
  Promise.all((await licenceFilesIn(dir)).map((file) => Bun.file(join(dir, file)).text()));

const trimmed = (text: string): string => text.trimEnd();

const spdxOf = (field: unknown): string | undefined => {
  if (typeof field === "string" && field !== "") return field;
  if (typeof field === "object" && field !== null && "type" in field) {
    return typeof field.type === "string" ? field.type : undefined;
  }
  return undefined;
};

const recordedFor = (texts: LicenceTexts, key: string): LicenceText | undefined =>
  Object.hasOwn(texts, key) ? texts[key] : undefined;

const fontLicenceFor = (table: FontLicences, key: string): FontLicence | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

// Whether one pair of parentheses wraps the whole expression: `(A OR B)`, not `(A) AND (B)`.
const wrapped = (licence: string): boolean => {
  if (!licence.startsWith("(") || !licence.endsWith(")")) return false;
  let depth = 0;
  for (let at = 0; at < licence.length; at += 1) {
    if (licence[at] === "(") depth += 1;
    if (licence[at] === ")") depth -= 1;
    if (depth === 0) return at === licence.length - 1;
  }
  return false;
};

// The package's licence with the fonts' beside it: `(MIT OR ISC) AND OFL-1.1`.
const withFonts = (file: NoticeFile, key: string, entry: FontLicence, derived: boolean) => {
  const { licence } = file.notice;
  const own = /\s/.test(licence) && !wrapped(licence) ? `(${licence})` : licence;
  return {
    ...file,
    notice: { ...file.notice, licence: `${own} AND ${entry.licence}` },
    text: `${file.text}\n\n${entry.text.trimEnd()}`,
    font: { key, derived },
  };
};

type Sources = {
  readonly chunk: string;
  readonly root: string;
  readonly recorded: LicenceTexts;
  readonly fonts: FontLicences;
  readonly inputs: ReadonlySet<string>;
};

const noticeOf = async (at: PackageAt, sources: Sources): Promise<NoticeFile> => {
  const { chunk, root, recorded: recordedTexts } = sources;
  const manifest = await Bun.file(join(at.dir, "package.json")).json();
  const name = String(manifest.name);
  const version = String(manifest.version);
  const where = `${name} ${version} in the chunk "${chunk}"`;
  const licence = spdxOf(manifest.license);
  if (licence === undefined) throw new Error(`${where} names no licence in its package.json`);
  const notice = { package: name, version, licence, path: licencePath(name, version) };
  const key = `${name}@${version}`;
  const entry = recordedFor(recordedTexts, key);
  // AskBoard's packages hold no licence file of their own: the repository's covers them. The root
  // files alone decide "has a licence" and "a recorded text is stale"; the `licenses/` texts follow.
  const own = await ownTexts(at.dir);
  if (own.length > 0 && entry !== undefined) {
    throw new Error(
      `${where} ships its own licence file: the text recorded for "${key}" in ${TEXTS_FILE} is stale`,
    );
  }
  const embedded = await embeddedTexts(at.dir);
  let file: NoticeFile;
  if (own.length === 0 && !at.workspace && entry?.licence === licence) {
    file = { notice, text: [entry.text, ...embedded].map(trimmed).join("\n\n"), recorded: key };
  } else {
    const texts = own.length > 0 || !at.workspace ? own : await ownTexts(root);
    if (texts.length === 0) throw new Error(`${where} has no licence file`);
    file = { notice, text: [...texts, ...embedded].map(trimmed).join("\n\n") };
  }
  const fonts = at.workspace ? undefined : fontLicenceFor(sources.fonts, key);
  if (fonts === undefined) return file;
  const derived = fonts.derived.some((path) => sources.inputs.has(join(at.dir, path)));
  return withFonts(file, key, fonts, derived);
};

// One package version linked twice is one notice; a derived file among either's inputs counts.
const merged = (a: NoticeFile, b: NoticeFile): NoticeFile =>
  a.font === undefined || b.font === undefined
    ? a
    : { ...a, font: { key: a.font.key, derived: a.font.derived || b.font.derived } };

/** The notices for a chunk's inputs, one per package, sorted by package name. */
export const collectNotices = async (
  chunk: string,
  inputs: readonly string[],
  root: string,
  recordedTexts: LicenceTexts = LICENCE_TEXTS,
  fonts: FontLicences = FONT_LICENCES,
): Promise<NoticeFile[]> => {
  const packages = new Map<string, PackageAt>();
  for (const input of inputs) {
    const at = packageOf(input, root);
    if (at !== undefined) packages.set(at.dir, at);
  }
  const sources = { chunk, root, recorded: recordedTexts, fonts, inputs: new Set(inputs) };
  const notices = await Promise.all([...packages.values()].map((at) => noticeOf(at, sources)));
  const unique = new Map<string, NoticeFile>();
  for (const file of notices) {
    const same = unique.get(file.notice.path);
    unique.set(file.notice.path, same === undefined ? file : merged(same, file));
  }
  return [...unique.values()].sort((a, b) => (a.notice.package < b.notice.package ? -1 : 1));
};

/**
 * The innermost `node_modules` package a file lies in, as `<name>@<version>`, from its
 * package.json; none for a file outside one.
 */
export const packageVersionOf = async (file: string): Promise<string | undefined> => {
  const parts = file.split(sep);
  const at = parts.lastIndexOf("node_modules");
  if (at === -1) return undefined;
  const end = at + (parts[at + 1]?.startsWith("@") === true ? 3 : 2);
  if (end >= parts.length) return undefined;
  const manifest = Bun.file(join(parts.slice(0, end).join(sep), "package.json"));
  if (!(await manifest.exists())) return undefined;
  const { name, version } = await manifest.json();
  return `${String(name)}@${String(version)}`;
};

/** The recorded texts no chunk took: each is stale, and fails the build. */
export const staleLicenceTexts = (texts: LicenceTexts, used: ReadonlySet<string>): string[] =>
  Object.keys(texts)
    .filter((key) => !used.has(key))
    .map(
      (key) =>
        `the text recorded for "${key}" in ${TEXTS_FILE} is stale: no chunk holds that package without a licence file`,
    );

/** What the font licence checks need to know of a chunk. */
export type FontUse = {
  readonly name: string;
  /** The package versions whose fonts the chunk inlines. */
  readonly fonts: readonly string[];
  readonly notices: readonly NoticeFile[];
};

/** An entry's licence must be `OFL-1.1` or one the adoption rule calls permissive. */
export const fontEntryProblems = (table: FontLicences): string[] =>
  Object.entries(table)
    .filter(([, { licence }]) => licence !== "OFL-1.1" && classify(licence) !== "permissive")
    .map(
      ([key, { licence }]) =>
        `the entry "${key}" in ${FONTS_FILE} names the licence "${licence}", which the adoption rule does not admit for fonts`,
    );

/** Fonts a chunk inlines whose package version has no entry: their licence is not recorded. */
export const missingFontLicences = (table: FontLicences, chunks: readonly FontUse[]): string[] =>
  chunks.flatMap(({ name, fonts }) =>
    fonts
      .filter((key) => !Object.hasOwn(table, key))
      .map(
        (key) =>
          `the chunk "${name}" inlines the fonts of ${key}, and ${FONTS_FILE} has no entry for it: read their name tables and record their licence`,
      ),
  );

/**
 * The entries no chunk used, each stale: used is a chunk inlining the package version's fonts or
 * holding one of its `derived` files among its inputs.
 */
export const staleFontLicences = (table: FontLicences, chunks: readonly FontUse[]): string[] => {
  const used = new Set(
    chunks.flatMap(({ fonts, notices }) => [
      ...fonts,
      ...notices.flatMap(({ font }) => (font?.derived === true ? [font.key] : [])),
    ]),
  );
  return Object.keys(table)
    .filter((key) => !used.has(key))
    .map(
      (key) =>
        `the entry "${key}" in ${FONTS_FILE} is stale: no chunk inlines those fonts or bundles a file derived from them`,
    );
};
