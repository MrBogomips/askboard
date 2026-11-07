// The release's files, from the assembled tree (plugin-release, design decision 6; packaging spec,
// "The release workflow"): `notes.md` (the body of the version's CHANGELOG section),
// `askboard-<version>.mjs` (the bundle), `askboard-<version>.zip` (the tree, its files at the root
// of the archive) and `SHA256SUMS` (the SHA-256 of the bundle and the zip, in the form
// `shasum -a 256 -c` and `sha256sum -c` read). Every check runs before the first write, and an
// output file that exists is never replaced.
//
// Usage: bun tools/release/package.ts --tree <dir> --out <dir>

import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import { changelogSection } from "./changelog.ts";
import { PLUGIN_MANIFEST, VERSION_FORM } from "./versions.ts";

const BUNDLE = "dist/askboard.mjs";
const CHANGELOG = "CHANGELOG.md";

export type Packaged = {
  /** The product version the files are named by. */
  readonly version: string;
  /** The files written, by name, in the output folder. */
  readonly files: string[];
};

/** The tree's files, relative and sorted; a link, a special file or an odd name is an error. */
const filesOf = (tree: string): string[] => {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(join(tree, directory), { withFileTypes: true })) {
      const path = directory === "" ? entry.name : `${directory}/${entry.name}`;
      if (path.includes("\n"))
        throw new Error(`${JSON.stringify(path)}: a file name with a line break`);
      const stat = lstatSync(join(tree, path));
      if (stat.isSymbolicLink()) throw new Error(`${path} is a symbolic link`);
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) found.push(path);
      else throw new Error(`${path} is neither a file nor a folder`);
    }
  };
  walk("");
  return found.sort();
};

const versionOf = (tree: string): string => {
  let version: unknown;
  try {
    version = (
      JSON.parse(readFileSync(join(tree, PLUGIN_MANIFEST), "utf8")) as { version?: unknown }
    ).version;
  } catch (error) {
    throw new Error(`${PLUGIN_MANIFEST} cannot be read: ${(error as Error).message}`);
  }
  if (typeof version !== "string" || !VERSION_FORM.test(version)) {
    throw new Error(
      `${PLUGIN_MANIFEST}: the version ${JSON.stringify(version)} is not major.minor.patch`,
    );
  }
  return version;
};

const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

/** Writes the four release files for `tree` into `out`; throws, having written nothing, on a problem. */
export const packageRelease = async (tree: string, out: string): Promise<Packaged> => {
  const root = resolve(tree);
  const target = resolve(out);
  if (target === root || target.startsWith(`${root}${sep}`)) {
    throw new Error(`the output folder ${target} is inside the tree ${root}`);
  }
  const version = versionOf(root);
  for (const path of [BUNDLE, CHANGELOG]) {
    if (!existsSync(join(root, path))) throw new Error(`${path} is missing from the tree`);
  }
  const files = filesOf(root);
  const notes = changelogSection(readFileSync(join(root, CHANGELOG), "utf8"), version);
  if (notes === undefined) throw new Error(`${CHANGELOG} has no section \`## ${version}\``);

  const names = {
    notes: "notes.md",
    bundle: `askboard-${version}.mjs`,
    zip: `askboard-${version}.zip`,
    sums: "SHA256SUMS",
  };
  for (const name of Object.values(names)) {
    if (existsSync(join(target, name)))
      throw new Error(`${join(target, name)} exists: it is not replaced`);
  }
  if (Bun.which("zip") === null) throw new Error("the zip command is not installed");

  mkdirSync(target, { recursive: true });
  const written: string[] = [];
  const write = (name: string, action: () => void): void => {
    written.push(name);
    action();
  };
  try {
    write(names.notes, () => writeFileSync(join(target, names.notes), `${notes}\n`));
    write(names.bundle, () => copyFileSync(join(root, BUNDLE), join(target, names.bundle)));
    write(names.zip, () => {
      const zipped = Bun.spawnSync(["zip", "-X", "-D", "-q", "-9", join(target, names.zip), "-@"], {
        cwd: root,
        stdin: Buffer.from(`${files.join("\n")}\n`),
        stdout: "pipe",
        stderr: "pipe",
      });
      if (zipped.exitCode !== 0) {
        throw new Error(`zip exited ${zipped.exitCode}: ${zipped.stderr.toString().trim()}`);
      }
    });
    write(names.sums, () =>
      writeFileSync(
        join(target, names.sums),
        [names.bundle, names.zip]
          .map((name) => `${sha256(join(target, name))}  ${name}\n`)
          .join(""),
      ),
    );
  } catch (error) {
    for (const name of written) rmSync(join(target, name), { force: true });
    throw error;
  }
  return { version, files: written };
};

export type PackagePorts = {
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
};

/** The command line: 0 when the files are written, 1 when the release cannot be packaged, 2 for usage. */
export const main = async (argv: readonly string[], ports: PackagePorts): Promise<number> => {
  const value = (flag: string): string | undefined => {
    const at = argv.indexOf(flag);
    return at < 0 ? undefined : argv[at + 1];
  };
  const tree = value("--tree");
  const out = value("--out");
  if (tree === undefined || out === undefined) {
    ports.stderr("package: usage: bun tools/release/package.ts --tree <dir> --out <dir>");
    return 2;
  }
  try {
    const made = await packageRelease(tree, out);
    for (const name of made.files) ports.stdout(`package: wrote ${name}`);
    return 0;
  } catch (error) {
    ports.stderr(`package: ${(error as Error).message}`);
    return 1;
  }
};

if (import.meta.main) {
  process.exit(
    await main(process.argv.slice(2), {
      stdout: (line) => void process.stdout.write(`${line}\n`),
      stderr: (line) => void process.stderr.write(`${line}\n`),
    }),
  );
}
