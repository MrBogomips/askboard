// The scripted MCP client: it starts a session process as Claude Code would, from the command
// its plugin declares, and calls its tools with no model (early-benchmark design decision 7). The
// smoke check and the stand-in `claude` of the tests use it.

import { spawn } from "node:child_process";
import { connectMcp, type McpOpened, RpcPeer } from "./mcp/jsonrpc.ts";
import { exitOf, spawnedOf } from "./process.ts";

export type ServerCommand = {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly cwd?: string;
};

export type ToolCall = { readonly text: string; readonly isError: boolean };

export type McpSession = {
  readonly pid: number;
  readonly opened: McpOpened;
  readonly listTools: () => Promise<string[]>;
  readonly call: (name: string, args: unknown) => Promise<ToolCall>;
  /** Ends stdin and waits for the exit, killing the process at the bound; resolves its exit code. */
  readonly close: () => Promise<number | null>;
};

const CLIENT = { name: "askboard-bench", version: "0.0.0" } as const;
const CLOSE_BOUND_MS = 5_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const startServer = async (
  server: ServerCommand,
  options: { readonly closeBoundMs?: number } = {},
): Promise<McpSession> => {
  const child = spawn(server.command, [...server.args], {
    env: { ...server.env },
    ...(server.cwd === undefined ? {} : { cwd: server.cwd }),
    stdio: ["pipe", "pipe", "ignore"],
  });
  const exited = exitOf(child);
  await spawnedOf(child, server.command);
  const peer = new RpcPeer(child.stdout, child.stdin);
  const opened = await connectMcp(peer, CLIENT);

  const listTools = async () => {
    const result = await peer.request("tools/list");
    const tools = isRecord(result) && Array.isArray(result.tools) ? result.tools : [];
    return tools.map((tool) => (isRecord(tool) ? String(tool.name) : ""));
  };

  const call = async (name: string, args: unknown): Promise<ToolCall> => {
    const result = await peer.request("tools/call", { name, arguments: args });
    const content = isRecord(result) && Array.isArray(result.content) ? result.content : [];
    const first = content[0];
    return {
      text: isRecord(first) && typeof first.text === "string" ? first.text : "",
      isError: isRecord(result) && result.isError === true,
    };
  };

  const close = async () => {
    peer.close();
    child.stdin.end();
    const timer = setTimeout(() => child.kill("SIGKILL"), options.closeBoundMs ?? CLOSE_BOUND_MS);
    const code = await exited;
    clearTimeout(timer);
    return code;
  };

  return { pid: child.pid ?? -1, opened, listTools, call, close };
};
