// Test helpers for mcp-tools: a fake core that records its calls, a manual clock, and an MCP client
// linked to the tool server over an in-memory transport.

import type { AskOutcome, Clock, CoreEvent, ReadOutcome } from "@askboard/core";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  createToolServer,
  type Timers,
  type ToolCore,
  type ToolDeps,
} from "../../src/mcp-tools/index.ts";

/** ask-core's Clock port over the runtime's timers, as the session entry point gives it. */
export const runtimeClock: Clock = {
  now: () => Date.now(),
  after: (ms, run) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
};

export const EPOCH = "k3x9w2q7";
export const ASK_ID = "order-db-choice-x7k2";
export const LINK = `http://127.0.0.1:47213/b/${ASK_ID}?t=pV3xK9qLmT2wR7nB4cYh8A`;

export type FakeCore = ToolCore & {
  readonly calls: string[];
  readonly listeners: Set<(event: CoreEvent) => void>;
  emit(event: CoreEvent): void;
};

type FakeCoreOptions = {
  readonly ask?: (request: unknown) => Promise<AskOutcome>;
  readonly read?: (askId: string, after: string) => ReadOutcome;
  readonly items?: Readonly<Record<string, readonly string[]>>;
  readonly states?: Record<string, "waiting" | "answered" | "discarded">;
};

export const fakeCore = (options: FakeCoreOptions = {}): FakeCore => {
  const calls: string[] = [];
  const listeners = new Set<(event: CoreEvent) => void>();
  return {
    epoch: EPOCH,
    calls,
    listeners,
    emit: (event) => {
      for (const listener of listeners) listener(event);
    },
    ask: async (request) => {
      calls.push("ask");
      return (
        options.ask?.(request) ?? {
          kind: "created",
          ask: { askId: ASK_ID, state: "waiting", cursor: `${EPOCH}.0`, board: LINK },
        }
      );
    },
    read: (askId, after) => {
      calls.push(`read ${askId} ${after}`);
      return (
        options.read?.(askId, after) ?? {
          kind: "events",
          askId,
          state: options.states?.[askId] ?? "waiting",
          cursor: after,
          events: [],
        }
      );
    },
    markRead: (askId, cursor) => {
      calls.push(`markRead ${askId} ${cursor}`);
      return true;
    },
    board: (askId) => {
      const items = options.items?.[askId] ?? ["database"];
      return {
        state: options.states?.[askId] ?? "waiting",
        questions: items.map((itemId) => ({ itemId, rev: 1 })),
      } as never;
    },
    subscribe: (listener) => {
      calls.push("subscribe");
      listeners.add(listener);
      return () => {
        calls.push("unsubscribe");
        listeners.delete(listener);
      };
    },
    discardAll: () => {
      calls.push("discardAll");
      return 0;
    },
  };
};

/** A clock the test moves by hand. */
export const manualTimers = () => {
  let now = 0;
  const pending = new Map<number, { at: number; run: () => void }>();
  let next = 0;
  const timers: Timers = {
    after: (ms, run) => {
      const id = next++;
      pending.set(id, { at: now + ms, run });
      return () => pending.delete(id);
    },
  };
  const advance = async (ms: number) => {
    const target = now + ms;
    for (;;) {
      const due = [...pending.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort(([, a], [, b]) => a.at - b.at)[0];
      if (due === undefined) break;
      const [id, timer] = due;
      now = timer.at;
      pending.delete(id);
      timer.run();
      await Bun.sleep(0);
    }
    now = target;
    await Bun.sleep(0);
  };
  return { timers, advance, pending: () => pending.size };
};

export type Written = string[];

export const depsWith = (core: ToolCore, timers: Timers = manualTimers().timers) => {
  const written: Written = [];
  const deps: ToolDeps = { core, timers, diagnostics: { write: (line) => written.push(line) } };
  return { deps, written };
};

/** An MCP client linked to the tool server, served as the session process serves it. */
export const connect = async (deps: ToolDeps) => {
  const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
  const handle = serveStdio(() => createToolServer(deps), { transport: serverEnd });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientEnd);
  return {
    client,
    close: async () => {
      await client.close();
      await handle.close();
    },
  };
};

/** The JSON a successful tool result carries. */
export const jsonOf = (result: { content?: unknown; isError?: boolean }): unknown => {
  const [block] = result.content as { type: string; text: string }[];
  return JSON.parse(block?.text ?? "null");
};

export const textOf = (result: { content?: unknown }): string =>
  ((result.content as { text: string }[])[0]?.text ?? "") as string;
