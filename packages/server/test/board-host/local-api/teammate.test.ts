import { describe, expect, test } from "bun:test";
import type { Run } from "../../../src/board-host/local-api/origin.ts";
import {
  argvOfProc,
  argvOfPs,
  PARENT_UNCLEAR_NOTE,
  PARENT_UNREADABLE_NOTE,
  parentTeammate,
  readParentArgv,
  stopEndOf,
  teammateFromArgv,
} from "../../../src/board-host/local-api/teammate.ts";

// Telling a teammate (board-host spec; design decision 4, Origin, PO decisions of 2026-11-03; tasks
// 17.1 and 18.2): a pane teammate's own session reads its parent's `--agent-id`, `--agent-name` and
// `--team-name` once, keeping nothing else; any doubt gives no name, so the label stays "Main
// agent". An in-process teammate is named by the mod's report (records-teammates.test.ts); what its
// stop ends falls back, without a report, on the form Claude Code 2.1.317 gives a named agent's ID.

const PARENT_PID = 870;
const SETTINGS = '{"env":{"API_KEY":"sk-not-a-real-key"}}';

// The argument vector of the live pane teammate of the research, with a settings flag added.
const PANE = [
  "2.1.317",
  "--agent-id",
  "ask-log-level@session-ffc1850b",
  "--agent-name",
  "ask-log-level",
  "--team-name",
  "session-ffc1850b",
  "--agent-color",
  "blue",
  "--settings",
  SETTINGS,
  "--agent-type",
  "general-purpose",
];

describe("the flags of a parent's argument vector", () => {
  test("all three, consistent, name the teammate, and nothing else is returned", () => {
    expect(teammateFromArgv(PANE)).toEqual({ kind: "teammate", name: "ask-log-level" });
  });

  test("the --flag=value form counts as well", () => {
    const argv = [
      "claude",
      "--agent-id=scout-2@team-a",
      "--agent-name=scout-2",
      "--team-name=team-a",
    ];
    expect(teammateFromArgv(argv)).toEqual({ kind: "teammate", name: "scout-2" });
  });

  test("none of them is an ordinary session, a --agent session or a print run", () => {
    expect(teammateFromArgv(["claude"])).toEqual({ kind: "none" });
    expect(teammateFromArgv(["claude", "--agent", "code-reviewer"])).toEqual({ kind: "none" });
    expect(teammateFromArgv(["claude", "-p", "hello", "--settings", SETTINGS])).toEqual({
      kind: "none",
    });
    expect(teammateFromArgv([])).toEqual({ kind: "none" });
  });

  test("one missing, one empty or one without a value is inconsistent", () => {
    const without = (flag: string) => {
      const at = PANE.indexOf(flag);
      return [...PANE.slice(0, at), ...PANE.slice(at + 2)];
    };
    for (const flag of ["--agent-id", "--agent-name", "--team-name"]) {
      expect(teammateFromArgv(without(flag))).toEqual({ kind: "inconsistent" });
    }
    const emptyName = PANE.map((arg) => (arg === "ask-log-level" ? " " : arg));
    expect(teammateFromArgv(emptyName)).toEqual({ kind: "inconsistent" });
    expect(teammateFromArgv(["claude", "--agent-id"])).toEqual({ kind: "inconsistent" });
  });

  test("an address other than name@team is inconsistent", () => {
    const other = PANE.map((arg) => (arg === "ask-log-level@session-ffc1850b" ? "x@y" : arg));
    expect(teammateFromArgv(other)).toEqual({ kind: "inconsistent" });
    const swapped = PANE.map((arg) =>
      arg === "ask-log-level@session-ffc1850b" ? "session-ffc1850b@ask-log-level" : arg,
    );
    expect(teammateFromArgv(swapped)).toEqual({ kind: "inconsistent" });
  });

  test("a flag given twice is inconsistent, even when one pair agrees", () => {
    expect(teammateFromArgv([...PANE, "--agent-name", "other"])).toEqual({ kind: "inconsistent" });
  });

  test("an address longer than an agent ID may be is inconsistent", () => {
    const name = "n".repeat(250);
    const argv = [
      "claude",
      "--agent-id",
      `${name}@team-a`,
      "--agent-name",
      name,
      "--team-name",
      "team-a",
    ];
    expect(teammateFromArgv(argv)).toEqual({ kind: "inconsistent" });
  });
});

describe("splitting a parent's command line", () => {
  test("Linux: /proc's NUL-separated arguments, an empty one kept", () => {
    expect(argvOfProc("claude\0--agent-name\0\0--x\0")).toEqual([
      "claude",
      "--agent-name",
      "",
      "--x",
    ]);
    expect(argvOfProc("")).toEqual([]);
  });

  test("macOS: ps's text on spaces, so a name with a space cannot agree", () => {
    expect(argvOfPs(`${PANE.join(" ")}\n`)).toEqual(PANE);
    expect(argvOfPs("  claude   --x \n")).toEqual(["claude", "--x"]);
    expect(argvOfPs("\n")).toEqual([]);
    const spaced = "claude --agent-id my name@t --agent-name my name --team-name t";
    expect(teammateFromArgv(argvOfPs(spaced))).toEqual({ kind: "inconsistent" });
  });
});

describe("reading the parent's argument vector", () => {
  const env = { PATH: "/usr/bin:/bin" };

  const runOf = (answer: () => Promise<string | undefined>) => {
    const calls: Parameters<Run>[] = [];
    const run: Run = (...args) => {
      calls.push(args);
      return answer();
    };
    return { run, calls };
  };

  const noFile = async (): Promise<string> => {
    throw new Error("no file expected");
  };

  test("macOS runs ps on the parent's PID with an argument vector", async () => {
    const { run, calls } = runOf(async () => `${PANE.join(" ")}\n`);
    const argv = await readParentArgv({
      platform: "darwin",
      parentPid: PARENT_PID,
      env,
      run,
      readFile: noFile,
    });
    expect(argv).toEqual(PANE);
    expect(calls).toEqual([["ps", ["-ww", "-o", "args=", "-p", "870"], { cwd: "/", env }]]);
  });

  test("Linux and WSL read /proc/<ppid>/cmdline and run nothing", async () => {
    const { run, calls } = runOf(async () => "never");
    const read: string[] = [];
    const argv = await readParentArgv({
      platform: "linux",
      parentPid: PARENT_PID,
      env,
      run,
      readFile: async (path) => {
        read.push(path);
        return `${PANE.join("\0")}\0`;
      },
    });
    expect(argv).toEqual(PANE);
    expect(read).toEqual(["/proc/870/cmdline"]);
    expect(calls).toEqual([]);
  });

  test("ps that exits with a failure, rejects (its time bound) or prints nothing gives none", async () => {
    for (const answer of [
      async () => undefined,
      async () => {
        throw new Error("ETIMEDOUT");
      },
      async () => "\n",
    ]) {
      const { run } = runOf(answer);
      const options = { platform: "darwin", parentPid: PARENT_PID, env, run, readFile: noFile };
      expect(await readParentArgv(options)).toBeUndefined();
    }
  });

  test("the file system's reader: this process's own command line, or none without /proc", async () => {
    const { run } = runOf(async () => undefined);
    const argv = await readParentArgv({ platform: "linux", parentPid: process.pid, env, run });
    if (process.platform === "linux") expect(argv?.length).toBeGreaterThan(0);
    else expect(argv).toBeUndefined();
  });

  test("an unreadable or empty /proc entry gives none", async () => {
    const { run } = runOf(async () => undefined);
    const base = { platform: "linux", parentPid: PARENT_PID, env, run };
    expect(await readParentArgv({ ...base, readFile: noFile })).toBeUndefined();
    expect(await readParentArgv({ ...base, readFile: async () => "" })).toBeUndefined();
  });
});

describe("this session's own teammate name", () => {
  const told = async (argv: readonly string[] | undefined) => {
    const notes: string[] = [];
    const name = await parentTeammate({
      argv: Promise.resolve(argv),
      diagnose: (text) => notes.push(text),
    });
    return { name, notes };
  };

  test("a pane teammate's parent names it, with no note", async () => {
    expect(await told(PANE)).toEqual({ name: "ask-log-level", notes: [] });
  });

  test("an ordinary parent names nothing, with no note", async () => {
    expect(await told(["claude", "--settings", SETTINGS])).toEqual({ name: undefined, notes: [] });
  });

  test("an unreadable parent or inconsistent flags name nothing, with one note naming no argument", async () => {
    expect(await told(undefined)).toEqual({ name: undefined, notes: [PARENT_UNREADABLE_NOTE] });
    const mismatch = PANE.map((arg) => (arg === "session-ffc1850b" ? "session-other" : arg));
    const { name, notes } = await told(mismatch);
    expect(name).toBeUndefined();
    expect(notes).toEqual([PARENT_UNCLEAR_NOTE]);
    for (const note of [PARENT_UNREADABLE_NOTE, PARENT_UNCLEAR_NOTE]) {
      expect(note).toContain("could not tell whether this session is a teammate");
      for (const arg of PANE) expect(note).not.toContain(arg);
    }
  });

  test("a read that rejects names nothing and never rejects", async () => {
    const notes: string[] = [];
    const name = await parentTeammate({
      argv: Promise.reject(new Error("EPERM")),
      diagnose: (text) => notes.push(text),
    });
    expect(name).toBeUndefined();
    expect(notes).toEqual([PARENT_UNREADABLE_NOTE]);
  });
});

// Board-host spec, A teammate's stop is idle (task 18.2): a reported teammate's stop ends its turn,
// a reported subagent's its work; without a report, the agent ID `a<agent_type>-<hex>` errs to idle.
describe("what a stop ends", () => {
  const PROBE = "aresearcher-096d99adc3d94b0a";

  test("the mod's report decides, whatever the agent ID's form", () => {
    expect(stopEndOf("researcher", "a3f9c1d27b8e4f60", "code-reviewer")).toBe("idle");
    expect(stopEndOf(null, PROBE, "researcher")).toBe("finished");
  });

  test("without a report, a named agent's ID of its own type is idle", () => {
    expect(stopEndOf(undefined, PROBE, "researcher")).toBe("idle");
    expect(stopEndOf(undefined, "acode.reviewer-0f", "code.reviewer")).toBe("idle");
    expect(stopEndOf(undefined, "a-0f", "")).toBe("idle");
  });

  test("without a report, any other ID is finished", () => {
    for (const [agentId, agentType] of [
      ["a3f9c1d27b8e4f60", "code-reviewer"],
      [PROBE, "explorer"],
      [PROBE, undefined],
      ["aresearcher-", "researcher"],
      ["aresearcher-096D99", "researcher"],
      ["aresearcher-096d99x", "researcher"],
      ["xaresearcher-096d99", "researcher"],
      ["acodexreviewer-0f", "code.reviewer"],
      ["researcher@session-653b7577", "researcher"],
    ] as const) {
      expect(stopEndOf(undefined, agentId, agentType)).toBe("finished");
    }
  });
});
