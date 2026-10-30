// The session process's stdio life (AD-2, design decision 4): serve the tools over stdio, and on
// stdin's end, SIGINT, SIGTERM or SIGHUP run one shutdown: discard every open ask, let the boards'
// sockets and the waiting collects' answers flush within a short bound, close, and exit.

import type { Transport } from "@modelcontextprotocol/server";
import { StdioServerTransport, serveStdio } from "@modelcontextprotocol/server/stdio";
import { failure, note } from "./diagnostics.ts";
import type { Timers, ToolDeps } from "./ports.ts";
import { createToolServer } from "./tools.ts";

export type ExitSignal = "SIGINT" | "SIGTERM" | "SIGHUP";

const EXIT_SIGNALS: readonly ExitSignal[] = ["SIGINT", "SIGTERM", "SIGHUP"];

/** The longest the exit waits for the boards' sockets and the last answers to flush. */
export const EXIT_FLUSH_MS = 1_000;

/** The process around the session: its exit signals and its exit. */
export type SessionProcess = {
  onSignal(signal: ExitSignal, handler: () => void): void;
  /** Ends the process with this code once what it wrote to stdout is flushed. */
  exit(code: number): void;
};

export type SessionOptions = {
  readonly deps: ToolDeps;
  readonly process: SessionProcess;
  /** Closes what the session opened after the discard, such as the board listener. */
  readonly beforeExit?: () => Promise<void>;
  /** The transport to serve on; the process's stdio by default. */
  readonly transport?: Transport;
  readonly version?: string;
};

export type Session = {
  /** Resolves with the exit code once the shutdown has asked the process to exit. */
  readonly ended: Promise<number>;
};

// A transport that also tells `closed` when it closes: stdin's end closes the stdio transport
// whether or not an MCP exchange has started, which the server's own close does not see.
const watched = (inner: Transport, closed: () => void): Transport => {
  const outer: Transport = {
    start: () => inner.start(),
    send: (message, options) => inner.send(message, options),
    close: () => inner.close(),
  };
  inner.onmessage = (message, extra) => outer.onmessage?.(message, extra);
  inner.onerror = (error) => outer.onerror?.(error);
  inner.onclose = () => {
    outer.onclose?.();
    closed();
  };
  return outer;
};

const delay = (timers: Timers, ms: number) =>
  new Promise<void>((resolve) => {
    timers.after(ms, resolve);
  });

const asks = (count: number) => `${count} open ${count === 1 ? "ask" : "asks"} discarded`;

/** Serves the session over stdio until stdin ends or an exit signal arrives. */
export const serveSession = (options: SessionOptions): Session => {
  const { deps, process } = options;
  const { core, timers, diagnostics } = deps;
  let shutdown: Promise<number> | undefined;
  let finish: (code: number) => void = () => undefined;
  const ended = new Promise<number>((resolve) => {
    finish = resolve;
  });

  const end = (why: string): Promise<number> => {
    shutdown ??= (async () => {
      diagnostics.write(note(`session ending (${why}): ${asks(core.discardAll("session-exit"))}`));
      const flushed = (async () => {
        // One turn of the event loop, so that the waiting collects the discard woke send their
        // answers before stdio closes.
        await new Promise((resolve) => setImmediate(resolve));
        await options.beforeExit?.();
      })().catch((error: unknown) => {
        diagnostics.write(failure("closing the board listener failed", error));
      });
      await Promise.race([flushed, delay(timers, EXIT_FLUSH_MS)]);
      await handle.close().catch((error: unknown) => {
        diagnostics.write(failure("closing stdio failed", error));
      });
      process.exit(0);
      finish(0);
      return 0;
    })();
    return shutdown;
  };

  const transport = watched(options.transport ?? new StdioServerTransport(), () => {
    void end("stdin closed");
  });
  const handle = serveStdio(() => createToolServer(deps, options.version), {
    transport,
    onerror: (error) => diagnostics.write(failure("protocol error", error)),
  });
  for (const signal of EXIT_SIGNALS) process.onSignal(signal, () => void end(signal));
  return { ended };
};

/** The running process as a session process: its signals, and an exit after stdout is flushed. */
export const processOf = (running: NodeJS.Process): SessionProcess => ({
  onSignal: (signal, handler) => {
    running.on(signal, handler);
  },
  exit: (code) => {
    // A backstop in case stdout never reports the flush, such as a reader that went away.
    setTimeout(() => running.exit(code), EXIT_FLUSH_MS).unref();
    running.stdout.write("", () => running.exit(code));
  },
});
