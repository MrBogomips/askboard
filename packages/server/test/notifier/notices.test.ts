import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NOTICE_TEXT_MAX_CHARS } from "@askboard/contract";
import type { Notice } from "@askboard/core";
import {
  createNotices,
  type NoticeProcess,
  type NoticeSpawn,
  noticeText,
  OSASCRIPT_SCRIPT,
} from "../../src/notifier/index.ts";

// Board-host spec, System notification and Notifier commands (task 5.1, design decision 9): the
// notification's text, and the notifier started with an argument vector, never through a shell,
// whose script is AskBoard's constant text; with `spawn` faked, then for real with recorder
// scripts on `PATH`.

const LINK = "http://127.0.0.1:47213/b/order-db-choice-x7k2?t=pV3xK9qLmT2wR7nB4cYh8A";
// What AppleScript or a shell would run, were either to parse the title as code.
const HOSTILE = `Pick "one" \\ do shell script "touch /tmp/askboard-pwned" -- '$(id)'`;

const subagent: Notice = {
  askId: "order-db-choice",
  title: "Which database for orders?",
  link: LINK,
  questions: 1,
  agentName: "Retry review",
  origin: {
    label: "Subagent code-reviewer",
    cwd: "/work/shop-retry",
    root: "/work/shop-retry",
    branch: "fix/retry",
    worktree: "shop-retry",
  },
};

describe("the notification's text", () => {
  test("names who asked, the project, branch and worktree, and the question count", () => {
    expect(noticeText(subagent, "shop")).toEqual({
      title: "Which database for orders?",
      body: "Subagent code-reviewer · Retry review · shop · fix/retry · shop-retry · 1 question",
    });
  });

  test("leaves out the pieces the notice lacks, and counts questions in the plural", () => {
    const main: Notice = {
      askId: "a",
      title: "Two things",
      link: LINK,
      questions: 2,
      origin: { label: "Main agent", cwd: "/work/shop", root: "/work/shop" },
    };
    expect(noticeText(main, "shop").body).toBe("Main agent · shop · 2 questions");
    const unchecked: Notice = { askId: "a", title: "t", link: LINK, questions: 3 };
    expect(noticeText(unchecked, "shop").body).toBe("shop · 3 questions");
    const named: Notice = { ...unchecked, agentName: "Planner" };
    expect(noticeText(named, "shop").body).toBe("Planner · shop · 3 questions");
  });

  test("adds the ordinal of a second subagent of one type to its label", () => {
    const second: Notice = {
      ...subagent,
      agentName: undefined as never,
      origin: { ...(subagent.origin as NonNullable<Notice["origin"]>), ordinal: 2 },
    };
    const { agentName: _, ...withoutName } = second;
    expect(noticeText(withoutName, "shop").body).toBe(
      "Subagent code-reviewer #2 · shop · fix/retry · shop-retry · 1 question",
    );
  });

  // Each piece is the contract's agentTextPiece, whose own tests hold its rules; here, that the
  // title and every piece of the body go through it.
  test("cuts each piece to the contract's limit, ending in an ellipsis", () => {
    const long = "x".repeat(NOTICE_TEXT_MAX_CHARS + 50);
    const text = noticeText({ ...subagent, title: long, agentName: long }, long);
    expect(text.title).toBe(`${"x".repeat(NOTICE_TEXT_MAX_CHARS - 1)}…`);
    for (const piece of text.body.split(" · ")) {
      expect(Array.from(piece).length).toBeLessThanOrEqual(NOTICE_TEXT_MAX_CHARS);
    }
  });

  test("shows bidirectional control characters as visible escapes", () => {
    const text = noticeText(
      {
        ...subagent,
        title: "a‮b",
        origin: { ...(subagent.origin as object), branch: "fix/‮yrter" },
      } as Notice,
      "shop",
    );
    expect(text.title).toBe("a\\u202Eb");
    expect(text.body).toContain("fix/\\u202Eyrter");
    expect(text.body).not.toContain("‮");
  });

  test("shows a NUL and other controls as escapes, which no argument may hold", () => {
    const text = noticeText({ ...subagent, title: "a\u0000b\nc" }, "shop");
    expect(text.title).toBe("a\\u0000b\\u000Ac");
  });
});

type Spawned = {
  readonly command: string;
  readonly args: readonly string[];
  readonly stdout: "pipe" | "ignore";
  readonly process: FakeProcess;
};

type FakeProcess = NoticeProcess & {
  emitLine(line: string): void;
  emitError(error: Error): void;
  emitExit(code: number | null): void;
  /** Its output ended after it exited. */
  emitClose(): void;
  killed: boolean;
};

const fakeProcess = (): FakeProcess => {
  const lines: ((line: string) => void)[] = [];
  const errors: ((error: Error) => void)[] = [];
  const exits: ((code: number | null) => void)[] = [];
  const closes: (() => void)[] = [];
  const process: FakeProcess = {
    killed: false,
    onLine: (listener) => lines.push(listener),
    onError: (listener) => errors.push(listener),
    onExit: (listener) => exits.push(listener),
    onClose: (listener) => closes.push(listener),
    kill: () => {
      process.killed = true;
    },
    emitLine: (line) => {
      for (const listener of lines) listener(line);
    },
    emitError: (error) => {
      for (const listener of errors) listener(error);
    },
    emitExit: (code) => {
      for (const listener of exits) listener(code);
    },
    emitClose: () => {
      for (const listener of closes) listener();
    },
  };
  return process;
};

const HELP_WITH_ACTIONS = [
  "Usage:",
  "  notify-send [OPTION…] <SUMMARY> [BODY] - create a notification",
  "  -w, --wait                        Wait for the notification to be closed before exiting.",
  "  -A, --action=[NAME=]Text...       Specifies the actions to display to the user.",
];
const HELP_WITHOUT_ACTIONS = [
  "Usage:",
  "  notify-send [OPTION...] <SUMMARY> [BODY] - create a notification",
  "  -a, --app-name=APP_NAME           Specifies the app name for the icon",
];

type FakeSpawnOptions = {
  help?: readonly string[];
  fail?: "throws" | "error";
  /** The help exits before its output arrives, as a child that writes it after its parent's exit. */
  exitFirst?: boolean;
};

// A fake `spawn` that answers `notify-send --help` with `help` and records every other start.
const fakeSpawn = (options: FakeSpawnOptions = {}) => {
  const spawned: Spawned[] = [];
  const helps: number[] = [];
  const spawn: NoticeSpawn = (command, args, { stdout }) => {
    if (options.fail === "throws") throw Object.assign(new Error("spawn"), { code: "EACCES" });
    const process = fakeProcess();
    if (args[0] === "--help") {
      helps.push(1);
      queueMicrotask(() => {
        if (options.exitFirst) process.emitExit(0);
        for (const line of options.help ?? HELP_WITH_ACTIONS) process.emitLine(line);
        if (!options.exitFirst) process.emitExit(0);
        process.emitClose();
      });
      return process;
    }
    spawned.push({ command, args, stdout, process });
    if (options.fail === "error") {
      queueMicrotask(() =>
        process.emitError(Object.assign(new Error("spawn x ENOENT"), { code: "ENOENT" })),
      );
    }
    return process;
  };
  return { spawn, spawned, helps };
};

const until = async (check: () => boolean, what: string, tries = 500): Promise<void> => {
  for (let tried = 0; tried < tries; tried += 1) {
    if (check()) return;
    await Bun.sleep(1);
  }
  throw new Error(`timed out waiting for ${what}`);
};

const settle = () => Bun.sleep(5);

type Setup = FakeSpawnOptions & {
  platform: string;
  env?: Readonly<Record<string, string>>;
  onPath?: readonly string[];
};

const setUp = ({ platform, env = {}, onPath = [], ...spawnOptions }: Setup) => {
  const fake = fakeSpawn(spawnOptions);
  const opened: string[] = [];
  const reported: unknown[] = [];
  const diagnosed: string[] = [];
  const notices = createNotices({
    platform,
    env,
    project: "shop",
    open: (link) => opened.push(link),
    report: (error) => reported.push(error),
    diagnose: (text) => diagnosed.push(text),
    onPath: (command) => onPath.includes(command),
    spawn: fake.spawn,
  });
  return { ...fake, notices, opened, reported, diagnosed };
};

const MAC_SCRIPT = [
  "-e",
  "on run argv",
  "-e",
  "display notification (item 3 of argv) with title (item 2 of argv)",
  "-e",
  "end run",
];

describe("on macOS", () => {
  test("osascript runs AskBoard's constant script, then AskBoard, the title and the body", async () => {
    const run = setUp({ platform: "darwin", onPath: ["osascript"] });
    run.notices.notify(subagent);
    await until(() => run.spawned.length === 1, "the notification");
    expect(OSASCRIPT_SCRIPT).toEqual([
      "on run argv",
      "display notification (item 3 of argv) with title (item 2 of argv)",
      "end run",
    ]);
    expect(run.spawned[0]).toMatchObject({
      command: "osascript",
      args: [...MAC_SCRIPT, "AskBoard", subagent.title, noticeText(subagent, "shop").body],
      stdout: "ignore",
    });
    expect(run.helps).toEqual([]);
    expect(run.reported).toEqual([]);
    expect(run.diagnosed).toEqual([]);
  });

  test("a title holding quotes, a backslash and do shell script is one plain argument", async () => {
    const run = setUp({ platform: "darwin" });
    run.notices.notify({ ...subagent, title: HOSTILE });
    await until(() => run.spawned.length === 1, "the notification");
    const args = run.spawned[0]?.args ?? [];
    expect(args.slice(0, 7)).toEqual([...MAC_SCRIPT, "AskBoard"]);
    expect(args[7]).toBe(HOSTILE);
    expect(args).toHaveLength(9);
  });

  test("a title starting with - follows AskBoard, so osascript reads no option from it", async () => {
    const run = setUp({ platform: "darwin" });
    run.notices.notify({ ...subagent, title: "-e do shell script" });
    await until(() => run.spawned.length === 1, "the notification");
    const args = run.spawned[0]?.args ?? [];
    expect(args[6]).toBe("AskBoard");
    expect(args[7]).toBe("-e do shell script");
  });

  test("a notification's exit is quiet; a failure to start writes one diagnostic", async () => {
    for (const fail of ["throws", "error"] as const) {
      const run = setUp({ platform: "darwin", fail });
      expect(() => run.notices.notify(subagent)).not.toThrow();
      await until(() => run.reported.length === 1, "the report");
      await settle();
      expect(run.reported).toHaveLength(1);
    }
    const run = setUp({ platform: "darwin" });
    run.notices.notify(subagent);
    await until(() => run.spawned.length === 1, "the notification");
    run.spawned[0]?.process.emitExit(0);
    expect(run.reported).toEqual([]);
    run.notices.notify(subagent);
    await until(() => run.spawned.length === 2, "the second notification");
    run.spawned[1]?.process.emitExit(1);
    expect(run.reported).toHaveLength(1);
  });
});

describe("on Linux", () => {
  const linux = { platform: "linux", onPath: ["notify-send"] } as const;

  test("notify-send offers the default action and waits when its help lists --action", async () => {
    const run = setUp(linux);
    run.notices.notify(subagent);
    await until(() => run.spawned.length === 1, "the notification");
    const { body } = noticeText(subagent, "shop");
    expect(run.spawned[0]).toMatchObject({
      command: "notify-send",
      args: ["--app-name=AskBoard", "--action=default=Open", "--wait", "--", subagent.title, body],
      stdout: "pipe",
    });
  });

  test("the default action opens the board with the link, once", async () => {
    const run = setUp(linux);
    run.notices.notify(subagent);
    await until(() => run.spawned.length === 1, "the notification");
    const process = run.spawned[0]?.process;
    process?.emitLine("other");
    expect(run.opened).toEqual([]);
    process?.emitLine("default");
    process?.emitLine("default");
    expect(run.opened).toEqual([LINK]);
    process?.emitExit(0);
    expect(run.reported).toEqual([]);
  });

  test("without --action in its help, notify-send runs without the action and the wait", async () => {
    const run = setUp({ ...linux, help: HELP_WITHOUT_ACTIONS });
    run.notices.notify(subagent);
    await until(() => run.spawned.length === 1, "the notification");
    expect(run.spawned[0]).toMatchObject({
      args: ["--app-name=AskBoard", "--", subagent.title, noticeText(subagent, "shop").body],
      stdout: "ignore",
    });
  });

  // Task 13.7: the exit can come before the output, so the help is read until its output ends.
  test("its help is read to the end of its output, though the help exits first", async () => {
    const run = setUp({ ...linux, exitFirst: true });
    run.notices.notify(subagent);
    await until(() => run.spawned.length === 1, "the notification");
    expect(run.spawned[0]?.args.slice(0, 3)).toEqual([
      "--app-name=AskBoard",
      "--action=default=Open",
      "--wait",
    ]);
  });

  test("its help is read once for the session", async () => {
    const run = setUp(linux);
    run.notices.notify(subagent);
    run.notices.notify({ ...subagent, askId: "second" });
    await until(() => run.spawned.length === 2, "two notifications");
    run.notices.notify({ ...subagent, askId: "third" });
    await until(() => run.spawned.length === 3, "a third notification");
    expect(run.helps).toEqual([1]);
  });

  test("a title starting with - comes after --", async () => {
    const run = setUp(linux);
    run.notices.notify({ ...subagent, title: "--action=x=y" });
    await until(() => run.spawned.length === 1, "the notification");
    const args = run.spawned[0]?.args ?? [];
    expect(args.indexOf("--")).toBe(3);
    expect(args[4]).toBe("--action=x=y");
  });

  test("the body's markup characters show as text", async () => {
    const run = setUp(linux);
    const notice = { ...subagent, agentName: `<a href="https://x.example">R&D</a>` };
    run.notices.notify(notice);
    await until(() => run.spawned.length === 1, "the notification");
    const body = run.spawned[0]?.args.at(-1) ?? "";
    expect(body).toContain('&lt;a href="https://x.example"&gt;R&amp;D&lt;/a&gt;');
    expect(body).not.toContain("<");
  });

  test("without notify-send on PATH, nothing runs and one diagnostic is written", async () => {
    const run = setUp({ platform: "linux" });
    expect(() => run.notices.notify(subagent)).not.toThrow();
    run.notices.notify({ ...subagent, askId: "second" });
    await until(() => run.diagnosed.length === 1, "the diagnostic");
    await settle();
    expect(run.diagnosed).toHaveLength(1);
    expect(run.diagnosed[0]).toContain("notify-send");
    expect(run.spawned).toEqual([]);
    expect(run.helps).toEqual([]);
  });

  test("under WSL no notification runs, and nothing is written", async () => {
    const envs: Readonly<Record<string, string>>[] = [
      { WSL_DISTRO_NAME: "Ubuntu" },
      { WSL_INTEROP: "/run/WSL/1_interop" },
    ];
    for (const env of envs) {
      const run = setUp({ ...linux, env });
      run.notices.notify(subagent);
      await settle();
      expect(run.spawned).toEqual([]);
      expect(run.helps).toEqual([]);
      expect(run.diagnosed).toEqual([]);
      expect(run.reported).toEqual([]);
    }
  });

  test("on another platform no notification runs", async () => {
    const run = setUp({ platform: "win32" });
    run.notices.notify(subagent);
    await settle();
    expect(run.spawned).toEqual([]);
    expect(run.reported).toEqual([]);
  });
});

// Task 13.7: a notifier that is there but fails would otherwise report on every ask.
describe("a notifier that fails", () => {
  test("is reported once, and no later ask starts it", async () => {
    const run = setUp({ platform: "darwin" });
    run.notices.notify(subagent);
    await until(() => run.spawned.length === 1, "the notification");
    run.spawned[0]?.process.emitExit(1);
    expect(run.reported).toHaveLength(1);
    run.notices.notify({ ...subagent, askId: "second" });
    run.notices.notify({ ...subagent, askId: "third" });
    await settle();
    expect(run.spawned).toHaveLength(1);
    expect(run.reported).toHaveLength(1);
  });

  test("one that cannot start is reported once for the session", async () => {
    for (const fail of ["throws", "error"] as const) {
      const run = setUp({ platform: "darwin", fail });
      run.notices.notify(subagent);
      await until(() => run.reported.length === 1, "the report");
      run.notices.notify({ ...subagent, askId: "second" });
      run.notices.notify({ ...subagent, askId: "third" });
      await settle();
      expect(run.reported).toHaveLength(1);
      expect(run.spawned.length).toBeLessThanOrEqual(1);
    }
  });

  test("two failing together are reported once", async () => {
    const run = setUp({ platform: "linux", onPath: ["notify-send"] });
    run.notices.notify(subagent);
    run.notices.notify({ ...subagent, askId: "second" });
    await until(() => run.spawned.length === 2, "two notifications");
    run.spawned[0]?.process.emitExit(1);
    run.spawned[1]?.process.emitError(new Error("notify-send died"));
    expect(run.reported).toHaveLength(1);
  });
});

describe("at exit", () => {
  test("the notifier's children still running are killed, and none starts after", async () => {
    const run = setUp({ platform: "linux", onPath: ["notify-send"] });
    run.notices.notify(subagent);
    run.notices.notify({ ...subagent, askId: "second" });
    await until(() => run.spawned.length === 2, "two notifications");
    run.spawned[1]?.process.emitExit(0);
    run.notices.close();
    expect(run.spawned.map(({ process }) => process.killed)).toEqual([true, false]);
    run.notices.notify({ ...subagent, askId: "third" });
    await settle();
    expect(run.spawned).toHaveLength(2);
  });

  test("a help run still going is killed too", async () => {
    let help: FakeProcess | undefined;
    const notices = createNotices({
      platform: "linux",
      env: {},
      project: "shop",
      open: () => undefined,
      report: () => undefined,
      diagnose: () => undefined,
      onPath: () => true,
      spawn: () => {
        help = fakeProcess();
        return help;
      },
    });
    notices.notify(subagent);
    await until(() => help !== undefined, "the help run");
    notices.close();
    expect(help?.killed).toBe(true);
  });

  test("a help run that never ends is given up after its bound, as without --action", async () => {
    const started: { args: readonly string[]; process: FakeProcess }[] = [];
    const notices = createNotices({
      platform: "linux",
      env: {},
      project: "shop",
      open: () => undefined,
      report: () => undefined,
      diagnose: () => undefined,
      onPath: () => true,
      helpTimeoutMs: 10,
      spawn: (_command, args) => {
        const process = fakeProcess();
        started.push({ args, process });
        return process;
      },
    });
    notices.notify(subagent);
    await until(() => started.length === 2, "the notification after the help's bound");
    expect(started[0]?.process.killed).toBe(true);
    expect(started[1]?.args.slice(0, 2)).toEqual(["--app-name=AskBoard", "--"]);
    notices.close();
  });
});

const folder = mkdtempSync(join(tmpdir(), "askboard-notices-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

// A recorder named `command` in its own folder: it writes its arguments, one per line after their
// count, and answers `--help` with `help`; with `print`, it prints that line and keeps running.
// With `lateHelp`, a child it leaves behind prints the help after it exited, with no final newline.
const recorderOnPath = (command: string, help: string, print?: string, lateHelp = false) => {
  const bin = mkdtempSync(join(folder, "bin-"));
  const record = join(bin, "argv.txt");
  const answerHelp = lateHelp
    ? `(sleep 0.2; printf '%s' '${help}') & exit 0`
    : `printf '%s\\n' '${help}'; exit 0`;
  writeFileSync(
    join(bin, command),
    [
      "#!/bin/sh",
      `if [ "$1" = "--help" ]; then ${answerHelp}; fi`,
      `printf '%s\\n' "$#" "$@" > '${record}.part'`,
      `mv '${record}.part' '${record}'`,
      ...(print === undefined ? [] : [`printf '%s\\n' '${print}'`, "exec sleep 30"]),
    ].join("\n"),
  );
  chmodSync(join(bin, command), 0o755);
  return { record, env: { PATH: `${bin}:${process.env.PATH ?? ""}` } };
};

const waitForRecord = async (record: string): Promise<string> => {
  await until(() => existsSync(record), "the recorder");
  return readFileSync(record, "utf8");
};

describe("a real run", () => {
  test("osascript, as found on PATH, receives each argument unchanged", async () => {
    const { record, env } = recorderOnPath("osascript", "");
    const reported: unknown[] = [];
    const notices = createNotices({
      platform: "darwin",
      env,
      project: "shop",
      open: () => undefined,
      report: (error) => reported.push(error),
      diagnose: () => undefined,
    });
    notices.notify({ ...subagent, title: HOSTILE });
    const args = [...MAC_SCRIPT, "AskBoard", HOSTILE, noticeText(subagent, "shop").body];
    expect(await waitForRecord(record)).toBe(`${args.length}\n${args.join("\n")}\n`);
    expect(existsSync("/tmp/askboard-pwned")).toBe(false);
    await settle();
    expect(reported).toEqual([]);
    notices.close();
  });

  test("notify-send's default action opens the board; the waiting child is killed at exit", async () => {
    const help = "  -A, --action=[NAME=]Text...       Specifies the actions";
    const { record, env } = recorderOnPath("notify-send", help, "default");
    const opened: string[] = [];
    const notices = createNotices({
      platform: "linux",
      env,
      project: "shop",
      open: (link) => opened.push(link),
      report: () => undefined,
      diagnose: () => undefined,
    });
    notices.notify(subagent);
    const text = await waitForRecord(record);
    expect(text.split("\n").slice(1, 5)).toEqual([
      "--app-name=AskBoard",
      "--action=default=Open",
      "--wait",
      "--",
    ]);
    await until(() => opened.length === 1, "the default action");
    expect(opened).toEqual([LINK]);
    notices.close();
  });

  test("notify-send's help, printed after it exited and with no final newline, lists --action", async () => {
    const help = "  -A, --action=[NAME=]Text...       Specifies the actions";
    const { record, env } = recorderOnPath("notify-send", help, undefined, true);
    const reported: unknown[] = [];
    const notices = createNotices({
      platform: "linux",
      env,
      project: "shop",
      open: () => undefined,
      report: (error) => reported.push(error),
      diagnose: () => undefined,
    });
    notices.notify(subagent);
    await until(() => existsSync(record), "the recorder", 2_000);
    expect(readFileSync(record, "utf8").split("\n").slice(1, 4)).toEqual([
      "--app-name=AskBoard",
      "--action=default=Open",
      "--wait",
    ]);
    expect(reported).toEqual([]);
    notices.close();
  });

  test("a notifier missing from PATH writes one report and leaves the caller unaffected", async () => {
    const reported: unknown[] = [];
    const notices = createNotices({
      platform: "darwin",
      env: { PATH: join(folder, "nowhere") },
      project: "shop",
      open: () => undefined,
      report: (error) => reported.push(error),
      diagnose: () => undefined,
    });
    expect(() => notices.notify(subagent)).not.toThrow();
    await until(() => reported.length === 1, "the report");
    notices.close();
  });
});
