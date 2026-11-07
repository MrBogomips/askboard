// The release's gates that need no build (plugin-release, design decision 6; packaging spec, "The
// release workflow"): the run is on `main`, the product versions agree, the tag `v<version>` does not
// exist yet, CHANGELOG.md has a section for the version, and Claude Code's `stable` channel has
// reached the declared minimum (AD-18). Every cause is reported at once. The inputs are injected;
// the command line reads `GITHUB_REF`, the tags of a checkout that fetched them all and
// `npm view @anthropic-ai/claude-code dist-tags --json`.
//
// Usage: bun tools/release/preflight.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLAUDE_CODE_MINIMUM } from "@askboard/contract";
import { changelogSection } from "./changelog.ts";
import { ROOT_MANIFEST, readVersion, VERSION_FORM, versionProblems } from "./versions.ts";

export const RELEASE_REF = "refs/heads/main";

export type PreflightInput = {
  /** The repository root. */
  readonly root: string;
  /** The ref the workflow runs on (`GITHUB_REF`). */
  readonly ref: string | undefined;
  /** Every tag of the repository, as `git tag --list` prints them. */
  readonly remoteTags: readonly string[];
  /** The parsed output of `npm view @anthropic-ai/claude-code dist-tags --json`. */
  readonly distTags: unknown;
  /** The Claude Code minimum; the contract's `CLAUDE_CODE_MINIMUM` when absent. */
  readonly minimum?: string;
};

/** Negative, zero or positive as `a` is below, equal to or above `b`; both are `major.minor.patch`. */
export const compareVersions = (a: string, b: string): number => {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let at = 0; at < 3; at += 1) {
    const difference = (left[at] ?? 0) - (right[at] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

/** The product version of the root manifest; `undefined` when it has none or is not `x.y.z`. */
const productVersion = (root: string): string | undefined => {
  try {
    const version = readVersion(root, ROOT_MANIFEST);
    return version !== undefined && VERSION_FORM.test(version) ? version : undefined;
  } catch {
    return undefined;
  }
};

const changelogProblem = (root: string, version: string): string | undefined => {
  let text: string;
  try {
    text = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  } catch {
    return `CHANGELOG.md is missing or unreadable: it needs a section \`## ${version}\``;
  }
  return changelogSection(text, version) === undefined
    ? `CHANGELOG.md has no section \`## ${version}\``
    : undefined;
};

const stableOf = (distTags: unknown): string | undefined => {
  if (typeof distTags !== "object" || distTags === null || Array.isArray(distTags))
    return undefined;
  const stable = (distTags as Record<string, unknown>).stable;
  return typeof stable === "string" && VERSION_FORM.test(stable) ? stable : undefined;
};

/** Why the release must not go ahead, one line per cause; empty when every gate passes. */
export const preflight = (input: PreflightInput): string[] => {
  const problems: string[] = [];
  if (input.ref !== RELEASE_REF) {
    problems.push(
      `a release runs only on ${RELEASE_REF}, not on ${input.ref === undefined || input.ref === "" ? "no ref" : input.ref}`,
    );
  }
  problems.push(...versionProblems(input.root));
  const version = productVersion(input.root);
  if (version !== undefined) {
    if (input.remoteTags.includes(`v${version}`)) {
      problems.push(`the tag v${version} already exists: a released version is never moved`);
    }
    const missing = changelogProblem(input.root, version);
    if (missing !== undefined) problems.push(missing);
  }
  const minimum = input.minimum ?? CLAUDE_CODE_MINIMUM;
  const stable = stableOf(input.distTags);
  if (stable === undefined) {
    problems.push(
      "Claude Code's dist-tag `stable` is missing or not a version: AD-18's gate cannot be read",
    );
  } else if (compareVersions(stable, minimum) < 0) {
    problems.push(
      `Claude Code's stable channel is ${stable}, below the declared minimum ${minimum} (AD-18): wait for it to reach the minimum`,
    );
  }
  return problems;
};

/** The parsed `npm view ... dist-tags --json` output; `undefined` when it is not JSON. */
export const distTagsFromNpm = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export type PreflightPorts = {
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Every tag of the checkout; throws when git fails. */
  readonly tags: (root: string) => string[];
  /** The dist-tags of Claude Code's package; throws when npm fails. */
  readonly distTags: () => unknown;
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
};

/** The command line: the exit code, with one stderr line per cause. */
export const runPreflight = (root: string, ports: PreflightPorts): number => {
  let remoteTags: string[];
  let distTags: unknown;
  try {
    remoteTags = ports.tags(root);
    distTags = ports.distTags();
  } catch (error) {
    ports.stderr(`preflight: cannot read the release's inputs: ${(error as Error).message}`);
    return 1;
  }
  const problems = preflight({ root, ref: ports.env.GITHUB_REF, remoteTags, distTags });
  for (const problem of problems) ports.stderr(`preflight: ${problem}`);
  if (problems.length > 0) return 1;
  ports.stdout(`preflight: ${productVersion(root)} may be released`);
  return 0;
};

/** Runs a command and returns its stdout; throws with its stderr when it fails. */
export const runCommand = (command: string[], cwd: string): string => {
  const result = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(
      `${command.join(" ")} exited ${result.exitCode}: ${result.stderr.toString().trim()}`,
    );
  }
  return result.stdout.toString();
};

/** The ports of the real process, with `run` as the way to run git and npm. */
export const portsWith = (run: typeof runCommand): PreflightPorts => ({
  env: process.env,
  tags: (root) => run(["git", "tag", "--list"], root).split("\n").filter(Boolean),
  distTags: () => {
    const parsed = distTagsFromNpm(
      run(["npm", "view", "@anthropic-ai/claude-code", "dist-tags", "--json"], "."),
    );
    if (parsed === undefined) throw new Error("npm view printed no JSON");
    return parsed;
  },
  stdout: (line) => void process.stdout.write(`${line}\n`),
  stderr: (line) => void process.stderr.write(`${line}\n`),
});

if (import.meta.main) {
  process.exit(runPreflight(join(import.meta.dir, "..", ".."), portsWith(runCommand)));
}
