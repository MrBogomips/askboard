import { describe, expect, test } from "bun:test";
import { originMessage, type SnapshotData } from "@askboard/contract";
import {
  type LifecycleTranscriptStep,
  lifecycleDraftRecord,
  lifecycleSnapshotData,
  lifecycleTranscripts,
} from "@askboard/contract/fixtures";
import { validateSnapshotData } from "@askboard/contract/validate";
import { gatherSnapshot, type SnapshotSources } from "../src/snapshot/gather.ts";
import { areasAsk, boardOf, command, created, LIFECYCLE_ID } from "./lifecycle-fakes.ts";
import { asFixtureEpoch, lifecycleSnapshotCore, SHOP_DIR, SHOP_OWNER } from "./snapshot-fakes.ts";

// Snapshot spec, through the core spec's requirements What a Snapshot holds, What a Snapshot never
// holds and Unsent work noted, never read (snapshot task 2.2, design decision 3): the pure gathering
// over what ask-core shows of an ask, as a table over E3's fixtures. Its board state is built with
// the gathering's own receipt mapping, which must give the state `board-host` sends (decision 1,
// Receipts): E3's transcripts record that state message by message.

type Core = Awaited<ReturnType<typeof created>>["core"];

const TAKEN_AT = "2026-10-31T14:30:00Z";

// The whole log, read as its owner reads it: an unchecked ask takes any caller.
const logOf = (core: Core) => {
  const read = core.read(LIFECYCLE_ID, `${core.epoch}.0`, { ownerKey: SHOP_OWNER });
  if (read.kind !== "events") throw new Error(`the log was not read: ${read.kind}`);
  return read.events;
};

const sourcesOf = (core: Core): SnapshotSources => ({
  epoch: core.epoch,
  board: boardOf(core, LIFECYCLE_ID),
  kept: core.keptRevisions(LIFECYCLE_ID) ?? [],
  log: logOf(core),
  takenAt: TAKEN_AT,
  taker: { takenBy: "agent" },
});

const gather = (core: Core, fields: Partial<SnapshotSources> = {}): SnapshotData =>
  gatherSnapshot({ ...sourcesOf(core), ...fields });

const valid = (data: SnapshotData) => {
  const checked = validateSnapshotData(data);
  expect(checked.ok ? [] : checked.problems).toEqual([]);
};

// Plays a lifecycle transcript's acts, drafts and agent updates into the core; at each board and
// state message the host sent, the Snapshot's document and state must equal it. Returns the types
// of the messages compared.
const replay = async (core: Core, steps: readonly LifecycleTranscriptStep[]): Promise<string[]> => {
  const compared: string[] = [];
  for (const step of steps) {
    if (step.from === "session" && step.event === "update") await core.update(step.request);
    if (!("message" in step)) continue;
    const message = step.message;
    if (message.type === "act") core.act(LIFECYCLE_ID, command(message.acts, message.actionId));
    if (message.type === "draft") core.holdDraft(LIFECYCLE_ID, message.record);
    if (step.from !== "host") continue;
    if (message.type === "board") expect(gather(core).document).toEqual(message.document);
    if (message.type === "state") expect(gather(core).state).toEqual(message.state);
    if (message.type === "board" || message.type === "state") compared.push(message.type);
  }
  return compared;
};

describe("the gathering over E3's transcripts", () => {
  test.each(Object.entries(lifecycleTranscripts))(
    "%s: the document and the state equal every board and state message the board got",
    async (_, transcript) => {
      const { core } = await created(areasAsk());
      const compared = await replay(core, transcript.steps);
      expect(compared).toContain("board");
      expect(compared).toContain("state");
      valid(gather(core));
    },
  );

  test("an answer `received` has passed is delivered, as `board-host` maps it; the others are sent", async () => {
    const { core } = await created(areasAsk());
    const when = "2026-10-31T14:05:12Z";
    core.act(
      LIFECYCLE_ID,
      command([{ type: "answer", itemId: "region", rev: 1, choice: ["EU"], when }]),
    );
    core.act(LIFECYCLE_ID, command([{ type: "decline", itemId: "payment", rev: 1, when }]));
    core.markRead(LIFECYCLE_ID, `${core.epoch}.1`);
    const [region, payment] = gather(core).state.questions;
    expect(region).toEqual({
      itemId: "region",
      rev: 1,
      state: "answered",
      answer: { choice: ["EU"], when, receipt: "delivered" },
    });
    expect(payment).toEqual({
      itemId: "payment",
      rev: 1,
      state: "declined",
      answer: { declined: true, when, receipt: "sent" },
    });
  });
});

describe("what a Snapshot holds", () => {
  test("the lifecycle ask played as the contract's Snapshot fixture tells it gives that fixture", async () => {
    const { core } = await lifecycleSnapshotCore();
    const asked = core.whoAsked(LIFECYCLE_ID);
    const data = gather(core, { projectDir: SHOP_DIR, ...(asked ? { asked } : {}) });
    valid(data);
    expect(data.epoch).toBe(core.epoch);
    expect(asFixtureEpoch(data, core.epoch)).toEqual(lifecycleSnapshotData);
  });

  test("an answer on an older revision: that revision's props beside the current document", async () => {
    const { core } = await lifecycleSnapshotCore();
    const data = gather(core);
    const rollout = data.events.filter(
      ({ event }) => "itemId" in event && event.itemId === "rollout",
    );
    expect(rollout.map(({ event }) => [event.type, "rev" in event ? event.rev : 0])).toEqual([
      ["follow-up", 1],
      ["edit-choice", 2],
      ["answer", 1],
    ]);
    const [rev1] =
      core.keptRevisions(LIFECYCLE_ID)?.find(({ itemId }) => itemId === "rollout")?.revisions ?? [];
    expect(data.revisions.map(({ itemId, rev }) => [itemId, rev])).toEqual([["rollout", 1]]);
    expect(rev1).toBeDefined();
    expect(data.revisions[0]?.props).toEqual(rev1?.props as never);
    expect(data.revisions[0]?.props.text).toBe("How should the new checkout roll out?");
    const delivery = data.document.items[1];
    const current = delivery?.type === "area" ? delivery.props.items[0] : undefined;
    expect(current).toMatchObject({ id: "rollout", rev: 2 });
    expect(current?.props.text).toBe("How should the new checkout roll out to customers?");
  });

  test("a revision kept for unsent work that no event names is left out, and so is the current one", async () => {
    const { core } = await created(areasAsk());
    await core.update({
      askId: LIFECYCLE_ID,
      actions: [{ action: "change", itemId: "payment", props: { text: "Reworded" } }],
    });
    expect(
      core.keptRevisions(LIFECYCLE_ID)?.find(({ itemId }) => itemId === "payment")?.revisions,
    ).toHaveLength(2);
    expect(gather(core).revisions).toEqual([]);
  });

  test("the origin is the row `board-host` sends: `originMessage(projectDir, whoAsked)`", async () => {
    const { core } = await lifecycleSnapshotCore();
    const asked = core.whoAsked(LIFECYCLE_ID) ?? {};
    const data = gather(core, { projectDir: SHOP_DIR, asked });
    expect(data.origin).toEqual(originMessage(SHOP_DIR, asked));
    expect(data.origin).toMatchObject({
      who: { label: "Main agent", name: "Planner" },
      project: "shop",
    });
  });

  test("an unchecked ask's origin names no agent but `Agent`", async () => {
    const { core } = await created(areasAsk());
    const data = gather(core, { projectDir: SHOP_DIR, asked: {} });
    expect(data.origin).toEqual(originMessage(SHOP_DIR, {}));
    valid(data);
  });

  test("without the display project folder, or without who asked, there is no origin", async () => {
    const { core } = await lifecycleSnapshotCore();
    const asked = core.whoAsked(LIFECYCLE_ID) ?? {};
    expect(gather(core, { asked })).not.toHaveProperty("origin");
    expect(gather(core, { projectDir: SHOP_DIR })).not.toHaveProperty("origin");
  });

  test("an answer logged after the gathering is absent from it", async () => {
    const { core } = await created(areasAsk());
    const data = gather(core);
    const before = structuredClone(data);
    const when = "2026-10-31T14:05:12Z";
    core.act(
      LIFECYCLE_ID,
      command([{ type: "answer", itemId: "region", rev: 1, choice: ["EU"], when }]),
    );
    await core.update({
      askId: LIFECYCLE_ID,
      actions: [{ action: "change", itemId: "payment", props: { text: "New" } }],
    });
    expect(data).toEqual(before);
    expect(data.events).toEqual([]);
    expect(gather(core).events).toHaveLength(1);
  });
});

describe("who took it", () => {
  test("the agent's: its time, and no one named", async () => {
    const { core } = await created(areasAsk());
    expect(gather(core).snapshot).toEqual({ takenAt: TAKEN_AT, takenBy: "agent" });
  });

  test("the user's: who answers, and unsent work only as the request says", async () => {
    const { core } = await created(areasAsk());
    const user = { takenBy: "user", who: "Sara Conti" } as const;
    const noted = gather(core, { taker: { ...user, unsentWork: true } });
    expect(noted.snapshot).toEqual({ ...user, takenAt: TAKEN_AT, unsentWork: true });
    expect(gather(core, { taker: { ...user, unsentWork: false } }).snapshot).toEqual({
      ...user,
      takenAt: TAKEN_AT,
    });
    valid(noted);
  });
});

describe("what a Snapshot never holds", () => {
  test("no draft, board link, token, agent record or agent status, searched as text", async () => {
    const { core, link } = await lifecycleSnapshotCore();
    core.holdDraft(LIFECYCLE_ID, {
      ...lifecycleDraftRecord,
      questions: { analytics: { rev: 1, note: "Unsent open-prompt text", composer: "Unsent ask" } },
    });
    expect(core.agentStatus(LIFECYCLE_ID)).toBeDefined();
    const asked = core.whoAsked(LIFECYCLE_ID) ?? {};
    const user = { takenBy: "user", who: "Sara Conti", unsentWork: true } as const;
    for (const data of [
      gather(core, { projectDir: SHOP_DIR, asked }),
      gather(core, { taker: user }),
    ]) {
      const text = JSON.stringify(data);
      const token = new URL(link).searchParams.get("t") ?? "a token";
      for (const absent of [
        "Unsent open-prompt text",
        "Unsent ask",
        '"inView"',
        '"held"',
        '"composer"',
        link,
        "127.0.0.1",
        token,
        SHOP_OWNER,
        "/home/sara/shop-checkout",
        '"status"',
        '"agent":',
      ]) {
        expect(text).not.toContain(absent);
      }
    }
  });
});
