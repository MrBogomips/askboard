// The tool server with its two tools, `ask` and `collect` (proposal, open question 4).

import type { Server } from "@modelcontextprotocol/server";
import { handleAsk } from "./ask.ts";
import { handleCollect } from "./collect.ts";
import type { ToolDeps } from "./ports.ts";
import { createToolServer as serverWith, type ToolHandler } from "./server.ts";

const HANDLERS: Readonly<Record<string, ToolHandler>> = {
  ask: handleAsk,
  collect: handleCollect,
};

/** The session process's MCP server: `ask` and `collect` over ask-core. */
export const createToolServer = (deps: ToolDeps, version?: string): Server =>
  serverWith(deps, HANDLERS, version);
