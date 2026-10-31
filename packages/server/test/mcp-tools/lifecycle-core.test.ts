import { describe, expect, test } from "bun:test";
import { RESULT_VERSIONS, SCHEMA_IDS } from "@askboard/contract";
import { lifecycleAsk, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { AskCore } from "@askboard/core";
import { connect, depsWith, jsonOf, LINK, runtimeClock } from "./helpers.ts";

// MCP adapter spec: A session without hooks, Fetching an item, Closed and discarded asks in update
// and fetch (ask-lifecycle, tasks 4.2 and 4.3), over the real ask-core.

const [question] = plainChoiceBoardDocument.items;
const plainChoice = {
  askId: plainChoiceBoardDocument.askId,
  items: [{ type: question.type, id: question.id, props: question.props }],
};

const session = async () => {
  const core = new AskCore({
    randomness: { bytes: (count) => crypto.getRandomValues(new Uint8Array(count)) },
    showing: { check: async () => ({ showable: true }), open: () => undefined },
    address: { link: async () => LINK },
    identity: { gitUserName: async () => "Paola Greco", loginName: async () => "paola" },
    report: () => undefined,
    clock: runtimeClock,
  });
  const { client, close } = await connect(depsWith(core).deps);
  const call = async (name: string, args: unknown) =>
    jsonOf(await client.callTool({ name, arguments: args as never })) as Record<string, unknown>;
  return { core, call, close };
};

let actions = 0;
const actionId = () => {
  actions += 1;
  return `${String(actions).padStart(2, "0")}${"a".repeat(20)}`;
};

describe("a session without hooks", () => {
  test("ask warns, and update, collect and fetch mark the ask unchecked", async () => {
    const { call, close } = await session();
    const asked = await call("ask", lifecycleAsk);
    expect(asked.warnings).toEqual([{ code: "no-hooks", message: expect.any(String) }]);
    const askId = lifecycleAsk.askId;
    const updated = await call("update", {
      askId,
      actions: [{ action: "change", itemId: "rollout", props: { text: "How do we roll out?" } }],
    });
    expect(updated).toMatchObject({ askId, state: "waiting", unchecked: true });
    expect(updated.applied).toEqual([{ action: "change", itemId: "rollout", rev: 2 }]);
    expect(validateAgainst(SCHEMA_IDS.updateResult, updated).ok).toBe(true);
    const collected = await call("collect", { asks: [{ askId, after: asked.cursor }] });
    expect(collected.asks).toEqual([expect.objectContaining({ askId, unchecked: true })]);
    const fetched = await call("fetch", { askId, itemId: "rollout" });
    expect(fetched).toMatchObject({ askId, unchecked: true, item: { id: "rollout", rev: 2 } });
    expect(validateAgainst(SCHEMA_IDS.fetchResult, fetched).ok).toBe(true);
    await close();
  });
});

describe("fetch over ask-core", () => {
  test("after a revision, holds the question at its rev with the latest answer and its cursor", async () => {
    const { core, call, close } = await session();
    await call("ask", plainChoice);
    const { askId } = plainChoice;
    const answer = (choice: string) => ({
      type: "answer",
      itemId: question.id,
      rev: 1,
      choice: [choice],
      when: "2026-10-31T09:00:00Z",
    });
    expect(core.act(askId, { actionId: actionId(), acts: [answer("PostgreSQL")] }).ok).toBe(true);
    expect(core.act(askId, { actionId: actionId(), acts: [answer("SQLite")] }).ok).toBe(true);
    const fetched = (await call("fetch", { askId, itemId: question.id })) as {
      item: { rev: number; answer: Record<string, unknown> };
    };
    expect(fetched.item.rev).toBe(1);
    expect(fetched.item.answer).toEqual({
      choice: ["SQLite"],
      cursor: `${core.epoch}.2`,
      who: "Paola Greco",
      when: "2026-10-31T09:00:00Z",
    });
    // fetch raises no `received`: the answers are still undelivered on the board.
    const view = core.lifecycleBoard(askId);
    expect(view?.state !== "discarded" && view?.questions[0]?.answer?.delivered).toBe(false);
    await close();
  });

  test("a closed ask's question holds its answer as it was at the close", async () => {
    const { core, call, close } = await session();
    await call("ask", plainChoice);
    const { askId } = plainChoice;
    core.act(askId, {
      actionId: actionId(),
      acts: [
        {
          type: "answer",
          itemId: question.id,
          rev: 1,
          choice: ["PostgreSQL"],
          when: "2026-10-31T09:00:00Z",
        },
      ],
    });
    expect(await call("update", { askId, actions: [{ action: "close" }] })).toMatchObject({
      state: "closed",
      applied: [{ action: "close" }],
    });
    const fetched = await call("fetch", { askId, itemId: question.id });
    expect(fetched).toMatchObject({
      state: "closed",
      item: { state: "answered", answer: { choice: ["PostgreSQL"] } },
    });
    expect(await call("update", { askId, actions: [{ action: "close" }] })).toEqual({
      versions: RESULT_VERSIONS,
      epoch: core.epoch,
      askId,
      outcome: "closed",
    });
    await close();
  });

  test("an ask from before a restart is discarded in update and fetch, never unknown", async () => {
    const { core, call, close } = await session();
    const askId = "sent-before-restart-k2m9";
    const typed = { versions: RESULT_VERSIONS, epoch: core.epoch, askId, outcome: "discarded" };
    expect(await call("update", { askId, actions: [{ action: "close" }] })).toEqual(typed);
    expect(await call("fetch", { askId, itemId: "database" })).toEqual(typed);
    await close();
  });
});
