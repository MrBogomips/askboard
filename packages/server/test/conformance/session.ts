// The conformance suite's session processes (task 9.2): the built bundle on the runtime the runner
// chose, in a throwaway project, with a recorder script as `BROWSER`, driven over stdio by the MCP
// client. The client talks through a transport over the child's own pipes, so the suite can end
// stdin and watch the process exit on its own, which the SDK's stdio transport, ending its child
// with signals, cannot show.

import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { VIEW_DIRECTORY, VIEW_MANIFEST_FILE, type ViewManifest } from "@askboard/contract";
import {
  Client,
  type JSONRPCMessage,
  ReadBuffer,
  serializeMessage,
  type Transport,
} from "@modelcontextprotocol/client";

const ROOT = join(import.meta.dir, "..", "..", "..", "..");

/** The session process's runtime, as the runner resolved it; this Bun when run directly. */
export const RUNTIME = process.env.ASKBOARD_CONFORMANCE_RUNTIME ?? process.execPath;

/** The git user name of every throwaway project: the approved examples' `who`. */
export const GIT_USER = "Paola Greco";

const folders: string[] = [];
const children = new Set<ReturnType<typeof Bun.spawn>>();

const folder = (name: string): string => {
  const made = mkdtempSync(join(tmpdir(), `askboard-conformance-${name}-`));
  folders.push(made);
  return made;
};

const writeFiles = (into: string, files: Readonly<Record<string, string>>): void => {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(into, path)), { recursive: true });
    writeFileSync(join(into, path), text);
  }
};

/**
 * The bundle the suite runs, and the view build beside it: `dist/askboard.mjs` itself with the real
 * `dist/view/`, or a copy beside the given view files, none for a missing view build.
 */
export const bundleWith = (view?: Readonly<Record<string, string>>): string => {
  if (view === undefined) return join(ROOT, "dist", "askboard.mjs");
  const into = folder("bundle");
  cpSync(join(ROOT, "dist", "askboard.mjs"), join(into, "askboard.mjs"));
  writeFiles(join(into, VIEW_DIRECTORY), view);
  return join(into, "askboard.mjs");
};

/** The real view build's files as text, by their path under `dist/view/`, to damage a copy. */
export const distViewFiles = (): Record<string, string> => {
  const view = join(ROOT, "dist", VIEW_DIRECTORY);
  return Object.fromEntries(
    readdirSync(view, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const path = relative(view, join(entry.parentPath, entry.name));
        return [path.split(sep).join("/"), readFileSync(join(view, path), "utf8")];
      }),
  );
};

/** The manifest of the view build a bundle serves. */
export const manifestOf = (bundle: string): ViewManifest =>
  JSON.parse(readFileSync(join(dirname(bundle), VIEW_DIRECTORY, VIEW_MANIFEST_FILE), "utf8"));

// The MCP transport over a child's stdin and stdout: newline-delimited JSON-RPC, every line kept so
// the suite can check that stdout carries only protocol.
class ChildTransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;
  readonly lines: string[] = [];
  readonly #child: Bun.Subprocess<"pipe", "pipe", "pipe">;
  readonly #buffer = new ReadBuffer();
  #ended = false;

  constructor(child: Bun.Subprocess<"pipe", "pipe", "pipe">) {
    this.#child = child;
  }

  async start(): Promise<void> {
    void (async () => {
      const decoder = new TextDecoder();
      for await (const chunk of this.#child.stdout) {
        this.lines.push(
          ...decoder
            .decode(chunk)
            .split("\n")
            .filter((line) => line !== ""),
        );
        this.#buffer.append(Buffer.from(chunk));
        try {
          for (
            let message = this.#buffer.readMessage();
            message;
            message = this.#buffer.readMessage()
          ) {
            this.onmessage?.(message);
          }
        } catch (error) {
          this.onerror?.(error as Error);
        }
      }
      this.onclose?.();
    })();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.#ended) throw new Error("stdin has ended");
    this.#child.stdin.write(serializeMessage(message));
    await this.#child.stdin.flush();
  }

  /** Ends the child's stdin, as Claude Code does when a session ends. */
  async close(): Promise<void> {
    if (this.#ended) return;
    this.#ended = true;
    await this.#child.stdin.end();
  }
}

export type SessionOptions = {
  /** Variables beside the suite's own: `BROWSER`, the project, an isolated git. */
  readonly env?: Readonly<Record<string, string>>;
  /** Variables of the suite's own to leave out, such as `BROWSER`. */
  readonly without?: readonly string[];
  readonly bundle?: string;
  /** The client's negotiation: Claude Code's modern one by default. */
  readonly negotiation?: "auto" | "legacy";
};

export type Session = {
  readonly client: Client;
  readonly transport: ChildTransport;
  readonly pid: number;
  /** The throwaway project, the session process's working folder. */
  readonly project: string;
  /** The session process's home, which E1 never writes to. */
  readonly home: string;
  /** Each start of the recorder: its arguments. */
  opened(): string[][];
  /** Waits for the recorder's next start and returns its arguments. */
  nextOpened(): Promise<string[]>;
  /** A tool call's result, its JSON parsed when it is not an error. */
  call(name: string, args: Record<string, unknown>): Promise<ToolOutcome>;
  /** Ends stdin and waits for the exit. */
  end(): Promise<number>;
  readonly exited: Promise<number>;
  stderr(): Promise<string>;
};

export type ToolOutcome = {
  readonly isError: boolean;
  readonly text: string;
  readonly json: unknown;
};

const WAIT_MS = 5_000;

const recorderIn = (into: string): string => {
  const script = join(into, "browser.sh");
  writeFileSync(
    script,
    `#!/bin/sh\nprintf '%s\\n' "$#" "$@" > '${into}/opened.$$.part'\nmv '${into}/opened.$$.part' '${into}/opened.$$.txt'\n`,
  );
  chmodSync(script, 0o755);
  return script;
};

const recordedIn = (into: string): string[][] =>
  readdirSync(into)
    .filter((name) => name.startsWith("opened.") && name.endsWith(".txt"))
    .map((name) => readFileSync(join(into, name), "utf8").split("\n").slice(1, -1));

/** Starts a session process and connects the MCP client to it. */
export const startSession = async (options: SessionOptions = {}): Promise<Session> => {
  const project = folder("project");
  const home = folder("home");
  const recorder = folder("recorder");
  Bun.spawnSync(["git", "init", "--quiet", project]);
  Bun.spawnSync(["git", "-C", project, "config", "user.name", GIT_USER]);
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: home,
    BROWSER: recorderIn(recorder),
    CLAUDE_PROJECT_DIR: project,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    // Bun caches its transpilation of a large file, such as the bundle, under the home folder: off,
    // so that what the suite finds there is AskBoard's own.
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
    ...options.env,
  };
  for (const name of options.without ?? []) delete env[name];
  const child = Bun.spawn([RUNTIME, options.bundle ?? bundleWith()], {
    cwd: project,
    env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  children.add(child);
  const exited = child.exited.then((code) => {
    children.delete(child);
    return code;
  });
  const transport = new ChildTransport(child);
  const client = new Client(
    { name: "askboard-conformance", version: "0.0.0" },
    { versionNegotiation: { mode: options.negotiation ?? "auto" } },
  );
  await client.connect(transport);
  let seen = 0;
  return {
    client,
    transport,
    pid: child.pid,
    project,
    home,
    opened: () => recordedIn(recorder),
    nextOpened: async () => {
      const until = Date.now() + WAIT_MS;
      while (recordedIn(recorder).length <= seen) {
        if (Date.now() > until) throw new Error("the board was not opened");
        await Bun.sleep(10);
      }
      seen += 1;
      return recordedIn(recorder)[seen - 1] ?? [];
    },
    call: async (name, args) => {
      const result = await client.callTool({ name, arguments: args });
      const [content] = result.content as { text: string }[];
      const text = content?.text ?? "";
      const isError = result.isError === true;
      return { isError, text, json: isError ? undefined : JSON.parse(text) };
    },
    end: async () => {
      await transport.close();
      return exited;
    },
    exited,
    stderr: async () => {
      await exited;
      return new Response(child.stderr).text();
    },
  };
};

/** Kills any session process a failed test left running, and removes the throwaway folders. */
export const cleanUp = async (): Promise<void> => {
  for (const child of children) child.kill("SIGKILL");
  await Promise.all([...children].map((child) => child.exited));
  for (const made of folders.splice(0)) rmSync(made, { recursive: true, force: true });
};

/** Whether a process is still running. */
export const isRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Whether a folder holds nothing at all. */
export const isEmpty = (path: string): boolean =>
  !existsSync(path) || readdirSync(path).length === 0;
