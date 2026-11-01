import { describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PreflightError } from "../src/plugin.ts";
import { rebuildReport, runBenchmark } from "../src/run.ts";
import { DEFAULTS, type RunSettings } from "../src/settings.ts";
import { childrenSince, useDecoys } from "./support/processes.ts";
import { useScratch } from "./support/scratch.ts";

const scratch = useScratch();
const decoy = useDecoys();

const FAKE_CLAUDE = join(import.meta.dir, "fake-claude.sh");

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });

const workspace = () => {
  const root = scratch("bench-run-");
  const config = join(root, "claude-config");
  const env = {
    PATH: process.env.PATH,
    HOME: root,
    CLAUDE_CONFIG_DIR: config,
    CLAUDE_CODE_SESSION_ID: "parent",
  };
  const lines: string[] = [];
  return {
    root,
    env,
    lines,
    options: { cwd: root, env, home: root, log: (line: string) => lines.push(line) },
  };
};

const settingsFor = (root: string, overrides: Partial<RunSettings> = {}): RunSettings => ({
  ...DEFAULTS,
  session: "stub",
  runs: 1,
  claude: FAKE_CLAUDE,
  out: join(root, ".askboard", "bench"),
  timeoutSeconds: 60,
  ...overrides,
});

describe("runBenchmark on the stub with the stand-in claude", () => {
  test("runs every case and arm once and writes a report with no invalid run", async () => {
    const { root, options, lines } = workspace();
    const { runDir, report } = await runBenchmark(settingsFor(root), options);
    expect(report.invalid).toEqual([]);
    expect(report.rows.map((row) => [row.row, row.arm, row.valid, row.runs])).toEqual([
      ["S1-cold", "askboard", 1, 1],
      ["S1-cold", "auq", 1, 1],
      ["S1-warm", "askboard", 1, 1],
      ["S1-warm", "auq", 1, 1],
      ["S6", "askboard", 1, 1],
    ]);
    expect(report.rows[0]?.k3?.median).toBeGreaterThanOrEqual(0);
    expect(existsSync(join(runDir, "cases", "S1-baseline-1", "transcripts", "main.jsonl"))).toBe(
      true,
    );
    expect(report.context.baseline?.n).toBe(1);
    expect(report.context.added).toBeNumber();
    expect(report.settings.claudeVersionInstalled).toBe("2.1.314");
    expect(report.cost.askboard.available).toBe(true);
    expect(existsSync(join(runDir, "report.json"))).toBe(true);
    expect(readFileSync(join(runDir, "report.md"), "utf8")).toContain("# AskBoard early benchmark");
    expect(readFileSync(join(root, ".askboard", "bench", ".gitignore"), "utf8")).toBe("*\n");
    const caseDir = join(runDir, "cases", "S1-askboard-1");
    expect(statSync(join(caseDir, "browser.sh")).mode & 0o777).toBe(0o755);
    for (const name of [
      "prompt.txt",
      "command.json",
      "run.json",
      "plan.json",
      "run-settings.json",
      "answerer.jsonl",
      "stream.jsonl",
      "stderr.txt",
      "measure.json",
      "transcripts/main.jsonl",
    ]) {
      expect({ name, exists: existsSync(join(caseDir, name)) }).toEqual({ name, exists: true });
    }
    expect(
      filesUnder(join(runDir, "cases", "S6-askboard-1", "transcripts", "subagents")),
    ).toHaveLength(1);
    const command = JSON.parse(readFileSync(join(caseDir, "command.json"), "utf8"));
    expect(command.args[1]).toBe("<prompt.txt>");
    expect(command.envNames).not.toContain("CLAUDE_CODE_SESSION_ID");
    for (const path of filesUnder(runDir)) {
      const text = readFileSync(path, "utf8");
      expect({
        path,
        link: /[?&]t=[A-Za-z0-9_-]{16,}/.test(text),
        token: /"token\\*"\s*:\s*\\*"[A-Za-z0-9_-]{16,}/.test(text),
      }).toEqual({ path, link: false, token: false });
    }
    expect(
      readdirSync(tmpdir()).filter((name) => name.startsWith(`askboard-bench-${report.runId}`)),
    ).toEqual([]);
    expect(lines.some((line) => line.includes("report.md"))).toBe(true);

    const rebuilt = rebuildReport(runDir);
    expect(rebuilt.rows).toEqual(report.rows);
    expect(rebuilt.cost).toEqual(report.cost);
  }, 60_000);
});

describe("runBenchmark's limits", () => {
  const hanging = (root: string) => {
    const path = join(root, "hang.sh");
    writeFileSync(
      path,
      '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "2.1.314 (Claude Code)"; exit 0; fi\nexec sleep 6123\n',
    );
    chmodSync(path, 0o755);
    return path;
  };

  test("a hung run is stopped at its timeout and listed as timed out", async () => {
    const { root, options } = workspace();
    const settings = settingsFor(root, {
      claude: hanging(root),
      cases: ["S1"],
      arms: ["auq"],
      timeoutSeconds: 1,
    });
    const started = Date.now();
    const { report } = await runBenchmark(settings, { ...options, killGraceMs: 300 });
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(report.invalid).toEqual([{ caseId: "S1", arm: "auq", run: 1, reason: "timed out" }]);
  }, 20_000);

  test("an interrupted benchmark stops its run, keeps a report and leaves no process", async () => {
    const { root, options } = workspace();
    decoy(["sleep", "6123"]);
    const leftRunning = childrenSince("sleep 6123");
    const settings = settingsFor(root, {
      claude: hanging(root),
      cases: ["S1"],
      arms: ["auq"],
      runs: 3,
    });
    const stop = new AbortController();
    setTimeout(() => stop.abort(), 800);
    const started = Date.now();
    const result = await runBenchmark(settings, {
      ...options,
      killGraceMs: 300,
      signal: stop.signal,
    });
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(result.interrupted).toBe(true);
    expect(result.report.invalid).toEqual([
      { caseId: "S1", arm: "auq", run: 1, reason: "interrupted" },
    ]);
    expect(existsSync(join(result.runDir, "report.md"))).toBe(true);
    expect(leftRunning()).toEqual([]);
  }, 20_000);

  test("a run folder whose case never finished is rebuilt with that case invalid", async () => {
    const { root, options } = workspace();
    const { runDir } = await runBenchmark(
      settingsFor(root, { cases: ["S1"], arms: ["auq"] }),
      options,
    );
    mkdirSync(join(runDir, "cases", "S1-auq-2"));
    const rebuilt = rebuildReport(runDir);
    expect(rebuilt.invalid).toEqual([{ caseId: "S1", arm: "auq", run: 2, reason: "interrupted" }]);
  }, 30_000);

  test("a pinned version that differs stops the run before it starts", async () => {
    const { root, options } = workspace();
    await expect(
      runBenchmark(settingsFor(root, { claudeVersion: "2.1.400" }), options),
    ).rejects.toThrow(
      new PreflightError("Claude Code 2.1.314 is installed, but 2.1.400 is pinned"),
    );
  });

  test("a claude that cannot run stops the run", async () => {
    const { root, options } = workspace();
    await expect(
      runBenchmark(settingsFor(root, { claude: join(root, "missing") }), options),
    ).rejects.toThrow(PreflightError);
  });

  test("E1's plugin without its built server stops an AskBoard run", async () => {
    const { root, options } = workspace();
    await expect(
      runBenchmark(settingsFor(root, { session: "e1", pluginDir: root }), options),
    ).rejects.toThrow(`no plugin manifest at ${join(root, ".claude-plugin", "plugin.json")}`);
  });
});
