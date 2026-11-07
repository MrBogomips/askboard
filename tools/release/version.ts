// `bun tools/release/version.ts <x.y.z>` sets the product version in every manifest of
// `versionedFiles` (plugin-release, design decision 3) and refreshes bun.lock, which records the
// workspace versions.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLUGIN_MANIFEST, VERSION_FORM, versionedFiles } from "./versions.ts";

const VERSION_LINE = /^( {2})"version": "[^"\n]*"(,?)$/m;
const NAME_LINE = /^( {2})"name": "[^"\n]*",$/m;

/** The manifest's text with its top-level `version` set; a field it lacks goes after `name`. */
const withVersion = (text: string, version: string): string => {
  const field = `"version": "${version}"`;
  if (VERSION_LINE.test(text))
    return text.replace(VERSION_LINE, (_, indent, comma) => `${indent}${field}${comma}`);
  if (NAME_LINE.test(text))
    return text.replace(NAME_LINE, (line, indent) => `${line}\n${indent}${field},`);
  throw new Error("has no top-level name to put a version after");
};

/** Sets `version` in every manifest, or in none: every file is checked before the first is written. */
export const setVersion = (root: string, version: string): void => {
  if (!VERSION_FORM.test(version)) {
    throw new Error(`the version "${version}" is not major.minor.patch (for example 0.1.0)`);
  }
  const updates = versionedFiles(root).map((path) => {
    try {
      const text = withVersion(readFileSync(join(root, path), "utf8"), version);
      JSON.parse(text);
      return { path, text };
    } catch (error) {
      throw new Error(`${path}: ${(error as Error).message}`);
    }
  });
  for (const { path, text } of updates) writeFileSync(join(root, path), text);
};

export interface CliPorts {
  /** Refreshes bun.lock; false when it failed. */
  refreshLock: (root: string) => boolean;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

/** The command line: the exit code for `<x.y.z>`. */
export const runCli = (root: string, argv: readonly string[], ports: CliPorts): number => {
  const version = argv[0] ?? "";
  try {
    setVersion(root, version);
  } catch (error) {
    ports.stderr(`version: ${(error as Error).message}`);
    return 1;
  }
  if (!ports.refreshLock(root)) {
    ports.stderr("version: bun install --lockfile-only failed; bun.lock is not refreshed");
    return 1;
  }
  const count = versionedFiles(root).length;
  ports.stdout(`version: ${version} set in ${count} manifests (${PLUGIN_MANIFEST} included)`);
  return 0;
};

/** The ports of the real process: bun.lock refreshed by Bun, lines on stdout and stderr. */
export const processPorts: CliPorts = {
  refreshLock: (dir) =>
    Bun.spawnSync(["bun", "install", "--lockfile-only"], { cwd: dir, stderr: "pipe" }).exitCode ===
    0,
  stdout: (line) => void process.stdout.write(`${line}\n`),
  stderr: (line) => void process.stderr.write(`${line}\n`),
};

if (import.meta.main) {
  process.exit(runCli(join(import.meta.dir, "..", ".."), process.argv.slice(2), processPorts));
}
