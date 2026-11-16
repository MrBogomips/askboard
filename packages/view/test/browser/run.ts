// Runs the browser tests (design decision 11, e2e-cadence decision 5): builds, then runs the files
// of the chosen set under `bun test`, one engine at a time, each in its own process with
// `ASKBOARD_E2E_ENGINES` naming it and its files in parallel over the workers. `bun run test` never
// runs these files: `bun test` picks up only `*.test.ts`, and they need a build and the
// Playwright browsers.
//
// The sets are the manifest's (`harness/suites.ts`): `smoke`, `full` (every file that is not a perf
// file), `perf` (the timed bounds, serially, judged alone) and `all`, which is `full` then `perf`.
// `--shard k/n` takes one part of each smoke or full pass, balanced by `timings/<engine>.json` when
// it exists; it is refused with the `perf` and `all` sets, whose perf pass is never sharded.
// `--update-timings` writes those files, on an unsharded `full` or `all` run only; `--timings-out
// <file>` writes one engine's full set, sharded or not, to a file of its own instead (the nightly's
// shard jobs, merged by `tools/ci/merge-timings.ts`). See `run-options.ts` and `run-plan.ts`.
//
// The tests talk to the test server, or with `--target session-process` to the built session
// process `dist/askboard.mjs` (task 9.3), on Bun or with `--runtime node` on Node 24; the ask
// lifecycle's scenarios talk to the session process on either target. The build is `bun run
// build` (the bundle and `dist/view/`); `--no-build` uses what `dist/` holds.
//
// The console gets one line per pass, then the digest (#227 point 2, `run-digest.ts`): the counts and
// one line per failing test, marked new, flaky or known; the full output goes to the log file
// (`--log`), which the digest names, and on CI the digest also goes to the job's summary. With
// `--rerun-failed <n>` a file with a new failure runs again alone, up to n times: a test that then
// passes is flaky. A failure `known-failures.json` quarantines under an open Issue is reported and
// does not fail the run (`run-quarantine.ts`); only new failures do.
//
// Usage: see USAGE in `run-options.ts`.

import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { BROWSER_FILES } from "./harness/suites.ts";
import {
  digestPassed,
  formatDigest,
  type JudgedFailure,
  type PassSummary,
  parseFailures,
} from "./run-digest.ts";
import { type Options, parseArgs, USAGE } from "./run-options.ts";
import { type Pass, planPasses, rerunPass, timingsFile } from "./run-plan.ts";
import {
  judgeFailures,
  KNOWN_FAILURES_FILE,
  type KnownFailure,
  knownIssueOf,
  parseKnownFailures,
  type Rerun,
} from "./run-quarantine.ts";

const HERE = import.meta.dir;
const ROOT = join(HERE, "..", "..", "..", "..");

const children = new Set<Bun.Subprocess>();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    for (const child of children) child.kill();
    process.exit(130);
  });
}

// The session process serves the view beside its bundle, so every target builds both; so does the
// test server's, since the lifecycle's scenarios run on the session process whatever the target
// (ask-lifecycle, `Scenario.ask`).
const build = async (): Promise<number> => {
  const child = Bun.spawn([process.execPath, "run", "build"], {
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  children.add(child);
  const code = await child.exited;
  children.delete(child);
  return code;
};

type PassRun = { pass: Pass; code: number; output: string; seconds: number };

// The file a `--timings-out` pass writes starts as the engine's committed timings (or empty), so
// that `bun test` balances the shard by them: Bun reads the file, runs, and rewrites it.
const seedTimings = (pass: Pass, from: string): void => {
  if (pass.timingsOut === undefined) return;
  mkdirSync(dirname(pass.timingsOut.file), { recursive: true });
  if (pass.timingsOut.base === undefined) {
    writeFileSync(pass.timingsOut.file, `${JSON.stringify({ version: 1, files: {} })}\n`);
  } else copyFileSync(join(from, pass.timingsOut.base), pass.timingsOut.file);
};

const runPass = async (pass: Pass, options: Options): Promise<PassRun> => {
  seedTimings(pass, ROOT);
  const started = performance.now();
  const child = Bun.spawn([process.execPath, ...pass.args], {
    cwd: ROOT,
    env: {
      ...process.env,
      ASKBOARD_E2E_ENGINES: pass.engine,
      ASKBOARD_E2E_TARGET: options.target,
      ASKBOARD_E2E_RUNTIME: options.runtime,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  children.add(child);
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  children.delete(child);
  return {
    pass,
    code,
    output: `${stdout}${stderr}`,
    seconds: (performance.now() - started) / 1000,
  };
};

const count = (output: string, word: "pass" | "fail") =>
  Number(new RegExp(`^\\s*(\\d+) ${word}$`, "m").exec(output)?.[1] ?? 0);

const baseName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

// A file with a new failure runs again alone, up to `rerunFailed` times, until each of its new
// failures has passed once; every output goes to the log.
const rerunFiles = async (
  run: PassRun,
  options: Options,
  known: readonly KnownFailure[],
  log: (title: string, output: string) => void,
): Promise<Record<string, Rerun[]>> => {
  const fresh = parseFailures(run.output).filter(
    (failure) => knownIssueOf(known, run.pass.engine, failure) === undefined,
  );
  const reruns: Record<string, Rerun[]> = {};
  for (const file of run.pass.files) {
    const name = baseName(file);
    let open = fresh.filter((failure) => failure.file === name);
    for (let time = 1; time <= options.rerunFailed && open.length > 0; time += 1) {
      const again = await runPass(rerunPass(run.pass, file, options), options);
      log(`rerun ${time} of ${name}, ${run.pass.engine}`, again.output);
      const rerun = { code: again.code, failures: parseFailures(again.output) };
      reruns[name] = [...(reruns[name] ?? []), rerun];
      const failedAgain = (test: string) => rerun.failures.some((one) => one.test === test);
      if (rerun.code === 0 || rerun.failures.length > 0) {
        open = open.filter((failure) => failedAgain(failure.test));
      }
    }
  }
  return reruns;
};

const knownFailures = (): KnownFailure[] =>
  parseKnownFailures(JSON.parse(readFileSync(join(ROOT, KNOWN_FAILURES_FILE), "utf8")) as unknown);

const logFileOf = (options: Options): string => {
  const file =
    options.log === undefined
      ? join(tmpdir(), `askboard-browser-${new Date().toISOString().replace(/[:.]/g, "-")}.log`)
      : resolve(options.log);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "");
  return file;
};

const summarise = (digest: string): void => {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary !== undefined && summary !== "") {
    appendFileSync(summary, `### Browser tests\n\n\`\`\`text\n${digest}\n\`\`\`\n`);
  }
};

const main = async (args: readonly string[]): Promise<number> => {
  let options: Options;
  let known: KnownFailure[];
  try {
    options = parseArgs(args, { env: process.env, cores: availableParallelism() });
    known = knownFailures();
  } catch (error) {
    console.log(error instanceof Error ? error.message : `${String(error)}\n${USAGE}`);
    return 1;
  }
  if (options.build && (await build()) !== 0) return 1;
  // The runner works from the repository root; a relative file is the caller's own.
  const timingsOut = options.timingsOut === undefined ? undefined : resolve(options.timingsOut);
  const passes = planPasses(
    timingsOut === undefined ? options : { ...options, timingsOut },
    BROWSER_FILES,
    (engine) => existsSync(join(ROOT, timingsFile(engine))),
  );
  if (passes.length === 0) {
    console.log("no file to run for these engines and this set");
    return 1;
  }
  const logFile = logFileOf(options);
  const log = (title: string, output: string) =>
    appendFileSync(logFile, `\n=== ${title} ===\n${output.trimEnd()}\n`);
  // The engines run in turn, a pass after a pass: three engines at once saturate the machine and add
  // failures that only load causes (task 0.3).
  const summaries: PassSummary[] = [];
  const failures: JudgedFailure[] = [];
  for (const pass of passes) {
    const run = await runPass(pass, options);
    log(`${pass.set} ${pass.engine}`, run.output);
    const reruns = await rerunFiles(run, options, known, log);
    const summary = {
      set: pass.set,
      engine: pass.engine,
      pass: count(run.output, "pass"),
      fail: count(run.output, "fail"),
      seconds: run.seconds,
      code: run.code,
    };
    summaries.push(summary);
    failures.push(
      ...judgeFailures({
        set: pass.set,
        engine: pass.engine,
        failures: parseFailures(run.output),
        reruns,
        known,
      }),
    );
    console.log(
      `${pass.set} ${pass.engine}: ${summary.pass} pass, ${summary.fail} fail in ${run.seconds.toFixed(1)} s`,
    );
  }
  const target =
    options.target === "session-process"
      ? `the session process on ${options.runtime}`
      : "the test server";
  const input = {
    heading: `browser tests against ${target}`,
    log: logFile,
    passes: summaries,
    failures,
  };
  const digest = formatDigest(input);
  console.log(`\n${digest}`);
  summarise(digest);
  return digestPassed(input) ? 0 : 1;
};

process.exitCode = await main(Bun.argv.slice(2));
