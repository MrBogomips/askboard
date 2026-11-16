import { describe, expect, test } from "bun:test";
import type { DraftRecord } from "@askboard/contract";
import { answeringFlowVisualDraftRecord, lifecycleDraftRecord } from "@askboard/contract/fixtures";
import { answerAct, areasAsk, command, created, LIFECYCLE_ID } from "./lifecycle-fakes.ts";

// Core spec: The draft record (ask-lifecycle, task 3.3): one per ask, replaced whole, held apart
// from the log; only the restore path reads it (AD-20).

const draft = (): DraftRecord => structuredClone(lifecycleDraftRecord) as DraftRecord;

// Every string a value holds, keys included, to look for the draft's text anywhere in it.
const textsOf = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : typeof value === "object" && value !== null
      ? Object.entries(value).flatMap(([key, child]) => [key, ...textsOf(child)])
      : [];

describe("the draft record", () => {
  test("held per ask and replaced whole; the restore path reads it back", async () => {
    const { core } = await created(areasAsk());
    expect(core.draftToRestore(LIFECYCLE_ID)).toBeUndefined();
    expect(core.holdDraft(LIFECYCLE_ID, draft())).toBe(true);
    expect(core.draftToRestore(LIFECYCLE_ID)).toEqual(lifecycleDraftRecord);
    const smaller: DraftRecord = { delivery: "immediate", questions: { region: { rev: 1 } } };
    core.holdDraft(LIFECYCLE_ID, smaller);
    expect(core.draftToRestore(LIFECYCLE_ID)).toEqual(smaller);
  });

  test("the held record shares nothing with the board's message and cannot change", async () => {
    const { core } = await created(areasAsk());
    const record = draft();
    core.holdDraft(LIFECYCLE_ID, record);
    (record.questions as Record<string, unknown>).region = { rev: 9 };
    const held = core.draftToRestore(LIFECYCLE_ID);
    expect(held?.questions.region?.rev).toBe(1);
    expect(Object.isFrozen(held)).toBe(true);
  });

  test("unsent work stays unsent: no read, view, full value or published event holds any of it", async () => {
    const { core, heard } = await created(areasAsk());
    core.holdDraft(LIFECYCLE_ID, draft());
    core.act(LIFECYCLE_ID, command([answerAct({ itemId: "rollout", choice: ["All at once"] })]));
    const unsent = ["Mollie", "Ask the shop team about their contract.", "Does the EU"];
    const seen = [
      core.read(LIFECYCLE_ID, `${core.epoch}.0`),
      core.lifecycleBoard(LIFECYCLE_ID),
      core.board(LIFECYCLE_ID),
      core.fullValue(LIFECYCLE_ID, "payment"),
      core.fullValue(LIFECYCLE_ID, "scope"),
      heard,
    ].flatMap(textsOf);
    for (const text of unsent) expect(seen).not.toContain(text);
    expect(seen.some((text) => text.includes("Mollie"))).toBe(false);
  });

  test("an ask this epoch does not hold keeps no draft", async () => {
    const { core } = await created(areasAsk());
    expect(core.holdDraft("never-asked", draft())).toBe(false);
    expect(core.draftToRestore("never-asked")).toBeUndefined();
  });
});

// Core spec: The draft record (answering-flow-visual, task 1.2): the short numbers ride in the
// record, which ask-core holds whole; they are never unsent work a read, collect or fetch shows.
describe("the draft record's short numbers", () => {
  test("a record holding numbers and nextNumber is held whole and restored as sent", async () => {
    const { core } = await created(areasAsk());
    const record = structuredClone(answeringFlowVisualDraftRecord) as DraftRecord;
    expect(core.holdDraft(LIFECYCLE_ID, record)).toBe(true);
    const held = core.draftToRestore(LIFECYCLE_ID);
    expect(held).toEqual(answeringFlowVisualDraftRecord);
    expect(held?.numbers).toEqual({ region: 1, payment: 2, analytics: 4, rollout: 5 });
    expect(held?.nextNumber).toBe(6);
    expect(Object.isFrozen(held?.numbers)).toBe(true);
  });

  test("no read, view, full value or published event holds a number", async () => {
    const { core, heard } = await created(areasAsk());
    core.holdDraft(LIFECYCLE_ID, structuredClone(answeringFlowVisualDraftRecord) as DraftRecord);
    const seen = [
      core.read(LIFECYCLE_ID, `${core.epoch}.0`),
      core.lifecycleBoard(LIFECYCLE_ID),
      core.board(LIFECYCLE_ID),
      core.fullValue(LIFECYCLE_ID, "payment"),
      heard,
    ].flatMap(textsOf);
    expect(seen).not.toContain("nextNumber");
    expect(seen).not.toContain("numbers");
  });
});
