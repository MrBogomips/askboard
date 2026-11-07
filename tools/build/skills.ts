// `bun run build:skills` and `bun run check:skills` (askboard-skills, design decision 2): the
// command that writes `skills/askboard/` from the generator, and the check that fails when a shipped
// file differs from its generated form, a generated file is missing, or a file nobody generates is
// there. The folder is committed source: `build` does not run this, so that a build never rewrites it.
//
// The command writes and removes files, so it confines itself to `skills/askboard/`: it follows no
// symlink (not `skills`, not the skill folder, nothing under it), refuses before it writes anything
// when it finds one, resolves every path it writes or removes against the skill folder, and removes
// only regular files, and the folders left empty under it.
//
// Usage: bun tools/build/skills.ts [--check]

import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ROOT } from "./paths.ts";
import { budgetReport } from "./skills/budgets.ts";
import { type GeneratedSkill, generateSkill } from "./skills/generate.ts";

/** The plugin's skill folder: Claude Code finds it as `askboard:askboard` (packaging spec). */
export const SKILL_DIR = join(ROOT, "skills", "askboard");

const CHECK_FLAG = "--check";

type Log = (line: string) => void;

const lstat = (path: string) => {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
};

// The forward-slash path of `path` under `root`.
const posix = (root: string, path: string): string => relative(root, path).split(sep).join("/");

/** The path of a generated file inside the skill folder; throws when it would leave it. */
const insideOf = (dir: string, name: string): string => {
  const target = resolve(dir, name);
  const outside = isAbsolute(name) || !target.startsWith(`${resolve(dir)}${sep}`);
  if (outside) throw new Error(`the generated path "${name}" is outside the skill folder`);
  return target;
};

// Refuses a symlink where the skill folder or the folder holding it is one.
const checkAnchors = (dir: string): void => {
  for (const anchor of [dirname(dir), dir]) {
    if (lstat(anchor)?.isSymbolicLink()) {
      throw new Error(
        `"${posix(dirname(dirname(dir)), anchor)}" is a symlink: the command follows none`,
      );
    }
  }
};

// The regular files under `dir` by relative path, and the folders; throws on a symlink or on
// anything that is neither a file nor a folder.
const walk = (dir: string, base: string, files: string[], folders: string[]): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const name = posix(base, path);
    if (entry.isSymbolicLink()) {
      throw new Error(`"${name}" under the skill folder is a symlink: the command follows none`);
    }
    if (entry.isDirectory()) {
      folders.push(name);
      walk(path, base, files, folders);
    } else if (entry.isFile()) {
      files.push(name);
    } else {
      throw new Error(`"${name}" under the skill folder is neither a file nor a folder`);
    }
  }
};

type Scan = { readonly files: readonly string[]; readonly folders: readonly string[] };

const scan = (dir: string): Scan => {
  checkAnchors(dir);
  const files: string[] = [];
  const folders: string[] = [];
  if (lstat(dir)?.isDirectory()) walk(dir, dir, files, folders);
  return { files: files.sort(), folders: folders.sort() };
};

/** Why the folder differs from the generated files: each missing, extra or different file. */
export const driftProblems = (dir: string, generated: GeneratedSkill, found: Scan): string[] => {
  const problems: string[] = [];
  for (const [name, text] of generated.files) {
    if (!found.files.includes(name)) {
      problems.push(`missing: skills/askboard/${name} is generated and not there`);
    } else if (readFileSync(insideOf(dir, name), "utf8") !== text) {
      problems.push(`differs: skills/askboard/${name} is not what the generator writes`);
    }
  }
  for (const name of found.files) {
    if (!generated.files.has(name)) {
      problems.push(`extra: skills/askboard/${name} is a file the generator does not write`);
    }
  }
  return problems;
};

// Refuses a generated name outside the skill folder, then removes the files nobody generates, then
// the folders left empty (deepest first), then writes the generated files, after the scan found
// nothing to refuse. The names are checked before any removal, so a refusal leaves the folder as it
// was. The removals come before the writes: on a case-insensitive volume an extra `skill.md` is the
// same file as a generated `SKILL.md`, and a `References/` folder is the generated `references/`;
// removed after the writes, they would delete the file just written or leave it in the wrong-case
// folder.
const writeAll = (dir: string, generated: GeneratedSkill, found: Scan, log: Log): void => {
  for (const name of generated.files.keys()) insideOf(dir, name);
  for (const name of found.files.filter((file) => !generated.files.has(file))) {
    const target = insideOf(dir, name);
    if (lstat(target)?.isFile()) {
      unlinkSync(target);
      log(`removed skills/askboard/${name}`);
    }
  }
  for (const name of [...found.folders].sort().reverse()) {
    const target = insideOf(dir, name);
    if (lstat(target)?.isDirectory() && readdirSync(target).length === 0) rmdirSync(target);
  }
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of generated.files) {
    const target = insideOf(dir, name);
    mkdirSync(dirname(target), { recursive: true });
    if (lstat(target)?.isSymbolicLink()) throw new Error(`"${name}" is a symlink`);
    writeFileSync(target, text);
  }
};

// Prints each problem and the outcome line; the exit code is 1 on any problem.
const finish = (problems: readonly string[], ok: string, log: Log): number => {
  for (const problem of problems) log(problem);
  if (problems.length === 0) {
    log(ok);
    return 0;
  }
  const count = `${problems.length} problem${problems.length === 1 ? "" : "s"}`;
  log(
    `skills: ${count}; fix the teaching text, run "bun run build:skills" and commit skills/askboard/`,
  );
  return 1;
};

/**
 * Runs the command: writes the skill folder, or with `--check` compares it. Returns the exit code.
 * `dir` and `generated` default to the repository's.
 */
export const main = async (
  args: readonly string[],
  log: Log = console.log,
  dir: string = SKILL_DIR,
  generated: GeneratedSkill = generateSkill(),
): Promise<number> => {
  const unknown = args.filter((arg) => arg !== CHECK_FLAG);
  if (unknown.length > 0) {
    log(`skills: unknown argument ${unknown.join(" ")}; the command takes ${CHECK_FLAG} only`);
    return 1;
  }
  try {
    const found = scan(dir);
    const budgets = budgetReport(generated.files, undefined, basename(dir));
    if (args.includes(CHECK_FLAG)) {
      const problems = [...driftProblems(dir, generated, found), ...budgets.problems];
      for (const figure of budgets.figures) log(figure);
      return finish(
        problems,
        `check:skills: ${generated.files.size} files under skills/askboard/, none drifted, within budget`,
        log,
      );
    }
    writeAll(dir, generated, found, log);
    log(`build:skills: ${generated.files.size} files written under skills/askboard/`);
    for (const figure of budgets.figures) log(figure);
    return finish(budgets.problems, "build:skills: within budget", log);
  } catch (error) {
    log(`skills: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
};

if (import.meta.main) {
  process.exitCode = await main(Bun.argv.slice(2));
}
