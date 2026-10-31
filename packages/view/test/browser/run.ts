// Runs the browser tests (design decision 11): builds, then runs every `*.browser.ts` file under
// `bun test` once per engine, the engines in parallel, each in its own process with
// `ASKBOARD_E2E_ENGINES` naming it. `bun run test` never runs these files: `bun test` picks up only
// `*.test.ts`, and they need a build and the Playwright browsers.
//
// The tests talk to the test server, or with `--target session-process` to the built session
// process `dist/askboard.mjs` (task 9.3), on Bun or with `--runtime node` on Node 24; the ask
// lifecycle's scenarios talk to the session process on either target. The build is `bun run
// build` (the bundle and `dist/view/`); `--no-build` uses what `dist/` holds.
//
// Usage: bun packages/view/test/browser/run.ts [--engines chromium,firefox,webkit]
//          [--target test-server|session-process] [--runtime bun|node] [--no-build] [--serial]
//          [-- <more bun test arguments, such as -t <pattern>>]

import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { type Engine, enginesFrom } from "./harness/engines.ts";
import { type Runtime, runtimeFrom, type Target, targetFrom } from "./harness/target.ts";

const HERE = import.meta.dir;
const ROOT = join(HERE, "..", "..", "..", "..");
const TEST_TIMEOUT_MS = 60_000;

type Options = {
  readonly engines: readonly Engine[];
  readonly target: Target;
  readonly runtime: Runtime;
  readonly build: boolean;
  readonly serial: boolean;
  readonly extra: readonly string[];
};

const USAGE =
  "usage: bun packages/view/test/browser/run.ts [--engines a,b] [--target test-server|session-process] [--runtime bun|node] [--no-build] [--serial] [-- <bun test arguments>]";

const parseArgs = (args: readonly string[]): Options | undefined => {
  let engines = enginesFrom(process.env.ASKBOARD_E2E_ENGINES);
  let target = targetFrom(process.env.ASKBOARD_E2E_TARGET);
  let runtime = runtimeFrom(process.env.ASKBOARD_E2E_RUNTIME);
  let build = true;
  let serial = false;
  const options = () => ({ engines, target, runtime, build, serial });
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at];
    const value = args[at + 1];
    if (arg === "--") return { ...options(), extra: args.slice(at + 1) };
    if (arg === "--no-build") build = false;
    else if (arg === "--serial") serial = true;
    else if (value === undefined) return undefined;
    else if (arg === "--engines") engines = enginesFrom(value);
    else if (arg === "--target") target = targetFrom(value);
    else if (arg === "--runtime") runtime = runtimeFrom(value);
    else return undefined;
    if (arg === "--engines" || arg === "--target" || arg === "--runtime") at += 1;
  }
  return { ...options(), extra: [] };
};

const children = new Set<Bun.Subprocess>();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    for (const child of children) child.kill();
    process.exit(130);
  });
}

// The session process serves the view beside its bundle, so its target builds both; so does the
// test server's, since the lifecycle's scenarios run on the session process whatever the target
// (ask-lifecycle, `Scenario.ask`).
const buildFor = async (_target: Target): Promise<number> => {
  const command = ["run", "build"];
  const child = Bun.spawn([process.execPath, ...command], {
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  children.add(child);
  const code = await child.exited;
  children.delete(child);
  return code;
};

type EngineRun = { engine: Engine; code: number; output: string; seconds: number };

const runEngine = async (
  engine: Engine,
  files: readonly string[],
  options: Options,
): Promise<EngineRun> => {
  const started = performance.now();
  const child = Bun.spawn(
    [process.execPath, "test", "--timeout", String(TEST_TIMEOUT_MS), ...files, ...options.extra],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        ASKBOARD_E2E_ENGINES: engine,
        ASKBOARD_E2E_TARGET: options.target,
        ASKBOARD_E2E_RUNTIME: options.runtime,
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  children.add(child);
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  children.delete(child);
  const seconds = (performance.now() - started) / 1000;
  return { engine, code, output: `${stdout}${stderr}`, seconds };
};

const count = (output: string, word: "pass" | "fail") =>
  Number(new RegExp(`^\\s*(\\d+) ${word}$`, "m").exec(output)?.[1] ?? 0);

const main = async (args: readonly string[]): Promise<number> => {
  let options: Options | undefined;
  try {
    options = parseArgs(args);
  } catch (error) {
    console.log(error instanceof Error ? error.message : String(error));
    return 1;
  }
  if (options === undefined) {
    console.log(USAGE);
    return 1;
  }
  if (options.build && (await buildFor(options.target)) !== 0) return 1;
  const files = (await readdir(HERE))
    .filter((name) => name.endsWith(".browser.ts"))
    .sort()
    .map((name) => `./${relative(ROOT, join(HERE, name))}`);
  const runs: EngineRun[] = [];
  if (options.serial) {
    for (const engine of options.engines) runs.push(await runEngine(engine, files, options));
  } else {
    runs.push(
      ...(await Promise.all(options.engines.map((engine) => runEngine(engine, files, options)))),
    );
  }
  for (const run of runs) console.log(`\n=== ${run.engine} ===\n${run.output.trimEnd()}`);
  const target =
    options.target === "session-process"
      ? `the session process on ${options.runtime}`
      : "the test server";
  console.log(`\nbrowser tests against ${target}:`);
  for (const run of runs) {
    const outcome = `${count(run.output, "pass")} pass, ${count(run.output, "fail")} fail`;
    console.log(`  ${run.engine.padEnd(8)} ${outcome} in ${run.seconds.toFixed(1)} s`);
  }
  return runs.every((run) => run.code === 0) ? 0 : 1;
};

process.exitCode = await main(Bun.argv.slice(2));
