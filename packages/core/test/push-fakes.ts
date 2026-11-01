// Fakes for push delivery's ports: a record table on a fake clock that binds as design decision 4
// says the local API's table does, and a notifier that records its notices.

import { RECORD_HOLD_MS, RECORD_TIMEOUT_MS } from "@askboard/contract";
import {
  type AgentRecords,
  AskCore,
  type Binding,
  type CallIdentity,
  type CoreEvent,
  type CorePorts,
  type Notice,
  type Origin,
  type Timers,
} from "../src/index.ts";
import { type FakeOptions, fakePorts } from "./fakes.ts";

/** A hook's record as the table keeps it, the Claude Code identifiers already mapped to a key. */
export type FakeRecord = {
  readonly ownerKey: string;
  readonly tool: string;
  readonly askIds: readonly string[];
  readonly toolUseId?: string;
  readonly origin?: Origin;
};

type Held = FakeRecord & { readonly at: number; bound: boolean };

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * The record table's rules: a call binds the record with its `tool_use_id` whatever its age; a
 * call without one binds the oldest unbound record of the same tool and ask IDs within the record
 * timeout, one without a `tool_use_id` first; a record left unbound past the hold time expires. A
 * record binds once.
 */
export const fakeRecordTable = () => {
  let now = 0;
  const held: Held[] = [];
  const calls: CallIdentity[] = [];
  const live = (record: Held) => !record.bound && now - record.at <= RECORD_HOLD_MS;
  const fallback = (call: CallIdentity) => {
    const matches = (candidate: Held) =>
      live(candidate) &&
      now - candidate.at <= RECORD_TIMEOUT_MS &&
      candidate.tool === call.tool &&
      sameIds(candidate.askIds, call.askIds);
    return (
      held.find((candidate) => matches(candidate) && candidate.toolUseId === undefined) ??
      held.find(matches)
    );
  };
  const port: AgentRecords = {
    bind: async (call) => {
      calls.push(call);
      const record =
        call.toolUseId === undefined
          ? fallback(call)
          : held.find((candidate) => live(candidate) && candidate.toolUseId === call.toolUseId);
      if (record === undefined) return undefined;
      record.bound = true;
      const { ownerKey, origin } = record;
      const binding: Binding = call.tool === "ask" && origin ? { ownerKey, origin } : { ownerKey };
      return binding;
    },
  };
  return {
    port,
    calls,
    add: (record: FakeRecord) => {
      held.push({ ...record, at: now, bound: false });
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
};

export const MAIN_ORIGIN: Origin = {
  label: "Main agent",
  cwd: "/home/paola/orders",
  root: "/home/paola/orders",
  branch: "main",
};

export const REVIEWER_ORIGIN: Origin = {
  label: "Subagent code-reviewer",
  cwd: "/home/paola/orders-worktrees/fix-retry/services",
  root: "/home/paola/orders-worktrees/fix-retry",
  branch: "fix/retry",
  worktree: "fix-retry",
};

/** Timers on a fake clock: `advance` runs, in time order, every timer it passes. */
export const fakeTimers = () => {
  let now = 0;
  const pending: { at: number; run: () => void; cancelled: boolean }[] = [];
  const timers: Timers = {
    after: (ms, run) => {
      const timer = { at: now + ms, run, cancelled: false };
      pending.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  };
  return {
    timers,
    /** Timers neither run nor cancelled. */
    pending: () => pending.filter((timer) => !timer.cancelled && timer.at > now).length,
    advance: (ms: number) => {
      const until = now + ms;
      for (;;) {
        const due = pending
          .filter((timer) => !timer.cancelled && timer.at <= until)
          .sort((a, b) => a.at - b.at)[0];
        if (due === undefined) break;
        due.cancelled = true;
        now = due.at;
        due.run();
      }
      now = until;
    },
  };
};

export type PushFakeOptions = FakeOptions & {
  /** Leave out the record table, as in a session whose local API never started. */
  readonly noRecords?: boolean;
  /** Leave out the notifier. */
  readonly noNotices?: boolean;
  /** A notifier that throws. */
  readonly noticeFails?: boolean;
  /** Leave out the diagnostics port. */
  readonly noDiagnose?: boolean;
  /**
   * The context header's ports (design decision 12): fake timers, with this background threshold
   * (`null`: never moved to the background). Left out unless given, as in E1.
   */
  readonly header?: { readonly backgroundThresholdMs: number | null };
  /** A git user name lookup that throws. */
  readonly gitFails?: boolean;
};

/** ask-core with E1's fake ports, a fake record table and a recording notifier. */
export const pushCoreWith = (options: PushFakeOptions = {}) => {
  const fakes = fakePorts(options);
  if (options.gitFails) {
    const ports = fakes.ports as { identity: CorePorts["identity"] };
    ports.identity = {
      ...fakes.ports.identity,
      gitUserName: async () => {
        fakes.calls.push("git");
        throw new Error("git is not installed");
      },
    };
  }
  const table = fakeRecordTable();
  const headerTimers = fakeTimers();
  const notices: Notice[] = [];
  const diagnosed: string[] = [];
  const header = options.header;
  const core = new AskCore({
    ...fakes.ports,
    ...(header === undefined
      ? {}
      : {
          header: {
            timers: headerTimers.timers,
            ...(header.backgroundThresholdMs === null
              ? {}
              : { backgroundThresholdMs: header.backgroundThresholdMs }),
          },
        }),
    ...(options.noDiagnose ? {} : { diagnose: (text: string) => diagnosed.push(text) }),
    ...(options.noRecords ? {} : { records: table.port }),
    ...(options.noNotices
      ? {}
      : {
          notices: {
            notify: (notice: Notice) => {
              fakes.calls.push("notify");
              if (options.noticeFails) throw new Error("notify-send is gone");
              notices.push(notice);
            },
          },
        }),
  });
  const heard: CoreEvent[] = [];
  core.subscribe((event) => heard.push(event));
  return { core, heard, table, notices, diagnosed, headerTimers, ...fakes };
};

/** The call identity of an `ask` or a `collect` naming one ask. */
export const callOf = (tool: string, askId: string, toolUseId?: string): CallIdentity => ({
  tool,
  askIds: [askId],
  ...(toolUseId === undefined ? {} : { toolUseId }),
});

/**
 * A listener that sends receipts as `board-host` does: on each `received` raise, one receipt per
 * answer of the ask that the board shows delivered and that had none yet (AD-3).
 */
export const fakeReceipts = (core: AskCore) => {
  const receipts: string[] = [];
  core.subscribe((event) => {
    if (event.type !== "received") return;
    for (const question of core.board(event.askId)?.questions ?? []) {
      const receipt = `${event.askId} ${question.itemId}`;
      if (question.answer?.delivered && !receipts.includes(receipt)) receipts.push(receipt);
    }
  });
  return receipts;
};
