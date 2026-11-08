import { describe, expect, test } from "bun:test";
import type { DraftRecord } from "@askboard/contract";
import { lifecycleBoardDocument } from "@askboard/contract/fixtures";
import { draftRecordProblems } from "@askboard/contract/validate";
import { gatherSnapshot } from "../src/snapshot/gather.ts";
import { answerAct, areasAsk, boardOf, command, created, LIFECYCLE_ID } from "./lifecycle-fakes.ts";

// Core spec: Cell entries stay in the draft (table-widget, design decision 8; AD-20): a draft
// record's cell entries are the text a Table's cell holds that gives no value. ask-core holds them
// with the draft, apart from the log, restores them to a reconnecting or taking-over board and
// exposes them to nothing else; the check that a cell entry names an item of its own question is the
// contract's `draftRecordProblems`, which `board-host` runs before it holds a record.

const ENTRY = "12,5";
const TEXTS = [ENTRY, "abc"];
const RECORD: DraftRecord = {
  delivery: "immediate",
  questions: {
    payment: { rev: 1, cellEntries: { costs: { "pm.rate": ENTRY, "u-1.days": "abc" } } },
  },
};

// Every string a value holds, keys included.
const textsOf = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : typeof value === "object" && value !== null
      ? Object.entries(value).flatMap(([key, child]) => [key, ...textsOf(child)])
      : [];

const held = async (record: DraftRecord = RECORD) => {
  const run = await created(areasAsk());
  expect(run.core.holdDraft(LIFECYCLE_ID, structuredClone(record))).toBe(true);
  return run;
};

describe("a draft record holding cell entries", () => {
  test("is kept and restored on takeover and reconnection, cell entries included", async () => {
    const { core } = await held();
    expect(core.draftToRestore(LIFECYCLE_ID)).toEqual(RECORD);
    core.disconnected(LIFECYCLE_ID);
    core.connected(LIFECYCLE_ID);
    expect(core.draftToRestore(LIFECYCLE_ID)?.questions.payment?.cellEntries).toEqual({
      costs: { "pm.rate": ENTRY, "u-1.days": "abc" },
    });
  });

  test("is replaced whole: a record with none leaves no cell entry behind", async () => {
    const { core } = await held();
    core.holdDraft(LIFECYCLE_ID, { delivery: "immediate", questions: { payment: { rev: 1 } } });
    expect(textsOf(core.draftToRestore(LIFECYCLE_ID))).not.toContain(ENTRY);
  });

  test("holds item and cell keys named like object members as own keys", async () => {
    const record = JSON.parse(
      '{"delivery":"immediate","questions":{"payment":{"rev":1,"cellEntries":{"__proto__":{"__proto__.rate":"x"},"constructor":{"constructor.toString":"y"}}}}}',
    ) as DraftRecord;
    const { core } = await held(record);
    const cells = core.draftToRestore(LIFECYCLE_ID)?.questions.payment?.cellEntries as Record<
      string,
      Record<string, string>
    >;
    expect(Object.hasOwn(cells, "__proto__")).toBe(true);
    const own = Object.getOwnPropertyDescriptor(cells, "constructor");
    expect(own?.value).toEqual({ "constructor.toString": "y" });
    expect(Object.getPrototypeOf(cells)).toBe(Object.prototype);
  });

  test("is unreadable by every read of the ask: collect, fetch, the board, overview, a Snapshot", async () => {
    const { core, heard } = await held();
    core.act(LIFECYCLE_ID, command([answerAct({ itemId: "rollout", choice: ["All at once"] })]));
    const snapshot = gatherSnapshot({
      epoch: core.epoch,
      board: boardOf(core, LIFECYCLE_ID),
      kept: core.keptRevisions(LIFECYCLE_ID) ?? [],
      log: [],
      takenAt: "2026-11-08T10:00:00Z",
      taker: { takenBy: "agent" },
      keptAnswerResults: new Map(),
    });
    const seen = [
      core.read(LIFECYCLE_ID, `${core.epoch}.0`),
      core.lifecycleBoard(LIFECYCLE_ID),
      core.board(LIFECYCLE_ID),
      core.fullValue(LIFECYCLE_ID, "payment"),
      core.fullValue(LIFECYCLE_ID, "rollout"),
      core.overview(),
      core.whoAsked(LIFECYCLE_ID),
      core.agentStatus(LIFECYCLE_ID),
      core.keptRevisions(LIFECYCLE_ID),
      snapshot,
      heard,
    ].flatMap(textsOf);
    for (const text of TEXTS) expect(seen.some((seenText) => seenText.includes(text))).toBe(false);
    expect(seen).not.toContain("cellEntries");
    expect(seen).not.toContain("pm.rate");
  });

  test("an answer sent after it logs the answer alone: the cell entry is no value, result or change", async () => {
    const { core } = await held();
    const outcome = core.act(
      LIFECYCLE_ID,
      command([answerAct({ itemId: "rollout", choice: ["All at once"] })]),
    );
    expect(outcome.ok).toBe(true);
    const event = JSON.stringify(core.read(LIFECYCLE_ID, `${core.epoch}.0`));
    expect(event).not.toContain(ENTRY);
    expect(event).not.toContain("cellEntries");
  });
});

describe("a cell entry naming an item of another question", () => {
  // The lifecycle's "payment" question holds a Table `costs`; its other questions hold none.
  const [scope] = lifecycleBoardDocument.items;
  if (scope?.type !== "area") throw new Error("the fixture's first item is an area");
  const document = {
    ...lifecycleBoardDocument,
    items: [
      {
        ...scope,
        props: {
          ...scope.props,
          items: scope.props.items.map((question) =>
            question.id === "payment"
              ? {
                  ...question,
                  props: {
                    ...question.props,
                    items: [{ type: "table", id: "costs", props: { columns: [], rows: [] } }],
                  },
                }
              : question,
          ),
        },
      },
      ...lifecycleBoardDocument.items.slice(1),
    ],
  } as never;
  const otherQuestion = scope.props.items.find((question) => question.id !== "payment");
  if (otherQuestion === undefined) throw new Error("the fixture's area holds one question");
  const recordFor = (question: string, item: string): DraftRecord => ({
    delivery: "immediate",
    questions: { [question]: { rev: 1, cellEntries: { [item]: { "pm.rate": ENTRY } } } },
  });

  test("is refused by the contract's check, naming the item and the question", () => {
    const problems = draftRecordProblems(recordFor(otherQuestion.id, "costs"), document);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.path).toBe(`/questions/${otherQuestion.id}/cellEntries/costs`);
    expect(problems[0]?.message).toContain('"costs"');
    expect(problems[0]?.message).toContain(otherQuestion.id);
  });

  test("an inherited name or an unknown item is refused, and the question's own Table is not", () => {
    for (const item of ["constructor", "toString", "nothing"]) {
      expect(draftRecordProblems(recordFor("payment", item), document)).toHaveLength(1);
    }
    expect(draftRecordProblems(recordFor("payment", "costs"), document)).toEqual([]);
  });
});
