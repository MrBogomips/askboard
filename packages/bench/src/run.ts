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
import { type Arm, CASES, type CaseId, promptFor } from "./scenarios.ts";
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
};

type RunRecord = {
  readonly caseId: CaseId;
  readonly arm: Arm;
  readonly run: number;
  readonly sessionId: string;
  readonly timedOut: boolean;
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
): Promise<{ timedOut: boolean; exitCode: number | null }> => {
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
  let killer: ReturnType<typeof setTimeout> | undefined;
  const timer = setTimeout(() => {
    timedOut = true;
    group("SIGINT");
    killer = setTimeout(() => group("SIGKILL"), killGraceMs);
  }, timeoutMs);
  const exitCode = await Promise.race([exitOf(child), failed]);
  clearTimeout(timer);
  if (killer !== undefined) clearTimeout(killer);
  // Whatever claude left in its group, its MCP servers included, goes with it.
  group("SIGKILL");
  return { timedOut, exitCode };
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

/** Measures one run from what its folder keeps. */
const measureCase = (dir: string): RunMeasure => {
  const record = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) as RunRecord;
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
    exitCode: record.exitCode,
  });
};

const runCase = async (
  run: Omit<CaseRun, "project" | "sessionId">,
  runId: string,
  options: RunOptions,
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
  );
  writeJson(join(dir, "run.json"), {
    caseId: run.caseId,
    arm: run.arm,
    run: run.run,
    sessionId,
    ...outcome,
  });
  copyTranscripts(projectsRoot(options.env, options.home), sessionId, dir);
  if (!settings.keepProjects) rmSync(project, { recursive: true, force: true });
  const measure = measureCase(dir);
  writeJson(join(dir, "measure.json"), measure);
  return measure;
};

const writeReport = (runDir: string, report: Report) => {
  writeJson(join(runDir, "report.json"), report);
  writeFileSync(join(runDir, "report.md"), renderMarkdown(report));
};

export const runBenchmark = async (
  settings: RunSettings,
  options: RunOptions,
): Promise<{ runDir: string; report: Report }> => {
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
  const measures: RunMeasure[] = [];
  for (const caseId of settings.cases) {
    for (const arm of CASES[caseId].arms.filter((candidate) => settings.arms.includes(candidate))) {
      for (let run = 1; run <= settings.runs; run += 1) {
        const dir = join(runDir, "cases", `${caseId}-${arm}-${run}`);
        options.log(`${caseId} ${arm} run ${run} of ${settings.runs}`);
        const measure = await runCase(
          { caseId, arm, run, dir, pluginDir, settings },
          runId,
          options,
        );
        options.log(`  ${measure.valid ? "valid" : `invalid: ${measure.reason}`}`);
        measures.push(measure);
      }
    }
  }
  const report = buildReport(measures, context);
  writeReport(runDir, report);
  redactTree(runDir);
  options.log(`report: ${join(runDir, "report.md")}`);
  return { runDir, report };
};

/** Measures a finished run again from its folder and rewrites its reports. */
export const rebuildReport = (runDir: string): Report => {
  const context = JSON.parse(readFileSync(join(runDir, "settings.json"), "utf8")) as ReportContext;
  const casesDir = join(runDir, "cases");
  const measures = readdirSync(casesDir)
    .sort()
    .map((name) => measureCase(join(casesDir, name)));
  const order = (measure: RunMeasure) =>
    `${context.settings.cases.indexOf(measure.caseId)}-${measure.arm === "askboard" ? 0 : 1}-${String(measure.run).padStart(4, "0")}`;
  const report = buildReport(
    [...measures].sort((a, b) => order(a).localeCompare(order(b))),
    context,
  );
  writeReport(runDir, report);
  redactTree(runDir);
  return report;
};
