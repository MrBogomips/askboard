// The permission host's entry, as the run's `mcp.json` declares it.

import { appendFileSync, readFileSync } from "node:fs";
import { RpcPeer, serveMcp } from "../mcp/jsonrpc.ts";
import { entryArgs } from "./args.ts";
import { permissionServer } from "./permission-host.ts";

const { plan, records } = entryArgs(process.argv.slice(2));
if (plan === undefined || records === undefined) {
  process.stderr.write("bench permission host: --plan and --records are required\n");
  process.exit(2);
}
const server = permissionServer(JSON.parse(readFileSync(plan, "utf8")), (entry) =>
  appendFileSync(records, `${JSON.stringify({ ...entry, at: Date.now() })}\n`),
);
serveMcp(new RpcPeer(process.stdin, process.stdout), server);
process.stdin.on("end", () => process.exit(0));
