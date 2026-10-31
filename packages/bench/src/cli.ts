// The benchmark's command line (early-benchmark design decision 12):
//   bun packages/bench/src/cli.ts run | smoke | report
// It starts Claude Code only for `run`; `smoke` and `report` run no model.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { PreflightError } from "./plugin.ts";
import type { Report } from "./report.ts";
import { rebuildReport, runBenchmark } from "./run.ts";
import { parseCommand, USAGE, UsageError } from "./settings.ts";
import { smoke } from "./smoke.ts";

export type Io = {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly home: string;
};

const summary = (report: Report): string[] => [
  ...report.targets.map(
    (target) =>
      `${target.row} ${target.kpi}: AskBoard ${target.askboard.toFixed(target.kpi === "cost" ? 2 : 0)} against AskUserQuestion ${target.auq.toFixed(target.kpi === "cost" ? 2 : 0)}, ${target.ratio.toFixed(2)}x, ${target.within ? "within" : "over"} +25%`,
  ),
  `invalid runs: ${report.invalid.length}`,
];

const execute = async (argv: readonly string[], io: Io): Promise<number> => {
  const command = parseCommand(argv);
  switch (command.kind) {
    case "help":
      io.out(USAGE);
      return 0;
    case "run": {
      const { runDir, report, interrupted } = await runBenchmark(command.settings, {
        cwd: io.cwd,
        env: io.env,
        home: io.home,
        log: io.out,
      });
      for (const line of summary(report)) io.out(line);
      io.out(`run folder: ${runDir}`);
      // 128 + SIGINT, as a shell reports a command stopped by Ctrl-C.
      return interrupted ? 130 : 0;
    }
    case "smoke":
      return smoke({
        session: command.session,
        ...(command.pluginDir === undefined ? {} : { pluginDir: command.pluginDir }),
        env: io.env,
        out: io.out,
        err: io.err,
      });
    case "report": {
      const folder = resolve(io.cwd, command.folder);
      if (!existsSync(join(folder, "settings.json")) || !existsSync(join(folder, "cases"))) {
        io.err(`${folder} is not a benchmark run folder`);
        return 1;
      }
      rebuildReport(folder);
      io.out(`report: ${join(folder, "report.md")}`);
      return 0;
    }
  }
};

/** Runs a command line; resolves the exit code: 0 done, 1 failed, 2 a usage error. */
export const main = async (argv: readonly string[], io: Io): Promise<number> => {
  try {
    return await execute(argv, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(`${error.message}\n\n${USAGE}`);
      return 2;
    }
    if (error instanceof PreflightError) {
      io.err(error.message);
      return 1;
    }
    throw error;
  }
};

/** The process's own streams and environment. */
export const processIo = (
  stdout: { write: (text: string) => unknown },
  stderr: { write: (text: string) => unknown },
): Io => ({
  out: (text) => stdout.write(`${text}\n`),
  err: (text) => stderr.write(`${text}\n`),
  cwd: process.cwd(),
  env: process.env,
  home: homedir(),
});

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2), processIo(process.stdout, process.stderr));
}
