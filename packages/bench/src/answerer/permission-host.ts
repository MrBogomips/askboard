// The permission host of the AskUserQuestion arm: a stdio MCP server whose one tool `-p` calls as
// its `--permission-prompt-tool` (design decision 6). It speaks the 2025 handshake only, so that
// arm runs with MCP_PROTOCOL_NEGOTIATION=legacy (proposal, open question 8).

import { fileURLToPath } from "node:url";
import type { McpServer } from "../mcp/jsonrpc.ts";
import type { PlanEntry } from "../scenarios.ts";
import { approve, type PermissionRecord } from "./auq.ts";

/** The server's name in the run's `mcp.json`; the tool's full name is `mcp__bench__approve`. */
export const PERMISSION_SERVER = "bench";
export const PERMISSION_TOOL = "approve";
export const PERMISSION_TOOL_NAME = `mcp__${PERMISSION_SERVER}__${PERMISSION_TOOL}`;
export const PERMISSION_HOST = fileURLToPath(new URL("./permission-host-main.ts", import.meta.url));

export const permissionServer = (
  plan: readonly PlanEntry[],
  record: (entry: PermissionRecord) => void,
): McpServer => ({
  name: PERMISSION_SERVER,
  version: "0.0.0",
  tools: [
    {
      name: PERMISSION_TOOL,
      description: "Benchmark permission host: allows AskUserQuestion with the scripted answers.",
      inputSchema: {
        type: "object",
        properties: {
          tool_name: { type: "string" },
          input: { type: "object" },
          tool_use_id: { type: "string" },
        },
        required: ["tool_name", "input"],
      },
    },
  ],
  call: async (_name, args) => {
    const { decision, record: entry } = approve(args, plan);
    record(entry);
    return { content: [{ type: "text", text: JSON.stringify(decision) }] };
  },
});
