import { describe, expect, test } from "bun:test";
import type { QuestionItem, UpdateAction } from "@askboard/contract";
import { lifecycleUpdate } from "@askboard/contract/fixtures";
import {
  answerAct,
  areasAsk,
  boardOf,
  command,
  created,
  FLAT_ID,
  flatAsk,
  LIFECYCLE_ID,
  logOf,
  statesOf,
  WHEN,
} from "./lifecycle-fakes.ts";

// Core spec: Updates apply atomically, Adding an item, Changing an item, Deleting an item,
// Reopening a question (ask-lifecycle, task 3.1). The agent's own changes append no event (AD-3).

type Core = Awaited<ReturnType<typeof created>>["core"];

const update = (core: Core, askId: string, ...actions: UpdateAction[]) =>
  core.update({ askId, actions });

const question = (id: string, text = `Question ${id}?`): QuestionItem => ({
  type: "question",
  id,
  props: { text, options: [{ label: "Yes" }, { label: "No" }] },
});

const idsOf = (core: Core, askId: string) =>
  boardOf(core, askId).document.items.map((item) =>
    item.type === "area" ? [item.id, item.props.items.map(({ id }) => id)] : item.id,
  );

describe("adding an item", () => {
  test("adding first without after, and last after the last question", async () => {
    const { core } = await created(flatAsk());
    const outcome = await update(
      core,
      FLAT_ID,
      { action: "add", item: question("q0") },
      { action: "add", item: question("q9"), after: "q3" },
    );
    expect(outcome).toEqual({
      kind: "updated",
      askId: FLAT_ID,
      state: "waiting",
      applied: [
        { action: "add", itemId: "q0", rev: 1 },
        { action: "add", itemId: "q9", rev: 1 },
      ],
    });
    expect(idsOf(core, FLAT_ID)).toEqual(["q0", "q1", "q2", "q3", "q9"]);
    expect(logOf(core, FLAT_ID)).toEqual([]);
  });

  test("a question goes into the area parentId names, after the sibling after names", async () => {
    const { core } = await created(areasAsk());
    await update(
      core,
      LIFECYCLE_ID,
      { action: "add", item: question("launch"), parentId: "delivery", after: "rollout" },
      { action: "add", item: question("tax"), parentId: "scope" },
    );
    expect(idsOf(core, LIFECYCLE_ID)).toEqual([
      ["scope", ["tax", "region", "payment", "analytics"]],
      ["delivery", ["rollout", "launch", "erp-export"]],
    ]);
    expect(statesOf(core, LIFECYCLE_ID)).toMatchObject({ launch: "open", tax: "open" });
  });

  test("an area goes at the top level of an ask of areas", async () => {
    const { core } = await created(areasAsk());
    const area = {
      type: "area",
      id: "support",
      props: { title: "Support", items: [question("hotline")] },
    } as const;
    expect(
      await update(core, LIFECYCLE_ID, { action: "add", item: area, after: "scope" }),
    ).toMatchObject({
      kind: "updated",
      applied: [{ action: "add", itemId: "support" }],
    });
    expect(idsOf(core, LIFECYCLE_ID)).toEqual([
      ["scope", ["region", "payment", "analytics"]],
      ["support", ["hotline"]],
      ["delivery", ["rollout", "erp-export"]],
    ]);
    expect(boardOf(core, LIFECYCLE_ID).questions.find((q) => q.itemId === "hotline")).toMatchObject(
      { rev: 1, state: "open" },
    );
  });

  test("a question added to an answered ask is open at rev 1, and the ask partly answered", async () => {
    const { core } = await created(flatAsk());
    core.act(
      FLAT_ID,
      command([
        answerAct(),
        answerAct({ itemId: "q2", choice: ["WSL"] }),
        answerAct({ itemId: "q3", choice: ["Sara"] }),
      ]),
    );
    expect(boardOf(core, FLAT_ID).state).toBe("answered");
    const outcome = await update(core, FLAT_ID, {
      action: "add",
      item: question("q4"),
      after: "q3",
    });
    expect(outcome).toMatchObject({ kind: "updated", state: "partly-answered" });
    expect(boardOf(core, FLAT_ID).questions.at(-1)).toMatchObject({
      itemId: "q4",
      rev: 1,
      state: "open",
    });
  });

  test.each([
    ["an ID in use", { action: "add", item: question("q2") }, "in-use", "q2"],
    [
      "an area at the top level of an ask without areas",
      {
        action: "add",
        item: { type: "area", id: "more", props: { title: "More", items: [question("q7")] } },
      },
      "area-rule",
      "more",
    ],
    [
      "a question into an area of an ask without areas",
      { action: "add", item: question("q5"), parentId: "q1" },
      "parent",
      "q5",
    ],
    [
      "after naming no item where it goes",
      { action: "add", item: question("q5"), after: "q7" },
      "after",
      "q5",
    ],
  ] as const)("adding with %s is refused", async (_, action, refusal, itemId) => {
    const { core } = await created(flatAsk());
    const before = boardOf(core, FLAT_ID).document;
    const outcome = await update(core, FLAT_ID, action as UpdateAction);
    expect(outcome).toMatchObject({ kind: "refused", index: 0, refusal, itemId });
    expect(boardOf(core, FLAT_ID).document).toEqual(before);
  });

  test.each([
    ["a question at the top level of an ask of areas", { item: question("loose") }, "area-rule"],
    [
      "a question into an area that is not one",
      { item: question("loose"), parentId: "region" },
      "parent",
    ],
    [
      "a question after an item of another area",
      { item: question("loose"), parentId: "scope", after: "rollout" },
      "after",
    ],
    [
      "an area holding a question whose ID is in use",
      { item: { type: "area", id: "more", props: { title: "More", items: [question("region")] } } },
      "in-use",
    ],
  ] as const)("in an ask of areas, %s is refused", async (_, fields, refusal) => {
    const { core } = await created(areasAsk());
    expect(
      await update(core, LIFECYCLE_ID, { action: "add", ...fields } as UpdateAction),
    ).toMatchObject({
      kind: "refused",
      refusal,
    });
  });

  test("reusing a deleted item's ID is refused, naming the ID as in use", async () => {
    const { core } = await created(flatAsk());
    await update(core, FLAT_ID, { action: "delete", itemId: "q2" });
    const outcome = await update(core, FLAT_ID, { action: "add", item: question("q2") });
    expect(outcome).toMatchObject({ kind: "refused", index: 0, itemId: "q2", refusal: "in-use" });
    expect(outcome.kind === "refused" && outcome.detail).toContain("deleted");
  });
});

describe("updates apply atomically", () => {
  test("a second action refused: neither applies, naming action 1 and the answered question", async () => {
    const { core, heard } = await created(flatAsk());
    core.act(FLAT_ID, command([answerAct({ itemId: "q2", choice: ["Linux"] })]));
    heard.length = 0;
    const before = boardOf(core, FLAT_ID);
    const outcome = await update(
      core,
      FLAT_ID,
      { action: "add", item: question("q4") },
      { action: "change", itemId: "q2", props: { text: "Reworded" } },
    );
    expect(outcome).toMatchObject({
      kind: "refused",
      index: 1,
      itemId: "q2",
      cursor: `${core.epoch}.1`,
      refusal: "answered",
    });
    expect(boardOf(core, FLAT_ID)).toEqual(before);
    expect(heard).toEqual([]);
  });

  test("each action sees what the earlier ones leave: add, then change what was added", async () => {
    const { core } = await created(flatAsk());
    const outcome = await update(
      core,
      FLAT_ID,
      { action: "add", item: question("q4") },
      { action: "change", itemId: "q4", props: { text: "Changed at once?" } },
      { action: "delete", itemId: "q4" },
    );
    expect(outcome).toMatchObject({
      kind: "updated",
      applied: [
        { action: "add", itemId: "q4", rev: 1 },
        { action: "change", itemId: "q4", rev: 2 },
        { action: "delete", itemId: "q4" },
      ],
    });
    expect(idsOf(core, FLAT_ID)).toEqual(["q1", "q2", "q3"]);
  });

  test("an update publishes the board document and the state once, document first", async () => {
    const { core, heard } = await created(flatAsk());
    await update(
      core,
      FLAT_ID,
      { action: "add", item: question("q4") },
      { action: "change", itemId: "q1", props: { text: "Reworded" } },
    );
    expect(heard).toEqual([
      { type: "document", askId: FLAT_ID },
      { type: "state", askId: FLAT_ID },
    ]);
  });

  test("the fixture's update of every action applies, as the fixture's result says", async () => {
    const { core } = await created(areasAsk());
    core.act(
      LIFECYCLE_ID,
      command([
        answerAct({ itemId: "region", choice: ["EU", "US"] }),
        answerAct({ itemId: "payment", choice: undefined, other: "Mollie" }),
        { type: "postpone", itemId: "erp-export", rev: 1 },
        { type: "follow-up", itemId: "rollout", rev: 1, text: "Why behind a flag?", when: WHEN },
      ]),
    );
    const fixture = structuredClone(lifecycleUpdate) as typeof lifecycleUpdate;
    const reply = fixture.actions[5];
    if (reply?.action === "reply") Object.assign(reply, { followUp: `${core.epoch}.4` });
    const outcome = await core.update(fixture);
    expect(outcome).toEqual({
      kind: "updated",
      askId: LIFECYCLE_ID,
      state: "closed",
      applied: [
        { action: "add", itemId: "launch", rev: 1 },
        { action: "change", itemId: "rollout", rev: 2 },
        { action: "delete", itemId: "analytics" },
        { action: "reopen", itemId: "region", rev: 2 },
        {
          action: "answer",
          itemId: "erp-export",
          rev: 1,
          recorded: { who: "Sara Conti", when: "2026-10-31T14:20:03Z" },
        },
        { action: "reply", itemId: "rollout" },
        { action: "close" },
      ],
    });
    expect(logOf(core, LIFECYCLE_ID)).toHaveLength(4);
  });
});

describe("deleting an item", () => {
  test("deleting the only postponed question of an otherwise answered ask: gone, and answered", async () => {
    const { core } = await created(flatAsk());
    core.act(
      FLAT_ID,
      command([
        answerAct(),
        answerAct({ itemId: "q2", choice: ["WSL"] }),
        { type: "postpone", itemId: "q3", rev: 1 },
      ]),
    );
    core.act(FLAT_ID, command([{ type: "reopen", itemId: "q3" }]));
    core.act(FLAT_ID, command([{ type: "postpone", itemId: "q3", rev: 1 }]));
    expect(await update(core, FLAT_ID, { action: "delete", itemId: "q3" })).toMatchObject({
      kind: "updated",
      state: "answered",
      applied: [{ action: "delete", itemId: "q3" }],
    });
    expect(idsOf(core, FLAT_ID)).toEqual(["q1", "q2"]);
  });

  test("an open last question deleted makes a partly answered ask answered", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([answerAct(), answerAct({ itemId: "q2", choice: ["WSL"] })]));
    expect(boardOf(core, FLAT_ID).state).toBe("partly-answered");
    expect(await update(core, FLAT_ID, { action: "delete", itemId: "q3" })).toMatchObject({
      state: "answered",
    });
  });

  test("deleting the only question of an ask is refused, saying to close the ask instead", async () => {
    const { core } = await created({ askId: "solo-a1b2", items: [question("only")] });
    const outcome = await update(core, "solo-a1b2", { action: "delete", itemId: "only" });
    expect(outcome).toMatchObject({ kind: "refused", refusal: "last-question", itemId: "only" });
    expect(outcome.kind === "refused" && outcome.detail).toContain("close");
  });

  test("deleting every area in turn is refused at the last one", async () => {
    const { core } = await created(areasAsk());
    const outcome = await update(
      core,
      LIFECYCLE_ID,
      { action: "delete", itemId: "scope" },
      { action: "delete", itemId: "delivery" },
    );
    expect(outcome).toMatchObject({ kind: "refused", index: 1, refusal: "last-question" });
  });

  test("an answered question is refused, naming its cursor; an area holding one too", async () => {
    const { core } = await created(areasAsk());
    core.act(LIFECYCLE_ID, command([answerAct({ itemId: "payment", choice: ["Stripe"] })]));
    expect(await update(core, LIFECYCLE_ID, { action: "delete", itemId: "payment" })).toMatchObject(
      {
        kind: "refused",
        itemId: "payment",
        cursor: `${core.epoch}.1`,
        refusal: "answered",
      },
    );
    const area = await update(core, LIFECYCLE_ID, { action: "delete", itemId: "scope" });
    expect(area).toMatchObject({
      kind: "refused",
      itemId: "scope",
      cursor: `${core.epoch}.1`,
      refusal: "answered",
    });
    expect(area.kind === "refused" && area.detail).toContain("payment");
  });

  test("an area and its questions go together; an area emptied by its last question goes too", async () => {
    const { core } = await created(areasAsk());
    await update(
      core,
      LIFECYCLE_ID,
      { action: "delete", itemId: "rollout" },
      { action: "delete", itemId: "erp-export" },
    );
    expect(idsOf(core, LIFECYCLE_ID)).toEqual([["scope", ["region", "payment", "analytics"]]]);
    expect(
      await update(core, LIFECYCLE_ID, {
        action: "change",
        itemId: "delivery",
        props: { title: "x" },
      }),
    ).toMatchObject({ kind: "refused", refusal: "deleted", itemId: "delivery" });
  });

  test("acts on a deleted question are refused and append nothing", async () => {
    const { core } = await created(flatAsk());
    await update(core, FLAT_ID, { action: "delete", itemId: "q1" });
    expect(core.act(FLAT_ID, command([answerAct()]))).toMatchObject({
      ok: false,
      refusal: "unknown-item",
      itemId: "q1",
    });
    expect(logOf(core, FLAT_ID)).toEqual([]);
  });

  test.each([
    ["a deleted item", "deleted"],
    ["an item the ask never held", "unknown-item"],
  ] as const)("deleting %s is refused", async (_, refusal) => {
    const { core } = await created(flatAsk());
    await update(core, FLAT_ID, { action: "delete", itemId: "q1" });
    const itemId = refusal === "deleted" ? "q1" : "q8";
    expect(await update(core, FLAT_ID, { action: "delete", itemId })).toMatchObject({
      kind: "refused",
      refusal,
      itemId,
    });
  });
});

describe("reopening a question", () => {
  test("reopening an answer: open at rev 2 with no answer, the rev 1 answer kept as previous", async () => {
    const { core } = await created(areasAsk());
    core.act(LIFECYCLE_ID, command([answerAct({ itemId: "erp-export", choice: ["No"] })]));
    const outcome = await update(core, LIFECYCLE_ID, { action: "reopen", itemId: "erp-export" });
    expect(outcome).toMatchObject({
      kind: "updated",
      state: "partly-answered",
      applied: [{ action: "reopen", itemId: "erp-export", rev: 2 }],
    });
    const reopened = boardOf(core, LIFECYCLE_ID).questions.at(-1);
    expect(reopened).toMatchObject({ itemId: "erp-export", rev: 2, state: "open" });
    expect(reopened?.answer).toBeUndefined();
    expect(reopened?.previous).toMatchObject({
      choice: ["No"],
      cursor: `${core.epoch}.1`,
      who: "Sara Conti",
    });
    expect(logOf(core, LIFECYCLE_ID)).toHaveLength(1);
  });

  test("an answered ask becomes partly answered; a board answer names the new rev, replacing nothing", async () => {
    const { core } = await created(flatAsk());
    core.act(
      FLAT_ID,
      command([
        answerAct(),
        answerAct({ itemId: "q2", choice: ["WSL"] }),
        { type: "decline", itemId: "q3", rev: 1, when: WHEN },
      ]),
    );
    expect(boardOf(core, FLAT_ID).state).toBe("answered");
    await update(core, FLAT_ID, { action: "reopen", itemId: "q3" });
    expect(boardOf(core, FLAT_ID).state).toBe("partly-answered");
    expect(
      core.act(FLAT_ID, command([answerAct({ itemId: "q3", choice: ["Sara"] })])),
    ).toMatchObject({ ok: false, refusal: "stale-rev" });
    const answered = core.act(
      FLAT_ID,
      command([answerAct({ itemId: "q3", rev: 2, choice: ["Sara"] })]),
    );
    expect(answered.ok && answered.events[0]).toMatchObject({ rev: 2 });
    expect(answered.ok && "replaces" in (answered.events[0] ?? {})).toBe(false);
  });

  test.each([
    ["an open question", [], "not-answered", "q1"],
    ["a postponed question", [{ type: "postpone", itemId: "q1", rev: 1 }], "not-answered", "q1"],
  ] as const)("reopening %s is refused", async (_, before, refusal, itemId) => {
    const { core } = await created(flatAsk());
    if (before.length > 0) core.act(FLAT_ID, command(before as never));
    expect(await update(core, FLAT_ID, { action: "reopen", itemId })).toMatchObject({
      kind: "refused",
      refusal,
      itemId,
    });
  });

  test("reopening an area is refused: only a question is reopened", async () => {
    const { core } = await created(areasAsk());
    expect(await update(core, LIFECYCLE_ID, { action: "reopen", itemId: "scope" })).toMatchObject({
      kind: "refused",
      refusal: "not-question",
      itemId: "scope",
    });
  });
});

describe("update outcomes for the ask itself", () => {
  test("an ask this epoch does not hold is discarded, never unknown", async () => {
    const { core } = await created(flatAsk());
    expect(await update(core, "never-asked", { action: "close" })).toEqual({
      kind: "discarded",
      askId: "never-asked",
    });
  });
});
