// Resolution at `update` (excerpts, task 3.3; design decision 4, When and Storage; core spec, "An
// update re-reads only what it changes", "Discard drops resolved context"), with a fake
// `SourceFiles` port.

import { describe, expect, test } from "bun:test";
import { CONTEXT_RESOLVE_BUDGET_MS, type ContextItem } from "@askboard/contract";
import { BoardModel } from "../src/lifecycle/model.ts";
import {
  ADR_POINTER,
  boardItemsOf,
  CONTEXT_ASK_ID,
  contextAsk,
  contextCoreWith,
  excerpt,
  turns,
} from "./context-fakes.ts";
import { answerAct, command } from "./lifecycle-fakes.ts";

const ROLLOUT_POINTER = "docs/rollout.md#Flags";

const created = async (options: Parameters<typeof contextCoreWith>[0] = {}) => {
  const fakes = contextCoreWith(options);
  const pending = fakes.core.ask(
    contextAsk([excerpt("retry-adr", ADR_POINTER)], [excerpt("flags", ROLLOUT_POINTER)]),
  );
  await turns();
  fakes.sources.release();
  await pending;
  fakes.sources.calls.length = 0;
  return fakes;
};

const changeRollout = (items: readonly ContextItem[]) => ({
  askId: CONTEXT_ASK_ID,
  actions: [
    {
      action: "change",
      itemId: "rollout",
      props: { items: items as [ContextItem, ...ContextItem[]] },
    },
  ],
});

const image = (id: string): ContextItem => ({
  type: "image",
  id,
  props: { pointer: `.askboard/media/${id}.png`, alt: id },
});

describe("only what the update revises is read again", () => {
  test("a change to rollout reads rollout's pointers alone, and fix's board document is unchanged", async () => {
    const { core, sources } = await created();
    const fixBefore = boardItemsOf(core, CONTEXT_ASK_ID, "fix");
    const outcome = await core.update(
      changeRollout([excerpt("flags", "docs/rollout.md#Kill switch")]),
    );
    expect(outcome).toMatchObject({ kind: "updated" });
    expect(sources.calls.map((call) => call.pointer)).toEqual(["docs/rollout.md#Kill switch"]);
    expect(boardItemsOf(core, CONTEXT_ASK_ID, "fix")).toEqual(fixBefore);
    expect(boardItemsOf(core, CONTEXT_ASK_ID, "rollout")?.[0]?.props).toMatchObject({
      pointer: "docs/rollout.md#Kill switch",
      status: "resolved",
      text: "text of docs/rollout.md#Kill switch",
    });
  });

  test("an added question with context is read; an update with no pointer reads nothing", async () => {
    const { core, sources } = await created();
    await core.update({
      askId: CONTEXT_ASK_ID,
      actions: [{ action: "change", itemId: "fix", props: { text: "Which fix now?" } }],
    });
    expect(sources.calls.map((call) => call.pointer)).toEqual([ADR_POINTER]);
    sources.calls.length = 0;
    const added = await core.update({
      askId: CONTEXT_ASK_ID,
      actions: [
        {
          action: "add",
          item: {
            type: "question",
            id: "owner",
            props: {
              text: "Who owns it?",
              options: [{ label: "Paola" }, { label: "Marco" }],
              items: [excerpt("owners", "docs/owners.md#Payments")],
            },
          },
        },
      ],
    });
    expect(added).toMatchObject({ kind: "updated" });
    expect(sources.calls.map((call) => call.pointer)).toEqual(["docs/owners.md#Payments"]);
    expect(boardItemsOf(core, CONTEXT_ASK_ID, "owner")?.[0]?.props).toMatchObject({
      status: "resolved",
    });
  });

  test("a reopen's new revision is read again", async () => {
    const { core, sources } = await created();
    await core.update({
      askId: CONTEXT_ASK_ID,
      actions: [{ action: "answer", itemId: "fix", answer: { choice: ["Fix A"] } }],
    });
    expect(sources.calls).toEqual([]);
    await core.update({ askId: CONTEXT_ASK_ID, actions: [{ action: "reopen", itemId: "fix" }] });
    expect(sources.calls.map((call) => call.pointer)).toEqual([ADR_POINTER]);
  });

  test("a change refused by E3's rules reads nothing", async () => {
    const { core, sources } = await created();
    const outcome = await core.update({
      askId: CONTEXT_ASK_ID,
      actions: [
        {
          action: "change",
          itemId: "rollout",
          props: { items: [excerpt("flags", ROLLOUT_POINTER)] },
        },
        { action: "change", itemId: "nowhere", props: { text: "Gone?" } },
      ],
    });
    expect(outcome).toMatchObject({ kind: "refused", index: 1 });
    expect(sources.calls).toEqual([]);
    expect(core.lifecycleBoard(CONTEXT_ASK_ID)).toMatchObject({
      document: { items: [{ rev: 1 }, { rev: 1 }] },
    });
  });
});

describe("the update applies in one step after its reads", () => {
  test("an act between sees the old revision, and the new one applies when the reads end", async () => {
    const { core, sources } = await created({ held: true });
    const pending = core.update(changeRollout([excerpt("flags", "docs/rollout.md#Kill switch")]));
    await turns();
    expect(sources.calls).toHaveLength(1);
    expect(boardItemsOf(core, CONTEXT_ASK_ID, "rollout")?.[0]?.props).toMatchObject({
      pointer: ROLLOUT_POINTER,
    });
    const act = core.act(
      CONTEXT_ASK_ID,
      command([answerAct({ itemId: "fix", rev: 1, choice: ["Fix A"] })]),
    );
    expect(act).toMatchObject({ ok: true });
    sources.release();
    expect(await pending).toMatchObject({
      kind: "updated",
      applied: [{ itemId: "rollout", rev: 2 }],
    });
    expect(boardItemsOf(core, CONTEXT_ASK_ID, "rollout")?.[0]?.props).toMatchObject({
      pointer: "docs/rollout.md#Kill switch",
    });
  });

  test("E3's rules are applied again after the reads: an answer in between refuses the change", async () => {
    const { core, sources } = await created({ held: true });
    const pending = core.update(changeRollout([excerpt("flags", "docs/rollout.md#Kill switch")]));
    await turns();
    const act = core.act(
      CONTEXT_ASK_ID,
      command([answerAct({ itemId: "rollout", rev: 1, choice: ["Yes"] })]),
    );
    expect(act).toMatchObject({ ok: true });
    sources.release();
    expect(await pending).toMatchObject({
      kind: "refused",
      refusal: "answered",
      itemId: "rollout",
    });
    expect(boardItemsOf(core, CONTEXT_ASK_ID, "rollout")?.[0]?.props).toMatchObject({
      pointer: ROLLOUT_POINTER,
      status: "resolved",
    });
  });

  test("updates of one ask apply in the order they came, one reading holding the next", async () => {
    const { core, sources } = await created({ held: true });
    const first = core.update(changeRollout([excerpt("flags", "docs/rollout.md#Kill switch")]));
    const second = core.update({
      askId: CONTEXT_ASK_ID,
      actions: [{ action: "change", itemId: "rollout", props: { text: "Roll out at all?" } }],
    });
    await turns();
    sources.release();
    expect(await first).toMatchObject({ applied: [{ itemId: "rollout", rev: 2 }] });
    await turns();
    sources.release();
    expect(await second).toMatchObject({ applied: [{ itemId: "rollout", rev: 3 }] });
    expect(boardItemsOf(core, CONTEXT_ASK_ID, "rollout")?.[0]?.props).toMatchObject({
      pointer: "docs/rollout.md#Kill switch",
      status: "resolved",
    });
  });

  test("an ask discarded while the update reads stays discarded, and nothing is stored", async () => {
    const { core, sources } = await created({ held: true });
    const pending = core.update(changeRollout([excerpt("flags", "docs/rollout.md#Kill switch")]));
    await turns();
    core.discardAll("session-exit");
    sources.release();
    expect(await pending).toEqual({ kind: "discarded", askId: CONTEXT_ASK_ID });
    expect(core.lifecycleBoard(CONTEXT_ASK_ID)).toEqual({
      askId: CONTEXT_ASK_ID,
      state: "discarded",
    });
  });

  test("an ask closed while the update reads stays closed at its old revision", async () => {
    const { core, sources } = await created({ held: true });
    const pending = core.update(changeRollout([excerpt("flags", "docs/rollout.md#Kill switch")]));
    await turns();
    core.close(CONTEXT_ASK_ID, "agent");
    sources.release();
    expect(await pending).toEqual({ kind: "closed", askId: CONTEXT_ASK_ID });
    expect(boardItemsOf(core, CONTEXT_ASK_ID, "rollout")?.[0]?.props).toMatchObject({
      pointer: ROLLOUT_POINTER,
    });
  });

  test("when the budget ends, the update applies with the slow pointer timeout", async () => {
    const { core, clock } = await created({ hang: ["docs/slow.md#Intro"] });
    const pending = core.update(changeRollout([excerpt("flags", "docs/slow.md#Intro")]));
    await turns();
    clock.advance(CONTEXT_RESOLVE_BUDGET_MS);
    const outcome = await pending;
    expect(outcome).toMatchObject({
      kind: "updated",
      warnings: [{ itemId: "flags", pointer: "docs/slow.md#Intro", reason: "timeout" }],
    });
  });
});

describe("warnings and limits", () => {
  test("the update's warnings name only the pointers of its new revisions", async () => {
    const missing = { status: "unresolved", reason: "not-found" } as const;
    const fakes = contextCoreWith({
      answers: { "docs/gone.md#Intro": { resolveExcerpt: missing } },
    });
    await fakes.core.ask(
      contextAsk([excerpt("gone", "docs/gone.md#Intro")], [excerpt("flags", ROLLOUT_POINTER)]),
    );
    const outcome = await fakes.core.update(
      changeRollout([excerpt("also-gone", "docs/gone.md#Intro")]),
    );
    expect(outcome).toMatchObject({
      kind: "updated",
      warnings: [{ code: "unresolved-pointer", itemId: "also-gone", reason: "not-found" }],
    });
    const quiet = await fakes.core.update(changeRollout([excerpt("flags", ROLLOUT_POINTER)]));
    expect(quiet).not.toHaveProperty("warnings");
  });

  // Core spec, "An update past the bound" (result-bound; Refs #98).
  test("an update past the bound: 60 excerpts of 300-character pointers, the warnings within 10,000 characters, the last counting the rest", async () => {
    const pointers = Array.from(
      { length: 60 },
      (_, n) => `${String(n).padStart(2, "0")}${"m".repeat(293)}.md`,
    );
    const missing = { status: "unresolved", reason: "not-found" } as const;
    const fakes = contextCoreWith({
      answers: Object.fromEntries(pointers.map((p) => [p, { resolveExcerpt: missing }])),
    });
    await fakes.core.ask(contextAsk([excerpt("retry-adr", ADR_POINTER)]));
    const outcome = await fakes.core.update({
      askId: CONTEXT_ASK_ID,
      actions: [
        {
          action: "add",
          item: {
            type: "question",
            id: "many",
            props: {
              text: "Which of these still hold?",
              options: [{ label: "All" }, { label: "None" }],
              items: pointers.map((pointer, n) => excerpt(`ex-${n}`, pointer)) as [
                ContextItem,
                ...ContextItem[],
              ],
            },
          },
        },
      ],
    });
    expect(outcome.kind).toBe("updated");
    const warnings = (outcome.kind === "updated" && outcome.warnings) || [];
    expect(JSON.stringify(warnings).length).toBeLessThanOrEqual(10_000);
    const kept = warnings.length - 1;
    expect(kept).toBeGreaterThan(0);
    expect(warnings.at(-1)?.message).toBe(
      `The pointer of ex-${kept} did not resolve (not-found), and ${60 - kept - 1} more unresolved pointers are left out: fetch their questions to read each one's reason.`,
    );
    const unresolved = (boardItemsOf(fakes.core, CONTEXT_ASK_ID, "many") ?? []).filter(
      (item) => "status" in item.props && item.props.status === "unresolved",
    );
    expect(unresolved).toHaveLength(60);
  });

  test("the per-ask image limit counts the images the other questions hold", async () => {
    const big = "A".repeat(((10 * 1024 * 1024) / 3) * 4);
    const answer = {
      resolveImage: { status: "resolved", mediaType: "image/png", bytes: big },
    } as const;
    const fakes = contextCoreWith({
      answers: { ".askboard/media/one.png": answer, ".askboard/media/two.png": answer },
    });
    await fakes.core.ask(contextAsk([image("one")], [excerpt("flags", ROLLOUT_POINTER)]));
    const outcome = await fakes.core.update(changeRollout([image("two")]));
    expect(outcome).toMatchObject({ warnings: [{ itemId: "two", reason: "too-large" }] });
    const again = await fakes.core.update({
      askId: CONTEXT_ASK_ID,
      actions: [
        { action: "delete", itemId: "fix" },
        { action: "change", itemId: "rollout", props: { items: [image("two")] } },
      ],
    });
    expect(again).not.toHaveProperty("warnings");
  });
});

describe("storage", () => {
  test("a revision's resolutions are pruned with it", () => {
    const { items } = contextAsk([excerpt("retry-adr", ADR_POINTER)]);
    const model = BoardModel.of(items, new Map([["fix", new Map()]]));
    const record = model.question("fix");
    if (record === undefined) throw new Error("no question fix");
    model.revise(record, { ...model.propsOf(record) });
    model.resolved("fix", new Map());
    expect([...record.context.keys()]).toEqual([1, 2]);
    record.decided = 1;
    model.revise(record, { ...model.propsOf(record) });
    expect([...record.revs.keys()]).toEqual([2, 3]);
    expect([...record.context.keys()]).toEqual([2]);
  });

  test("discard drops every resolution with the board documents", async () => {
    const { core } = await created();
    await core.update(changeRollout([image("shot")]));
    core.discardAll("session-exit");
    expect(core.lifecycleBoard(CONTEXT_ASK_ID)).toEqual({
      askId: CONTEXT_ASK_ID,
      state: "discarded",
    });
    expect(core.keptRevisions(CONTEXT_ASK_ID)).toEqual([]);
    expect(core.fullValue(CONTEXT_ASK_ID, "rollout")).toEqual({
      kind: "discarded",
      askId: CONTEXT_ASK_ID,
    });
    const tombstone = JSON.stringify(core.board(CONTEXT_ASK_ID));
    expect(tombstone).not.toContain("text of");
    expect(tombstone).not.toContain("iVBOR");
  });
});
