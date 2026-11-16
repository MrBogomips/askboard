// The quiet form of `bun run check` for agents (#227 point 2): the same steps in the same order,
// stopping at the first failure, but the console gets one line per step that passes and, for the
// one that fails, only its failures and its counts: the failing tests with the first line of each
// error, the coverage rows under the threshold when that is what failed, or the end of any other
// step's output. Each step's whole output goes to a log file, which the last line names. About 2 KB
// in place of about 100 KB, most of it the coverage table.
//
// Usage: bun tools/check-agent.ts [--log <file>]   (bun run check:agent)

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseFailures } from "../packages/view/test/browser/run-digest.ts";

/** The steps of the `check` script, which a test keeps equal to package.json's. */
export const CHECK_STEPS = [
  "typecheck",
  "lint",
  "test",
  "check:imports",
  "check:skills",
  "check:licences",
] as const;

/** bunfig.toml's `coverageThreshold`, as a fraction; a test keeps them equal. */
export const COVERAGE_THRESHOLD = 0.8;

/** The bound of one failing step's report, in bytes. */
export const REPORT_LIMIT = 3072;
const LINE_LIMIT = 200;
const TAIL_LINES = 40;

const ROOT = join(import.meta.dir, "..");

const cut = (line: string): string =>
  line.length <= LINE_LIMIT ? line : `${line.slice(0, LINE_LIMIT - 1)}…`;

const COVERAGE_ROW = /^\s(\S.*?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*(.*?)\s*$/;
const COUNT_LINE = /^\s*\d+ (pass|fail|skip|todo|error|errors)$/;

/** The coverage table's file rows under the threshold, functions or lines. */
export const coverageBelow = (output: string): string[] =>
  output.split("\n").flatMap((line) => {
    const row = COVERAGE_ROW.exec(line);
    if (row === null) return [];
    const [, file = "", funcs = "", lines = "", uncovered = ""] = row;
    const under = Math.min(Number(funcs), Number(lines)) < COVERAGE_THRESHOLD * 100;
    if (!under || file === "All files") return [];
    const where = uncovered === "" ? "" : ` (uncovered ${uncovered})`;
    return [`${file}: ${funcs}% functions, ${lines}% lines${where}`];
  });

const fits = (lines: readonly string[]): boolean =>
  new TextEncoder().encode(lines.join("\n")).length <= REPORT_LIMIT;

// The first lines that fit after the head.
const firstWithin = (head: string, lines: readonly string[]): string => {
  const kept: string[] = [];
  for (const line of lines) {
    if (!fits([head, ...kept, line])) break;
    kept.push(line);
  }
  return [head, ...kept].join("\n");
};

// The last lines that fit after the head: the end of an output says most.
const lastWithin = (head: string, lines: readonly string[]): string => {
  const kept: string[] = [];
  for (const line of [...lines].reverse()) {
    if (!fits([head, line, ...kept])) break;
    kept.unshift(line);
  }
  return [head, ...kept].join("\n");
};

const testLines = (output: string): string[] => {
  const failures = parseFailures(output);
  const counts = output
    .split("\n")
    .filter((line) => COUNT_LINE.test(line))
    .map((line) => line.trim());
  const body =
    failures.length > 0
      ? failures.map((failure) => `${failure.file} > ${failure.test}: ${failure.error}`)
      : [`coverage under ${COVERAGE_THRESHOLD * 100}%:`, ...coverageBelow(output)];
  return [...body, ...counts].map((line) => cut(`  ${line}`));
};

/** One line for a step that passed; its failures, within `REPORT_LIMIT`, for one that failed. */
export const stepReport = (step: string, code: number, output: string, seconds: number): string => {
  const time = `in ${seconds.toFixed(1)} s`;
  if (code === 0) return `ok   ${step} ${time}`;
  const head = `FAIL ${step} ${time}`;
  if (step === "test") return firstWithin(head, testLines(output));
  const tail = output.trimEnd().split("\n").slice(-TAIL_LINES);
  return lastWithin(
    head,
    tail.map((line) => cut(`  ${line}`)),
  );
};

export type StepRun = { readonly code: number; readonly output: string; readonly seconds: number };

/** Runs a package.json script from the repository root, its output captured. */
export const runStep = async (step: string): Promise<StepRun> => {
  const started = performance.now();
  const child = Bun.spawn([process.execPath, "run", step], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { code, output: `${stdout}${stderr}`, seconds: (performance.now() - started) / 1000 };
};

/** The log file, `--log <file>` or one in the system's temporary folder, created empty. */
export const logFileOf = (args: readonly string[]): string => {
  const at = args.indexOf("--log");
  const named = at === -1 ? undefined : args[at + 1];
  const file =
    named === undefined || named === ""
      ? join(tmpdir(), `askboard-check-${new Date().toISOString().replace(/[:.]/g, "-")}.log`)
      : resolve(named);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "");
  return file;
};

export type Run = {
  readonly run: (step: string) => Promise<StepRun>;
  readonly print: (text: string) => void;
};

/** Runs the steps in turn, stopping at the first failure; 0 when every step passed. */
export const main = async (
  args: readonly string[],
  { run, print }: Run = { run: runStep, print: console.log },
): Promise<number> => {
  const log = logFileOf(args);
  for (const step of CHECK_STEPS) {
    const { code, output, seconds } = await run(step);
    appendFileSync(log, `\n=== ${step} (exit ${code}) ===\n${output.trimEnd()}\n`);
    print(stepReport(step, code, output, seconds));
    if (code !== 0) {
      print(`check: FAIL at ${step}; full log: ${log}`);
      return 1;
    }
  }
  print(`check: PASS; full log: ${log}`);
  return 0;
};

if (import.meta.main) process.exitCode = await main(Bun.argv.slice(2));
