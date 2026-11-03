// A session process stand-in for the unit tests of the session-process target: a child process
// with no process behind it, whose standard output answers MCP requests as a fake server says.
// Test code only; the browser runs use the real bundle.

import type { JSONRPCMessage } from "@modelcontextprotocol/client";
import type { Child, ChildExit, SpawnChild, SpawnOptions } from "./child.ts";

/** Replies to one message the client wrote, in order; nothing for a notification. */
export type Respond = (message: JSONRPCMessage, child: FakeChild) => readonly JSONRPCMessage[];

export class FakeChild implements Child {
  readonly pid = 4242;
  /** Every message the client wrote, parsed. */
  readonly received: JSONRPCMessage[] = [];
  readonly signals: string[] = [];
  inputEnded = false;
  /** What ending its input does; by default it exits with code 0. */
  onInputEnd: () => void = () => this.finish({ code: 0, signal: null });
  readonly exited: Promise<ChildExit>;
  #finish: (exit: ChildExit) => void = () => undefined;
  #finished = false;
  #output: (chunk: Uint8Array) => void = () => undefined;
  #errorOutput: (chunk: Uint8Array) => void = () => undefined;
  readonly #respond: Respond;

  constructor(respond: Respond = () => []) {
    this.#respond = respond;
    this.exited = new Promise((resolve) => {
      this.#finish = resolve;
    });
  }

  write(text: string): void {
    for (const line of text.split("\n").filter((part) => part !== "")) {
      const message = JSON.parse(line) as JSONRPCMessage;
      this.received.push(message);
      const replies = this.#respond(message, this);
      queueMicrotask(() => {
        for (const reply of replies) this.emit(`${JSON.stringify(reply)}\n`);
      });
    }
  }

  endInput(): void {
    if (this.inputEnded) return;
    this.inputEnded = true;
    this.onInputEnd();
  }

  kill(signal: "SIGKILL" | "SIGTERM"): void {
    this.signals.push(signal);
    this.finish({ code: null, signal });
  }

  onOutput(listener: (chunk: Uint8Array) => void): void {
    this.#output = listener;
  }

  onErrorOutput(listener: (chunk: Uint8Array) => void): void {
    this.#errorOutput = listener;
  }

  /** Writes to the client as the process's standard output. */
  emit(text: string): void {
    this.#output(Buffer.from(text));
  }

  /** Writes to its standard error. */
  emitError(text: string): void {
    this.#errorOutput(Buffer.from(text));
  }

  /** Ends the process; the first end counts. */
  finish(exit: ChildExit): void {
    if (this.#finished) return;
    this.#finished = true;
    this.#finish(exit);
  }
}

export type ToolReply = { readonly text: string; readonly isError?: boolean };
export type FakeTool = (args: unknown, child: FakeChild) => ToolReply;

const isRequest = (
  message: JSONRPCMessage,
): message is JSONRPCMessage & { id: string | number; method: string; params?: unknown } =>
  "method" in message && "id" in message;

const paramsOf = (message: { params?: unknown }): Record<string, unknown> =>
  typeof message.params === "object" && message.params !== null
    ? (message.params as Record<string, unknown>)
    : {};

/** An MCP server over stdio in the legacy handshake, whose tools are the functions given. */
export const fakeMcpServer =
  (tools: Readonly<Record<string, FakeTool>>): Respond =>
  (message, child) => {
    if (!isRequest(message)) return [];
    const { id, method } = message;
    const params = paramsOf(message);
    const result = (value: Record<string, unknown>): JSONRPCMessage[] => [
      { jsonrpc: "2.0", id, result: value } as JSONRPCMessage,
    ];
    if (method === "initialize") {
      return result({
        protocolVersion: params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "fake-askboard", version: "0.0.0" },
      });
    }
    if (method === "tools/list") {
      return result({
        tools: Object.keys(tools).map((name) => ({ name, inputSchema: { type: "object" } })),
      });
    }
    const tool = method === "tools/call" ? tools[String(params.name)] : undefined;
    if (tool === undefined) {
      return [
        {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `no ${method}` },
        } as JSONRPCMessage,
      ];
    }
    const reply = tool(params.arguments, child);
    return result({
      content: [{ type: "text", text: reply.text }],
      ...(reply.isError ? { isError: true } : {}),
    });
  };

export type Spawned = {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: SpawnOptions;
  readonly child: FakeChild;
};

/** A `spawn` that starts fake children made by the function given, and remembers each start. */
export const fakeSpawn = (make: (options: SpawnOptions, count: number) => FakeChild) => {
  const spawned: Spawned[] = [];
  const spawn: SpawnChild = (command, args, options) => {
    const child = make(options, spawned.length + 1);
    spawned.push({ command, args, options, child });
    return child;
  };
  return { spawn, spawned };
};
