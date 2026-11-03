// A hook process with stand-in handlers (task 6.2): every event asks the local API for the rule
// once and outputs it, so the process tests see the runner's request and output alone.

import { LOCAL_API_ROUTES } from "@askboard/contract";
import { HOOK_EVENTS, type HookHandler, type HookHandlers, hookProcess } from "../../src/index.ts";

const asksTheRule: HookHandler = async ({ localApi }) => {
  const { rule } = await localApi.exchange(
    { method: "GET", path: LOCAL_API_ROUTES.rule.path },
    "ruleResponse",
  );
  return { output: { rule } };
};

const handlers = Object.fromEntries(
  HOOK_EVENTS.map((event) => [event, asksTheRule]),
) as unknown as HookHandlers;

await hookProcess(process.argv[2], process, handlers);
