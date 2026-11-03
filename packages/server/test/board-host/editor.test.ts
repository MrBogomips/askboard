import { describe, expect, test } from "bun:test";
import type { EditorLaunchTarget } from "@askboard/core";
import {
  EDITOR_LAUNCH_INTERVAL_MS,
  type EditorCommand,
  EditorLaunch,
  type EditorSpawn,
  editorArguments,
  type StartedEditor,
} from "../../src/board-host/editor.ts";

// The editor launch (excerpts, task 5.4; design decision 5, Editor launch; board-host spec, "The
// editor launch"): the argument vector as a table, then the launch with a fake `spawn` and clock.

const FILE = "/work/proj/docs/adr/0012-payment-retries.md";

describe("editorArguments", () => {
  const cases: readonly (readonly [string, EditorCommand, string, number, EditorCommand])[] = [
    [
      "{file} and {line} inside an argument",
      ["code", "--goto", "{file}:{line}"],
      FILE,
      7,
      ["code", "--goto", `${FILE}:7`],
    ],
    ["{line} as an option's suffix", ["vim", "+{line}", "{file}"], FILE, 12, ["vim", "+12", FILE]],
    [
      "{line} as its own argument",
      ["idea", "--line", "{line}", "{file}"],
      FILE,
      3,
      ["idea", "--line", "3", FILE],
    ],
    [
      "several occurrences",
      ["ed", "{file}#{line}", "{line}", "{file}"],
      FILE,
      2,
      ["ed", `${FILE}#2`, "2", FILE],
    ],
    ["no {file} appends the path", ["subl"], FILE, 9, ["subl", FILE]],
    [
      "no {file}, with {line}, appends the path",
      ["nano", "+{line}"],
      FILE,
      4,
      ["nano", "+4", FILE],
    ],
    [
      "nothing else expands",
      ["sh-like", "$HOME", "~", "%s", "{other}", "{FILE}", "{ file }", "{{file}}"],
      FILE,
      1,
      ["sh-like", "$HOME", "~", "%s", "{other}", "{FILE}", "{ file }", `{${FILE}}`],
    ],
    ["the program is the first element, expanded too", ["{file}"], FILE, 1, [FILE]],
  ];

  for (const [name, command, file, line, expected] of cases) {
    test(name, () => {
      expect(editorArguments(command, file, line)).toEqual(expected);
    });
  }

  test("a hostile file name is one argument, unchanged, starting with /", () => {
    const hostile = "/work/proj/docs/-rf $(touch pwned) `id`; x 'q' \"d\" {line} $1 $&.md";
    for (const command of [
      ["code", "--goto", "{file}:{line}"],
      ["vim", "{file}"],
      ["subl"],
    ] as const) {
      const argv = editorArguments(command, hostile, 5);
      const [, ...args] = argv;
      const holding = args.filter((arg) => arg.includes(hostile));
      expect(holding).toHaveLength(1);
      expect(holding[0]?.startsWith("/")).toBe(true);
      const appended = command.some((arg) => arg.includes("{file}")) ? 0 : 1;
      expect(argv).toHaveLength(command.length + appended);
    }
    expect(editorArguments(["vim", "{file}"], hostile, 5)).toEqual(["vim", hostile]);
    expect(editorArguments(["code", "--goto", "{file}:{line}"], hostile, 5)).toEqual([
      "code",
      "--goto",
      `${hostile}:5`,
    ]);
  });

  test("the command it was given is unchanged", () => {
    const command: EditorCommand = ["code", "--goto", "{file}:{line}"];
    editorArguments(command, FILE, 2);
    expect(command).toEqual(["code", "--goto", "{file}:{line}"]);
  });
});

type Launched = {
  readonly program: string;
  readonly args: readonly string[];
  readonly options: object;
};

type FakeSpawn = {
  readonly spawn: EditorSpawn;
  readonly launched: Launched[];
  readonly unrefs: () => number;
};

/** A `spawn` whose processes start, fail with `error`, or throw before starting. */
const fakeSpawn = (result: "spawn" | Error | { readonly throws: Error } = "spawn"): FakeSpawn => {
  const launched: Launched[] = [];
  let unrefs = 0;
  const spawn: EditorSpawn = (program, args, options) => {
    if (typeof result === "object" && "throws" in result) throw result.throws;
    launched.push({ program, args: [...args], options });
    const listeners: { spawn?: () => void; error?: (error: Error) => void } = {};
    const started: StartedEditor = {
      once: (_event, listener) => {
        listeners.spawn = listener;
      },
      on: (_event, listener) => {
        listeners.error = listener;
      },
      unref: () => {
        unrefs += 1;
      },
    };
    queueMicrotask(() => {
      if (result === "spawn") listeners.spawn?.();
      else listeners.error?.(result as Error);
    });
    return started;
  };
  return { spawn, launched, unrefs: () => unrefs };
};

const at = (file: string, line: number) => async (): Promise<EditorLaunchTarget> => ({
  file,
  line,
});

type LaunchOf = {
  readonly command?: EditorCommand;
  readonly spawn?: FakeSpawn;
  readonly clock?: { now: number };
};

const launchOf = (options: LaunchOf = {}) => {
  const reported: unknown[] = [];
  const spawn = options.spawn ?? fakeSpawn();
  const clock = options.clock ?? { now: 1_000 };
  const launch = new EditorLaunch({
    command: () => options.command,
    report: (error) => reported.push(error),
    spawn: spawn.spawn,
    now: () => clock.now,
  });
  return { launch, reported, spawn, clock };
};

const CODE: EditorCommand = ["code", "--goto", "{file}:{line}"];

describe("EditorLaunch", () => {
  test("opened: the vector with no shell, detached, stdio ignored, unreferenced", async () => {
    const { launch, spawn, reported } = launchOf({ command: CODE });
    expect(await launch.open("ask-1", at(FILE, 7))).toBe("opened");
    expect(spawn.launched).toEqual([
      {
        program: "code",
        args: ["--goto", `${FILE}:7`],
        options: { shell: false, detached: true, stdio: "ignore" },
      },
    ]);
    expect(spawn.unrefs()).toBe(1);
    expect(reported).toEqual([]);
  });

  test("no-editor: no command set, nothing read or started", async () => {
    let read = 0;
    const { launch, spawn } = launchOf();
    const outcome = await launch.open("ask-1", async () => {
      read += 1;
      return { file: FILE, line: 1 };
    });
    expect(outcome).toBe("no-editor");
    expect(read).toBe(0);
    expect(spawn.launched).toEqual([]);
  });

  test("the command is read at each launch", async () => {
    let command: EditorCommand | undefined;
    const spawn = fakeSpawn();
    const launch = new EditorLaunch({
      command: () => command,
      report: () => undefined,
      spawn: spawn.spawn,
      now: () => 0,
    });
    expect(await launch.open("ask-1", at(FILE, 1))).toBe("no-editor");
    command = ["vim", "+{line}", "{file}"];
    expect(await launch.open("ask-1", at(FILE, 3))).toBe("opened");
    expect(spawn.launched.map(({ program, args }) => [program, ...args])).toEqual([
      ["vim", "+3", FILE],
    ]);
  });

  test("unavailable: no target, nothing started", async () => {
    const { launch, spawn } = launchOf({ command: CODE });
    expect(await launch.open("ask-1", async () => undefined)).toBe("unavailable");
    expect(spawn.launched).toEqual([]);
  });

  test("unavailable: a target that is not an absolute path with a positive integer line", async () => {
    const targets: readonly EditorLaunchTarget[] = [
      { file: "docs/x.md", line: 1 },
      { file: "-rf", line: 1 },
      { file: "", line: 1 },
      { file: FILE, line: 0 },
      { file: FILE, line: -2 },
      { file: FILE, line: 1.5 },
      { file: FILE, line: Number.NaN },
    ];
    for (const [index, target] of targets.entries()) {
      const { launch, spawn } = launchOf({ command: CODE });
      expect(await launch.open(`ask-${index}`, async () => target)).toBe("unavailable");
      expect(spawn.launched).toEqual([]);
    }
  });

  test("busy: a second launch for the ask within a second, whatever the first's outcome", async () => {
    const { launch, spawn, clock } = launchOf({ command: CODE });
    expect(await launch.open("ask-1", at(FILE, 1))).toBe("opened");
    clock.now += EDITOR_LAUNCH_INTERVAL_MS - 1;
    expect(await launch.open("ask-1", at(FILE, 1))).toBe("busy");
    expect(await launch.open("ask-2", async () => undefined)).toBe("unavailable");
    clock.now += 1;
    expect(await launch.open("ask-1", at(FILE, 2))).toBe("opened");
    expect(await launch.open("ask-2", at(FILE, 2))).toBe("busy");
    expect(spawn.launched).toHaveLength(2);
  });

  test("busy: a click while the first launch reads its target", async () => {
    const { launch, spawn } = launchOf({ command: CODE });
    let go: (target: EditorLaunchTarget) => void = () => undefined;
    const first = launch.open("ask-1", () => new Promise((resolve) => (go = resolve)));
    expect(await launch.open("ask-1", at(FILE, 1))).toBe("busy");
    go({ file: FILE, line: 4 });
    expect(await first).toBe("opened");
    expect(spawn.launched).toHaveLength(1);
  });

  test("no-editor is never busy and starts no interval", async () => {
    let command: EditorCommand | undefined;
    const spawn = fakeSpawn();
    const launch = new EditorLaunch({
      command: () => command,
      report: () => undefined,
      spawn: spawn.spawn,
      now: () => 0,
    });
    expect(await launch.open("ask-1", at(FILE, 1))).toBe("no-editor");
    expect(await launch.open("ask-1", at(FILE, 1))).toBe("no-editor");
    command = CODE;
    expect(await launch.open("ask-1", at(FILE, 1))).toBe("opened");
  });

  // A start error carries the program and its arguments (`spawnargs`, `path`, the message): what is
  // reported holds the outcome and the error code only.
  const leaks = (reported: readonly unknown[], hostile: string) =>
    JSON.stringify(
      reported.map((error) => ({ ...(error as object), message: (error as Error).message })),
    ).includes(hostile) || reported.some((error) => String(error).includes(hostile));

  test("failed: the program could not start, reported without the vector", async () => {
    const hostile = "/work/proj/secret-name.md";
    const error = Object.assign(new Error(`spawn /opt/editor ENOENT ${hostile}`), {
      code: "ENOENT",
      path: "/opt/editor",
      spawnargs: ["--goto", hostile],
    });
    const { launch, reported, spawn } = launchOf({
      command: ["/opt/editor", "--goto", "{file}"],
      spawn: fakeSpawn(error),
    });
    expect(await launch.open("ask-1", at(hostile, 1))).toBe("failed");
    expect(spawn.unrefs()).toBe(1);
    expect(reported).toHaveLength(1);
    expect(String(reported[0])).toContain("ENOENT");
    expect(leaks(reported, hostile)).toBe(false);
    expect(leaks(reported, "/opt/editor")).toBe(false);
    expect(leaks(reported, "--goto")).toBe(false);
  });

  test("failed: spawn throws before starting (a NUL in an argument), reported without it", async () => {
    const hostile = "/work/proj/a\0b.md";
    const error = Object.assign(new TypeError(`The argument 'args[1]' must be ... ${hostile}`), {
      code: "ERR_INVALID_ARG_VALUE",
    });
    const { launch, reported } = launchOf({
      command: ["code", "{file}"],
      spawn: fakeSpawn({ throws: error }),
    });
    expect(await launch.open("ask-1", at(hostile, 1))).toBe("failed");
    expect(reported).toHaveLength(1);
    expect(String(reported[0])).toContain("ERR_INVALID_ARG_VALUE");
    expect(leaks(reported, hostile)).toBe(false);
  });

  test("failed: an error with no code, or a code that is not one, names only the outcome", async () => {
    for (const error of [
      new Error("boom /x/y"),
      Object.assign(new Error("e"), { code: "/x/y z" }),
    ]) {
      const { launch, reported } = launchOf({ command: CODE, spawn: fakeSpawn(error) });
      expect(await launch.open("ask-1", at(FILE, 1))).toBe("failed");
      expect(String(reported[0])).not.toContain("/x/y");
    }
  });

  test("an error after the editor started is reported, and the outcome stays opened", async () => {
    const reported: unknown[] = [];
    let error: ((error: Error) => void) | undefined;
    const spawn: EditorSpawn = () => {
      const started: StartedEditor = {
        once: (_event, listener) => queueMicrotask(listener),
        on: (_event, listener) => {
          error = listener;
        },
        unref: () => undefined,
      };
      return started;
    };
    const launch = new EditorLaunch({
      command: () => CODE,
      report: (e) => reported.push(e),
      spawn,
    });
    expect(await launch.open("ask-1", at(FILE, 1))).toBe("opened");
    error?.(Object.assign(new Error(`kill ${FILE}`), { code: "EPERM" }));
    expect(reported).toHaveLength(1);
    expect(String(reported[0])).not.toContain(FILE);
  });
});
