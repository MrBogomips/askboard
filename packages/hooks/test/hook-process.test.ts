import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  HOOK_EVENTS,
  HOOK_HANDLERS,
  type HookHandlers,
  hookProcess,
  type ModeProcess,
  type ProcessOutput,
  postToolUse,
  preToolUse,
  subagentStop,
} from "../src/index.ts";
import { chunks, type FakeApi, fakeLocalApi, removeRuntimeFolders } from "./fake-local-api.ts";

// The hook mode as a real process (task 6.2; AD-19): spawned by this test, which stands for Claude
// Code, so the hook finds the session file named by its real parent PID; it exits 0 with only the
// hook's output on stdout, or with one stderr line and nothing on stdout when anything fails.

const STAND_IN = join(import.meta.dir, "fixtures", "stand-in-hooks.ts");
const INPUT = JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "AskUserQuestion" });

const apis: FakeApi[] = [];
afterEach(async () => {
  await Promise.all(apis.splice(0).map((api) => api.close()));
  removeRuntimeFolders();
});

type Ran = { readonly code: number; readonly stdout: string; readonly stderr: string };

const run = async (
  args: string[],
  env: Readonly<Record<string, string>>,
  feed: (stdin: import("bun").FileSink) => void = (stdin) => {
    stdin.write(INPUT);
    stdin.end();
  },
): Promise<Ran> => {
  const child = Bun.spawn(["bun", STAND_IN, ...args], {
    env: { PATH: process.env.PATH ?? "", ...env },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  feed(child.stdin);
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr };
};

describe("a hook process", () => {
  test("finds the session file of its parent and writes only the hook's output", async () => {
    const api = await fakeLocalApi({ key: process.pid });
    apis.push(api);
    api.reply(() => ({ json: { version: "1.0", rule: "always", showable: true } }));
    const ran = await run(["PreToolUse"], api.env);
    expect(ran).toEqual({ code: 0, stdout: '{"rule":"always"}\n', stderr: "" });
    expect(api.requests).toHaveLength(1);
  });

  test("with no session file exits 0 with one stderr line and nothing on stdout", async () => {
    const api = await fakeLocalApi({ key: process.pid + 1 });
    apis.push(api);
    const ran = await run(["PreToolUse"], api.env);
    expect(ran).toEqual({
      code: 0,
      stdout: "",
      stderr: "askboard hook PreToolUse: no session file for this Claude Code process\n",
    });
    expect(api.requests).toHaveLength(0);
  });

  test("for an unknown event exits 0 with one stderr line, without waiting for stdin", async () => {
    const ran = await run(["Notification"], {}, () => {});
    expect(ran).toEqual({
      code: 0,
      stdout: "",
      stderr: "askboard hook: AskBoard has no hook for the event given\n",
    });
  });

  test("with an input over 1 MiB exits 0 while stdin is still open", async () => {
    const ran = await run(["SubagentStop"], {}, (stdin) => {
      stdin.write(new Uint8Array(1024 * 1024 + 1).fill(0x20));
      stdin.flush();
    });
    expect(ran).toEqual({
      code: 0,
      stdout: "",
      stderr: "askboard hook SubagentStop: the hook input is over 1 MiB\n",
    });
  });
});

describe("hookProcess", () => {
  // A process whose streams and exit are recorded, in the order they happen.
  const recorded = (stdin: AsyncIterable<Uint8Array>) => {
    const events: string[] = [];
    const output = (name: string): ProcessOutput => ({
      write: (text, done) => {
        events.push(`${name} ${text}`);
        done();
      },
    });
    const io: ModeProcess = {
      stdin,
      stdout: output("stdout"),
      stderr: output("stderr"),
      env: {},
      ppid: 1,
      getuid: () => 501,
      exit: (code) => events.push(`exit ${code}`),
    };
    return { io, events };
  };
  const handlers = (result: { output?: Record<string, unknown>; problem?: string }) =>
    Object.fromEntries(
      HOOK_EVENTS.map((event) => [event, async () => result]),
    ) as unknown as HookHandlers;

  test("writes the output, then the stderr line, then exits 0", async () => {
    const { io, events } = recorded(chunks("{}"));
    await hookProcess(
      "PostToolUse",
      io,
      handlers({ output: { systemMessage: "AskBoard · x" }, problem: "why" }),
    );
    expect(events).toEqual([
      'stdout {"systemMessage":"AskBoard · x"}\n',
      "stderr askboard hook PostToolUse: why\n",
      "exit 0",
    ]);
  });

  test("writes nothing for a hook with no output, and exits 0", async () => {
    const { io, events } = recorded(chunks("{}"));
    await hookProcess("SubagentStop", io, handlers({}));
    expect(events).toEqual(["exit 0"]);
  });

  test("takes no event as an unknown one", async () => {
    const { io, events } = recorded(chunks("{}"));
    await hookProcess(undefined, io, handlers({}));
    expect(events).toEqual([
      "stderr askboard hook: AskBoard has no hook for the event given\n",
      "exit 0",
    ]);
  });

  test("runs the hooks' own handlers unless given others", async () => {
    expect(HOOK_HANDLERS).toEqual({
      PreToolUse: preToolUse,
      PostToolUse: postToolUse,
      SubagentStop: subagentStop,
    });
    const { io, events } = recorded(chunks(JSON.stringify({ tool_name: "Bash" })));
    await hookProcess("PreToolUse", io);
    expect(events).toEqual([
      "stderr askboard hook PreToolUse: AskBoard has no PreToolUse hook for this tool\n",
      "exit 0",
    ]);
  });
});
