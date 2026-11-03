// The MCP server of the session process (design decision 4): `ask`, `update`, `collect` and `fetch`,
// in AD-6's order, as the contract's copy of the approved definitions, with the approved server
// instructions whole (ask-lifecycle, design decision 2). Building it has no side effect:
// `server/discover`, `initialize` and `tools/list` touch nothing (AD-2).

import {
  CLAUDE_CODE_CLIENT_NAME,
  SERVER_INSTRUCTIONS,
  TOOL_DEFINITIONS,
  type ToolDefinition,
} from "@askboard/contract";
import { Server, type Tool } from "@modelcontextprotocol/server";
import { failure } from "./diagnostics.ts";
import type { CallContext, ToolCore, ToolDeps } from "./ports.ts";
import { errorResult, type ToolResult } from "./results.ts";

/** The server's name and the plugin's, which make the full tool names (Consistency Conventions). */
export const SERVER_NAME = "askboard";
const FULL_NAME_PREFIX = `mcp__plugin_${SERVER_NAME}_${SERVER_NAME}__`;
const DEFINITION_MAX_CHARS = 4_096;
const FULL_NAME_MAX_CHARS = 128;

export type ToolHandler = (
  deps: ToolDeps,
  args: unknown,
  context: CallContext,
) => Promise<ToolResult>;

/**
 * The Consistency Conventions' limits on what the tool list loads into every session: each
 * description and the instructions within 4,096 characters, each full tool name within 128.
 */
export const listingProblems = (
  definitions: readonly ToolDefinition[],
  instructions: string,
): string[] => {
  const problems: string[] = [];
  const over = (what: string, length: number, max: number) => {
    if (length > max) problems.push(`${what} ${length} characters, more than ${max}`);
  };
  for (const { name, description } of definitions) {
    over(`the description of ${name} has`, description.length, DEFINITION_MAX_CHARS);
    const full = `${FULL_NAME_PREFIX}${name}`;
    over(`the full name ${full} has`, full.length, FULL_NAME_MAX_CHARS);
  }
  over("the server instructions have", instructions.length, DEFINITION_MAX_CHARS);
  return problems;
};

// "ask, update, collect and fetch": the listed names in order, the last after "and".
const listed = (names: readonly string[]): string =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

const TOOL_NAMES = listed(TOOL_DEFINITIONS.map(({ name }) => name));

/** Where Claude Code names a call's tool use in its `_meta` (spike criterion 14). */
const TOOL_USE_ID_KEY = "claudecode/toolUseId";
/** The longest tool use ID an agent record carries (the local API's records schema). */
const TOOL_USE_ID_MAX_CHARS = 256;
/** The per-request envelope's client information (protocol revision 2026-07-28). */
const CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo";

type RequestContext = {
  mcpReq: {
    signal: AbortSignal;
    _meta?: Readonly<Record<string, unknown>>;
    /** The per-request envelope's keys, lifted out of `_meta` by the SDK. */
    envelope?: unknown;
    notify: (notification: { method: string; params: Record<string, unknown> }) => Promise<void>;
  };
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toolUseIdOf = (meta: Readonly<Record<string, unknown>> | undefined): string | undefined => {
  const id = meta?.[TOOL_USE_ID_KEY];
  return typeof id === "string" && id !== "" && id.length <= TOOL_USE_ID_MAX_CHARS ? id : undefined;
};

const contextOf = (ctx: RequestContext): CallContext => {
  const { signal, _meta: meta } = ctx.mcpReq;
  const toolUseId = toolUseIdOf(meta);
  const base: CallContext = toolUseId === undefined ? { signal } : { signal, toolUseId };
  const token = meta?.progressToken;
  if (typeof token !== "string" && typeof token !== "number") return base;
  return {
    ...base,
    progress: (progress, message) =>
      ctx.mcpReq.notify({
        method: "notifications/progress",
        params: { progressToken: token, progress, message },
      }),
  };
};

/**
 * Hands ask-core the Claude Code version the client information names (AD-18): the per-request
 * envelope's, else the one `initialize` gave. A client of another name sets none.
 */
const noteClient = (core: ToolCore, server: Server, ctx: RequestContext): void => {
  const envelope = isRecord(ctx.mcpReq.envelope) ? ctx.mcpReq.envelope : undefined;
  const client: unknown = envelope?.[CLIENT_INFO_KEY] ?? server.getClientVersion();
  if (!isRecord(client) || client.name !== CLAUDE_CODE_CLIENT_NAME) return;
  if (typeof client.version === "string") core.setClientVersion("client-info", client.version);
};

/** The tool server, whose `tools/call` dispatches by name to these handlers. */
export const createToolServer = (
  deps: ToolDeps,
  handlers: Readonly<Record<string, ToolHandler>>,
  version = "0.0.0",
): Server => {
  const server = new Server(
    { name: SERVER_NAME, version },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS },
  );
  // The approved JSON, whose input schemas are objects with JSON values; the contract's tests check
  // them against AD-6, so the SDK's narrower type holds.
  const tools = TOOL_DEFINITIONS.map((definition) => ({ ...definition })) as unknown as Tool[];
  server.setRequestHandler("tools/list", async () => ({ tools }));
  server.setRequestHandler("tools/call", async (request, ctx) => {
    const { name, arguments: args } = request.params;
    noteClient(deps.core, server, ctx);
    const handler = Object.hasOwn(handlers, name) ? handlers[name] : undefined;
    let result: ToolResult;
    if (handler === undefined) {
      result = errorResult(
        `AskBoard has no tool ${JSON.stringify(name.slice(0, 64))}: it lists ${TOOL_NAMES}.`,
      );
    } else {
      try {
        result = await handler(deps, args, contextOf(ctx));
      } catch (error) {
        // `name` is one of the listed tools here, so it is AskBoard's own text.
        deps.diagnostics.write(failure(`${name} failed`, error));
        result = errorResult(`AskBoard's ${name} failed inside. Send the call again.`);
      }
    }
    return server.projectCallToolResult({ ...result, content: [...result.content] }, undefined);
  });
  return server;
};
