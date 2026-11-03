// What mcp-tools needs from outside: ask-core, a clock for waits and exits, and a stderr writer.

import type { AskCore } from "@askboard/core";

/**
 * The part of ask-core the tools use. The ask lifecycle adds `update`, `fetch`'s full value and
 * what the board shows, which `collect`'s wait reads (ask-lifecycle, design decision 4); push
 * delivery adds its binding and version gate, and the waiting `collect` reports of the agent status
 * (design decision 12), which E1's fakes leave out.
 */
export type ToolCore = Pick<
  AskCore,
  | "epoch"
  | "ask"
  | "read"
  | "markRead"
  | "board"
  | "subscribe"
  | "discardAll"
  | "update"
  | "fullValue"
  | "lifecycleBoard"
  | "bind"
  | "ownerOf"
  | "ownerRefusal"
  | "setClientVersion"
> &
  Partial<Pick<AskCore, "waitStarted">>;

/** Runs `run` once after `ms` milliseconds; the returned function cancels it. */
export type Timers = {
  after(ms: number, run: () => void): () => void;
};

/** Diagnostics on stderr: fixed text only, never agent content and never a token (AD-11). */
export type Diagnostics = {
  write(line: string): void;
};

export type ToolDeps = {
  readonly core: ToolCore;
  readonly timers: Timers;
  readonly diagnostics: Diagnostics;
  /**
   * Whether an owner key is the main conversation's, from the record table (design decision 12):
   * its waits count only until Claude Code's background threshold. Without it, no owner is.
   */
  readonly mainConversation?: (ownerKey: string) => boolean;
};

/** What a tool handler gets from its MCP request. */
export type CallContext = {
  /** Aborted when the client cancels the request. */
  readonly signal: AbortSignal;
  /** Sends a progress notification; absent when the request carries no progress token. */
  readonly progress?: (progress: number, message: string) => Promise<void>;
  /**
   * The request's `_meta["claudecode/toolUseId"]`, which the call's agent record carries too
   * (design decision 4); absent when the request carries none.
   */
  readonly toolUseId?: string;
};

/** The timers of the running process. */
export const systemTimers: Timers = {
  after: (ms, run) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
};
