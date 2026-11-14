// `bun tools/release/assemble.ts --out <dir>` (plugin-release, design decision 4; packaging spec,
// "The release tree" and "The marketplace on the release branch"): copies, from a built checkout and
// by an explicit allowlist, the plugin a user installs into an empty folder, and generates its
// marketplace file and the bundle's notices. The tree holds no `package.json`, lockfile, `bin/` or
// `agents/` (so Claude Code runs no install on the user's machine), no symbolic link and no source.
// Every check runs before the first byte is written: a refused assembly leaves no tree.
//
// Usage: bun tools/release/assemble.ts --out <dir> [--root <checkout>]

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { noticesMarkdown } from "./notices.ts";
import { PLUGIN_MANIFEST, versionProblems } from "./versions.ts";

/** Single files copied as they are. */
const FILES = [
  PLUGIN_MANIFEST,
  "hooks/hooks.json",
  "hooks/askboard-mod.js",
  "scripts/askboard",
  "dist/askboard.mjs",
  "LICENSE",
  "README.md",
  "CHANGELOG.md",
] as const;

/** Folders copied whole, file by file. */
const FOLDERS = ["dist/view", "skills/askboard", "skills/askboard-help"] as const;

export const MARKETPLACE_PATH = ".claude-plugin/marketplace.json";
export const NOTICES_PATH = "THIRD-PARTY-NOTICES.md";
const MARKETPLACE_NAME = "askboard";

// What would make Claude Code run an install on the user's machine, or load an agent, or that is
// not part of the plugin: refused wherever it sits in a copied folder.
const REFUSED_NAMES = new Set([
  "package.json",
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "CLAUDE.md",
]);
const REFUSED_FOLDERS = new Set(["bin", "agents"]);

export type AssemblePorts = {
  /** The notices file's text; the bundle's notices (`notices.ts`) when absent. */
  readonly notices?: (root: string) => Promise<string>;
};

export type Assembled = {
  /** The tree's files, relative to it, sorted. */
  readonly files: string[];
  readonly bytes: number;
};

type Copy = { readonly path: string };

const kindOf = (root: string, path: string): "file" | "folder" | "link" | "other" | "missing" => {
  try {
    const stat = lstatSync(join(root, path));
    if (stat.isSymbolicLink()) return "link";
    if (stat.isDirectory()) return "folder";
    return stat.isFile() ? "file" : "other";
  } catch {
    return "missing";
  }
};

const refusedWithin = (path: string, below: string): string | undefined => {
  const parts = path.slice(below.length + 1).split("/");
  const name = parts[parts.length - 1] as string;
  if (name.startsWith(".")) return `${path} is a hidden file`;
  if (REFUSED_NAMES.has(name)) return `${path} is a file the tree must not hold (${name})`;
  const folder = parts.slice(0, -1).find((part) => REFUSED_FOLDERS.has(part));
  return folder === undefined
    ? undefined
    : `${path} is in a ${folder}/ folder, which the tree must not hold`;
};

/** Every file below a folder, relative to the root; problems for links, odd files and refused names. */
const walk = (root: string, folder: string, below: string, found: Copy[], problems: string[]) => {
  for (const entry of readdirSync(join(root, folder), { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  )) {
    const path = `${folder}/${entry.name}`;
    if (entry.isSymbolicLink()) problems.push(`${path} is a symbolic link`);
    else if (entry.isDirectory()) walk(root, path, below, found, problems);
    else if (!entry.isFile()) problems.push(`${path} is neither a file nor a folder`);
    else {
      const refused = refusedWithin(path, below);
      if (refused === undefined) found.push({ path });
      else problems.push(refused);
    }
  }
};

const inputs = (root: string, problems: string[]): Copy[] => {
  const found: Copy[] = [];
  for (const path of FILES) {
    const kind = kindOf(root, path);
    if (kind === "file") found.push({ path });
    else if (kind === "missing") problems.push(`${path} is missing`);
    else problems.push(`${path} is a ${kind === "link" ? "symbolic link" : kind}, not a file`);
  }
  for (const path of FOLDERS) {
    const kind = kindOf(root, path);
    if (kind === "folder") walk(root, path, path, found, problems);
    else if (kind === "missing") problems.push(`${path} is missing`);
    else problems.push(`${path} is a ${kind === "link" ? "symbolic link" : kind}, not a folder`);
  }
  return found;
};

const readJson = (root: string, path: string): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(root, path), "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

const HOLDER = /^Copyright \(c\) (?:\d{4}(?:\s*-\s*\d{4})?,?\s+)?(\S.*)$/im;

/** The marketplace file's text, or why it cannot be written. */
const marketplace = (root: string, problems: string[]): string | undefined => {
  const plugin = readJson(root, PLUGIN_MANIFEST);
  const name = plugin?.name;
  const description = plugin?.description;
  if (typeof name !== "string" || typeof description !== "string" || description === "") {
    problems.push(`${PLUGIN_MANIFEST} needs a name and a description for the marketplace entry`);
  }
  const licence = existsSync(join(root, "LICENSE"))
    ? readFileSync(join(root, "LICENSE"), "utf8")
    : "";
  const holder = HOLDER.exec(licence)?.[1]?.trim();
  if (holder === undefined && licence !== "") {
    problems.push(
      "LICENSE names no copyright holder (a line `Copyright (c) <year> <holder>`) for the marketplace's owner",
    );
  }
  if (typeof name !== "string" || typeof description !== "string" || holder === undefined) {
    return undefined;
  }
  const file = {
    name: MARKETPLACE_NAME,
    owner: { name: holder },
    metadata: { description },
    plugins: [{ name, source: "./", description }],
  };
  return `${JSON.stringify(file, null, 2)}\n`;
};

const outProblem = (out: string): string | undefined => {
  if (!existsSync(out)) return undefined;
  if (!statSync(out).isDirectory()) return `the output ${out} is not a folder`;
  return readdirSync(out).length > 0 ? `the output folder ${out} is not empty` : undefined;
};

const fail = (problems: readonly string[]): never => {
  throw new Error(`assemble: ${problems.join("\n")}`);
};

/**
 * Assembles the release tree of the built checkout `root` into `out`, which must not exist or be an
 * empty folder. Throws, writing nothing, when an input is missing or linked, a copied folder holds a
 * refused file, the versions disagree, or the notices cannot be made.
 */
export const assemble = async (
  root: string,
  out: string,
  ports: AssemblePorts = {},
): Promise<Assembled> => {
  const problems: string[] = [];
  const refusedOut = outProblem(out);
  if (refusedOut !== undefined) problems.push(refusedOut);
  problems.push(...versionProblems(root));
  const copies = inputs(root, problems);
  const marketplaceText = marketplace(root, problems);
  if (problems.length > 0 || marketplaceText === undefined) return fail(problems);
  let notices: string;
  try {
    notices = await (ports.notices ?? noticesMarkdown)(root);
  } catch (error) {
    return fail([error instanceof Error ? error.message : String(error)]);
  }

  const existed = existsSync(out);
  try {
    mkdirSync(out, { recursive: true });
    for (const { path } of copies) {
      mkdirSync(dirname(join(out, path)), { recursive: true });
      copyFileSync(join(root, path), join(out, path));
    }
    mkdirSync(dirname(join(out, MARKETPLACE_PATH)), { recursive: true });
    writeFileSync(join(out, MARKETPLACE_PATH), marketplaceText);
    writeFileSync(join(out, NOTICES_PATH), notices);
  } catch (error) {
    if (existed)
      for (const name of readdirSync(out))
        rmSync(join(out, name), { recursive: true, force: true });
    else rmSync(out, { recursive: true, force: true });
    throw error;
  }
  const files = [...copies.map(({ path }) => path), MARKETPLACE_PATH, NOTICES_PATH].sort();
  const bytes = files.reduce((sum, path) => sum + statSync(join(out, path)).size, 0);
  return { files, bytes };
};

const USAGE = "usage: bun tools/release/assemble.ts --out <dir> [--root <checkout>]";

type Options = { readonly out: string; readonly root?: string };

const optionsOf = (args: readonly string[]): Options | undefined => {
  let out: string | undefined;
  let root: string | undefined;
  for (let at = 0; at < args.length; at += 2) {
    const value = args[at + 1];
    if (value === undefined) return undefined;
    if (args[at] === "--out" && out === undefined) out = value;
    else if (args[at] === "--root" && root === undefined) root = value;
    else return undefined;
  }
  return out === undefined ? undefined : { out, ...(root === undefined ? {} : { root }) };
};

/** The command line: the exit code for `--out <dir>` and an optional `--root <checkout>`. */
export const main = async (
  defaultRoot: string,
  args: readonly string[],
  log: (line: string) => void,
  ports: AssemblePorts = {},
): Promise<number> => {
  const options = optionsOf(args);
  if (options === undefined) {
    log(USAGE);
    return 2;
  }
  try {
    const { files, bytes } = await assemble(options.root ?? defaultRoot, options.out, ports);
    log(`assemble: wrote ${files.length} files (${bytes} bytes) to ${options.out}`);
    return 0;
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 1;
  }
};

if (import.meta.main) {
  process.exitCode = await main(join(import.meta.dir, "..", ".."), Bun.argv.slice(2), console.log);
}
