// Helpers for the Snapshot tests (snapshot, group 2): a fake writer that records what it was handed,
// a core with E7's ports beside push delivery's record table, and the lifecycle ask played as the
// contract's Snapshot fixture tells it, from E3's fixtures, on a core whose clock the test sets.

import type { Act, AnswerEvent, OutputEvent, SnapshotData, UpdateAction } from "@askboard/contract";
import { LIFECYCLE, lifecycleCollectResult, lifecycleUpdate } from "@askboard/contract/fixtures";
import {
  AskCore,
  type CoreEvent,
  type HeaderPorts,
  type Origin,
  type SnapshotPorts,
  type SnapshotWriter,
} from "../src/index.ts";
import { type FakeOptions, fakeClock, fakePorts } from "./fakes.ts";
import { areasAsk, command, LIFECYCLE_ID } from "./lifecycle-fakes.ts";
import { callOf, fakeRecordTable } from "./push-fakes.ts";

/** The folder the fixture's Snapshots go to, and the path the fake writer gives. */
export const SNAPSHOT_FOLDER = "/home/sara/shop/.askboard/snapshots";
export const SNAPSHOT_PATH = `${SNAPSHOT_FOLDER}/${LIFECYCLE_ID}-20261031T143000Z-k3x9a1.html`;

/**
 * A writer that records each data it is handed and answers as `answer` says: the path, or a
 * rejection with that error. With `held`, each write waits until the test calls `release`.
 */
export const fakeWriter = (answer: { readonly fails?: unknown; readonly held?: boolean } = {}) => {
  const written: SnapshotData[] = [];
  const waiting: (() => void)[] = [];
  const writer: SnapshotWriter = {
    write: async (data) => {
      written.push(data);
      if (answer.held) await new Promise<void>((resolve) => waiting.push(resolve));
      if (answer.fails !== undefined) throw answer.fails;
      return { path: SNAPSHOT_PATH };
    },
  };
  const release = () => {
    for (const resolve of waiting.splice(0)) resolve();
  };
  return { writer, written, release };
};

/** The display folder `board-host` names the project with (`PushComposition.projectDir`). */
export const SHOP_DIR = "/home/sara/shop";

/** The record table's owner key of the agent that asked: it must never reach a Snapshot. */
export const SHOP_OWNER = "agent-7f3e";

/** Where the main agent asked from: its working folder is the project's root. */
export const SHOP_ORIGIN: Origin = {
  label: "Main agent",
  cwd: "/home/sara/shop-checkout",
  root: "/home/sara/shop-checkout",
  directory: ".",
  branch: "feat/checkout",
};

// The act a logged event records, as the board sent it.
const answerActOf = (event: AnswerEvent): Act => {
  const { itemId, rev, when, choice, other, optionNotes, note } = event;
  if (event.declined) return { type: "decline", itemId, rev, when, ...(note ? { note } : {}) };
  const content = { choice, other, optionNotes, note };
  const given = Object.entries(content).filter(([, value]) => value !== undefined);
  return { type: "answer", itemId, rev, when, ...Object.fromEntries(given) };
};

const actOf = (event: OutputEvent): Act => {
  switch (event.type) {
    case "answer":
      return answerActOf(event);
    case "postponed":
      return { type: "postpone", itemId: event.itemId, rev: event.rev };
    case "reopened":
      return { type: "reopen", itemId: event.itemId };
    case "note":
      return {
        type: "note",
        itemId: event.itemId,
        rev: event.rev,
        note: event.note,
        when: event.when,
      };
    case "follow-up": {
      const { itemId, rev, text, when } = event;
      return { type: "follow-up", itemId, rev, text, when };
    }
    case "edit-choice": {
      const { cursor: _, ...act } = event;
      return act;
    }
    default:
      throw new Error(`no act logs a ${event.type} event`);
  }
};

const [logged] = lifecycleCollectResult.asks;
/** The user's acts of the lifecycle collect result, in their order. */
const LIFECYCLE_ACTS = (logged?.events ?? []).map(actOf);

const actionOf = <K extends UpdateAction["action"]>(kind: K) =>
  lifecycleUpdate.actions.find((action) => action.action === kind) as Extract<
    UpdateAction,
    { action: K }
  >;

export type SnapshotFakeOptions = FakeOptions & {
  /** E7's `CorePorts` field: without it, the core has no Snapshot writer. */
  readonly snapshots?: SnapshotPorts;
  /** The context header's ports, for the expected answerer. */
  readonly header?: HeaderPorts;
};

/** ask-core with E1's fake ports, a fake record table and, when given, E7's ports. */
export const snapshotCoreWith = (options: SnapshotFakeOptions = {}) => {
  const fakes = fakePorts(options);
  const table = fakeRecordTable();
  const { snapshots, header } = options;
  const core = new AskCore({
    ...fakes.ports,
    records: table.port,
    ...(header === undefined ? {} : { header }),
    ...(snapshots === undefined ? {} : { snapshots }),
  });
  const heard: CoreEvent[] = [];
  core.subscribe((event) => heard.push(event));
  return { core, heard, table, ...fakes };
};

const applied = (outcome: { readonly ok: boolean } | { readonly kind: string }) => {
  if ("ok" in outcome ? outcome.ok : outcome.kind === "updated") return;
  throw new Error(`the step was not applied: ${JSON.stringify(outcome)}`);
};

/**
 * The lifecycle ask as `lifecycleSnapshotData` tells it, on an owned ask with the context header's
 * ports: the user's acts of the lifecycle collect result, the agent rewording the rollout question
 * and replying to its follow-up before the edit choice, `received` raised past the payment answer,
 * the launch question added with the user's answer recorded, then the analytics question
 * postponed; the clock stands at the Snapshot's time, 14:30. Returns the ask's board link too.
 */
export const lifecycleSnapshotCore = async (snapshots?: SnapshotPorts) => {
  const clock = fakeClock(Date.parse("2026-10-31T14:00:00Z"));
  const header = { backgroundThresholdMs: 120_000 };
  const options = { clock, git: "Paolo Ferri", header };
  const fixture = snapshotCoreWith(snapshots === undefined ? options : { ...options, snapshots });
  const { core, table } = fixture;
  table.add({ ownerKey: SHOP_OWNER, tool: "ask", askIds: [LIFECYCLE_ID], origin: SHOP_ORIGIN });
  const created = await core.ask(areasAsk(), callOf("ask", LIFECYCLE_ID));
  if (created.kind !== "created") throw new Error(`the ask was not created: ${created.kind}`);
  const act = (acts: readonly Act[]) => {
    for (const one of acts) applied(core.act(LIFECYCLE_ID, command([one])));
  };
  const update = async (actions: readonly UpdateAction[]) =>
    applied(await core.update({ askId: LIFECYCLE_ID, actions }));
  const until = (time: string) => clock.advance(Date.parse(time) - clock.now());
  act(LIFECYCLE_ACTS.slice(0, 6));
  until("2026-10-31T14:09:30Z");
  const reply = { ...actionOf("reply"), followUp: `${core.epoch}.4` };
  await update([actionOf("change"), reply]);
  act(LIFECYCLE_ACTS.slice(6));
  core.markRead(LIFECYCLE_ID, `${core.epoch}.9`);
  until("2026-10-31T14:16:00Z");
  const record = {
    action: "answer",
    itemId: "launch",
    answer: { choice: ["Before Black Friday"] },
  };
  await update([actionOf("add"), record as UpdateAction]);
  act([{ type: "postpone", itemId: "analytics", rev: 1 }]);
  until("2026-10-31T14:30:00Z");
  return { ...fixture, link: created.ask.board };
};

/** The data with the core's epoch written as the fixtures' (`k3x9`), so they compare whole. */
export const asFixtureEpoch = (data: SnapshotData, epoch: string): SnapshotData =>
  JSON.parse(JSON.stringify(data).replaceAll(epoch, LIFECYCLE.epoch));
