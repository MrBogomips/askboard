// The MCP server of the session process (design decision 4): `ask` then `collect`, as the contract's
// copy of the approved definitions, with the cut server instructions. Building it has no side
// effect: `server/discover`, `initialize` and `tools/list` touch nothing (AD-2).

import { SERVER_INSTRUCTIONS, TOOL_DEFINITIONS, type ToolDefinition } from "@askboard/contract";
import { Server, type Tool } from "@modelcontextprotocol/server";
import type { CallContext, ToolDeps } from "./ports.ts";
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

const TOOL_NAMES = TOOL_DEFINITIONS.map(({ name }) => name).join(" and ");

const contextOf = (ctx: {
  mcpReq: {
    signal: AbortSignal;
    _meta?: { progressToken?: string | number };
    notify: (notification: { method: string; params: Record<string, unknown> }) => Promise<void>;
  };
}): CallContext => {
  const token = ctx.mcpReq._meta?.progressToken;
  if (token === undefined) return { signal: ctx.mcpReq.signal };
  return {
    signal: ctx.mcpReq.signal,
    progress: (progress, message) =>
      ctx.mcpReq.notify({
        method: "notifications/progress",
        params: { progressToken: token, progress, message },
      }),
  };
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
    const handler = Object.hasOwn(handlers, name) ? handlers[name] : undefined;
    const result =
      handler === undefined
        ? errorResult(
            `AskBoard has no tool ${JSON.stringify(name.slice(0, 64))}: it lists ${TOOL_NAMES}.`,
          )
        : await handler(deps, args, contextOf(ctx));
    return server.projectCallToolResult({ ...result, content: [...result.content] }, undefined);
  });
  return server;
};
