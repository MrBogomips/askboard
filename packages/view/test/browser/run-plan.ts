// What a browser run executes (e2e-cadence, design decision 5): the passes, each a set of files in
// one engine with the `bun test` arguments that run it. Pure, so that it is unit-tested; `run.ts`
// spawns the passes. Every set runs the engines in turn (C2): a pass is one engine's, never two at
// once, and `all` runs the full passes of every engine before the perf passes.

import type { Engine } from "./harness/engines.ts";
import type { BrowserFileEntry } from "./harness/suites.ts";
import type { Options } from "./run-options.ts";

/** Where the browser files are, from the repository root, which is where `bun test` runs. */
export const BROWSER_DIR = "packages/view/test/browser";
/** The committed per-file timings, one file per engine, in `tools/test-timings.json`'s format. */
export const TIMINGS_DIR = `${BROWSER_DIR}/timings`;
export const TEST_TIMEOUT_MS = 60_000;

export const timingsFile = (engine: Engine): string => `${TIMINGS_DIR}/${engine}.json`;

export type PassSet = "smoke" | "full" | "perf";

export type Pass = {
  readonly set: PassSet;
  readonly engine: Engine;
  /** The files, as paths from the repository root with a leading `./`, sorted by name. */
  readonly files: readonly string[];
  /** The arguments of `bun test`, after the executable. */
  readonly args: readonly string[];
};

const belongs = (set: PassSet, entry: BrowserFileEntry): boolean =>
  set === "smoke"
    ? entry.smoke === true
    : set === "perf"
      ? entry.perf === true
      : entry.perf !== true;

const runsIn = (engine: Engine, entry: BrowserFileEntry): boolean =>
  entry.engines === undefined || entry.engines.includes(engine);

const filesOf = (
  set: PassSet,
  engine: Engine,
  manifest: Readonly<Record<string, BrowserFileEntry>>,
): string[] =>
  Object.entries(manifest)
    .filter(([, entry]) => belongs(set, entry) && runsIn(engine, entry))
    .map(([name]) => `./${BROWSER_DIR}/${name}`)
    .sort();

// Smoke and full passes are parallel over the workers and balanced by the engine's timings; the
// perf pass is serial, whole and untimed, so that its timings are judged alone (decision 6).
const argsOf = (
  set: PassSet,
  engine: Engine,
  files: readonly string[],
  options: Options,
  hasTimings: (engine: Engine) => boolean,
): string[] => {
  const timed = set !== "perf";
  const timings = timed && (options.updateTimings || hasTimings(engine));
  return [
    "test",
    "--timeout",
    String(TEST_TIMEOUT_MS),
    ...(timed ? [`--parallel=${options.workers}`] : []),
    ...(timed && options.shard !== undefined
      ? [`--shard=${options.shard.k}/${options.shard.n}`]
      : []),
    ...(timings ? ["--timings", timingsFile(engine)] : []),
    ...(timed && options.updateTimings ? ["--update-timings"] : []),
    ...files,
    ...options.extra,
  ];
};

const SETS_OF = {
  smoke: ["smoke"],
  full: ["full"],
  perf: ["perf"],
  all: ["full", "perf"],
} as const satisfies Record<Options["set"], readonly PassSet[]>;

/** The passes of a run, in order; an engine with no file in a set has no pass in it. */
export const planPasses = (
  options: Options,
  manifest: Readonly<Record<string, BrowserFileEntry>>,
  hasTimings: (engine: Engine) => boolean,
): Pass[] =>
  SETS_OF[options.set].flatMap((set) =>
    options.engines.flatMap((engine): Pass[] => {
      const files = filesOf(set, engine, manifest);
      if (files.length === 0) return [];
      return [{ set, engine, files, args: argsOf(set, engine, files, options, hasTimings) }];
    }),
  );
