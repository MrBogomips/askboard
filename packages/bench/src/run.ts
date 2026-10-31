// The benchmark run (early-benchmark design decisions 2, 3, 11 and 12): preflight, then each case,
// arm and run in turn in its own scratch project, under its timeout; then the measurements, the
// report and the redaction of everything kept. `rebuildReport` measures a finished run again.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { buildLaunch, type CaseRun, cleanEnv, parseVersion } from "./command.ts";
import { measureRun, type RunMeasure } from "./measure.ts";
import { PreflightError, pluginDirOf, preflightPlugin } from "./plugin.ts";
import { eventsOf, exitOf } from "./process.ts";
import { redactTree } from "./redact.ts";
import { buildReport, type Report, type ReportContext, renderMarkdown } from "./report.ts";
import { ARMS, type Arm, CASES, type CaseId, promptFor } from "./scenarios.ts";
import type { RunSettings } from "./settings.ts";
import { findTranscripts, parseInit, parseTranscript, projectsRoot } from "./transcript.ts";

export type RunOptions = {
  /** The folder the output path resolves against, as the user's working directory. */
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly home: string;
  readonly log: (line: string) => void;
  /** After SIGINT at a timeout, SIGKILL follows this much later (design decision 12). */
  readonly killGraceMs?: number;
  /** Stops the benchmark, as SIGINT or SIGTERM to bench does. */
  readonly signal?: AbortSignal;
};

type RunRecord = {
  readonly caseId: CaseId;
  readonly arm: Arm;
  readonly run: number;
  readonly sessionId: string;
  readonly timedOut: boolean;
  readonly interrupted: boolean;
  readonly exitCode: number | null;
};

const KILL_GRACE_MS = 10_000;
const VERSION_TIMEOUT_MS = 30_000;

const runIdOf = (date: Date): string =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");

const writeJson = (path: string, value: unknown) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

// The version the installed claude reports, checked against the pinned one.
const preflightVersion = async (
  settings: RunSettings,
  env: Record<string, string>,
): Promise<string> => {
  const child = spawn(settings.claude, ["--version"], { env, stdio: ["ignore", "pipe", "ignore"] });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });
  const failed = new Promise<undefined>((settle) => {
    eventsOf(child).once("error", () => settle(undefined));
  });
  const timer = setTimeout(() => child.kill("SIGKILL"), VERSION_TIMEOUT_MS);
  await Promise.race([exitOf(child), failed]);
  clearTimeout(timer);
  const version = parseVersion(output);
  if (version === undefined) {
    throw new PreflightError(`cannot run ${settings.claude} --version: is Claude Code installed?`);
  }
  if (settings.claudeVersion !== undefined && settings.claudeVersion !== version) {
    throw new PreflightError(
      `Claude Code ${version} is installed, but ${settings.claudeVersion} is pinned`,
    );
  }
  return version;
};

// Starts claude in its own process group, stops it at the timeout, and resolves its exit.
const execute = async (
  launch: ReturnType<typeof buildLaunch>,
  dir: string,
  timeoutMs: number,
  killGraceMs: number,
  signal: AbortSignal,
): Promise<{ timedOut: boolean; interrupted: boolean; exitCode: number | null }> => {
  const out = openSync(join(dir, "stream.jsonl"), "w");
  const err = openSync(join(dir, "stderr.txt"), "w");
  const child = spawn(launch.command, [...launch.args], {
    cwd: launch.cwd,
    env: { ...launch.env },
    stdio: ["ignore", out, err],
    detached: true,
  });
  closeSync(out);
  closeSync(err);
  const failed = new Promise<null>((settle) => {
    eventsOf(child).once("error", () => settle(null));
  });
  let timedOut = false;
  const group = (signal: NodeJS.Signals) => {
    try {
      if (child.pid !== undefined) process.kill(-child.pid, signal);
    } catch {
      // The group has already gone.
    }
  };
  let interrupted = false;
  let killer: ReturnType<typeof setTimeout> | undefined;
  // claude has its own process group, so a Ctrl-C to bench reaches it only through here.
  const stop = () => {
    if (killer !== undefined) return;
    group("SIGINT");
    killer = setTimeout(() => group("SIGKILL"), killGraceMs);
  };
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, timeoutMs);
  const onAbort = () => {
    interrupted = true;
    stop();
  };
  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });
  const exitCode = await Promise.race([exitOf(child), failed]);
  clearTimeout(timer);
  signal.removeEventListener("abort", onAbort);
  if (killer !== undefined) clearTimeout(killer);
  // Whatever claude left in its group, its MCP servers included, goes with it.
  group("SIGKILL");
  return { timedOut, interrupted, exitCode };
};

const copyTranscripts = (root: string, sessionId: string, dir: string) => {
  const found = findTranscripts(root, sessionId);
  const target = join(dir, "transcripts");
  mkdirSync(join(target, "subagents"), { recursive: true });
  if (found.main !== undefined) copyFileSync(found.main, join(target, "main.jsonl"));
  for (const path of found.subagents) copyFileSync(path, join(target, "subagents", basename(path)));
};

const readLines = (path: string): unknown[] =>
  existsSync(path)
    ? readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .flatMap((line) => {
          try {
            return [JSON.parse(line)];
          } catch {
            return [];
          }
        })
    : [];

const readText = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, "utf8") : undefined;

// A case folder without run.json is a run that never finished: bench was stopped during it.
const recordOf = (dir: string): RunRecord => {
  const path = join(dir, "run.json");
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8")) as RunRecord;
  const [caseId = "S1", arm = "auq", run = "0"] = basename(dir).split("-");
  return {
    caseId: caseId as CaseId,
    arm: arm as Arm,
    run: Number(run),
    sessionId: "",
    timedOut: false,
    interrupted: true,
    exitCode: null,
  };
};

/** Measures one run from what its folder keeps. */
const measureCase = (dir: string): RunMeasure => {
  const record = recordOf(dir);
  const main = readText(join(dir, "transcripts", "main.jsonl"));
  const subDir = join(dir, "transcripts", "subagents");
  const subagents = existsSync(subDir)
    ? readdirSync(subDir)
        .sort()
        .map((name) => parseTranscript(readFileSync(join(subDir, name), "utf8")))
    : [];
  return measureRun({
    caseId: record.caseId,
    arm: record.arm,
    run: record.run,
    main: main === undefined ? undefined : parseTranscript(main),
    subagents,
    records: readLines(join(dir, "answerer.jsonl")),
    init: parseInit(readText(join(dir, "stream.jsonl")) ?? ""),
    timedOut: record.timedOut,
    interrupted: record.interrupted === true,
    exitCode: record.exitCode,
  });
};

const runCase = async (
  run: Omit<CaseRun, "project" | "sessionId">,
  runId: string,
  options: RunOptions,
  signal: AbortSignal,
): Promise<RunMeasure> => {
  const { settings, dir } = run;
  mkdirSync(dir, { recursive: true });
  const project = mkdtempSync(
    join(tmpdir(), `askboard-bench-${runId}-${run.caseId}-${run.arm}-${run.run}-`),
  );
  const sessionId = randomUUID();
  const prompt = promptFor(CASES[run.caseId], run.arm);
  const launch = buildLaunch({ ...run, project, sessionId }, prompt, options.env);
  for (const file of launch.files) {
    writeFileSync(file.path, file.content);
    if (file.mode !== undefined) chmodSync(file.path, file.mode);
  }
  writeFileSync(join(dir, "prompt.txt"), prompt);
  writeJson(join(dir, "command.json"), {
    command: launch.command,
    args: launch.args.map((arg) => (arg === prompt ? "<prompt.txt>" : arg)),
    envNames: launch.envNames,
    cwd: launch.cwd,
  });
  const outcome = await execute(
    launch,
    dir,
    settings.timeoutSeconds * 1_000,
    options.killGraceMs ?? KILL_GRACE_MS,
    signal,
  );
  writeJson(join(dir, "run.json"), {
    caseId: run.caseId,
    arm: run.arm,
    run: run.run,
    sessionId,
    ...outcome,
  });
  copyTranscripts(projectsRoot(options.env, options.home), sessionId, dir);
  // Redacted at once, so that a benchmark stopped later leaves no token behind.
  redactTree(dir);
  if (!settings.keepProjects) rmSync(project, { recursive: true, force: true });
  const measure = measureCase(dir);
  writeJson(join(dir, "measure.json"), measure);
  return measure;
};

const writeReport = (runDir: string, report: Report) => {
  writeJson(join(runDir, "report.json"), report);
  writeFileSync(join(runDir, "report.md"), renderMarkdown(report));
};

export type RunOutcome = {
  readonly runDir: string;
  readonly report: Report;
  /** The benchmark was stopped: the report covers the runs that ended. */
  readonly interrupted: boolean;
};

export const runBenchmark = async (
  settings: RunSettings,
  options: RunOptions,
): Promise<RunOutcome> => {
  const pluginDir = pluginDirOf(settings.session, settings.pluginDir);
  if (settings.arms.includes("askboard")) preflightPlugin(settings.session, pluginDir);
  const claudeVersion = await preflightVersion(settings, {
    ...cleanEnv(options.env),
    DISABLE_AUTOUPDATER: "1",
  });
  const runId = runIdOf(new Date());
  const benchDir = resolve(options.cwd, settings.out);
  const runDir = join(benchDir, runId);
  mkdirSync(runDir, { recursive: true });
  if (!existsSync(join(benchDir, ".gitignore"))) writeFileSync(join(benchDir, ".gitignore"), "*\n");
  const context: ReportContext = {
    runId,
    settings,
    claudeVersion,
    pluginDir,
    platform: `${process.platform}-${process.arch}`,
  };
  writeJson(join(runDir, "settings.json"), context);
  const plan = settings.cases.flatMap((caseId) =>
    CASES[caseId].arms
      .filter((arm) => settings.arms.includes(arm))
      .flatMap((arm) =>
        Array.from({ length: settings.runs }, (_, index) => ({ caseId, arm, run: index + 1 })),
      ),
  );
  const stop = new AbortController();
  const onStop = () => stop.abort();
  if (options.signal?.aborted) stop.abort();
  options.signal?.addEventListener("abort", onStop, { once: true });
  process.on("SIGINT", onStop);
  process.on("SIGTERM", onStop);
  const measures: RunMeasure[] = [];
  try {
    for (const { caseId, arm, run } of plan) {
      if (stop.signal.aborted) break;
      const dir = join(runDir, "cases", `${caseId}-${arm}-${run}`);
      options.log(`${caseId} ${arm} run ${run} of ${settings.runs}`);
      const measure = await runCase(
        { caseId, arm, run, dir, pluginDir, settings },
        runId,
        options,
        stop.signal,
      );
      options.log(`  ${measure.valid ? "valid" : `invalid: ${measure.reason}`}`);
      measures.push(measure);
    }
  } finally {
    process.off("SIGINT", onStop);
    process.off("SIGTERM", onStop);
    options.signal?.removeEventListener("abort", onStop);
  }
  const report = buildReport(measures, context);
  writeReport(runDir, report);
  redactTree(runDir);
  if (stop.signal.aborted) options.log("interrupted: the report covers the runs that ended");
  options.log(`report: ${join(runDir, "report.md")}`);
  return { runDir, report, interrupted: stop.signal.aborted };
};

/** Measures a finished run again from its folder and rewrites its reports. */
export const rebuildReport = (runDir: string): Report => {
  const context = JSON.parse(readFileSync(join(runDir, "settings.json"), "utf8")) as ReportContext;
  const casesDir = join(runDir, "cases");
  const measures = readdirSync(casesDir)
    .sort()
    .map((name) => measureCase(join(casesDir, name)));
  const order = (measure: RunMeasure) =>
    `${context.settings.cases.indexOf(measure.caseId)}-${ARMS.indexOf(measure.arm)}-${String(measure.run).padStart(4, "0")}`;
  const report = buildReport(
    [...measures].sort((a, b) => order(a).localeCompare(order(b))),
    context,
  );
  writeReport(runDir, report);
  redactTree(runDir);
  return report;
};
