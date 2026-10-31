// The view build the test server serves: `dist/view/` as `bun run build:view` writes it, the
// contract's fixture build for the harness's own unit tests, and test-only variants of either.
// A variant replaces a chunk's script or the board page's and records the new digest and size in
// its manifest, so the board page's policy and `assemble`'s still admit it by hash (AD-8).

import { join } from "node:path";
import {
  type LifecycleBoardState,
  type ManifestFile,
  VIEW_DIRECTORY,
  VIEW_MANIFEST_FILE,
  type ViewManifest,
} from "@askboard/contract";
import { fixtureViewFiles, fixtureViewManifest } from "@askboard/contract/fixtures";
import { validateViewManifest } from "@askboard/contract/validate";
import { assemble, selectChunks, sourcesToFetch } from "../../../src/assemble/index.ts";
import { questionsOf, type ViewDocument } from "../../../src/view-document.ts";
import { THROWING_CHOICE_ERROR } from "../fixtures/throwing-choice-error.ts";

export { THROWING_CHOICE_ERROR };

export type ViewBuild = {
  readonly manifest: ViewManifest;
  /** The manifest as `/m` serves it: the file's bytes, or a variant's manifest written the same way. */
  readonly manifestText: string;
  /** The files the session side serves (`servedFiles`), by their path in the build folder. */
  readonly files: ReadonlyMap<string, string>;
};

const ROOT = join(import.meta.dir, "..", "..", "..", "..", "..");

/** `dist/view/` at the repository root, beside the session process's bundle (design decision 7). */
export const DIST_VIEW = join(ROOT, "dist", VIEW_DIRECTORY);

const THROWING_CHOICE_ENTRY = join(import.meta.dir, "..", "fixtures", "throwing-choice.ts");

/**
 * A caught `eval` and a caught `new Function`, as a library probing for code generation does. The
 * policy blocks both; CI counts each such violation even when it is caught (renderer row 17).
 */
export const EVAL_PROBE = 'try{eval("1")}catch(_){}try{new Function("")()}catch(_){}\n';

export const sha256Hex = (text: string): string =>
  new Bun.CryptoHasher("sha256").update(text).digest("hex");

const fileOf = (path: string, text: string): ManifestFile => ({
  path,
  sha256: sha256Hex(text),
  bytes: Buffer.byteLength(text),
});

const manifestTextOf = (manifest: ViewManifest): string => `${JSON.stringify(manifest, null, 2)}\n`;

/**
 * The files the board page loads: its HTML, script and styles, and each chunk's script and
 * styles. The manifest also lists licence notices, which no route serves; the view build's own
 * `listedFiles` (`tools/build/manifest.ts`) includes them.
 */
const servedFiles = (manifest: ViewManifest): ManifestFile[] => [
  manifest.boardPage.html,
  manifest.boardPage.script,
  ...manifest.boardPage.styles,
  ...Object.values(manifest.chunks).flatMap((chunk) => [chunk.script, ...chunk.styles]),
];

/** The contract's fixture build, whose scripts only mark that they ran. */
export const fixtureViewBuild = (): ViewBuild => ({
  manifest: fixtureViewManifest,
  manifestText: fixtureViewFiles[VIEW_MANIFEST_FILE] ?? manifestTextOf(fixtureViewManifest),
  files: new Map(Object.entries(fixtureViewFiles)),
});

/** A build folder's manifest and the files it serves; fails when the folder holds no build. */
export const readViewBuild = async (dir: string = DIST_VIEW): Promise<ViewBuild> => {
  const manifestFile = Bun.file(join(dir, VIEW_MANIFEST_FILE));
  if (!(await manifestFile.exists())) {
    throw new Error(`no view build in ${dir}: run \`bun run build:view\` first`);
  }
  const manifestText = await manifestFile.text();
  const checked = validateViewManifest(JSON.parse(manifestText));
  if (!checked.ok) {
    const problems = checked.problems.map((problem) => `${problem.path}: ${problem.message}`);
    throw new Error(`the view manifest in ${dir} is not valid: ${problems.join("; ")}`);
  }
  const files = new Map<string, string>();
  for (const { path } of servedFiles(checked.value)) {
    files.set(path, await Bun.file(join(dir, path)).text());
  }
  return { manifest: checked.value, manifestText, files };
};

const withFiles = (
  build: ViewBuild,
  manifest: ViewManifest,
  changed: Readonly<Record<string, string>>,
): ViewBuild => ({
  manifest,
  manifestText: manifestTextOf(manifest),
  files: new Map([...build.files, ...Object.entries(changed)]),
});

/** The build with one chunk's script replaced. */
export const withChunkScript = (build: ViewBuild, name: string, script: string): ViewBuild => {
  const chunk = Object.hasOwn(build.manifest.chunks, name)
    ? build.manifest.chunks[name]
    : undefined;
  if (chunk === undefined) throw new Error(`no chunk "${name}" in the view build`);
  const manifest: ViewManifest = {
    ...build.manifest,
    chunks: {
      ...build.manifest.chunks,
      [name]: { ...chunk, script: fileOf(chunk.script.path, script) },
    },
  };
  return withFiles(build, manifest, { [chunk.script.path]: script });
};

/** The build with the board page's script replaced, in the page and in the file beside it. */
const withBoardPageScript = (build: ViewBuild, script: string): ViewBuild => {
  const { boardPage } = build.manifest;
  const html = build.files.get(boardPage.html.path) ?? "";
  const inline = `<script>${build.files.get(boardPage.script.path) ?? ""}</script>`;
  const at = html.indexOf(inline);
  if (at < 0 || html.lastIndexOf(inline) !== at) {
    throw new Error("the board page's script is not inline exactly once in its HTML");
  }
  const page = `${html.slice(0, at)}<script>${script}</script>${html.slice(at + inline.length)}`;
  const manifest: ViewManifest = {
    ...build.manifest,
    boardPage: {
      ...boardPage,
      html: fileOf(boardPage.html.path, page),
      script: fileOf(boardPage.script.path, script),
    },
  };
  return withFiles(build, manifest, {
    [boardPage.html.path]: page,
    [boardPage.script.path]: script,
  });
};

/** The view's shell runs `EVAL_PROBE` first: a negative control for the violation collector. */
export const withViewProbe = (build: ViewBuild): ViewBuild => {
  const shell = build.manifest.chunks.shell;
  const script = build.files.get(shell?.script.path ?? "") ?? "";
  return withChunkScript(build, "shell", `${EVAL_PROBE}${script}`);
};

/** The board page runs `EVAL_PROBE` first: a negative control for the violation collector. */
export const withBoardPageProbe = (build: ViewBuild): ViewBuild => {
  const script = build.files.get(build.manifest.boardPage.script.path) ?? "";
  return withBoardPageScript(build, `${EVAL_PROBE}${script}`);
};

/**
 * A test-only entry bundled as the view build bundles chunks: one classic script. A chunk, or the
 * widget host's page script (`widget-host.ts`).
 */
export const bundleTestChunk = async (entry: string): Promise<string> => {
  const result = await Bun.build({ entrypoints: [entry], format: "iife", target: "browser" });
  const output = result.outputs[0];
  if (!result.success || output === undefined) {
    throw new Error(`could not bundle ${entry}: ${result.logs.map(String).join("; ")}`);
  }
  const code = await output.text();
  if (code.includes("import.meta")) throw new Error(`${entry} holds import.meta`);
  return code;
};

/** The build with the Choice chunk replaced by one whose component throws while rendering. */
export const withThrowingChoice = async (build: ViewBuild): Promise<ViewBuild> =>
  withChunkScript(build, "choice", await bundleTestChunk(THROWING_CHOICE_ENTRY));

/** The board state with every question of the document open and the ask waiting. */
export const openStateOf = (document: ViewDocument): LifecycleBoardState => {
  const [first, ...rest] = questionsOf(document).map((question) => ({
    itemId: question.id,
    rev: question.rev,
    state: "open" as const,
  }));
  if (first === undefined) throw new Error("the board document holds no question");
  return { ask: "waiting", questions: [first, ...rest] };
};

/**
 * The view's srcdoc for a board document with its question open, assembled from the build as the
 * board page assembles it (AD-9): for a harness check that needs the view before the board page
 * builds it, or for the widget host, whose documents the board page refuses (design decision 9).
 */
export const assembledSrcdoc = (build: ViewBuild, document: ViewDocument): string => {
  const files = sourcesToFetch(selectChunks(document, build.manifest));
  const sources = Object.fromEntries(
    files.map((file) => [file.sha256, build.files.get(file.path) ?? ""]),
  );
  return assemble({ document, state: openStateOf(document) }, build.manifest, sources).srcdoc;
};
