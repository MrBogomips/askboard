// The tool server with its five tools, in AD-6's order: `ask`, `update`, `collect` and `fetch`
// (ask-lifecycle, open question 1), then E7's `snapshot` in its own block (snapshot design
// decision 7).

import type { Server } from "@modelcontextprotocol/server";
import { handleAsk } from "./ask.ts";
import { handleCollect } from "./collect.ts";
import { handleFetch } from "./fetch.ts";
import type { ToolDeps } from "./ports.ts";
import { createToolServer as serverWith, type ToolHandler } from "./server.ts";
import { handleSnapshot } from "./snapshot.ts";
import { handleUpdate } from "./update.ts";

const HANDLERS: Readonly<Record<string, ToolHandler>> = {
  ask: handleAsk,
  update: handleUpdate,
  collect: handleCollect,
  fetch: handleFetch,
  // E7 (snapshot design decision 7).
  snapshot: handleSnapshot,
};

/**
 * The session process's MCP server: `ask`, `update`, `collect`, `fetch` and `snapshot` over
 * ask-core.
 */
export const createToolServer = (deps: ToolDeps, version?: string): Server =>
  serverWith(deps, HANDLERS, version);
