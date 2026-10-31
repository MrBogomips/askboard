// The session process as a child of the test run, and the MCP transport over its stdio. The SDK's
// `StdioClientTransport` spawns the process itself and keeps its exit status, which the target
// checks (design decision 4: exit code 0 at stdin's end; a restart is a kill), and a fake child
// cannot stand in for it in the unit tests. So the target starts the process through `Child`
// (with `Bun.spawn`: test code), and `ChildTransport` frames MCP messages over it with the SDK's
// own `ReadBuffer` and `serializeMessage`; `@modelcontextprotocol/client`'s `Client` speaks the
// protocol.

import {
  type JSONRPCMessage,
  ReadBuffer,
  serializeMessage,
  type Transport,
} from "@modelcontextprotocol/client";

/** How a process ended: its exit code, the signal that ended it, or why it never started. */
export type ChildExit = {
  readonly code: number | null;
  readonly signal: string | null;
  readonly error?: string;
};

/** The part of a started process the target uses; a fake stands in for it in unit tests. */
export type Child = {
  readonly pid: number | undefined;
  /** Writes to the process's standard input; nothing once it has ended. */
  write(text: string): void;
  /** Ends its standard input, which ends a session process (design decision 4). */
  endInput(): void;
  kill(signal: "SIGKILL" | "SIGTERM"): void;
  onOutput(listener: (chunk: Uint8Array) => void): void;
  onErrorOutput(listener: (chunk: Uint8Array) => void): void;
  /** Settles once, when the process has ended or could not start. */
  readonly exited: Promise<ChildExit>;
};

export type SpawnOptions = { readonly env: Record<string, string>; readonly cwd: string };

export type SpawnChild = (command: string, args: readonly string[], options: SpawnOptions) => Child;

// A child's output stream handed to one listener, the chunks before it kept for it. The stream
// ends with the process; how it ended is the exit's to say.
const relay = (stream: ReadableStream<Uint8Array>) => {
  let listener: ((chunk: Uint8Array) => void) | undefined;
  const early: Uint8Array[] = [];
  void (async () => {
    for await (const chunk of stream) {
      if (listener === undefined) early.push(chunk);
      else listener(chunk);
    }
  })().catch(() => undefined);
  return (next: (chunk: Uint8Array) => void) => {
    listener = next;
    for (const chunk of early.splice(0)) next(chunk);
  };
};

const notStarted = (error: unknown): Child => ({
  pid: undefined,
  write: () => undefined,
  endInput: () => undefined,
  kill: () => undefined,
  onOutput: () => undefined,
  onErrorOutput: () => undefined,
  exited: Promise.resolve({ code: null, signal: null, error: String(error) }),
});

/** Starts a process with an argument vector, no shell, and only the environment given. */
export const spawnChild: SpawnChild = (command, args, { env, cwd }) => {
  let child: Bun.Subprocess<"pipe", "pipe", "pipe">;
  try {
    child = Bun.spawn([command, ...args], {
      env,
      cwd,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    return notStarted(error);
  }
  let open = true;
  const exited = child.exited.then((): ChildExit => {
    open = false;
    const signal = child.signalCode === null ? null : String(child.signalCode);
    return { code: signal === null ? child.exitCode : null, signal };
  });
  // Once the process has ended, its input takes nothing more.
  const input = (act: () => void) => {
    if (open) act();
  };
  return {
    pid: child.pid,
    write: (text) =>
      input(() => {
        child.stdin.write(text);
        child.stdin.flush();
      }),
    endInput: () =>
      input(() => {
        open = false;
        child.stdin.end();
      }),
    kill: (signal) => child.kill(signal),
    onOutput: relay(child.stdout),
    onErrorOutput: relay(child.stderr),
    exited,
  };
};

/** How a process ended, in a few words. */
export const describeExit = (exit: ChildExit): string => {
  if (exit.error !== undefined) return `no start: ${exit.error}`;
  return exit.signal === null ? `exit code ${exit.code}` : `signal ${exit.signal}`;
};

/** MCP over a child's stdio: one JSON-RPC message per line, as the stdio transport frames them. */
export class ChildTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  readonly #child: Child;
  readonly #buffer = new ReadBuffer();

  constructor(child: Child) {
    this.#child = child;
  }

  async start(): Promise<void> {
    this.#child.onOutput((chunk) => {
      this.#buffer.append(Buffer.from(chunk));
      for (;;) {
        let message: JSONRPCMessage | null;
        try {
          message = this.#buffer.readMessage();
        } catch (error) {
          this.onerror?.(error instanceof Error ? error : new Error(String(error)));
          continue;
        }
        if (message === null) break;
        this.onmessage?.(message);
      }
    });
    void this.#child.exited.then(() => this.onclose?.());
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.#child.write(serializeMessage(message));
  }

  /** Ends the child's input; the transport closes when the child has exited. */
  async close(): Promise<void> {
    this.#child.endInput();
  }
}
