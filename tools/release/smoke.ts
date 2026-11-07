// The release's smoke test (plugin-release, design decision 6; packaging spec, "The release
// workflow"), run on the assembled tree on macOS and on Linux: the start script on Node answers
// `initialize` as AskBoard with the tree's version, lists the tools it is expected to, ends with its
// input, and runs the hook mode on `{}`. It runs on plain Node 24 and imports nothing but Node's own
// modules, so the Linux job needs no workspace, no install and no Bun. Session files and sockets go
// to a throwaway folder, never to the machine's own session folder.
//
// Usage: node tools/release/smoke.ts <tree> --tools <file>
//   <file> is a JSON array of the tool names to expect (`bun tools/release/tool-names.ts --out`).

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

export type SmokeStep = { name: string; ok: boolean; detail: string };

export type SmokeOptions = {
  /** The tool names `tools/list` must hold exactly. */
  tools: readonly string[];
  /** The wait for each answer and for each exit, in milliseconds; 20 s when absent. */
  timeoutMs?: number;
  /** Added to the environment of the processes it runs; `undefined` removes a variable. */
  env?: Readonly<Record<string, string | undefined>>;
};

const TIMEOUT_MS = 20_000;

type Json = Record<string, unknown>;

const childEnvironment = (
  temp: string,
  added: Readonly<Record<string, string | undefined>>,
): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env))
    if (value !== undefined) env[name] = value;
  // The session folder comes from TMPDIR; the host's own variables must not reach the tree.
  for (const name of ["XDG_RUNTIME_DIR", "CLAUDE_PROJECT_DIR", "ASKBOARD_CALLER_CWD"])
    delete env[name];
  env.TMPDIR = temp;
  for (const [name, value] of Object.entries(added)) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
  return env;
};

type Running = {
  write: (text: string) => void;
  end: () => void;
  /** The next stdout line, or why there is none. */
  line: () => Promise<{ text: string } | { why: string }>;
  /** The exit code once the process is gone, or `"timeout"` after the wait (the process is killed). */
  exit: () => Promise<number | null | "timeout">;
  stderr: () => string;
  kill: () => void;
};

const start = (
  command: string,
  args: string[],
  options: { cwd: string; env: Record<string, string>; timeoutMs: number },
): Running => {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let buffered = "";
  let stderr = "";
  let closed: { code: number | null } | undefined;
  const lines: string[] = [];
  const wake: (() => void)[] = [];
  const notify = () => {
    for (const resume of wake.splice(0)) resume();
  };
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffered += chunk;
    for (let at = buffered.indexOf("\n"); at >= 0; at = buffered.indexOf("\n")) {
      lines.push(buffered.slice(0, at));
      buffered = buffered.slice(at + 1);
    }
    notify();
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    if (stderr.length < 4096) stderr += chunk;
  });
  child.stdin.on("error", () => {});
  child.on("close", (code) => {
    closed = { code };
    notify();
  });
  child.on("error", (error) => {
    stderr += error.message;
    closed = { code: null };
    notify();
  });
  const waitFor = async (ready: () => boolean): Promise<boolean> => {
    const deadline = Date.now() + options.timeoutMs;
    while (!ready()) {
      const left = deadline - Date.now();
      if (left <= 0) return false;
      await new Promise<void>((resume) => {
        const timer = setTimeout(resume, left);
        wake.push(() => {
          clearTimeout(timer);
          resume();
        });
      });
    }
    return true;
  };
  return {
    write: (text) => void child.stdin.write(text),
    end: () => void child.stdin.end(),
    line: async () => {
      const got = await waitFor(() => lines.length > 0 || closed !== undefined);
      const text = lines.shift();
      if (text !== undefined) return { text };
      return got
        ? { why: `the process ended (exit code ${closed?.code ?? "none"}) before answering` }
        : { why: `no answer within ${options.timeoutMs} ms` };
    },
    exit: async () => {
      if (await waitFor(() => closed !== undefined)) return closed?.code ?? null;
      child.kill("SIGKILL");
      return "timeout";
    },
    stderr: () => stderr.trim().split("\n")[0] ?? "",
    kill: () => void child.kill("SIGKILL"),
  };
};

const withStderr = (detail: string, stderr: string): string =>
  stderr === "" ? detail : `${detail} (stderr: ${stderr})`;

const parse = (text: string): Json | undefined => {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Json)
      : undefined;
  } catch {
    return undefined;
  }
};

/** Sends a request and returns the reply with that ID, skipping other lines; or why none came. */
const ask = async (
  session: Running,
  id: number,
  method: string,
  params?: unknown,
): Promise<{ reply: Json } | { why: string }> => {
  session.write(
    `${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) })}\n`,
  );
  for (;;) {
    const got = await session.line();
    if ("why" in got) return got;
    const message = parse(got.text);
    if (message !== undefined && message.id === id) return { reply: message };
  }
};

const resultOf = (reply: Json): Json | undefined => {
  const result = reply.result;
  return typeof result === "object" && result !== null ? (result as Json) : undefined;
};

const listed = (list: Json | undefined): string[] | undefined => {
  const tools = list?.tools;
  if (!Array.isArray(tools)) return undefined;
  return tools.map((tool) => String((tool as Json | null)?.name));
};

const difference = (left: readonly string[], right: readonly string[]): string[] =>
  left.filter((name) => !right.includes(name));

const versionOf = (tree: string): { version: string } | { why: string } => {
  const path = join(tree, ".claude-plugin", "plugin.json");
  try {
    const version = (JSON.parse(readFileSync(path, "utf8")) as Json).version;
    if (typeof version === "string") return { version };
    return { why: `${path} has no version` };
  } catch (error) {
    return { why: `cannot read ${path}: ${(error as Error).message}` };
  }
};

/** The session process: handshake, version, tools, and the end with its input. */
const sessionSteps = async (
  tree: string,
  options: SmokeOptions,
  run: { cwd: string; env: Record<string, string>; timeoutMs: number },
): Promise<SmokeStep[]> => {
  const steps: SmokeStep[] = [];
  const session = start("sh", [join(tree, "scripts", "askboard")], run);
  try {
    const initialized = await ask(session, 1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "askboard-release-smoke", version: "0" },
    });
    const info =
      "reply" in initialized
        ? (resultOf(initialized.reply)?.serverInfo as Json | undefined)
        : undefined;
    if (!("reply" in initialized)) {
      steps.push({
        name: "initialize",
        ok: false,
        detail: withStderr(initialized.why, session.stderr()),
      });
      return steps;
    }
    if (info?.name !== "askboard") {
      steps.push({
        name: "initialize",
        ok: false,
        detail: `the server is named ${JSON.stringify(info?.name)}, not "askboard"`,
      });
      return steps;
    }
    steps.push({ name: "initialize", ok: true, detail: `askboard ${String(info.version)}` });

    const expected = versionOf(tree);
    if ("why" in expected) {
      steps.push({ name: "version", ok: false, detail: expected.why });
    } else if (info.version === expected.version) {
      steps.push({ name: "version", ok: true, detail: expected.version });
    } else {
      steps.push({
        name: "version",
        ok: false,
        detail: `the server reports ${JSON.stringify(info.version)}, the tree's plugin.json says ${expected.version}`,
      });
    }

    session.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    const tools = await ask(session, 2, "tools/list");
    const names = "reply" in tools ? listed(resultOf(tools.reply)) : undefined;
    if (names === undefined) {
      steps.push({
        name: "tools",
        ok: false,
        detail: "why" in tools ? tools.why : "tools/list has no tool list",
      });
    } else if (options.tools.length === 0) {
      steps.push({
        name: "tools",
        ok: false,
        detail: "no tool is expected, so the list proves nothing",
      });
    } else {
      const missing = difference(options.tools, names);
      const extra = difference(names, options.tools);
      steps.push({
        name: "tools",
        ok: missing.length === 0 && extra.length === 0,
        detail:
          missing.length === 0 && extra.length === 0
            ? names.join(", ")
            : `missing ${JSON.stringify(missing)}, not expected ${JSON.stringify(extra)}`,
      });
    }
  } finally {
    session.end();
  }
  const code = await session.exit();
  steps.push({
    name: "exit",
    ok: code === 0,
    detail:
      code === 0
        ? "ended with its input, exit 0"
        : code === "timeout"
          ? `did not end within ${run.timeoutMs} ms after its input closed`
          : withStderr(`exit code ${code}`, session.stderr()),
  });
  return steps;
};

/** The hook mode on `{}`: exit 0. */
const hookStep = async (
  tree: string,
  run: { cwd: string; env: Record<string, string>; timeoutMs: number },
): Promise<SmokeStep> => {
  const hook = start("sh", [join(tree, "scripts", "askboard"), "hook", "SubagentStop"], run);
  hook.write("{}");
  hook.end();
  const code = await hook.exit();
  return {
    name: "hook",
    ok: code === 0,
    detail:
      code === 0
        ? "hook SubagentStop exited 0"
        : code === "timeout"
          ? `hook SubagentStop did not end within ${run.timeoutMs} ms`
          : withStderr(`hook SubagentStop exited ${code}`, hook.stderr()),
  };
};

/** Runs the smoke on `tree`; every step's result, in order. A step that cannot run is a failed one. */
export const smoke = async (treePath: string, options: SmokeOptions): Promise<SmokeStep[]> => {
  // Absolute: the processes run in a throwaway folder, not where the caller stands.
  const tree = resolve(treePath);
  // Short, for the local API socket's path limit on macOS.
  const temp = mkdtempSync("/tmp/ab-smoke-");
  try {
    const run = {
      cwd: temp,
      env: childEnvironment(temp, options.env ?? {}),
      timeoutMs: options.timeoutMs ?? TIMEOUT_MS,
    };
    return [...(await sessionSteps(tree, options, run)), await hookStep(tree, run)];
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
};

export type SmokePorts = {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
};

/** The command line: 0 when every step passes, 1 when one fails, 2 for a usage problem. */
export const runSmoke = async (argv: readonly string[], ports: SmokePorts): Promise<number> => {
  const [tree, flag, file] = argv;
  if (tree === undefined || flag !== "--tools" || file === undefined) {
    ports.stderr("smoke: usage: node tools/release/smoke.ts <tree> --tools <file>");
    return 2;
  }
  let tools: unknown;
  try {
    tools = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    ports.stderr(`smoke: cannot read the tool names from ${file}: ${(error as Error).message}`);
    return 2;
  }
  if (!Array.isArray(tools) || !tools.every((name) => typeof name === "string")) {
    ports.stderr(`smoke: ${file} is not a JSON array of tool names`);
    return 2;
  }
  const steps = await smoke(tree, { tools: tools as string[], env: ports.env });
  for (const step of steps) {
    if (step.ok) ports.stdout(`smoke: ${step.name}: ok (${step.detail})`);
    else ports.stderr(`smoke: ${step.name}: FAILED: ${step.detail}`);
  }
  return steps.every((step) => step.ok) ? 0 : 1;
};

if (import.meta.main) {
  process.exit(
    await runSmoke(process.argv.slice(2), {
      env: {},
      stdout: (line) => void process.stdout.write(`${line}\n`),
      stderr: (line) => void process.stderr.write(`${line}\n`),
    }),
  );
}
