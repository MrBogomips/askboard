// The PreToolUse hooks (design decision 6; AD-5, AD-16):
// - on every AskBoard tool, the agent record of the call, sent before the call reaches the session
//   process; never a decision, so the call proceeds whatever happens;
// - on AskUserQuestion, a deny pointing to AskBoard's ask tool when the effective rule sends the
//   question to AskBoard and a board can be shown; otherwise nothing, so the question proceeds.

import { type AgentRecord, LOCAL_API_ROUTES, LOCAL_API_VERSION } from "@askboard/contract";
import { sendsToAskBoard } from "./asking-rules.ts";
import { HookFailure } from "./failure.ts";
import type { HookInput } from "./input.ts";
import type { HookContext, HookHandler, HookResult } from "./runner.ts";
import { ASK_USER_QUESTION, askBoardTool } from "./tool-names.ts";

/** Why AskUserQuestion is refused: the agent asks through AskBoard instead (AD-16). */
export const ASK_USER_QUESTION_DENIED =
  "The asking rule in effect sends this question to AskBoard: ask it with AskBoard's ask tool instead of AskUserQuestion, then collect the answer.";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

/**
 * The ask IDs a call names, in the order the session process reads them: `askId` (`ask`, `update`,
 * `fetch`), then every `asks[].askId` (`collect`). Only strings count.
 */
export const askIdsOf = (toolInput: unknown): string[] => {
  if (!isRecord(toolInput)) return [];
  const own = typeof toolInput.askId === "string" ? [toolInput.askId] : [];
  const listed = Array.isArray(toolInput.asks)
    ? toolInput.asks.flatMap((entry: unknown) =>
        isRecord(entry) && typeof entry.askId === "string" ? [entry.askId] : [],
      )
    : [];
  return [...own, ...listed];
};

/** The agent record of an AskBoard call, from Claude Code's hook input (AD-5). */
export const recordOf = (input: HookInput, toolName: string, now: Date): AgentRecord => {
  const cwd = text(input.cwd);
  if (cwd === undefined) throw new HookFailure("the hook input has no cwd");
  const agentId = text(input.agent_id);
  const toolUseId = text(input.tool_use_id);
  return {
    version: LOCAL_API_VERSION,
    ...(agentId === undefined ? {} : { agent_id: agentId }),
    ...(typeof input.agent_type === "string" ? { agent_type: input.agent_type } : {}),
    cwd,
    ...(toolUseId === undefined ? {} : { tool_use_id: toolUseId }),
    tool_name: toolName,
    askIds: askIdsOf(input.tool_input),
    timestamp: now.toISOString(),
  };
};

const sendRecord = async (
  { input, localApi, now }: HookContext,
  toolName: string,
): Promise<HookResult> => {
  const { method, path } = LOCAL_API_ROUTES.records;
  await localApi.exchange(
    { method, path, body: recordOf(input, toolName, now()) },
    "recordsResponse",
  );
  return {};
};

const DENY: HookResult = {
  output: {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ASK_USER_QUESTION_DENIED,
    },
  },
};

const applyRule = async ({ input, localApi }: HookContext): Promise<HookResult> => {
  const { method, path } = LOCAL_API_ROUTES.rule;
  const { rule, showable } = await localApi.exchange({ method, path }, "ruleResponse");
  if (!showable) return {};
  let sends: boolean;
  try {
    sends = sendsToAskBoard(rule, input.tool_input);
  } catch {
    return { problem: "the asking rule in effect has no predicate yet, so the question proceeds" };
  }
  return sends ? DENY : {};
};

export const preToolUse: HookHandler = async (context) => {
  const { tool_name: toolName } = context.input;
  if (askBoardTool(toolName) !== undefined) return sendRecord(context, toolName as string);
  if (toolName === ASK_USER_QUESTION) return applyRule(context);
  return { problem: "AskBoard has no PreToolUse hook for this tool" };
};
