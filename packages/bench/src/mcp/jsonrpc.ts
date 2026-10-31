// A minimal JSON-RPC 2.0 peer over newline-delimited streams, and MCP's 2025 handshake on both
// sides (early-benchmark design decision 7). The permission host, the scripted MCP client of
// `smoke` and the stub session process share it; bench declares no MCP SDK.

import type { Readable, Writable } from "node:stream";

/** The 2025 revision bench speaks; SDK v2 serves it to clients that open with `initialize`. */
export const MCP_PROTOCOL_VERSION = "2025-11-25";
const SERVED_VERSIONS = new Set([MCP_PROTOCOL_VERSION, "2025-06-18", "2025-03-26"]);

type Id = number | string;

type Message = {
  readonly jsonrpc?: unknown;
  readonly id?: Id | null;
  readonly method?: unknown;
  readonly params?: unknown;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string };
};

export class RpcError extends Error {
  override readonly name = "RpcError";
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

export type RequestHandler = (method: string, params: unknown) => Promise<unknown>;
export type NotificationHandler = (method: string, params: unknown) => void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** One end of a JSON-RPC connection: it sends requests and notifications, and answers requests. */
export class RpcPeer {
  private nextId = 1;
  private closed = false;
  private buffer = "";
  private readonly pending = new Map<
    Id,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private requestHandler: RequestHandler = async (method) => {
    throw new RpcError(METHOD_NOT_FOUND, `method "${method}" not found`);
  };
  private notificationHandler: NotificationHandler = () => undefined;

  constructor(
    input: Readable,
    private readonly output: Writable,
  ) {
    input.on("data", (chunk: Buffer | string) => this.receive(chunk.toString()));
    input.on("end", () => this.close());
    input.on("close", () => this.close());
  }

  onRequest(handler: RequestHandler): void {
    this.requestHandler = handler;
  }

  onNotification(handler: NotificationHandler): void {
    this.notificationHandler = handler;
  }

  request(method: string, params?: unknown): Promise<unknown> {
    if (this.closed) return Promise.reject(new Error("the connection closed"));
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });
    });
  }

  notify(method: string, params?: unknown): void {
    this.send({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) });
  }

  /** Fails every pending request; later requests fail at once. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const { reject } of this.pending.values()) reject(new Error("the connection closed"));
    this.pending.clear();
  }

  private send(message: Record<string, unknown>): void {
    if (this.output.writable) this.output.write(`${JSON.stringify(message)}\n`);
  }

  private receive(text: string): void {
    this.buffer += text;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim() !== "") this.dispatch(line);
    }
  }

  private dispatch(line: string): void {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      this.send({ jsonrpc: "2.0", id: null, error: { code: PARSE_ERROR, message: "parse error" } });
      return;
    }
    if (!isRecord(message)) {
      this.send({
        jsonrpc: "2.0",
        id: null,
        error: { code: INVALID_REQUEST, message: "invalid request" },
      });
      return;
    }
    const { id, method, params, error } = message as Message;
    if (typeof method === "string") {
      if (id === undefined || id === null) this.notificationHandler(method, params);
      else void this.answer(id, method, params);
      return;
    }
    const waiting = id === undefined || id === null ? undefined : this.pending.get(id);
    if (waiting === undefined || id === undefined || id === null) return;
    this.pending.delete(id);
    if (error !== undefined) waiting.reject(new RpcError(error.code, error.message));
    else waiting.resolve((message as Message).result);
  }

  private async answer(id: Id, method: string, params: unknown): Promise<void> {
    try {
      const result = await this.requestHandler(method, params);
      this.send({ jsonrpc: "2.0", id, result });
    } catch (error) {
      // Only a typed error's message reaches the other side; anything else may hold detail.
      const reply =
        error instanceof RpcError
          ? { code: error.code, message: error.message }
          : { code: INTERNAL_ERROR, message: "internal error" };
      this.send({ jsonrpc: "2.0", id, error: reply });
    }
  }
}

export type McpTool = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
};

export type CallResult = {
  readonly content: readonly { readonly type: "text"; readonly text: string }[];
  readonly isError?: boolean;
};

export type McpServer = {
  readonly name: string;
  readonly version: string;
  readonly instructions?: string;
  readonly tools: readonly McpTool[];
  readonly call: (name: string, args: unknown, meta: unknown) => Promise<CallResult>;
};

/** Serves MCP's 2025 handshake, `ping`, `tools/list` and `tools/call` on a peer. */
export const serveMcp = (peer: RpcPeer, server: McpServer): void => {
  const names = new Set(server.tools.map((tool) => tool.name));
  peer.onNotification(() => undefined);
  peer.onRequest(async (method, params) => {
    const request = isRecord(params) ? params : {};
    switch (method) {
      case "initialize": {
        const asked = request.protocolVersion;
        const version =
          typeof asked === "string" && SERVED_VERSIONS.has(asked) ? asked : MCP_PROTOCOL_VERSION;
        return {
          protocolVersion: version,
          capabilities: { tools: {} },
          serverInfo: { name: server.name, version: server.version },
          ...(server.instructions === undefined ? {} : { instructions: server.instructions }),
        };
      }
      case "ping":
        return {};
      case "tools/list":
        return { tools: server.tools };
      case "tools/call": {
        const name = request.name;
        if (typeof name !== "string" || !names.has(name)) {
          throw new RpcError(INVALID_PARAMS, `unknown tool "${String(name)}"`);
        }
        return server.call(name, request.arguments, request._meta);
      }
      default:
        throw new RpcError(METHOD_NOT_FOUND, `method "${method}" not found`);
    }
  });
};

export type McpOpened = {
  readonly protocolVersion: string;
  readonly serverInfo: unknown;
  readonly instructions: string | undefined;
};

/** Opens an MCP connection as a client: `initialize`, then `notifications/initialized`. */
export const connectMcp = async (
  peer: RpcPeer,
  clientInfo: { readonly name: string; readonly version: string },
): Promise<McpOpened> => {
  const result = await peer.request("initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo,
  });
  const opened = isRecord(result) ? result : {};
  peer.notify("notifications/initialized");
  return {
    protocolVersion: String(opened.protocolVersion),
    serverInfo: opened.serverInfo,
    instructions: typeof opened.instructions === "string" ? opened.instructions : undefined,
  };
};
