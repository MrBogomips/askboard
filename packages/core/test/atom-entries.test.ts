import { describe, expect, test } from "bun:test";
import type { DraftRecord } from "@askboard/contract";
import { gatherSnapshot } from "../src/snapshot/gather.ts";
import { answerAct, boardOf, command, created, FLAT_ID, flatAsk } from "./lifecycle-fakes.ts";

// Core spec: Entries stay in the draft (atoms, design decision 3; AD-20): a draft record's entries
// are the text of a field the user is still typing. ask-core holds them with the draft, apart from
// the log, restores them to the board, and exposes them to nothing else.

const ENTRY = "1.23e";
const TEXTS = [ENTRY, "1.23"];
const RECORD: DraftRecord = {
  delivery: "immediate",
  questions: { q1: { rev: 1, entries: { days: ENTRY, seats: "4o" } } },
};

// Every string a value holds, keys included.
const textsOf = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : typeof value === "object" && value !== null
      ? Object.entries(value).flatMap(([key, child]) => [key, ...textsOf(child)])
      : [];

const held = async () => {
  const run = await created(flatAsk());
  expect(run.core.holdDraft(FLAT_ID, structuredClone(RECORD))).toBe(true);
  return run;
};

describe("a draft record holding entries", () => {
  test("is kept and restored on takeover, entries included", async () => {
    const { core } = await held();
    expect(core.draftToRestore(FLAT_ID)).toEqual(RECORD);
    expect(core.draftToRestore(FLAT_ID)?.questions.q1?.entries).toEqual({
      days: ENTRY,
      seats: "4o",
    });
  });

  test("is replaced whole: a record with none leaves no entry behind", async () => {
    const { core } = await held();
    core.holdDraft(FLAT_ID, { delivery: "immediate", questions: { q1: { rev: 1 } } });
    expect(textsOf(core.draftToRestore(FLAT_ID))).not.toContain(ENTRY);
  });

  test("is unreadable by every read of the ask: collect, fetch, the board, overview, a Snapshot", async () => {
    const { core, heard } = await held();
    core.act(FLAT_ID, command([answerAct({ itemId: "q1", choice: ["main"] })]));
    const board = boardOf(core, FLAT_ID);
    const snapshot = gatherSnapshot({
      epoch: core.epoch,
      board,
      kept: core.keptRevisions(FLAT_ID) ?? [],
      log: [],
      takenAt: "2026-11-06T10:00:00Z",
      taker: { takenBy: "agent" },
      keptAnswerResults: new Map(),
    });
    const seen = [
      core.read(FLAT_ID, `${core.epoch}.0`),
      core.lifecycleBoard(FLAT_ID),
      core.board(FLAT_ID),
      core.fullValue(FLAT_ID, "q1"),
      core.overview(),
      core.whoAsked(FLAT_ID),
      core.agentStatus(FLAT_ID),
      core.keptRevisions(FLAT_ID),
      snapshot,
      heard,
    ].flatMap(textsOf);
    for (const text of TEXTS) expect(seen.some((seenText) => seenText.includes(text))).toBe(false);
    expect(seen).not.toContain("4o");
    expect(seen).not.toContain("entries");
  });

  test("an answer sent after it logs the answer alone: the entry is no result", async () => {
    const { core } = await held();
    const outcome = core.act(FLAT_ID, command([answerAct({ itemId: "q1", choice: ["main"] })]));
    expect(outcome.ok).toBe(true);
    const event = JSON.stringify(core.read(FLAT_ID, `${core.epoch}.0`));
    expect(event).not.toContain(ENTRY);
  });
});
