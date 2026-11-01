// `bun run build:view` (design decision 7): builds the view into `dist/view/` and writes its
// manifest (`manifest.json`, AD-9). It writes the board page (`board-page.html`, with its script
// and styles inline, and the two files beside it), each chunk's script and styles under `chunks/`,
// and the licence texts under `licences/`. It fails, naming the chunk, on a chunk that holds
// `import.meta`, a script or style that cannot be inlined as it is, a package without a licence,
// a board page that would compile schemas, a manifest the contract refuses, a file whose hash does
// not match, and a chunk grown more than 10% over `packages/view/chunk-sizes.json`.
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
} from "@askboard/contract";
import type { BunPlugin } from "bun";
import { boardPageHtml } from "./board-page.ts";
import { boardPageInputProblems, inlineScript, inlineStyleProblem } from "./checks.ts";
import {
  type Bundle,
  bundleChunk,
  type ChunkKind,
  chunkDefinitions,
  stylePlanOf,
} from "./chunks.ts";
import { collectNotices, LICENCE_TEXTS, type NoticeFile, staleLicenceTexts } from "./licences.ts";
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
import { hostValidatorsCode, validatorsPlugin } from "./validators.ts";

/** The board page's name among the recorded sizes. */
export const BOARD_PAGE = "board-page";

type Finished = {
  readonly name: string;
  readonly script: string;
  readonly styles: string;
  readonly notices: readonly NoticeFile[];
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

// Inline-safe script, styles and notices for one bundled chunk or the board page.
const finish = async (
  name: string,
  plan: StylePlan | undefined,
  bundle: Bundle,
  work: string,
): Promise<Finished> => {
  const { code, problems } = inlineScript(name, bundle.code);
  failIf(problems);
  const styles = await stylesOf(name, plan, bundle.inputs, work);
  failIf([inlineStyleProblem(name, styles)]);
  const inputs = plan === "document" ? [...bundle.inputs, PREFLIGHT_FILE] : bundle.inputs;
  return { name, script: code, styles, notices: await collectNotices(name, inputs, ROOT) };
};

type BuiltChunk = Finished & { readonly kind: ChunkKind; readonly needs: readonly string[] };

const buildChunks = async (work: string): Promise<BuiltChunk[]> => {
  const modules = sharedModules(await portExports());
  const definitions = await chunkDefinitions(work);
  return Promise.all(
    definitions.map(async ({ name, kind, entry }) => {
      const needs = new Set<string>();
      const plugins: BunPlugin[] = [sharedModulesPlugin(name, modules, needs)];
      const bundle = await bundleChunk({ name, entry }, plugins);
      const finished = await finish(name, stylePlanOf(kind), bundle, work);
      return { ...finished, kind, needs: [...needs].sort() };
    }),
  );
};

const buildBoardPage = async (work: string): Promise<Finished> => {
  const plugins = [validatorsPlugin(hostValidatorsCode())];
  const bundle = await bundleChunk({ name: BOARD_PAGE, entry: BOARD_PAGE_ENTRY }, plugins);
  failIf(boardPageInputProblems(bundle.inputs.map((input) => relative(ROOT, input))));
  return finish(BOARD_PAGE, "document", bundle, work);
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
        ...(chunk.kind === "component" ? { components: [chunk.name] } : {}),
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
export const buildView = async (out: string): Promise<BuiltView> => {
  await checkReplaceable(out);
  const work = await mkdtemp(join(tmpdir(), "askboard-view-"));
  try {
    await writeTokenFiles(work);
    const [page, chunks] = await Promise.all([buildBoardPage(work), buildChunks(work)]);
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
