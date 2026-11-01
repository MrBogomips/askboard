// The hooks (AD-5, AD-10, AD-16, AD-19): Claude Code's settings hooks, run as `askboard hook
// <event>` from the session process's executable, and the local API client the mod's fallback runs
// as `askboard client <route> <body>`. They reach the session process only through its local API,
// and import `contract` only (AD-1).

export { sendsToAskBoard } from "./asking-rules.ts";
export {
  CLIENT_EXIT,
  type ClientOptions,
  type ClientOutcome,
  clientProcess,
  runClient,
} from "./client.ts";
export { describeFailure, HookFailure } from "./failure.ts";
export { HOOK_HANDLERS } from "./hooks.ts";
export { HOOK_INPUT_MAX_BYTES, type HookInput, parseInput, readInput } from "./input.ts";
export {
  exchange,
  type LocalApiAnswer,
  type LocalApiRequest,
  sendRequest,
} from "./local-api.ts";
export { askResultOf, postToolUse } from "./post-tool-use.ts";
export {
  ASK_USER_QUESTION_DENIED,
  askIdsOf,
  preToolUse,
  recordOf,
} from "./pre-tool-use.ts";
export {
  flushed,
  hookProcess,
  type ModeProcess,
  type ProcessOutput,
  uidOf,
} from "./process.ts";
export {
  HOOK_EVENTS,
  type HookContext,
  type HookEvent,
  type HookHandler,
  type HookHandlers,
  type HookLocalApi,
  type HookOptions,
  type HookOutcome,
  type HookResult,
  runHook,
} from "./runner.ts";
export { findSession, type SessionLookup } from "./session.ts";
export { stopOf, subagentStop } from "./subagent-stop.ts";
export { ASK_USER_QUESTION, ASKBOARD_TOOL_PREFIXES, askBoardTool } from "./tool-names.ts";
