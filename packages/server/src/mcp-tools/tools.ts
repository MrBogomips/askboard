// The tool server with its four tools, in AD-6's order: `ask`, `update`, `collect` and `fetch`
// (ask-lifecycle, open question 1; E7 adds `snapshot`).

import type { Server } from "@modelcontextprotocol/server";
import { handleAsk } from "./ask.ts";
import { handleCollect } from "./collect.ts";
import { handleFetch } from "./fetch.ts";
import type { ToolDeps } from "./ports.ts";
import { createToolServer as serverWith, type ToolHandler } from "./server.ts";
import { handleUpdate } from "./update.ts";

const HANDLERS: Readonly<Record<string, ToolHandler>> = {
  ask: handleAsk,
  update: handleUpdate,
  collect: handleCollect,
  fetch: handleFetch,
};

/** The session process's MCP server: `ask`, `update`, `collect` and `fetch` over ask-core. */
export const createToolServer = (deps: ToolDeps, version?: string): Server =>
  serverWith(deps, HANDLERS, version);
