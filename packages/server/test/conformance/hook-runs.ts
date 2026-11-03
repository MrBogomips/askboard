// Claude Code's hooks in the conformance suite (push delivery, task 9.1; design decision 11): the
// built bundle's hook mode run as a process of this suite, which stands for Claude Code as the
// parent of the session process and of every hook, in the session's environment and project, fed
// the hook input Claude Code writes on stdin, with the guard that refuses a listening socket
// preloaded. An agent's AskBoard call goes as Claude Code makes it: the `PreToolUse` hook, then
// the call with the same tool use ID in its `_meta`, then, for `ask`, the `PostToolUse` hook.

import {
  type Agent,
  type HookEvent,
  postToolUseInput,
  preToolUseInput,
  subagentStopInput,
} from "./hook-inputs.ts";
import { GUARD, type ModeRun, preloadFlag } from "./modes.ts";
import { bundleWith, RUNTIME, type Session, type ToolOutcome } from "./session.ts";

export type { Agent } from "./hook-inputs.ts";

/** Claude Code ends a hook past the timeout each one declares (hooks/hooks.json). */
const HOOK_TIMEOUT_MS = 5_000;

/** Runs the built bundle's hook for `event`, as Claude Code runs it, on `input`. */
export const runHook = async (
  session: Session,
  event: HookEvent,
  input: unknown,
): Promise<ModeRun> => {
  const child = Bun.spawn([RUNTIME, preloadFlag(), GUARD, bundleWith(), "hook", event], {
    cwd: session.project,
    env: session.env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  child.stdin.write(JSON.stringify(input));
  child.stdin.end();
  const timer = setTimeout(() => child.kill("SIGKILL"), HOOK_TIMEOUT_MS);
  try {
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    return { code, stdout, stderr };
  } finally {
    clearTimeout(timer);
  }
};

export type AgentCall = {
  readonly toolUseId: string;
  readonly pre: ModeRun;
  readonly outcome: ToolOutcome;
  /** `ask`'s PostToolUse run. */
  readonly post?: ModeRun;
};

let calls = 0;

/**
 * An agent's AskBoard call as Claude Code makes it: its `PreToolUse` hook, the call carrying the
 * same tool use ID, then `ask`'s `PostToolUse` hook on the result.
 */
export const callAs = async (
  session: Session,
  agent: Agent | undefined,
  tool: "ask" | "collect",
  args: Record<string, unknown>,
): Promise<AgentCall> => {
  calls += 1;
  const toolUseId = `toolu_conformance_${String(calls).padStart(4, "0")}`;
  const pre = await runHook(
    session,
    "PreToolUse",
    preToolUseInput(session, agent, tool, args, toolUseId),
  );
  const outcome = await session.call(tool, args, toolUseId);
  if (tool !== "ask") return { toolUseId, pre, outcome };
  const post = await runHook(
    session,
    "PostToolUse",
    postToolUseInput(session, agent, args, toolUseId, outcome),
  );
  return { toolUseId, pre, outcome, post };
};

/** A subagent's stop, as Claude Code runs its `SubagentStop` hook. */
export const stopAs = (session: Session, agent: Agent, stopHookActive: boolean): Promise<ModeRun> =>
  runHook(session, "SubagentStop", subagentStopInput(session, agent, stopHookActive));
