// Each event's hook, as `hooks/hooks.json` runs them (design decision 6).

import { postToolUse } from "./post-tool-use.ts";
import { preToolUse } from "./pre-tool-use.ts";
import type { HookHandlers } from "./runner.ts";
import { subagentStop } from "./subagent-stop.ts";

export const HOOK_HANDLERS: HookHandlers = {
  PreToolUse: preToolUse,
  PostToolUse: postToolUse,
  SubagentStop: subagentStop,
};
