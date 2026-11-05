// Test helpers for mcp-tools: a fake core that records its calls, a manual clock, and an MCP client
// linked to the tool server over an in-memory transport.

import type { QuestionState } from "@askboard/contract";
import type {
  AskOutcome,
  Binding,
  CallIdentity,
  Clock,
  CoreEvent,
  FullValue,
  LifecycleBoardView,
  OwnerRefusal,
  ReadOutcome,
  SnapshotOutcome,
  SnapshotRequester,
  UpdateOutcome,
} from "@askboard/core";
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
  /** Each call identity `ask` and `bind` received, and each binding `read` received. */
  readonly identities: (CallIdentity | undefined)[];
  readonly bindings: (Binding | undefined)[];
  /** Each client version set, as "<source> <version>". */
  readonly versions: string[];
  readonly listeners: Set<(event: CoreEvent) => void>;
  emit(event: CoreEvent): void;
  /** Each request `snapshot` received (E7). */
  readonly snapshots: SnapshotRequester[];
};

type FakeState = "waiting" | "partly-answered" | "answered" | "closed" | "discarded";

type FakeCoreOptions = {
  readonly ask?: (request: unknown) => Promise<AskOutcome>;
  readonly read?: (askId: string, after: string, caller?: Binding) => ReadOutcome;
  /** The binding of every call; none by default, as without hooks. */
  readonly binding?: Binding;
  /** The owners of asks; every ask is unchecked by default, as without hooks. */
  readonly owners?: Readonly<Record<string, Binding>>;
  /** Each ask's owner refusal of every call; none by default (AD-5). */
  readonly refusals?: Readonly<Record<string, OwnerRefusal>>;
  readonly items?: Readonly<Record<string, readonly string[]>>;
  readonly states?: Record<string, FakeState>;
  /** Each question's state by ask, then by item ID; `open` unless given. */
  readonly questionStates?: Record<string, Record<string, QuestionState>>;
  readonly update?: (request: unknown) => UpdateOutcome;
  readonly fullValue?: (askId: string, itemId: string) => FullValue;
  /** What `lifecycleBoard` shows; built from `items`, `states` and `questionStates` unless given. */
  readonly lifecycle?: (askId: string) => LifecycleBoardView | undefined;
  /** What `snapshot` gives (E7); `discarded` unless given. */
  readonly snapshot?: (askId: string, request: SnapshotRequester) => Promise<SnapshotOutcome>;
};

// A board document of plain questions at rev 1, by the fake's item IDs.
const fakeView = (options: FakeCoreOptions, askId: string): LifecycleBoardView => {
  const state = options.states?.[askId] ?? "waiting";
  if (state === "discarded") return { askId, state };
  const items = options.items?.[askId] ?? ["database"];
  const props = { text: "Which?", options: [{ label: "A" }, { label: "B" }] };
  return {
    askId,
    state,
    document: {
      version: "1.1",
      askId,
      title: "Which?",
      items: items.map((id) => ({ type: "question", id, rev: 1, props })),
    } as never,
    questions: items.map((itemId) => ({
      itemId,
      rev: 1,
      state: options.questionStates?.[askId]?.[itemId] ?? "open",
      thread: [],
    })),
  };
};

export const fakeCore = (options: FakeCoreOptions = {}): FakeCore => {
  const calls: string[] = [];
  const identities: (CallIdentity | undefined)[] = [];
  const bindings: (Binding | undefined)[] = [];
  const versions: string[] = [];
  const listeners = new Set<(event: CoreEvent) => void>();
  const snapshots: SnapshotRequester[] = [];
  return {
    epoch: EPOCH,
    calls,
    identities,
    bindings,
    versions,
    listeners,
    emit: (event) => {
      for (const listener of listeners) listener(event);
    },
    ask: async (request, call) => {
      calls.push("ask");
      identities.push(call);
      return (
        options.ask?.(request) ?? {
          kind: "created",
          ask: { askId: ASK_ID, state: "waiting", cursor: `${EPOCH}.0`, board: LINK },
        }
      );
    },
    read: (askId, after, caller) => {
      calls.push(`read ${askId} ${after}`);
      bindings.push(caller);
      return (
        options.read?.(askId, after, caller) ?? {
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
    update: async (request) => {
      calls.push("update");
      return (
        options.update?.(request) ?? {
          kind: "invalid",
          problems: [],
        }
      );
    },
    fullValue: (askId, itemId) => {
      calls.push(`fullValue ${askId} ${itemId}`);
      return options.fullValue?.(askId, itemId) ?? { kind: "missing", askId, itemId };
    },
    lifecycleBoard: (askId) => options.lifecycle?.(askId) ?? fakeView(options, askId),
    bind: async (call) => {
      calls.push("bind");
      identities.push(call);
      return options.binding;
    },
    ownerOf: (askId) => options.owners?.[askId],
    ownerRefusal: (askId, caller) => {
      calls.push(`ownerRefusal ${askId}`);
      bindings.push(caller);
      return options.refusals?.[askId];
    },
    setClientVersion: (source, version) => {
      versions.push(`${source} ${version}`);
    },
    snapshots,
    snapshot: async (askId, request) => {
      calls.push(`snapshot ${askId}`);
      snapshots.push(request);
      return (await options.snapshot?.(askId, request)) ?? { outcome: "discarded" };
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

export type ClientOptions = {
  readonly name?: string;
  readonly version?: string;
  readonly negotiation?: "auto" | "legacy";
};

/** An MCP client linked to the tool server, served as the session process serves it. */
export const connect = async (deps: ToolDeps, options: ClientOptions = {}) => {
  const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
  const handle = serveStdio(() => createToolServer(deps), { transport: serverEnd });
  const client = new Client(
    { name: options.name ?? "test", version: options.version ?? "0.0.0" },
    options.negotiation === undefined ? {} : { versionNegotiation: { mode: options.negotiation } },
  );
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
