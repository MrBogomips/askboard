// AskBoard's mod (AD-4, AD-5; design decision 7): the push transport inside Claude Code, and the
// pending asks above the prompt. The mod build bundles this module into `hooks/askboard-mod.js`, the
// hooks module `hooks/hooks.json` names, which exports `register(on)` alone.

import { drawBand } from "./band.ts";
import { createMemory } from "./memory.ts";
import type { On } from "./mod-api.ts";
import { start } from "./poll.ts";
import { subagentStepped, subagentTurnCompleted, subagentTurnStarted } from "./subagent-turns.ts";
import { turnChanged } from "./turn-reports.ts";
import { mainTurnCompleted, mainTurnStarted, mainTurnStepped } from "./turns.ts";

/**
 * Hooks the session's start, the turns and the band above the prompt; one memory per loaded module.
 * The turn hooks count each agent's requests and never wait for a report, which goes with the next
 * poll.
 */
export function register(on: On): void {
  const memory = createMemory();
  on("session.start", async ($, e, next) => {
    await start(memory, $);
    return next(e);
  });
  // Every agent's turn start and completion is reported, for the agent status (design decision 12).
  on("turn.start", async ($, e, next) => {
    turnChanged(memory, $, e.agentId, true);
    if (e.agentId === undefined) await mainTurnStarted(memory, $);
    else subagentTurnStarted(memory, e.agentId);
    return next(e);
  });
  // A streaming event: the hook is an async generator that forwards the request's stream unread.
  on("turn.step", async function* (_$, e, next) {
    if (e.agentId === undefined) mainTurnStepped(memory);
    else subagentStepped(memory, e.agentId);
    return yield* next(e);
  });
  // The catch-up submit is never awaited: it waits for the session to be idle, after this hook.
  on("turn.complete", async ($, e, next) => {
    turnChanged(memory, $, e.agentId, false);
    if (e.agentId === undefined) mainTurnCompleted(memory, $);
    else subagentTurnCompleted(memory, e.agentId);
    return next(e);
  });
  // The pending asks above the prompt (PO decision of 2026-11-03), from the last poll's list.
  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => drawBand(memory, $, e, next));
}
