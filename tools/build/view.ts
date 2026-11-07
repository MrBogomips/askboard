// `bun run build:view` (design decision 7): builds the view into `dist/view/` and writes its
// manifest (`manifest.json`, AD-9). It writes the board page (`board-page.html`, with its script
// and styles inline, and the two files beside it), each chunk's script and styles under `chunks/`,
// and the licence texts under `licences/`. It fails, naming the chunk, on a chunk that holds
// `import.meta`, a script or style that cannot be inlined as it is, a package without a licence,
// a board page that would compile schemas, a chunk that needs a host-only chunk without being one
// (snapshot design decision 5), a registered widget type with no chunk and a widget chunk of no
// registered type (widget-registry, design decision 10), a style that requests a file (a `url(` that
// is not a `data:` URL, an `@import`) or a listed package stylesheet that cannot be read
// (latex-kanban-timeline, design decision 8), inlined fonts with no entry in
// `tools/font-licences.json`, an entry no chunk used or one under a licence outside the rule, a
// manifest the contract refuses, a file whose hash does not match, and a chunk grown more than 10%
// over `packages/view/chunk-sizes.json`.
//
// Usage: bun tools/build/view.ts [--record-sizes] [--out <dir>] [--sizes <file>]
//   --record-sizes  write the built sizes to the sizes file instead of checking them; a change
//                   that grows a chunk on purpose runs `bun run build:view --record-sizes` and
//                   commits the file, so the diff shows the growth.

import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  type LicenceNotice,
  type ManifestChunk,
  type ManifestFile,
  VIEW_MANIFEST_FILE,
  VIEW_MANIFEST_VERSION,
  type ViewManifest,
  WIDGET_TYPES,
} from "@askboard/contract";
import type { BunPlugin } from "bun";
import { boardPageHtml } from "./board-page.ts";
import {
  boardPageInputProblems,
  hostOnlyNeedProblems,
  inlineScript,
  inlineStyleProblem,
  styleUrlProblems,
} from "./checks.ts";
import {
  type Bundle,
  bundleChunk,
  type ChunkKind,
  chunkComponents,
  chunkDefinitions,
  stylePlanOf,
  widgetChunkProblems,
} from "./chunks.ts";
import {
  collectNotices,
  FONT_LICENCES,
  type FontLicences,
  fontEntryProblems,
  LICENCE_TEXTS,
  missingFontLicences,
  type NoticeFile,
  staleFontLicences,
  staleLicenceTexts,
} from "./licences.ts";
import { fileEntry, hashProblems, listedFiles, manifestProblems } from "./manifest.ts";
import { BOARD_PAGE_ENTRY, DIST_VIEW, ROOT, SIZES_FILE } from "./paths.ts";
import { portExports, sharedModules, sharedModulesPlugin } from "./shared-modules.ts";
import {
  type ChunkSizes,
  formatSizes,
  RECORD_SIZES_FLAG,
  readSizes,
  sizeNotes,
  sizeProblems,
} from "./sizes.ts";
import {
  PREFLIGHT_FILE,
  runTailwind,
  type StylePlan,
  tailwindInput,
  writeTokenFiles,
} from "./styles.ts";
import { CHUNK_STYLESHEETS, type ChunkStylesheets, loadChunkStylesheets } from "./stylesheets.ts";
import { hostValidatorsCode, validatorsPlugin } from "./validators.ts";

/** The board page's name among the recorded sizes. */
export const BOARD_PAGE = "board-page";

type Finished = {
  readonly name: string;
  readonly script: string;
  readonly styles: string;
  readonly notices: readonly NoticeFile[];
  /** The package versions whose fonts the chunk's package stylesheets inline. */
  readonly fonts: readonly string[];
};

/** A chunk's package stylesheets, loaded: their styles, their files and the fonts' packages. */
type ChunkPackages = {
  readonly css?: string;
  readonly files: readonly string[];
  readonly fonts: readonly string[];
};

const failIf = (problems: readonly (string | undefined)[]): void => {
  const found = problems.filter((problem) => problem !== undefined);
  if (found.length > 0) throw new Error(found.join("\n"));
};

// AskBoard's own sources in a chunk are what Tailwind scans for its utilities.
const ownSources = (inputs: readonly string[]): string[] =>
  inputs.filter((input) => {
    const path = relative(ROOT, input);
    return path.startsWith("packages/") && !path.includes("node_modules") && /\.tsx?$/.test(path);
  });

const stylesOf = async (
  name: string,
  plan: StylePlan | undefined,
  inputs: readonly string[],
  work: string,
): Promise<string> => {
  if (plan === undefined) return "";
  const input = join(work, "styles", `${name}.css`);
  await Bun.write(input, tailwindInput(plan, ownSources(inputs), work));
  const css = await runTailwind(input, join(work, "styles", `${name}.out.css`));
  // A stylesheet with no rule, only Tailwind's banner and layer order, is left out.
  return css.includes("{") ? css : "";
};

/**
 * A chunk's styles as the build assembles them: its own (Tailwind's output over its sources), then
 * its package stylesheets, joined by a line feed with an empty part left out, and the problems of
 * both checks over the whole: a style that would request a file and a style that cannot be
 * inlined. Pure, so the checks' reach over the board page, every chunk and each part is a test,
 * not a build (latex-kanban-timeline, design decision 8, group 3 review S-1).
 */
export const assembleChunkStyles = ({
  chunk,
  own,
  packages,
}: {
  readonly chunk: string;
  readonly own: string;
  readonly packages?: string;
}): { readonly css: string; readonly problems: readonly string[] } => {
  const css = [own, packages ?? ""].filter((part) => part !== "").join("\n");
  const problems = [...styleUrlProblems(chunk, css), inlineStyleProblem(chunk, css)];
  return { css, problems: problems.filter((problem) => problem !== undefined) };
};

// Inline-safe script, styles and notices for one bundled chunk or the board page, through
// `assembleChunkStyles`. The chunk's package stylesheet, when it has one, follows Tailwind's
// styles. The stylesheets' files join the inputs the notices are collected for, so the chunk holds
// the notice of every package whose stylesheet it carries, even one its script does not import.
// `ownStyles` is Tailwind's output for the chunk; tests pass another.
export const finish = async (
  name: string,
  plan: StylePlan | undefined,
  bundle: Bundle,
  work: string,
  fontLicences: FontLicences,
  packages?: ChunkPackages,
  ownStyles: typeof stylesOf = stylesOf,
): Promise<Finished> => {
  const { code, problems } = inlineScript(name, bundle.code);
  failIf(problems);
  const own = await ownStyles(name, plan, bundle.inputs, work);
  const styles = assembleChunkStyles({ chunk: name, own, packages: packages?.css });
  failIf([...styles.problems]);
  const inputs = [
    ...bundle.inputs,
    ...(plan === "document" ? [PREFLIGHT_FILE] : []),
    ...(packages?.files ?? []),
  ];
  const notices = await collectNotices(name, inputs, ROOT, LICENCE_TEXTS, fontLicences);
  return { name, script: code, styles: styles.css, notices, fonts: packages?.fonts ?? [] };
};

type BuiltChunk = Finished & {
  readonly kind: ChunkKind;
  readonly hostOnly?: true;
  readonly needs: readonly string[];
};

const buildChunks = async (
  work: string,
  stylesheets: ChunkStylesheets,
  fontLicences: FontLicences,
): Promise<BuiltChunk[]> => {
  const modules = sharedModules(await portExports());
  const definitions = await chunkDefinitions(work);
  failIf(widgetChunkProblems(definitions, WIDGET_TYPES));
  const packages = await loadChunkStylesheets(stylesheets, new Set(definitions.map((d) => d.name)));
  failIf([...packages.problems]);
  return Promise.all(
    definitions.map(async ({ name, kind, entry, hostOnly }) => {
      const needs = new Set<string>();
      const plugins: BunPlugin[] = [sharedModulesPlugin(name, modules, needs)];
      const bundle = await bundleChunk({ name, entry }, plugins);
      const loaded = {
        css: packages.styles.get(name),
        files: packages.files.get(name) ?? [],
        fonts: packages.fonts.get(name) ?? [],
      };
      const finished = await finish(name, stylePlanOf(kind), bundle, work, fontLicences, loaded);
      return { ...finished, kind, ...(hostOnly ? { hostOnly } : {}), needs: [...needs].sort() };
    }),
  );
};

const buildBoardPage = async (work: string, fontLicences: FontLicences): Promise<Finished> => {
  const plugins = [validatorsPlugin(hostValidatorsCode())];
  const bundle = await bundleChunk({ name: BOARD_PAGE, entry: BOARD_PAGE_ENTRY }, plugins);
  failIf(boardPageInputProblems(bundle.inputs.map((input) => relative(ROOT, input))));
  return finish(BOARD_PAGE, "document", bundle, work, fontLicences);
};

// Every file of the build by its path in the folder, and the manifest that lists them.
const assembleBuild = (
  page: Finished,
  chunks: readonly BuiltChunk[],
): { files: Map<string, string>; manifest: ViewManifest } => {
  const files = new Map<string, string>();
  const add = (path: string, text: string): ManifestFile => {
    files.set(path, text);
    return fileEntry(path, text);
  };
  const notices = ({ notices: list }: Finished): LicenceNotice[] =>
    list.map(({ notice, text }) => {
      files.set(notice.path, `${text}\n`);
      return notice;
    });
  const styles = (path: string, css: string) => (css === "" ? [] : [add(path, css)]);
  const html = boardPageHtml(page.script, page.styles);
  const boardPage = {
    html: add(`${BOARD_PAGE}.html`, html),
    script: add(`${BOARD_PAGE}.js`, page.script),
    styles: styles(`${BOARD_PAGE}.css`, page.styles),
    licences: notices(page),
  };
  const entries = [...chunks]
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .map((chunk): [string, ManifestChunk] => [
      chunk.name,
      {
        kind: chunk.kind,
        script: add(`chunks/${chunk.name}.js`, chunk.script),
        styles: styles(`chunks/${chunk.name}.css`, chunk.styles),
        needs: chunk.needs,
        ...(chunk.hostOnly ? { hostOnly: true } : {}),
        ...(chunk.kind === "component" ? { components: [...chunkComponents(chunk.name)] } : {}),
        licences: notices(chunk),
      },
    ]);
  const manifest = {
    version: VIEW_MANIFEST_VERSION,
    boardPage,
    chunks: Object.fromEntries(entries),
  };
  return { files, manifest };
};

const sizesOf = (page: Finished, chunks: readonly BuiltChunk[]): ChunkSizes =>
  Object.fromEntries(
    [page, ...chunks].map(({ name, script, styles }) => [
      name,
      Buffer.byteLength(script) + Buffer.byteLength(styles),
    ]),
  );

// The build replaces its folder; it refuses one that holds anything but a previous build.
const checkReplaceable = async (out: string): Promise<void> => {
  const existing = await readdir(out).catch((): string[] => []);
  if (existing.length > 0 && !existing.includes(VIEW_MANIFEST_FILE)) {
    throw new Error(`${out} is not empty and holds no view build: not replacing it`);
  }
};

const writeBuild = async (
  out: string,
  files: ReadonlyMap<string, string>,
  manifest: ViewManifest,
) => {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const [path, text] of files) await Bun.write(join(out, path), text);
  await Bun.write(join(out, VIEW_MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
};

// What was written, read back: the manifest validates and every hash matches its file.
const verifyBuild = async (out: string, manifest: ViewManifest): Promise<void> => {
  const read = new Map<string, Uint8Array>();
  for (const path of listedFiles(manifest)) {
    const file = Bun.file(join(out, path));
    if (await file.exists()) read.set(path, await file.bytes());
  }
  failIf([...manifestProblems(manifest), ...hashProblems(manifest, (path) => read.get(path))]);
};

export type BuiltView = { readonly manifest: ViewManifest; readonly sizes: ChunkSizes };

/** Builds the view into `out`, replacing what is there. */
export const buildView = async (
  out: string,
  stylesheets: ChunkStylesheets = CHUNK_STYLESHEETS,
  fontLicences: FontLicences = FONT_LICENCES,
): Promise<BuiltView> => {
  await checkReplaceable(out);
  const work = await mkdtemp(join(tmpdir(), "askboard-view-"));
  try {
    await writeTokenFiles(work);
    const [page, chunks] = await Promise.all([
      buildBoardPage(work, fontLicences),
      buildChunks(work, stylesheets, fontLicences),
    ]);
    failIf(hostOnlyNeedProblems(chunks));
    // Fonts need a recorded licence, and a recorded licence a chunk that uses it (task 3.4).
    failIf([
      ...fontEntryProblems(fontLicences),
      ...missingFontLicences(fontLicences, [page, ...chunks]),
      ...staleFontLicences(fontLicences, [page, ...chunks]),
    ]);
    // A licence text recorded for a package that no chunk took is stale (ask-lifecycle, 6.6).
    const used = [page, ...chunks].flatMap(({ notices }) =>
      notices.flatMap(({ recorded }) => (recorded === undefined ? [] : [recorded])),
    );
    failIf(staleLicenceTexts(LICENCE_TEXTS, new Set(used)));
    const { files, manifest } = assembleBuild(page, chunks);
    await writeBuild(out, files, manifest);
    await verifyBuild(out, manifest);
    return { manifest, sizes: sizesOf(page, chunks) };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
};

const USAGE = `usage: bun tools/build/view.ts [${RECORD_SIZES_FLAG}] [--out <dir>] [--sizes <file>]`;

type Options = { out: string; sizes: string; record: boolean };

const parseArgs = (args: readonly string[]): Options | undefined => {
  const options: Options = { out: DIST_VIEW, sizes: SIZES_FILE, record: false };
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at];
    const value = args[at + 1];
    if (arg === RECORD_SIZES_FLAG) options.record = true;
    else if ((arg === "--out" || arg === "--sizes") && value !== undefined) {
      options[arg === "--out" ? "out" : "sizes"] = value;
      at += 1;
    } else return undefined;
  }
  return options;
};

const summary = ({ manifest, sizes }: BuiltView): string[] =>
  [BOARD_PAGE, ...Object.keys(manifest.chunks)].map((name) => {
    const chunk = manifest.chunks[name];
    const kind = chunk?.kind ?? "page";
    const needs =
      chunk === undefined || chunk.needs.length === 0 ? "" : `  needs ${chunk.needs.join(", ")}`;
    return `  ${kind.padEnd(9)} ${name.padEnd(12)} ${String(sizes[name] ?? 0).padStart(9)} bytes${needs}`;
  });

/** Builds, then checks the sizes or records them. Returns the exit code. */
export const main = async (
  args: readonly string[],
  log: (line: string) => void = console.log,
): Promise<number> => {
  const options = parseArgs(args);
  if (options === undefined) {
    log(USAGE);
    return 1;
  }
  const started = performance.now();
  try {
    const built = await buildView(options.out);
    for (const line of summary(built)) log(line);
    if (options.record) {
      await Bun.write(options.sizes, formatSizes(built.sizes));
      log(`build:view: recorded the sizes in ${relative(process.cwd(), options.sizes)}`);
    } else {
      const recorded = await readSizes(options.sizes);
      const problems = sizeProblems(recorded, built.sizes);
      for (const line of [...problems, ...sizeNotes(recorded, built.sizes)]) log(line);
      if (problems.length > 0) return 1;
    }
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    log(`build:view: wrote ${relative(process.cwd(), options.out) || "."} in ${seconds} s`);
    return 0;
  } catch (error) {
    log(`build:view failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
};

if (import.meta.main) {
  process.exitCode = await main(Bun.argv.slice(2));
}
