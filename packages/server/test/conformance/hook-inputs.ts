// Claude Code's hook inputs for the conformance suite (push delivery, task 9.1): what Claude Code
// writes on a hook's stdin for an AskBoard call, `ask`'s result and a subagent's stop, with the
// fields every hook input carries. hook-runs.ts feeds them to the built bundle's hooks.

/** A subagent as Claude Code names it in hook inputs; the main conversation is none. */
export type Agent = { readonly id: string; readonly type: string };

export type HookEvent = "PreToolUse" | "PostToolUse" | "SubagentStop";

const SESSION_ID = "0f6b6a43-6a6c-4c3e-9a55-3d1c1c0e2b7a";
const TOOL_PREFIX = "mcp__plugin_askboard_askboard__";

/** Where the session runs: Claude Code's project, every hook's working folder. */
type Where = { readonly project: string };

/** A tool result, as the MCP client gave it to Claude Code. */
type Outcome = { readonly isError: boolean; readonly text: string };

// The fields every hook input carries, then the event's own.
const inputOf = <F extends object>(session: Where, event: HookEvent, fields: F) => ({
  session_id: SESSION_ID,
  transcript_path: `/Users/paola/.claude/projects/conformance/${SESSION_ID}.jsonl`,
  cwd: session.project,
  permission_mode: "default",
  hook_event_name: event,
  ...fields,
});

const agentOf = (agent: Agent | undefined) =>
  agent === undefined ? {} : { agent_id: agent.id, agent_type: agent.type };

/** Claude Code's `PreToolUse` input for an AskBoard call. */
export const preToolUseInput = (
  session: Where,
  agent: Agent | undefined,
  tool: string,
  toolInput: unknown,
  toolUseId: string,
) =>
  inputOf(session, "PreToolUse", {
    tool_name: `${TOOL_PREFIX}${tool}`,
    tool_input: toolInput,
    tool_use_id: toolUseId,
    ...agentOf(agent),
  });

/** Claude Code's `PostToolUse` input for `ask`: the result as its content blocks. */
export const postToolUseInput = (
  session: Where,
  agent: Agent | undefined,
  toolInput: unknown,
  toolUseId: string,
  outcome: Outcome,
) => {
  const content = [{ type: "text", text: outcome.text }];
  return inputOf(session, "PostToolUse", {
    tool_name: `${TOOL_PREFIX}ask`,
    tool_input: toolInput,
    tool_response: outcome.isError ? { content, isError: true } : content,
    tool_use_id: toolUseId,
    ...agentOf(agent),
  });
};

/** Claude Code's `SubagentStop` input. */
export const subagentStopInput = (session: Where, agent: Agent, stopHookActive: boolean) =>
  inputOf(session, "SubagentStop", {
    stop_hook_active: stopHookActive,
    agent_transcript_path: `/Users/paola/.claude/projects/conformance/subagents/agent-${agent.id}.jsonl`,
    last_assistant_message: "Done.",
    ...agentOf(agent),
  });
