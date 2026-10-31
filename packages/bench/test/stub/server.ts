// The stub session process over stdio, as Claude Code or bench's scripted client starts it from
// this folder's plugin manifest. Boards open only through BROWSER, started with the link as its
// only argument, as E1's notifier does (E1 design decision 6).

import { spawn } from "node:child_process";
import { RpcPeer, serveMcp } from "../../src/mcp/jsonrpc.ts";
import { eventsOf } from "../../src/process.ts";
import { createStub } from "./stub.ts";

const COLLECT_MAX_WAIT_MS = 20 * 60_000;
const browser = process.env.BROWSER;

const stub = createStub({
  ...(browser
    ? {
        open: (link: string) => {
          const child = spawn(browser, [link], { detached: true, stdio: "ignore", shell: false });
          eventsOf(child).on("error", () =>
            process.stderr.write("stub: BROWSER failed to start\n"),
          );
          child.unref();
        },
      }
    : {}),
  waitMs: COLLECT_MAX_WAIT_MS,
});

serveMcp(new RpcPeer(process.stdin, process.stdout), stub.server);

let ending = false;
const end = async () => {
  if (ending) return;
  ending = true;
  await stub.shutdown();
  process.exit(0);
};
process.stdin.on("end", end);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, end);
