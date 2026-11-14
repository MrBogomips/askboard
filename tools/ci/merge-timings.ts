// Combines the per-shard timings files of one engine's full set into the engine's timings file
// (e2e-cadence, decision 5, C5):
//
//   bun tools/ci/merge-timings.ts <base> [<shard file>...] --out <file>
//
// `<base>` is the committed file the shards were balanced by; each shard file is what one
// `run.ts --shard k/n --timings-out` pass wrote. Bun 1.4.4 under `--shard` drops the entries of the
// files the shard did not run (task 5.2's probe), so a shard file holds only its own files, but the
// merge does not rely on it: for each path it takes the one shard value that differs from the base
// (or, for a path the base lacks, the value its shards agree on), else the base's. Two shard
// values that differ from the base and from each other are an error, since one file ran in two
// shards. The output is in `tools/test-timings.json`'s format, the slowest file first.

import { readFileSync, writeFileSync } from "node:fs";

/** `tools/test-timings.json`'s format: the milliseconds each file took. */
export type Timings = { readonly version: 1; readonly files: Readonly<Record<string, number>> };

const USAGE = "usage: bun tools/ci/merge-timings.ts <base> [<shard file>...] --out <file>";

// Own keys only (threat model 3.5): `files["__proto__"]` or `files["constructor"]` of a file that lacks
// them is Object.prototype's member, not a timing.
const ownValue = (timings: Timings, path: string): number | undefined =>
  Object.hasOwn(timings.files, path) ? timings.files[path] : undefined;

/** The merge of the shard files over the base; throws, naming the path, when two shards disagree. */
export const mergeTimings = (base: Timings, shards: readonly Timings[]): Timings => {
  const paths = new Set([
    ...Object.keys(base.files),
    ...shards.flatMap((shard) => Object.keys(shard.files)),
  ]);
  const merged = new Map<string, number>();
  for (const path of paths) {
    const before = ownValue(base, path);
    const changed = new Set<number>();
    for (const shard of shards) {
      const value = ownValue(shard, path);
      if (value !== undefined && value !== before) changed.add(value);
    }
    if (changed.size > 1) {
      throw new Error(
        `${path} has ${[...changed].join(" and ")} ms in different shards: a file ran in two of them`,
      );
    }
    const [value] = changed;
    const result = value ?? before;
    if (result !== undefined) merged.set(path, result);
  }
  const ordered = [...merged].sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0));
  return { version: 1, files: Object.fromEntries(ordered) };
};

const read = (file: string): Timings => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const record = parsed as { version?: unknown; files?: unknown } | null;
  const files = record?.files;
  if (
    record?.version !== 1 ||
    typeof files !== "object" ||
    files === null ||
    Array.isArray(files)
  ) {
    throw new Error(`${file}: not a timings file ({"version": 1, "files": {<path>: <ms>}})`);
  }
  for (const [path, ms] of Object.entries(files)) {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
      throw new Error(`${file}: ${path} has ${JSON.stringify(ms)}, not a number of milliseconds`);
    }
  }
  return { version: 1, files: files as Record<string, number> };
};

/** Runs the command; returns the exit code (0 done, 1 failed, 2 misused) and says why through `log`. */
export const main = (args: readonly string[], log: (line: string) => void): number => {
  const inputs: string[] = [];
  let out: string | undefined;
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at] ?? "";
    if (arg === "--out") {
      out = args[at + 1];
      at += 1;
    } else if (arg.startsWith("--")) {
      log(`unknown option "${arg}"\n${USAGE}`);
      return 2;
    } else inputs.push(arg);
  }
  const [baseFile, ...shardFiles] = inputs;
  if (out === undefined || baseFile === undefined) {
    log(USAGE);
    return 2;
  }
  try {
    const merged = mergeTimings(read(baseFile), shardFiles.map(read));
    writeFileSync(out, `${JSON.stringify(merged, null, 2)}\n`);
    return 0;
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 1;
  }
};

if (import.meta.main) process.exitCode = main(process.argv.slice(2), console.error);
