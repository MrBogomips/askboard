import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import {
  ganttBoardDocument,
  ganttEditedValue,
  lifecycleBoardDocument,
} from "@askboard/contract/fixtures";
import type { ViewArea, ViewDocument, ViewQuestion } from "../view-document.ts";
import { connectDrafts, createBoardDraft, type Delivery } from "./board-draft.ts";
import { createDraftStore } from "./draft-store.ts";
import {
  hasRecommendation,
  heldWorkOf,
  selectRecommended,
  submitActsOf,
  submitStateOf,
  updatesLabel,
} from "./submit.ts";

const document = lifecycleBoardDocument as unknown as ViewDocument;
const AT = new Date("2026-10-31T17:42:05.000Z");
const WHEN = "2026-10-31T17:42:05.000Z";
// No widget item reported derived values (widget-answers design decision 10).
const NONE_REPORTED = () => undefined;

const stateOf = (
  states: Readonly<Record<string, "open" | "postponed" | "answered" | "declined">> = {},
): LifecycleBoardState => {
  const ids = ["region", "payment", "analytics", "rollout", "erp-export"];
  return {
    ask: "waiting",
    questions: ids.map((itemId) => {
      const state = states[itemId] ?? "open";
      return state === "answered" || state === "declined"
        ? { itemId, rev: 1, state, answer: { when: WHEN, receipt: "sent" as const } }
        : { itemId, rev: 1, state };
    }) as unknown as LifecycleBoardState["questions"],
  };
};

const setUp = (delivery: Delivery = "submitted", doc: ViewDocument = document) => {
  const values = createDraftStore();
  const board = createBoardDraft(delivery);
  connectDrafts(doc, values, board);
  return { values, board };
};

describe("what Submit sends (AD-20; task 6.6)", () => {
  test("every held act as one command, in the order the user produced them", () => {
    const { values, board } = setUp();
    board.edit("erp-export", 1, () => ({ rev: 1, held: { act: "postpone", order: 2 } }));
    values.set("region", ["EU", "US"]);
    board.edit("region", 1, (work) => ({
      ...work,
      note: "Both.",
      held: { act: "answer", order: 0 },
    }));
    board.edit("payment", 1, () => ({
      rev: 1,
      other: "Mollie",
      held: { act: "answer", order: 1 },
    }));
    board.edit("analytics", 1, () => ({
      rev: 1,
      note: "Not ours.",
      held: { act: "decline", order: 3 },
    }));
    board.edit("rollout", 1, () => ({ rev: 1, note: "Ask ops.", held: { act: "note", order: 4 } }));
    board.edit("cache", 1, () => ({ rev: 1, held: { act: "answer", order: 5 } }));
    const held = heldWorkOf(document, board.get());
    expect(held.map(({ question }) => question.id)).toEqual([
      "region",
      "payment",
      "erp-export",
      "analytics",
      "rollout",
    ]);
    expect(submitActsOf(held, values.record(), AT, NONE_REPORTED)).toEqual([
      { type: "answer", itemId: "region", rev: 1, choice: ["EU", "US"], note: "Both.", when: WHEN },
      { type: "answer", itemId: "payment", rev: 1, other: "Mollie", when: WHEN },
      { type: "postpone", itemId: "erp-export", rev: 1 },
      { type: "decline", itemId: "analytics", rev: 1, note: "Not ours.", when: WHEN },
      { type: "note", itemId: "rollout", rev: 1, note: "Ask ops.", when: WHEN },
    ]);
  });

  test("an undo of a sent postpone or decline goes as a reopen; held acts with nothing to carry are left out", () => {
    const { values, board } = setUp();
    board.edit("payment", 1, () => ({ rev: 1, held: { act: "reopen", order: 0 } }));
    board.edit("rollout", 1, () => ({ rev: 1, held: { act: "note", order: 1 } }));
    board.edit("region", 1, () => ({ rev: 1, held: { act: "answer", order: 2 } }));
    board.edit("analytics", 1, () => ({ rev: 1, held: { act: "decline", order: 3 } }));
    expect(
      submitActsOf(heldWorkOf(document, board.get()), values.record(), AT, NONE_REPORTED),
    ).toEqual([
      { type: "reopen", itemId: "payment" },
      { type: "decline", itemId: "analytics", rev: 1, when: WHEN },
    ]);
  });

  test("a note held over the undo of a sent postpone goes after its reopen, in the user's order; an answer or decline held over one goes alone, which the core takes on a postponed or declined question", () => {
    const { values, board } = setUp();
    const undo = (order: number) => ({ act: "reopen", order }) as const;
    board.edit("rollout", 1, () => ({
      rev: 1,
      note: "Ask ops.",
      held: { act: "note", order: 3 },
      undo: undo(0),
    }));
    board.edit("erp-export", 1, () => ({ rev: 1, held: { act: "postpone", order: 1 } }));
    values.set("region", ["EU"]);
    board.edit("region", 1, (work) => ({
      ...work,
      held: { act: "answer", order: 4 },
      undo: undo(2),
    }));
    board.edit("analytics", 1, () => ({
      rev: 1,
      held: { act: "decline", order: 6 },
      undo: undo(5),
    }));
    expect(
      submitActsOf(heldWorkOf(document, board.get()), values.record(), AT, NONE_REPORTED),
    ).toEqual([
      { type: "reopen", itemId: "rollout" },
      { type: "postpone", itemId: "erp-export", rev: 1 },
      { type: "note", itemId: "rollout", rev: 1, note: "Ask ops.", when: WHEN },
      { type: "answer", itemId: "region", rev: 1, choice: ["EU"], when: WHEN },
      { type: "decline", itemId: "analytics", rev: 1, when: WHEN },
    ]);
  });

  test("an answer on work kept from an earlier revision names that revision; a postpone the current one", () => {
    const area = document.items[0] as ViewArea;
    const changed: ViewDocument = {
      ...document,
      items: [
        {
          ...area,
          props: {
            ...area.props,
            items: area.props.items.map((question) => ({ ...question, rev: 2 })) as never,
          },
        },
        document.items[1] as ViewArea,
      ],
    };
    const { values, board } = setUp("submitted", changed);
    values.set("payment", ["Adyen"]);
    board.edit("payment", 1, (work) => ({ ...work, rev: 1, held: { act: "answer", order: 0 } }));
    board.edit("region", 1, () => ({ rev: 1, held: { act: "postpone", order: 1 } }));
    expect(
      submitActsOf(heldWorkOf(changed, board.get()), values.record(), AT, NONE_REPORTED),
    ).toEqual([
      { type: "answer", itemId: "payment", rev: 1, choice: ["Adyen"], when: WHEN },
      { type: "postpone", itemId: "region", rev: 2 },
    ]);
  });
});

describe("what Submit's answers carry of the derived values (widget-answers design decision 10; AD-20, FR-12)", () => {
  const [schedule] = ganttBoardDocument.items;
  const gantt = ganttBoardDocument as unknown as ViewDocument;
  const finish = { "release.finish": "2026-12-16", "release.criticalPath": ["reporting"] };
  const reported = (itemId: string) => (itemId === "release" ? finish : undefined);

  test("a held answer carrying a Gantt's value goes with the derived values the Gantt last reported", () => {
    const { values, board } = setUp("submitted", gantt);
    values.set("release", ganttEditedValue);
    board.edit(schedule.id, 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    expect(submitActsOf(heldWorkOf(gantt, board.get()), values.record(), AT, reported)).toEqual([
      {
        type: "answer",
        itemId: schedule.id,
        rev: 1,
        values: { release: ganttEditedValue },
        derived: finish,
        when: WHEN,
      },
    ]);
  });

  test("a held answer of Other text beside an untouched Gantt carries the Gantt's derived values and no values", () => {
    const { values, board } = setUp("submitted", gantt);
    board.edit(schedule.id, 1, (work) => ({
      ...work,
      other: "Later",
      held: { act: "answer", order: 0 },
    }));
    const [act] = submitActsOf(heldWorkOf(gantt, board.get()), values.record(), AT, reported);
    expect(act).toMatchObject({ type: "answer", other: "Later", derived: finish });
    expect(Object.hasOwn(act ?? {}, "values")).toBe(false);
  });

  test("a held answer with no widget value carries none", () => {
    const { values, board } = setUp();
    values.set("region", ["EU"]);
    board.edit("region", 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    expect(submitActsOf(heldWorkOf(document, board.get()), values.record(), AT, reported)).toEqual([
      { type: "answer", itemId: "region", rev: 1, choice: ["EU"], when: WHEN },
    ]);
  });
});

describe("whether Submit can go (FR-22, AD-20)", () => {
  const base = {
    document,
    delivery: "submitted" as const,
    connection: undefined,
    lock: undefined,
    pending: () => false,
    sending: () => false,
  };

  test("disabled in immediate delivery, while nothing is held, while the connection is lost, on a locked board", () => {
    const { board } = setUp();
    expect(submitStateOf({ ...base, board: board.get() })).toEqual({
      held: 0,
      blocked: [],
      disabled: true,
    });
    board.edit("payment", 1, () => ({ rev: 1, held: { act: "postpone", order: 0 } }));
    expect(submitStateOf({ ...base, board: board.get() }).disabled).toBe(false);
    expect(submitStateOf({ ...base, board: board.get(), delivery: "immediate" }).disabled).toBe(
      true,
    );
    expect(submitStateOf({ ...base, board: board.get(), connection: "lost" }).disabled).toBe(true);
    expect(submitStateOf({ ...base, board: board.get(), lock: "closed" }).disabled).toBe(true);
    expect(submitStateOf({ ...base, board: board.get(), sending: () => true }).disabled).toBe(true);
  });

  test("an agent-change notice on a question with held work blocks it and is counted; one on a question without held work does not", () => {
    const { board } = setUp();
    board.edit("payment", 1, () => ({ rev: 1, held: { act: "answer", order: 0 } }));
    board.edit("region", 1, () => ({ rev: 1, note: "x" }));
    const pending = (id: string) => id === "payment" || id === "region";
    expect(submitStateOf({ ...base, board: board.get(), pending })).toEqual({
      held: 1,
      blocked: ["payment"],
      disabled: true,
    });
    expect(updatesLabel(1)).toBe("1 update needs a choice");
    expect(updatesLabel(2)).toBe("2 updates need a choice");
  });
});

describe("Select recommended (FR-3; task 6.6)", () => {
  const rollout = (document.items[1] as ViewArea).props.items[0] as ViewQuestion;

  test("it selects the recommended option where the user has chosen nothing, never replaces a choice, and sends nothing; in submitted delivery Submit sends what is left in place", () => {
    const { values, board } = setUp();
    values.set("rollout", ["All at once"]);
    const count = selectRecommended(document, stateOf(), { draft: values, board }, () => false);
    expect(count).toBe(1);
    expect(values.valueOf("region")).toEqual(["EU"]);
    expect(values.valueOf("rollout")).toEqual(["All at once"]);
    expect(board.work("region")?.held).toEqual({ act: "answer", order: 0, byRecommended: true });
    expect(board.work("rollout")?.held).toBeUndefined();
    expect(hasRecommendation(document)).toBe(true);
    expect(rollout.props.options?.some((option) => option.recommended)).toBe(true);
  });

  test("it leaves answered, declined, postponed and ready questions alone, Other text counts as a choice, and in immediate delivery it only selects", () => {
    const answered = setUp();
    selectRecommended(
      document,
      stateOf({ region: "answered", rollout: "postponed" }),
      {
        draft: answered.values,
        board: answered.board,
      },
      () => false,
    );
    expect(answered.values.valueOf("region")).toBeUndefined();
    expect(answered.values.valueOf("rollout")).toBeUndefined();

    const held = setUp();
    held.board.edit("region", 1, () => ({ rev: 1, held: { act: "postpone", order: 0 } }));
    held.board.edit("rollout", 1, () => ({ rev: 1, other: "Canary" }));
    selectRecommended(document, stateOf(), { draft: held.values, board: held.board }, () => false);
    expect(held.values.valueOf("region")).toBeUndefined();
    expect(held.values.valueOf("rollout")).toBeUndefined();

    const immediate = setUp("immediate");
    selectRecommended(
      document,
      stateOf(),
      { draft: immediate.values, board: immediate.board },
      (id) => id === "rollout",
    );
    expect(immediate.values.valueOf("region")).toEqual(["EU"]);
    expect(immediate.values.valueOf("rollout")).toBeUndefined();
    expect(immediate.board.work("region")?.held).toBeUndefined();
  });

  test("a board without a recommendation has nothing to select", () => {
    const area = document.items[0] as ViewArea;
    const plain: ViewDocument = {
      ...document,
      items: [
        {
          ...area,
          props: {
            ...area.props,
            items: area.props.items.map((question) => ({
              ...question,
              props: {
                ...question.props,
                options: question.props.options?.map(({ recommended: _, ...option }) => option),
              },
            })) as never,
          },
        },
      ],
    };
    expect(hasRecommendation(plain)).toBe(false);
  });
});
