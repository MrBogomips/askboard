// The licence notices of the session process bundle (plugin-release, design decision 5; packaging
// spec, "Notices for the bundle"). The view build and the mod build ship their notices; `build:server`
// is a plain `bun build` command and ships none, so the release writes them. This module builds the
// bundle again in memory with the options of `build:server` plus a metafile, checks that the result
// equals `dist/askboard.mjs` byte for byte (so the notices describe the bundle that ships), and
// takes the notices of the metafile's inputs as the view build does (`tools/build/licences.ts`),
// AskBoard's own packages excluded (the repository's LICENSE covers them).
//
// The bundle's comments carry each module's path relative to the working directory, so the build
// is the shipped one only when it runs at the repository root.
//
// Usage: bun tools/release/notices.ts --out <file>

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { chunkInputs, collectNotices, type NoticeFile } from "../build/licences.ts";

/** The bundle, relative to the root. */
export const BUNDLE_PATH = "dist/askboard.mjs";
/** The session process's entry, as `build:server` names it. */
const SERVER_ENTRY = "packages/server/src/main.ts";
const CHUNK = "the bundle";
const REBUILD = "run bun run build:server";

export type BuiltBundle = {
  /** What the build produced, as `build:server` writes it. */
  readonly code: string;
  /** The files the metafile lists, as absolute paths. */
  readonly inputs: readonly string[];
};

export type NoticePorts = {
  /** Builds the bundle in memory; the real build when absent. */
  readonly build?: (root: string) => Promise<BuiltBundle>;
  /** The shipped bundle to compare with; `<root>/dist/askboard.mjs` when absent. */
  readonly bundleFile?: string;
};

/** Builds `packages/server/src/main.ts` as `build:server` does, with a metafile. */
export const buildServerBundle = async (root: string): Promise<BuiltBundle> => {
  if (resolve(root) !== process.cwd()) {
    throw new Error(
      `the bundle can be rebuilt only with ${process.cwd()} as the repository root, not ${root}: ` +
        "its comments carry paths relative to the working directory",
    );
  }
  const result = await Bun.build({
    entrypoints: [SERVER_ENTRY],
    target: "node",
    format: "esm",
    metafile: true,
  });
  const [output] = result.outputs;
  if (!result.success || output === undefined || result.metafile === undefined) {
    throw new Error(`the bundle did not build:\n${result.logs.join("\n")}`);
  }
  return { code: await output.text(), inputs: chunkInputs(result.metafile, root) };
};

const shipped = (root: string, ports: NoticePorts): string => {
  const file = ports.bundleFile ?? join(root, BUNDLE_PATH);
  if (!existsSync(file)) throw new Error(`${BUNDLE_PATH} is missing: ${REBUILD}`);
  return readFileSync(file, "utf8");
};

/**
 * The notices for the third-party packages of the bundle, sorted by name. Fails when the bundle on
 * disk is not what the build produces, and when a package has no licence text.
 */
export const bundleNotices = async (
  root: string,
  ports: NoticePorts = {},
): Promise<NoticeFile[]> => {
  const onDisk = shipped(root, ports);
  const { code, inputs } = await (ports.build ?? buildServerBundle)(root);
  if (code !== onDisk) {
    throw new Error(
      `${BUNDLE_PATH} is not what the build of ${SERVER_ENTRY} produces, so its notices would describe another bundle: ${REBUILD}`,
    );
  }
  const notices = await collectNotices(CHUNK, inputs, root);
  return notices.filter(({ notice }) => !notice.package.startsWith("@askboard/"));
};

// A fence longer than any run of backticks in the text, so the text cannot close it.
const fenceFor = (text: string): string => {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((run) => run[0].length));
  return "`".repeat(Math.max(3, longest + 1));
};

/** The `THIRD-PARTY-NOTICES.md` text: a section per package with name, version, licence and text. */
export const renderNotices = (notices: readonly NoticeFile[]): string => {
  const head = [
    "# Third-party notices",
    "",
    `AskBoard's session process (\`${BUNDLE_PATH}\`) bundles code of the packages below. AskBoard's own code is MIT-licensed (see LICENSE).`,
  ];
  if (notices.length === 0) {
    return `${[...head, "", "The bundle holds no third-party package."].join("\n")}\n`;
  }
  const sections = notices.map(({ notice, text }) => {
    const fence = fenceFor(text);
    return [
      `## ${notice.package} ${notice.version} (${notice.licence})`,
      "",
      fence,
      text,
      fence,
    ].join("\n");
  });
  return `${[...head, "", ...sections.flatMap((section) => [section, ""])].join("\n").trimEnd()}\n`;
};

/** The notices file for the bundle at `root`. */
export const noticesMarkdown = async (root: string, ports: NoticePorts = {}): Promise<string> =>
  renderNotices(await bundleNotices(root, ports));

const USAGE = "usage: bun tools/release/notices.ts --out <file>";

/** The command line: the exit code for `--out <file>`. */
export const main = async (
  root: string,
  args: readonly string[],
  log: (line: string) => void,
  ports: NoticePorts = {},
): Promise<number> => {
  const [flag, out, ...rest] = args;
  if (flag !== "--out" || out === undefined || rest.length > 0) {
    log(USAGE);
    return 2;
  }
  try {
    const notices = await bundleNotices(root, ports);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, renderNotices(notices));
    log(`notices: wrote ${out} for ${notices.length} packages`);
    return 0;
  } catch (error) {
    log(`notices: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
};

if (import.meta.main) {
  process.exitCode = await main(join(import.meta.dir, "..", ".."), Bun.argv.slice(2), console.log);
}
