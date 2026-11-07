// One product version, in lockstep (plugin-release, design decision 3): the root package.json, every
// packages/*/package.json and .claude-plugin/plugin.json carry the same major.minor.patch version.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The only form a product version takes: three numbers, no prefix and no pre-release part. */
export const VERSION_FORM = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

export const ROOT_MANIFEST = "package.json";
export const PLUGIN_MANIFEST = ".claude-plugin/plugin.json";

/** The manifests that carry the product version, relative to the root: the root first. */
export const versionedFiles = (root: string): string[] => {
  const packagesDirectory = join(root, "packages");
  const packages = existsSync(packagesDirectory)
    ? readdirSync(packagesDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `packages/${entry.name}/package.json`)
        .filter((path) => existsSync(join(root, path)))
        .sort()
    : [];
  return [ROOT_MANIFEST, ...packages, PLUGIN_MANIFEST];
};

/** The `version` field of a manifest; `undefined` when it has none. Throws when the file is no JSON object. */
export const readVersion = (root: string, path: string): string | undefined => {
  const parsed: unknown = JSON.parse(readFileSync(join(root, path), "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("is not a JSON object");
  }
  const version = (parsed as Record<string, unknown>).version;
  return typeof version === "string" ? version : undefined;
};

/** Why the versions disagree or are missing, one line per file; empty when they agree. */
export const versionProblems = (root: string): string[] => {
  const problems: string[] = [];
  let reference: string | undefined;
  for (const path of versionedFiles(root)) {
    let version: string | undefined;
    try {
      version = readVersion(root, path);
    } catch (error) {
      problems.push(`${path}: cannot be read (${(error as Error).message})`);
      continue;
    }
    if (version === undefined) {
      problems.push(`${path}: has no version`);
    } else if (!VERSION_FORM.test(version)) {
      problems.push(`${path}: version ${version} is not major.minor.patch`);
    } else if (path === ROOT_MANIFEST) {
      reference = version;
    } else if (reference !== undefined && version !== reference) {
      problems.push(`${path}: version ${version} differs from ${ROOT_MANIFEST}'s ${reference}`);
    }
  }
  return problems;
};
