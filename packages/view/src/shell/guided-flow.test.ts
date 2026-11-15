import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import { lifecycleBoardDocument } from "@askboard/contract/fixtures";
import type { QuestionWork } from "./board-draft.ts";
import type { Ladder } from "./board-view.ts";
import {
  areaInputOf,
  createSentRecords,
  flowTargetOf,
  heldActsOf,
  nextOfFlow,
} from "./guided-flow.ts";

// What the card hands `afterAnswerOf` and what the board records for the messages (answering-flow-
// guidance, design decisions 3 and 7): the target, its place on the board and the area just finished.
const none: Ladder = { flightOf: () => undefined, revisingOf: () => false };
const noWork = new Map<string, QuestionWork>();
const stateOf = (questions: unknown[]) =>
  ({ ask: "partly-answered", questions }) as unknown as LifecycleBoardState;
const answered = (itemId: string) => ({
  itemId,
  rev: 1,
  state: "answered",
  answer: { choice: ["x"], when: "2026-10-31T09:41:27Z", receipt: "sent" },
});
const open = (itemId: string) => ({ itemId, rev: 1, state: "open" });
const postponed = (itemId: string) => ({ itemId, rev: 1, state: "postponed" });

describe("the target of a move", () => {
  const state = stateOf([
    open("region"),
    open("payment"),
    postponed("analytics"),
    answered("rollout"),
    open("erp-export"),
  ]);
  const from = (acted: string, unseen: string[] = []) =>
    nextOfFlow(lifecycleBoardDocument, state, noWork, none, new Set(unseen), acted);

  test("is the next question to do after the acted one", () => {
    expect(from("region")).toEqual({ id: "payment", newFromAgent: false });
    expect(from("payment")).toEqual({ id: "erp-export", newFromAgent: false });
  });

  test("is marked new when the agent added it and the user has not seen it", () => {
    expect(from("region", ["erp-export"])).toEqual({ id: "erp-export", newFromAgent: true });
  });

  test("is none when only postponed questions remain: that is completion, not a move", () => {
    const only = stateOf([
      open("region"),
      answered("payment"),
      postponed("analytics"),
      answered("rollout"),
      answered("erp-export"),
    ]);
    expect(
      nextOfFlow(lifecycleBoardDocument, only, noWork, none, new Set(), "region"),
    ).toBeUndefined();
  });
});

describe("the place and title of a question", () => {
  test("its header chip, else its text, and its place among the board's questions", () => {
    const first = flowTargetOf(lifecycleBoardDocument, "region");
    expect(first?.n).toBe(1);
    expect(first?.m).toBe(5);
    expect(flowTargetOf(lifecycleBoardDocument, "erp-export")?.n).toBe(5);
    expect(flowTargetOf(lifecycleBoardDocument, "nowhere")).toBeUndefined();
    expect(typeof first?.title).toBe("string");
    expect(first?.title).not.toBe("");
  });
});

describe("the area just finished", () => {
  const areas = lifecycleBoardDocument.items as unknown as readonly {
    id: string;
    props: { title: string; items: readonly { id: string }[] };
  }[];
  const first = areas[0];
  const second = areas[1];

  test("the acted question's area, its questions to do left and the target's area", () => {
    if (first === undefined || second === undefined) throw new Error("the fixture has two areas");
    const all = [...first.props.items, ...second.props.items].map((each) => open(each.id));
    const state = stateOf(all);
    const acted = first.props.items[0]?.id ?? "";
    const left = areaInputOf(
      lifecycleBoardDocument,
      state,
      noWork,
      none,
      acted,
      second.props.items[0]?.id,
    );
    expect(left?.acted).toEqual({ id: first.id, title: first.props.title });
    expect(left?.left).toBe(first.props.items.length - 1);
    expect(left?.targetId).toBe(second.id);
  });

  test("none for a board without areas", () => {
    const flat = { ...lifecycleBoardDocument, items: [] } as never;
    expect(areaInputOf(flat, stateOf([]), noWork, none, "region", undefined)).toBeUndefined();
  });
});

describe("the acts held for Submit", () => {
  test("counts every held act, an answer, a decline, a postpone, a note, once each", () => {
    const work = new Map<string, QuestionWork>([
      ["a", { rev: 1, held: { act: "answer", order: 0 } }],
      ["b", { rev: 1, held: { act: "decline", order: 1 } }],
      ["c", { rev: 1, held: { act: "note", order: 2 } }],
      ["d", { rev: 1 }],
      ["e", { rev: 1, undo: { act: "reopen", order: 3 } }],
    ]);
    expect(heldActsOf(work)).toBe(3);
    expect(heldActsOf(new Map())).toBe(0);
  });
});

describe("the records the messages read", () => {
  test("take gives the first question's record and forgets every one of them", () => {
    const records = createSentRecords();
    records.set("a", { revision: true });
    records.set("b", { revision: false });
    expect(records.take(["x", "b", "a"])).toEqual({ revision: false });
    expect(records.take(["a"])).toBeUndefined();
    expect(records.take(["b"])).toBeUndefined();
  });
});
