// The browser runner's options (e2e-cadence, design decision 5): parsed here, apart from the
// spawning in `run.ts`, so that they are unit-tested.

import { type Engine, enginesFrom } from "./harness/engines.ts";
import { type Runtime, runtimeFrom, type Target, targetFrom } from "./harness/target.ts";

/** The sets of files a run takes (decision 5): the smoke files, every non-perf file, the perf files, or both of the last two. */
export const SETS = ["smoke", "full", "perf", "all"] as const;
export type SetName = (typeof SETS)[number];

/** `--shard k/n`: the k-th of n parts of the files of a pass, as `bun test --shard` takes it. */
export type Shard = { readonly k: number; readonly n: number };

export type Options = {
  readonly engines: readonly Engine[];
  readonly target: Target;
  readonly runtime: Runtime;
  readonly build: boolean;
  /** Accepted and without effect: the engines always run in turn (decision 5, C2). */
  readonly serial: boolean;
  readonly set: SetName;
  /** The `--parallel` workers of each smoke and full pass; one per core by default (C2). */
  readonly workers: number;
  readonly shard?: Shard;
  readonly updateTimings: boolean;
  /** Where a full-set pass of one engine writes its timings, in place of the committed file (C5). */
  readonly timingsOut?: string;
  readonly extra: readonly string[];
};

export const USAGE =
  "usage: bun packages/view/test/browser/run.ts [--engines a,b] [--target test-server|session-process] [--runtime bun|node] [--no-build] [--serial] [--set smoke|full|perf|all] [--workers <n>] [--shard <k>/<n>] [--update-timings] [--timings-out <file>] [-- <bun test arguments>]";

/** Where the defaults come from: the environment, and the cores a run may use. */
export type Defaults = {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cores: number;
};

const refuse = (reason: string): never => {
  throw new Error(`${reason}\n${USAGE}`);
};

const setFrom = (value: string): SetName =>
  SETS.find((name) => name === value) ?? refuse(`unknown set "${value}": ${SETS.join(", ")}`);

const workersFrom = (value: string): number => {
  const workers = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(workers) || workers < 1) {
    return refuse(`--workers takes a whole number of at least 1, not "${value}"`);
  }
  return workers;
};

const shardFrom = (value: string): Shard => {
  const parts = value.split("/");
  const [k, n] = parts.map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN));
  if (parts.length !== 2 || k === undefined || n === undefined || !(k >= 1) || !(n >= 1) || k > n) {
    return refuse(`--shard takes <k>/<n> with 1 <= k <= n, not "${value}"`);
  }
  return { k, n };
};

// Combinations that would do the wrong thing, refused after the whole list is read so that the
// order of the options does not matter. `bun test --update-timings` replaces the engine's file with
// the files of the pass, so only an unsharded run of every non-perf file may write it; the perf pass
// is serial, whole and untimed, so a shard cannot share it out (it would run in full in every
// shard): shard the smoke and full sets alone.
// `--timings-out` is the sharded form of `--update-timings` (C5): one engine's full set, written to
// a file of its own for a merge step to combine, so it takes a shard but not the committed file.
const checkCombination = (
  set: SetName,
  shard: Shard | undefined,
  updateTimings: boolean,
  timingsOut: string | undefined,
  engines: number,
): void => {
  if (timingsOut !== undefined) {
    if (set !== "full") {
      refuse(`--timings-out takes the full set, not ${set}: only its files are timed and merged`);
    }
    if (engines !== 1) {
      refuse(`--timings-out takes one engine, not ${engines}: name it with --engines`);
    }
    if (updateTimings) {
      refuse("--timings-out cannot be combined with --update-timings: they write different files");
    }
  }
  if (updateTimings && shard !== undefined) {
    refuse(
      "--update-timings cannot be sharded: each shard would replace the file with its own files",
    );
  }
  if (updateTimings && (set === "smoke" || set === "perf")) {
    refuse(
      `--update-timings needs the full or all set, not ${set}: it would replace the file with only those files`,
    );
  }
  if (shard !== undefined && (set === "all" || set === "perf")) {
    refuse(
      `--shard takes the smoke or full set, not ${set}: the perf pass cannot be sharded (run --set full --shard and --set perf apart)`,
    );
  }
};

const WITH_VALUE = [
  "--engines",
  "--target",
  "--runtime",
  "--set",
  "--workers",
  "--shard",
  "--timings-out",
];

/** The options an argument list gives; throws the reason and the usage line when it is refused. */
export const parseArgs = (args: readonly string[], { env, cores }: Defaults): Options => {
  let engines = enginesFrom(env.ASKBOARD_E2E_ENGINES);
  let target = targetFrom(env.ASKBOARD_E2E_TARGET);
  let runtime = runtimeFrom(env.ASKBOARD_E2E_RUNTIME);
  let build = true;
  let serial = false;
  let set: SetName = "all";
  let workers = Math.max(1, cores);
  let shard: Shard | undefined;
  let updateTimings = false;
  let timingsOut: string | undefined;
  const options = (extra: readonly string[]): Options => {
    checkCombination(set, shard, updateTimings, timingsOut, engines.length);
    return {
      engines,
      target,
      runtime,
      build,
      serial,
      set,
      workers,
      ...(shard === undefined ? {} : { shard }),
      updateTimings,
      ...(timingsOut === undefined ? {} : { timingsOut }),
      extra,
    };
  };
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at] ?? "";
    if (arg === "--") return options(args.slice(at + 1));
    if (arg === "--no-build") build = false;
    else if (arg === "--serial") serial = true;
    else if (arg === "--update-timings") updateTimings = true;
    else if (!WITH_VALUE.includes(arg)) return refuse(`unknown option "${arg}"`);
    else {
      const value = args[at + 1];
      if (value === undefined) return refuse(`${arg} takes a value`);
      at += 1;
      if (arg === "--engines") engines = enginesFrom(value);
      else if (arg === "--target") target = targetFrom(value);
      else if (arg === "--runtime") runtime = runtimeFrom(value);
      else if (arg === "--set") set = setFrom(value);
      else if (arg === "--workers") workers = workersFrom(value);
      else if (arg === "--timings-out") {
        timingsOut = value === "" ? refuse("--timings-out takes a file name") : value;
      } else shard = shardFrom(value);
    }
  }
  return options([]);
};
