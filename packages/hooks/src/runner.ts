// The hook runner (design decision 6; AD-5, AD-19): `askboard hook <event>` reads the hook input
// to its end, runs the event's hook, which makes at most one local API request with a 2 s timeout
// to the session process of its parent Claude Code process, and gives what to write: the hook's
// JSON output on stdout, and one stderr line when it did less than it would. It never throws, so
// the process always exits 0 and the agent's call is never blocked by a failure.

import { HOOK_REQUEST_TIMEOUT_MS, type LocalApiMessages } from "@askboard/contract";
import { describeFailure, HookFailure } from "./failure.ts";
import { type HookInput, parseInput, readInput } from "./input.ts";
import { exchange, type LocalApiRequest } from "./local-api.ts";
import { findSession, type SessionLookup } from "./session.ts";

/** The events `hooks/hooks.json` runs, in its order. */
export const HOOK_EVENTS = ["PreToolUse", "PostToolUse", "SubagentStop"] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

/** The one local API request a hook may make. */
export type HookLocalApi = {
  exchange<N extends keyof LocalApiMessages>(
    request: LocalApiRequest,
    response: N,
  ): Promise<LocalApiMessages[N]>;
};

export type HookContext = {
  readonly input: HookInput;
  readonly localApi: HookLocalApi;
  /** The time a record names. */
  readonly now: () => Date;
};

export type HookResult = {
  /** The hook's JSON output for Claude Code; none for no output. */
  readonly output?: Readonly<Record<string, unknown>>;
  /** Why the hook did less than it would, for one stderr line beside any output. */
  readonly problem?: string;
};

export type HookHandler = (context: HookContext) => Promise<HookResult>;

export type HookHandlers = Readonly<Record<HookEvent, HookHandler>>;

export type HookOptions = SessionLookup & {
  /** The hook input, as Claude Code writes it on stdin. */
  readonly stdin: AsyncIterable<Uint8Array | string>;
  readonly now?: () => Date;
  /** The request's timeout; `HOOK_REQUEST_TIMEOUT_MS` by default. */
  readonly timeoutMs?: number;
  readonly handlers: HookHandlers;
};

/** What the hook process writes, each empty for nothing. */
export type HookOutcome = { readonly stdout: string; readonly stderr: string };

const isHookEvent = (event: string): event is HookEvent =>
  (HOOK_EVENTS as readonly string[]).includes(event);

// The local API of the parent's session, found at the first request, which is also the last.
const oneRequest = (lookup: SessionLookup, timeoutMs: number): HookLocalApi => {
  let used = false;
  return {
    exchange: (request, response) => {
      if (used) return Promise.reject(new HookFailure("a hook makes one local API request"));
      used = true;
      return Promise.resolve().then(() =>
        exchange(findSession(lookup), request, response, timeoutMs),
      );
    },
  };
};

/** Runs the hook of `event`; never throws. */
export const runHook = async (event: string, options: HookOptions): Promise<HookOutcome> => {
  if (!isHookEvent(event)) {
    return { stdout: "", stderr: "askboard hook: AskBoard has no hook for the event given\n" };
  }
  const line = (why: string) => `askboard hook ${event}: ${why}\n`;
  try {
    const input = parseInput(await readInput(options.stdin));
    const { output, problem } = await options.handlers[event]({
      input,
      localApi: oneRequest(options, options.timeoutMs ?? HOOK_REQUEST_TIMEOUT_MS),
      now: options.now ?? (() => new Date()),
    });
    return {
      stdout: output === undefined ? "" : `${JSON.stringify(output)}\n`,
      stderr: problem === undefined ? "" : line(describeFailure(new HookFailure(problem))),
    };
  } catch (error) {
    return { stdout: "", stderr: line(describeFailure(error)) };
  }
};
