import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { type Io, main, processIo } from "../src/cli.ts";
import { smoke } from "../src/smoke.ts";
import { childrenOf, childrenSince, isRunning, useDecoys } from "./support/processes.ts";
import { useScratch } from "./support/scratch.ts";

const scratch = useScratch();
const decoy = useDecoys();

const FAKE_CLAUDE = join(import.meta.dir, "fake-claude.sh");
const STUB_SERVER = join(import.meta.dir, "stub", "server.ts");

const io = (root: string) => {
  const out: string[] = [];
  const err: string[] = [];
  const env = { PATH: process.env.PATH, HOME: root, CLAUDE_CONFIG_DIR: join(root, "config") };
  const value: Io = {
    out: (text) => out.push(text),
    err: (text) => err.push(text),
    cwd: root,
    env,
    home: root,
  };
  return { io: value, out, err };
};

describe("the command line", () => {
  test("help and a usage error", async () => {
    const root = scratch("bench-cli-");
    const help = io(root);
    expect(await main([], help.io)).toBe(0);
    expect(help.out.join("\n")).toContain("Usage:");
    const wrong = io(root);
    expect(await main(["run", "--runs", "0"], wrong.io)).toBe(2);
    expect(wrong.err.join("\n")).toContain("--runs must be a whole number of at least 1");
    expect(wrong.err.join("\n")).toContain("Usage:");
  });

  test("smoke on the stub: the scripted answer comes back and nothing is left running", async () => {
    const root = scratch("bench-cli-");
    const { io: value, out } = io(root);
    decoy([process.execPath, STUB_SERVER]);
    const leftRunning = childrenSince(STUB_SERVER);
    expect(await main(["smoke", "--session", "stub"], value)).toBe(0);
    const text = out.join("\n");
    expect(text).toContain("answer: PostgreSQL");
    expect(text).toMatch(/board shown \d+ ms after the answerer started/);
    expect(text).not.toMatch(/t=[A-Za-z0-9_-]{16,}/);
    expect(leftRunning()).toEqual([]);
  }, 30_000);

  test("smoke on a plugin that cannot start says why", async () => {
    const root = scratch("bench-cli-");
    const { io: value, err } = io(root);
    expect(await main(["smoke", "--session", "e1", "--plugin-dir", root], value)).toBe(1);
    expect(err.join("\n")).toContain("no plugin manifest");
  });

  test("run, then report on its folder", async () => {
    const root = scratch("bench-cli-");
    const { io: value, out } = io(root);
    const argv = [
      "run",
      "--session",
      "stub",
      "--runs",
      "1",
      "--cases",
      "S1",
      "--claude",
      FAKE_CLAUDE,
    ];
    expect(await main(argv, value)).toBe(0);
    const bench = join(root, ".askboard", "bench");
    const [runId] = readdirSync(bench).filter((name) => name !== ".gitignore");
    const runDir = join(bench, runId ?? "");
    expect(out.join("\n")).toContain(join(runDir, "report.md"));
    expect(out.join("\n")).toMatch(/S1-cold K1: AskBoard \d+ against AskUserQuestion \d+/);
    const before = readFileSync(join(runDir, "report.md"), "utf8");
    const again = io(root);
    expect(await main(["report", runDir], again.io)).toBe(0);
    expect(readFileSync(join(runDir, "report.md"), "utf8")).toBe(before);
    expect(again.out.join("\n")).toContain("report.md");
  }, 30_000);

  test("report on a folder that is no run, and a run whose claude is missing", async () => {
    const root = scratch("bench-cli-");
    const report = io(root);
    expect(await main(["report", root], report.io)).toBe(1);
    expect(report.err.join("\n")).toContain("not a benchmark run folder");
    const run = io(root);
    expect(await main(["run", "--arms", "auq", "--claude", join(root, "missing")], run.io)).toBe(1);
    expect(run.err.join("\n")).toContain("cannot run");
  });
});

describe("the smoke check's failures", () => {
  const fakePlugin = (mode: string) => {
    const dir = scratch("bench-fake-plugin-");
    mkdirSync(join(dir, ".claude-plugin"));
    const server = {
      command: process.execPath,
      args: [join(import.meta.dir, "support", "fake-session.ts"), "--mode", mode],
    };
    writeFileSync(
      join(dir, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "askboard", mcpServers: { askboard: server } }),
    );
    return dir;
  };
  const run = async (mode: string) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await smoke({
      session: "stub",
      pluginDir: fakePlugin(mode),
      env: { PATH: process.env.PATH },
      out: (text) => out.push(text),
      err: (text) => err.push(text),
      waitMs: 300,
    });
    return { code, out: out.join("\n"), err: err.join("\n") };
  };

  test("a session process that cannot start", async () => {
    const dir = scratch("bench-fake-plugin-");
    mkdirSync(join(dir, ".claude-plugin"));
    const server = { command: join(dir, "missing-server"), args: [] };
    writeFileSync(
      join(dir, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "askboard", mcpServers: { askboard: server } }),
    );
    const err: string[] = [];
    const code = await smoke({
      session: "stub",
      pluginDir: dir,
      env: { PATH: process.env.PATH },
      out: () => undefined,
      err: (text) => err.push(text),
    });
    expect(code).toBe(1);
    expect(err.join("\n")).toContain("cannot start the session process: cannot start");
  });

  test("an ask that fails", async () => {
    expect(await run("error")).toMatchObject({
      code: 1,
      err: "ask failed: items: expected one question",
    });
  });

  test("a collect that never returns", async () => {
    expect(await run("hang")).toMatchObject({ code: 1, err: "no answer came back within 0.3 s" });
  });

  test("a board the session process never opens", async () => {
    const result = await run("empty");
    expect(result.code).toBe(1);
    expect(result.out).toContain("answer: none");
    expect(result.err).toBe("the answerer did not see the board: no record");
  }, 15_000);
});

describe("stopping a run", () => {
  test("SIGINT to bench stops claude's group, writes the report and exits 130", async () => {
    const root = scratch("bench-cli-");
    const hang = join(root, "hang.sh");
    writeFileSync(
      hang,
      '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "2.1.314 (Claude Code)"; exit 0; fi\nexec sleep 6124\n',
    );
    chmodSync(hang, 0o755);
    const out = join(root, "out");
    decoy(["sleep", "6124"]);
    const child = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "cli.ts"),
        "run",
        "--session",
        "stub",
        "--cases",
        "S1",
        "--arms",
        "auq",
        "--runs",
        "2",
        "--claude",
        hang,
        "--out",
        out,
      ],
      {
        cwd: root,
        env: { PATH: process.env.PATH ?? "", HOME: root },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    // bench's claude is its child; once bench has exited, a claude left running is no one's.
    let claude: number[] = [];
    for (let waited = 0; waited < 10_000 && claude.length === 0; waited += 50) {
      await Bun.sleep(50);
      claude = childrenOf(child.pid, "sleep 6124");
    }
    child.kill("SIGINT");
    expect(await child.exited).toBe(130);
    const printed = await new Response(child.stdout).text();
    expect(printed).toContain("interrupted");
    expect(claude).toHaveLength(1);
    expect(claude.filter(isRunning)).toEqual([]);
    const [runId] = readdirSync(out).filter((name) => name !== ".gitignore");
    expect(JSON.parse(readFileSync(join(out, runId ?? "", "report.json"), "utf8")).invalid).toEqual(
      [{ caseId: "S1", arm: "auq", run: 1, reason: "interrupted" }],
    );
  }, 30_000);
});

describe("processIo", () => {
  test("writes lines to the given streams", () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const value = processIo(stdout, stderr);
    value.out("one");
    value.err("two");
    expect(String(stdout.read())).toBe("one\n");
    expect(String(stderr.read())).toBe("two\n");
    expect(value.cwd).toBe(process.cwd());
  });
});
