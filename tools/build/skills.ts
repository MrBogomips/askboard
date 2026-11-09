// `bun run build:skills` and `bun run check:skills` (askboard-skills, design decision 2; keyboard-
// shortcuts-help, decision 10): the command that writes `skills/askboard/` and `skills/askboard-help/`
// from the generators, and the check that fails when a shipped file differs from its generated form,
// a generated file is missing, or a file nobody generates is there. The folders are committed source:
// `build` does not run this, so that a build never rewrites them.
//
// The command writes and removes files, so it confines itself to the two skill folders: it follows
// no symlink (not `skills`, not a skill folder, nothing under one), refuses before it writes anything
// when it finds one in either, resolves every path it writes or removes against its skill folder,
// and removes only regular files, and the folders left empty under them.
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
import { budgetReport, defaultAlwaysLoaded, HELP_SKILL, headOf } from "./skills/budgets.ts";
import { type GeneratedSkill, generateSkill } from "./skills/generate.ts";
import { type GeneratedHelp, generateHelpSkill } from "./skills/help.ts";

/** The plugin's skill folder: Claude Code finds it as `askboard:askboard` (packaging spec). */
export const SKILL_DIR = join(ROOT, "skills", "askboard");

/** The help skill's folder, `askboard:askboard-help`. */
export const HELP_DIR = join(ROOT, "skills", "askboard-help");

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

/** What a generator gives: the files by path under the skill folder. */
type Generated = Pick<GeneratedSkill, "files"> | GeneratedHelp;

type Scan = { readonly files: readonly string[]; readonly folders: readonly string[] };

const scan = (dir: string): Scan => {
  checkAnchors(dir);
  const files: string[] = [];
  const folders: string[] = [];
  if (lstat(dir)?.isDirectory()) walk(dir, dir, files, folders);
  return { files: files.sort(), folders: folders.sort() };
};

/** Why the folder differs from the generated files: each missing, extra or different file. */
export const driftProblems = (dir: string, generated: Generated, found: Scan): string[] => {
  const problems: string[] = [];
  const at = `skills/${basename(dir)}`;
  for (const [name, text] of generated.files) {
    if (!found.files.includes(name)) {
      problems.push(`missing: ${at}/${name} is generated and not there`);
    } else if (readFileSync(insideOf(dir, name), "utf8") !== text) {
      problems.push(`differs: ${at}/${name} is not what the generator writes`);
    }
  }
  for (const name of found.files) {
    if (!generated.files.has(name)) {
      problems.push(`extra: ${at}/${name} is a file the generator does not write`);
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
const writeAll = (dir: string, generated: Generated, found: Scan, log: Log): void => {
  for (const name of found.files.filter((file) => !generated.files.has(file))) {
    const target = insideOf(dir, name);
    if (lstat(target)?.isFile()) {
      unlinkSync(target);
      log(`removed skills/${basename(dir)}/${name}`);
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
    `skills: ${count}; fix the teaching text, run "bun run build:skills" and commit skills/askboard/ and skills/askboard-help/`,
  );
  return 1;
};

/**
 * Runs the command: writes the two skill folders, or with `--check` compares them. Returns the exit
 * code. The folders and the generated files default to the repository's; the help folder defaults
 * to `askboard-help` beside `dir`. Everything is scanned and every generated name checked before the
 * first file is removed or written, so a refusal in either folder leaves both as they were.
 */
export const main = async (
  args: readonly string[],
  log: Log = console.log,
  dir: string = SKILL_DIR,
  generated: GeneratedSkill = generateSkill(),
  helpDir: string = dir === SKILL_DIR ? HELP_DIR : join(dirname(dir), "askboard-help"),
  help: GeneratedHelp = generateHelpSkill(),
): Promise<number> => {
  const unknown = args.filter((arg) => arg !== CHECK_FLAG);
  if (unknown.length > 0) {
    log(`skills: unknown argument ${unknown.join(" ")}; the command takes ${CHECK_FLAG} only`);
    return 1;
  }
  try {
    const targets = [
      { dir, generated },
      { dir: helpDir, generated: help },
    ];
    const found = targets.map((target) => scan(target.dir));
    for (const target of targets) {
      for (const name of target.generated.files.keys()) insideOf(target.dir, name);
    }
    const reports = [
      budgetReport(
        generated.files,
        { ...defaultAlwaysLoaded(), others: headOf(help.files) },
        basename(dir),
      ),
      budgetReport(help.files, undefined, basename(helpDir), HELP_SKILL, false),
    ];
    const problems = reports.flatMap((report) => report.problems);
    const figures = reports.flatMap((report) => report.figures);
    const count = targets.reduce((sum, target) => sum + target.generated.files.size, 0);
    if (args.includes(CHECK_FLAG)) {
      const drift = targets.flatMap((target, at) =>
        driftProblems(target.dir, target.generated, found[at] as Scan),
      );
      for (const figure of figures) log(figure);
      return finish(
        [...drift, ...problems],
        `check:skills: ${count} files under skills/askboard/ and skills/askboard-help/, none drifted, within budget`,
        log,
      );
    }
    for (const [at, target] of targets.entries()) {
      writeAll(target.dir, target.generated, found[at] as Scan, log);
    }
    log(`build:skills: ${count} files written under skills/askboard/ and skills/askboard-help/`);
    for (const figure of figures) log(figure);
    return finish(problems, "build:skills: within budget", log);
  } catch (error) {
    log(`skills: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
};

if (import.meta.main) {
  process.exitCode = await main(Bun.argv.slice(2));
}
