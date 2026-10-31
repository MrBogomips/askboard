import { describe, expect, test } from "bun:test";
import type { UpdateAction } from "@askboard/contract";
import { lifecycleBoardDocument, lifecycleFetchResult } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { canonicalize } from "../src/index.ts";
import {
  answerAct,
  areasAsk,
  command,
  created,
  FLAT_ID,
  flatAsk,
  LIFECYCLE_ID,
  WHEN,
} from "./lifecycle-fakes.ts";

// Core spec: Full value of an item (ask-lifecycle, task 3.5; FR-20), with the generation counter
// that `fetch`'s continuations name (design decision 4).

type Core = Awaited<ReturnType<typeof created>>["core"];

const update = (core: Core, askId: string, ...actions: UpdateAction[]) =>
  core.update({ askId, actions });

const generationOf = (core: Core, askId: string, itemId: string): number => {
  const value = core.fullValue(askId, itemId);
  if (value.kind !== "item") throw new Error(`no full value for ${itemId}: ${value.kind}`);
  return value.generation;
};

// The fetch result an item's full value makes, for the contract's schema.
const asResult = (core: Core, value: ReturnType<Core["fullValue"]>) =>
  value.kind === "item"
    ? {
        versions: { result: "1.1", output: "1.1" },
        epoch: core.epoch,
        askId: value.askId,
        state: value.state,
        item: value.item,
        unchecked: true,
      }
    : undefined;

describe("the full value of an item", () => {
  test("an answered question: its rev, props, state and answer in full with its cursor", async () => {
    const { core } = await created(areasAsk());
    core.act(
      LIFECYCLE_ID,
      command([
        answerAct({
          itemId: "region",
          choice: ["EU", "US"],
          optionNotes: { US: "East coast only, at first." },
        }),
      ]),
    );
    const value = core.fullValue(LIFECYCLE_ID, "region");
    expect(value).toEqual({
      kind: "item",
      askId: LIFECYCLE_ID,
      state: "partly-answered",
      item: {
        ...lifecycleFetchResult.item,
        answer: {
          ...(lifecycleFetchResult.item as { answer: object }).answer,
          cursor: `${core.epoch}.1`,
          when: WHEN,
        },
      } as never,
      generation: expect.any(Number),
    });
    expect(
      validateAgainst("urn:askboard:tool-envelopes:fetch-result", asResult(core, value)).ok,
    ).toBe(true);
  });

  test("an open question has its state and no answer; an area its title and questions", async () => {
    const { core } = await created(areasAsk());
    expect(core.fullValue(LIFECYCLE_ID, "payment")).toMatchObject({
      item: { type: "question", id: "payment", rev: 1, state: "open" },
    });
    const area = core.fullValue(LIFECYCLE_ID, "scope");
    expect(area).toMatchObject({
      kind: "item",
      item: { type: "area", id: "scope", props: lifecycleBoardDocument.items[0]?.props },
    });
    expect(
      validateAgainst("urn:askboard:tool-envelopes:fetch-result", asResult(core, area)).ok,
    ).toBe(true);
  });

  test("a revised answer: the latest, with its cursor", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([answerAct()]));
    core.act(FLAT_ID, command([answerAct({ choice: ["release"] })]));
    expect(core.fullValue(FLAT_ID, "q1")).toMatchObject({
      item: { state: "answered", answer: { choice: ["release"], cursor: `${core.epoch}.2` } },
    });
  });

  test("a recorded answer is marked recorded and has no cursor; a reopen keeps it as previous", async () => {
    const { core } = await created(flatAsk());
    update(core, FLAT_ID, { action: "answer", itemId: "q3", answer: { other: "Ines" } });
    const recorded = core.fullValue(FLAT_ID, "q3");
    expect(recorded).toMatchObject({
      item: {
        state: "answered",
        answer: {
          other: "Ines",
          who: "unknown user",
          when: "2026-10-31T14:20:03Z",
          recorded: true,
        },
      },
    });
    const answer = recorded.kind === "item" && "answer" in recorded.item && recorded.item.answer;
    expect(answer && "cursor" in answer).toBe(false);
    update(core, FLAT_ID, { action: "reopen", itemId: "q3" });
    const reopened = core.fullValue(FLAT_ID, "q3");
    expect(reopened).toMatchObject({
      item: { rev: 2, state: "open", previous: { other: "Ines", recorded: true } },
    });
    expect(reopened.kind === "item" && "answer" in reopened.item).toBe(false);
    expect(
      validateAgainst("urn:askboard:tool-envelopes:fetch-result", asResult(core, reopened)).ok,
    ).toBe(true);
  });

  test("a declined question carries its decline", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([{ type: "decline", itemId: "q1", rev: 1, note: "No", when: WHEN }]));
    expect(core.fullValue(FLAT_ID, "q1")).toMatchObject({
      item: {
        state: "declined",
        answer: { declined: true, note: "No", cursor: `${core.epoch}.1` },
      },
    });
  });

  test("a closed ask's items are as they were at the close", async () => {
    const { core } = await created(flatAsk());
    core.act(FLAT_ID, command([answerAct()]));
    core.close(FLAT_ID, "agent");
    expect(core.fullValue(FLAT_ID, "q1")).toMatchObject({
      state: "closed",
      item: { state: "answered", answer: { choice: ["main"] } },
    });
  });

  test("a deleted item is reported as deleted, and one never held as missing", async () => {
    const { core } = await created(flatAsk());
    update(core, FLAT_ID, { action: "delete", itemId: "q2" });
    expect(core.fullValue(FLAT_ID, "q2")).toEqual({
      kind: "deleted",
      askId: FLAT_ID,
      itemId: "q2",
    });
    expect(core.fullValue(FLAT_ID, "q8")).toEqual({
      kind: "missing",
      askId: FLAT_ID,
      itemId: "q8",
    });
    expect(core.fullValue("never-asked", "q1")).toEqual({
      kind: "discarded",
      askId: "never-asked",
    });
  });

  test("the value is RFC 8785-ready JSON and shares nothing with the core", async () => {
    const { core } = await created(areasAsk());
    const value = core.fullValue(LIFECYCLE_ID, "region");
    expect(() => canonicalize(value.kind === "item" ? value.item : undefined)).not.toThrow();
    expect(Object.isFrozen(value.kind === "item" ? value.item : undefined)).toBe(true);
  });
});

describe("the generation", () => {
  test("rises with a revision, a reopen, a recorded answer, and the user's answer or decline", async () => {
    const { core } = await created(flatAsk());
    const seen = [generationOf(core, FLAT_ID, "q1")];
    const step = () => seen.push(generationOf(core, FLAT_ID, "q1"));
    update(core, FLAT_ID, { action: "change", itemId: "q1", props: { text: "Reworded?" } });
    step();
    core.act(FLAT_ID, command([answerAct({ rev: 2 })]));
    step();
    update(core, FLAT_ID, { action: "reopen", itemId: "q1" });
    step();
    update(core, FLAT_ID, { action: "answer", itemId: "q1", answer: { choice: ["release"] } });
    step();
    update(core, FLAT_ID, { action: "reopen", itemId: "q1" });
    core.act(FLAT_ID, command([{ type: "decline", itemId: "q1", rev: 4, when: WHEN }]));
    step();
    for (const [index, generation] of seen.entries()) {
      if (index > 0) expect(generation).toBeGreaterThan(seen[index - 1] as number);
    }
  });

  test("a postpone and its undo change the state, and the generation with it", async () => {
    const { core } = await created(flatAsk());
    const before = generationOf(core, FLAT_ID, "q1");
    core.act(FLAT_ID, command([{ type: "postpone", itemId: "q1", rev: 1 }]));
    const postponed = generationOf(core, FLAT_ID, "q1");
    core.act(FLAT_ID, command([{ type: "reopen", itemId: "q1" }]));
    expect(postponed).toBeGreaterThan(before);
    expect(generationOf(core, FLAT_ID, "q1")).toBeGreaterThan(postponed);
  });

  test("notes, follow-ups, replies and other questions' changes leave it", async () => {
    const { core } = await created(flatAsk());
    const before = generationOf(core, FLAT_ID, "q1");
    core.act(
      FLAT_ID,
      command([
        { type: "note", itemId: "q1", rev: 1, note: "x", when: WHEN },
        { type: "follow-up", itemId: "q1", rev: 1, text: "?", when: WHEN },
        answerAct({ itemId: "q2", choice: ["WSL"] }),
      ]),
    );
    update(
      core,
      FLAT_ID,
      { action: "reply", itemId: "q1", followUp: `${core.epoch}.2`, text: "!" },
      { action: "change", itemId: "q3", props: { text: "Who signs?" } },
    );
    expect(generationOf(core, FLAT_ID, "q1")).toBe(before);
  });

  test("an area's rises when its title or its questions' revisions change, or one joins or leaves", async () => {
    const { core } = await created(areasAsk());
    const seen = [generationOf(core, LIFECYCLE_ID, "scope")];
    const step = () => seen.push(generationOf(core, LIFECYCLE_ID, "scope"));
    update(core, LIFECYCLE_ID, { action: "change", itemId: "scope", props: { title: "What" } });
    step();
    update(core, LIFECYCLE_ID, { action: "change", itemId: "region", props: { text: "Where?" } });
    step();
    update(core, LIFECYCLE_ID, {
      action: "add",
      item: { type: "question", id: "tax", props: { text: "Tax?", options: [{ label: "Yes" }] } },
      parentId: "scope",
    });
    step();
    update(core, LIFECYCLE_ID, { action: "delete", itemId: "tax" });
    step();
    for (const [index, generation] of seen.entries()) {
      if (index > 0) expect(generation).toBeGreaterThan(seen[index - 1] as number);
    }
    const unchanged = generationOf(core, LIFECYCLE_ID, "scope");
    core.act(LIFECYCLE_ID, command([answerAct({ itemId: "payment", choice: ["Adyen"] })]));
    update(core, LIFECYCLE_ID, { action: "change", itemId: "rollout", props: { text: "How?" } });
    expect(generationOf(core, LIFECYCLE_ID, "scope")).toBe(unchanged);
  });
});
