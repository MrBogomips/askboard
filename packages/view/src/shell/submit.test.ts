import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import {
  ganttBoardDocument,
  ganttEditedValue,
  lifecycleBoardDocument,
} from "@askboard/contract/fixtures";
import type { ComponentFacts } from "../catalog/port.ts";
import type { ViewArea, ViewDocument, ViewQuestion } from "../view-document.ts";
import { connectDrafts, createBoardDraft, type Delivery } from "./board-draft.ts";
import { createDraftStore } from "./draft-store.ts";
import { press as confirmPress, settle } from "./revision-confirm.ts";
import {
  confirmedPress,
  hasRecommendation,
  heldMissingReason,
  heldWorkOf,
  selectRecommended,
  submitActsOf,
  submitPress,
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

describe("what Submit's answers carry of the results (widget-registry, design decision 9; AD-20)", () => {
  // A test-only `probe` widget item on the Gantt's question, and the result it holds.
  const [schedule] = ganttBoardDocument.items;
  const sketch = { type: "probe", id: "sketch", props: { size: 3 } };
  const withSketch = {
    ...ganttBoardDocument,
    items: [
      { ...schedule, props: { ...schedule.props, items: [...schedule.props.items, sketch] } },
    ],
  } as unknown as ViewDocument;
  const result = { pick: "a" };
  const none = () => undefined;

  test("a held answer whose only content is a result goes with it and no values", () => {
    const { values, board } = setUp("submitted", withSketch);
    const results = new Map<string, unknown>([["sketch", result]]);
    board.edit(schedule.id, 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    const acts = submitActsOf(
      heldWorkOf(withSketch, board.get()),
      values.record(),
      AT,
      none,
      results,
    );
    expect(acts).toEqual([
      { type: "answer", itemId: schedule.id, rev: 1, results: { sketch: result }, when: WHEN },
    ]);
    expect(Object.hasOwn(acts[0] ?? {}, "values")).toBe(false);
  });

  test("with no result held, the same held answer carries nothing and is left out", () => {
    const { values, board } = setUp("submitted", withSketch);
    board.edit(schedule.id, 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    expect(
      submitActsOf(heldWorkOf(withSketch, board.get()), values.record(), AT, none, new Map()),
    ).toEqual([]);
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

describe("every path to an answer checks the reason (approval-scale-ranking, design decision 6; AD-10)", () => {
  // A test-only `verdict` item on the `region` question, which has a recommended option and whose
  // result `{decision: "revise"}` requires a reason; `payment` has none.
  const pair = { label: "question.reasonRequired", missing: "question.reasonMissing" } as const;
  const FACTS: Readonly<Record<string, ComponentFacts>> = {
    verdict: {
      reason: (result) =>
        (result as { decision?: string }).decision === "revise" ? pair : undefined,
    },
  };
  const facts = (type: string): ComponentFacts | undefined =>
    Object.hasOwn(FACTS, type) ? FACTS[type] : undefined;
  const verdict = { type: "verdict", id: "verdict", props: {} };
  const withVerdict = (): ViewDocument => {
    const copy = structuredClone(document) as unknown as ViewDocument;
    const area = copy.items[0] as ViewArea;
    const [first] = area.props.items;
    (first as unknown as { props: { items: unknown[] } }).props.items = [verdict];
    return copy;
  };
  const doc = withVerdict();
  const revise = { decision: "revise" };
  const reject = { decision: "reject" };

  const board3 = (delivery: Delivery = "submitted") => {
    const values = createDraftStore();
    const results = createDraftStore();
    const board = createBoardDraft(delivery);
    connectDrafts(doc, values, board, results);
    return { values, results, board };
  };
  const mark = (board: ReturnType<typeof board3>["board"], id: string, order: number) =>
    board.edit(id, 1, (work) => ({ ...work, held: { act: "answer", order } }));

  test("Select recommended selects the option, does not mark a question whose reason is missing, and counts it", () => {
    const { values, results, board } = board3();
    results.set("verdict", revise);
    const count = selectRecommended(
      doc,
      stateOf(),
      { draft: values, results, board, facts },
      () => false,
    );
    expect(values.valueOf("region")).toEqual(["EU"]);
    expect(board.work("region")?.held).toBeUndefined();
    // `rollout` also has a recommended option and no reason to give: selected and marked.
    expect(board.work("rollout")?.held?.act).toBe("answer");
    expect(count).toBe(2);
  });

  test("with the reason in the note, or a result that needs none, it marks the question ready", () => {
    const written = board3();
    written.results.set("verdict", revise);
    written.board.edit("region", 1, () => ({ rev: 1, note: "Cheaper." }));
    selectRecommended(
      doc,
      stateOf(),
      { draft: written.values, results: written.results, board: written.board, facts },
      () => false,
    );
    expect(written.board.work("region")?.held).toEqual({
      act: "answer",
      order: 0,
      byRecommended: true,
    });
    const plain = board3();
    plain.results.set("verdict", reject);
    selectRecommended(
      doc,
      stateOf(),
      { draft: plain.values, results: plain.results, board: plain.board, facts },
      () => false,
    );
    expect(plain.board.work("region")?.held?.act).toBe("answer");
  });

  test("heldMissingReason names the first held answer, in board order, whose reason is missing", () => {
    const { values, results, board } = board3();
    results.set("verdict", revise);
    // `payment` is marked before `region`, which comes first on the board.
    mark(board, "payment", 0);
    mark(board, "region", 1);
    const held = heldWorkOf(doc, board.get());
    expect(heldMissingReason(doc, held, values.record(), results.record(), facts)?.id).toBe(
      "region",
    );
  });

  test("it names none when every held answer has its reason, or needs none", () => {
    const { values, results, board } = board3();
    results.set("verdict", revise);
    board.edit("region", 1, () => ({
      rev: 1,
      note: "Cheaper.",
      held: { act: "answer", order: 0 },
    }));
    expect(
      heldMissingReason(
        doc,
        heldWorkOf(doc, board.get()),
        values.record(),
        results.record(),
        facts,
      ),
    ).toBeUndefined();
    results.set("verdict", reject);
    board.edit("region", 1, () => ({ rev: 1, held: { act: "answer", order: 0 } }));
    expect(
      heldMissingReason(
        doc,
        heldWorkOf(doc, board.get()),
        values.record(),
        results.record(),
        facts,
      ),
    ).toBeUndefined();
  });

  test("a held decline or postpone is not an answer and needs no reason", () => {
    const { values, results, board } = board3();
    results.set("verdict", revise);
    board.edit("region", 1, () => ({ rev: 1, held: { act: "decline", order: 0 } }));
    expect(
      heldMissingReason(
        doc,
        heldWorkOf(doc, board.get()),
        values.record(),
        results.record(),
        facts,
      ),
    ).toBeUndefined();
  });

  test("Submit with such a question sends nothing, keeps every act held and names the question", () => {
    const { values, results, board } = board3();
    results.set("verdict", revise);
    values.set("payment", ["Stripe"]);
    mark(board, "payment", 0);
    mark(board, "region", 1);
    const before = JSON.stringify([...board.get().questions]);
    const pressed = submitPress(doc, board.get(), values.record(), AT, NONE_REPORTED, {
      results: results.record(),
      facts,
      state: stateOf(),
    });
    expect(pressed).toEqual({ kind: "needs-reason", questionId: "region" });
    expect(JSON.stringify([...board.get().questions])).toBe(before);
  });

  test("Submit with every reason in place sends what submitActsOf builds", () => {
    const { values, results, board } = board3();
    results.set("verdict", revise);
    values.set("region", ["EU"]);
    board.edit("region", 1, () => ({
      rev: 1,
      note: "Cheaper.",
      held: { act: "answer", order: 0 },
    }));
    const pressed = submitPress(doc, board.get(), values.record(), AT, NONE_REPORTED, {
      results: results.record(),
      facts,
      state: stateOf(),
    });
    expect(pressed.kind).toBe("send");
    if (pressed.kind === "send") {
      expect(pressed.acts).toEqual(
        submitActsOf(
          heldWorkOf(doc, board.get()),
          values.record(),
          AT,
          NONE_REPORTED,
          results.record(),
        ),
      );
      expect(pressed.acts).toHaveLength(1);
    }
  });
});

describe("Submit asks before replacing a received verdict (approval-scale-ranking, design decision 6; F-63)", () => {
  const facts = (type: string): ComponentFacts | undefined =>
    type === "verdict" ? { confirmsRevision: true } : undefined;
  const verdict = { type: "verdict", id: "verdict", props: {} };
  const doc = (() => {
    const copy = structuredClone(document) as unknown as ViewDocument;
    const area = copy.items[0] as ViewArea;
    const [first] = area.props.items;
    (first as unknown as { props: { items: unknown[] } }).props.items = [verdict];
    return copy;
  })();
  const stateWith = (receipt: "queued" | "sent" | "delivered"): LifecycleBoardState => {
    const base = stateOf();
    return {
      ...base,
      questions: base.questions.map((status) =>
        status.itemId === "region"
          ? { itemId: "region", rev: 1, state: "answered", answer: { when: WHEN, receipt } }
          : status,
      ),
    } as unknown as LifecycleBoardState;
  };
  const marked = () => {
    const values = createDraftStore();
    const results = createDraftStore();
    const board = createBoardDraft("submitted");
    connectDrafts(doc, values, board, results);
    values.set("region", ["EU"]);
    results.set("verdict", { decision: "reject" });
    board.edit("region", 1, () => ({ rev: 1, held: { act: "answer", order: 0 } }));
    return { values, results, board };
  };
  const press = (receipt: "queued" | "sent" | "delivered") => {
    const { values, results, board } = marked();
    return {
      board,
      pressed: submitPress(doc, board.get(), values.record(), AT, NONE_REPORTED, {
        results: results.record(),
        facts,
        state: stateWith(receipt),
      }),
    };
  };

  test("the receipt turned delivered after the mark: the press asks, naming the question", () => {
    const { pressed } = press("delivered");
    expect(pressed.kind).toBe("confirm");
    if (pressed.kind === "confirm") {
      expect(pressed.questions.map(({ id }) => id)).toEqual(["region"]);
      expect(pressed.acts).toHaveLength(1);
    }
  });

  test("a receipt that reads sent or queued sends at once", () => {
    for (const receipt of ["queued", "sent"] as const) {
      expect(press(receipt).pressed.kind).toBe("send");
    }
  });

  test("the reason check comes first: a question lacking its reason is named before any asking", () => {
    const { values, results, board } = marked();
    const needing: ComponentFacts = {
      confirmsRevision: true,
      reason: () => ({ label: "question.reasonRequired", missing: "question.reasonMissing" }),
    };
    const pressed = submitPress(doc, board.get(), values.record(), AT, NONE_REPORTED, {
      results: results.record(),
      facts: () => needing,
      state: stateWith("delivered"),
    });
    expect(pressed).toEqual({ kind: "needs-reason", questionId: "region" });
  });

  test("Cancel sends nothing and keeps every act held; confirming sends the command once", () => {
    const { board, pressed } = press("delivered");
    if (pressed.kind !== "confirm") throw new Error(pressed.kind);
    const before = JSON.stringify([...board.get().questions]);
    const sent: unknown[] = [];
    const cancelled = confirmPress(true, () => sent.push(pressed.acts));
    settle(cancelled, false);
    settle(cancelled, true);
    expect(sent).toEqual([]);
    expect(JSON.stringify([...board.get().questions])).toBe(before);
    const confirmed = confirmPress(true, () => sent.push(pressed.acts));
    settle(confirmed, true);
    settle(confirmed, true);
    expect(sent).toEqual([pressed.acts]);
  });
});

describe("the confirmation sends what is held when it is confirmed (approval-scale-ranking, task 4b.15; AD-20, NFR-10)", () => {
  const facts = (type: string): ComponentFacts | undefined =>
    type === "verdict" ? { confirmsRevision: true } : undefined;
  const verdict = { type: "verdict", id: "verdict", props: {} };
  const doc = (() => {
    const copy = structuredClone(document) as unknown as ViewDocument;
    const area = copy.items[0] as ViewArea;
    const [first] = area.props.items;
    (first as unknown as { props: { items: unknown[] } }).props.items = [verdict];
    return copy;
  })();
  const delivered = (() => {
    const base = stateOf();
    return {
      ...base,
      questions: base.questions.map((status) =>
        status.itemId === "region"
          ? {
              itemId: "region",
              rev: 1,
              state: "answered",
              answer: { when: WHEN, receipt: "delivered" },
            }
          : status,
      ),
    } as unknown as LifecycleBoardState;
  })();
  // A fresh board for each test: a change of a result releases the mark, as the card does.
  const fixture = () => {
    const values = createDraftStore();
    const results = createDraftStore();
    const board = createBoardDraft("submitted");
    connectDrafts(doc, values, board, results);
    values.set("region", ["EU"]);
    results.set("verdict", { decision: "reject" });
    board.edit("region", 1, () => ({ rev: 1, held: { act: "answer", order: 0 } }));
    const pressNow = (resultFacts: (type: string) => ComponentFacts | undefined = facts) =>
      submitPress(doc, board.get(), values.record(), AT, NONE_REPORTED, {
        results: results.record(),
        facts: resultFacts,
        state: delivered,
      });
    const first = pressNow();
    if (first.kind !== "confirm") throw new Error(first.kind);
    return { values, results, board, pressNow, asked: first };
  };

  test("Submit's state disabled since the dialog opened: nothing is sent", () => {
    const { asked, pressNow } = fixture();
    expect(confirmedPress(asked.questions, true, pressNow())).toEqual({ kind: "blocked" });
  });

  test("the reason went missing since: nothing is sent, and the question is named", () => {
    const { asked, pressNow } = fixture();
    const needing: ComponentFacts = {
      confirmsRevision: true,
      reason: () => ({ label: "question.reasonRequired", missing: "question.reasonMissing" }),
    };
    expect(
      confirmedPress(
        asked.questions,
        false,
        pressNow(() => needing),
      ),
    ).toEqual({
      kind: "needs-reason",
      questionId: "region",
    });
  });

  test("the same questions: the acts are those of the press now, not those of the first press", () => {
    const { asked, results, board, pressNow } = fixture();
    // The held answer changed since: a new note, which keeps the mark.
    board.edit("region", 1, (work) => ({ ...work, note: "Changed my mind." }));
    results.set("verdict", { decision: "approve" });
    board.edit("region", 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    const now = pressNow();
    const outcome = confirmedPress(asked.questions, false, now);
    expect(outcome.kind).toBe("send");
    if (outcome.kind === "send" && now.kind === "confirm") {
      expect(outcome.acts).toEqual(now.acts);
      expect(outcome.acts).not.toEqual(asked.acts);
    }
  });

  test("other questions would now be replaced: nothing is sent, and it asks again with the new list", () => {
    const { pressNow } = fixture();
    const outcome = confirmedPress([], false, pressNow());
    expect(outcome.kind).toBe("ask");
    if (outcome.kind === "ask") expect(outcome.questions.map(({ id }) => id)).toEqual(["region"]);
  });

  test("nothing is replaced any more: the press now sends its acts", () => {
    const { asked, pressNow } = fixture();
    const sendNow = pressNow(() => undefined);
    expect(sendNow.kind).toBe("send");
    expect(confirmedPress(asked.questions, false, sendNow)).toEqual({
      kind: "send",
      acts: sendNow.kind === "send" ? sendNow.acts : [],
    });
  });
});

describe("Select recommended and Submit with an entry held (checkpoints 2.3 and 4.4, X-1; AD-10, AD-20)", () => {
  // A test-only NumberField `days` on the `region` question, which has a recommended option. The
  // user typed `21` into it: the entry is held, the field has no result and "Answer" is disabled.
  const days = { type: "number-field", id: "days", props: { label: "Days", max: 20 } };
  const doc = (() => {
    const copy = structuredClone(document) as unknown as ViewDocument;
    const area = copy.items[0] as ViewArea;
    const [first] = area.props.items;
    (first as unknown as { props: { items: unknown[] } }).props.items = [days];
    return copy;
  })();
  const stores = (delivery: Delivery = "submitted") => {
    const values = createDraftStore();
    const results = createDraftStore();
    const entries = createDraftStore();
    const board = createBoardDraft(delivery);
    connectDrafts(doc, values, board, results, entries);
    return { values, results, entries, board };
  };
  const mark = (board: ReturnType<typeof stores>["board"], id: string, order: number) =>
    board.edit(id, 1, (work) => ({ ...work, held: { act: "answer", order } }));
  const base = {
    document: doc,
    delivery: "submitted" as const,
    connection: undefined,
    lock: undefined,
    pending: () => false,
    sending: () => false,
  };

  test("Select recommended selects the option, does not mark a question holding an entry, and counts it", () => {
    const { values, results, entries, board } = stores();
    entries.set("days", "21");
    const count = selectRecommended(
      doc,
      stateOf(),
      { draft: values, results, entries, board },
      () => false,
    );
    expect(values.valueOf("region")).toEqual(["EU"]);
    expect(board.work("region")?.held).toBeUndefined();
    // `rollout` has a recommended option and no entry: selected and marked, as before.
    expect(board.work("rollout")?.held?.act).toBe("answer");
    expect(count).toBe(2);
    expect(entries.valueOf("days")).toBe("21");
  });

  test("with the entry corrected or cleared, Select recommended marks the question ready", () => {
    const { values, results, entries, board } = stores();
    selectRecommended(doc, stateOf(), { draft: values, results, entries, board }, () => false);
    expect(board.work("region")?.held).toEqual({ act: "answer", order: 0, byRecommended: true });
  });

  test("in immediate delivery it only selects, entry or none", () => {
    const { values, results, entries, board } = stores("immediate");
    entries.set("days", "21");
    selectRecommended(doc, stateOf(), { draft: values, results, entries, board }, () => false);
    expect(values.valueOf("region")).toEqual(["EU"]);
    expect(board.work("region")?.held).toBeUndefined();
  });

  test("Submit with a held answer whose question holds an entry sends nothing and names the question", () => {
    const { values, results, entries, board } = stores();
    values.set("payment", ["Stripe"]);
    mark(board, "payment", 0);
    values.set("region", ["EU"]);
    mark(board, "region", 1);
    // A held mark that outlived the entry, as a path other than the card's could leave it.
    entries.set("days", "21");
    mark(board, "region", 1);
    const before = JSON.stringify([...board.get().questions]);
    const pressed = submitPress(doc, board.get(), values.record(), AT, NONE_REPORTED, {
      results: results.record(),
      entries: entries.record(),
      state: stateOf(),
    });
    expect(pressed).toEqual({ kind: "has-entry", questionId: "region" });
    expect(JSON.stringify([...board.get().questions])).toBe(before);
  });

  test("the reason check still comes first, and an entry on a question with no held answer blocks nothing", () => {
    const { values, results, entries, board } = stores();
    values.set("payment", ["Stripe"]);
    mark(board, "payment", 0);
    entries.set("days", "21");
    const pressed = submitPress(doc, board.get(), values.record(), AT, NONE_REPORTED, {
      results: results.record(),
      entries: entries.record(),
      state: stateOf(),
    });
    expect(pressed.kind).toBe("send");
    // A held decline or postpone on the question with the entry carries none of it.
    board.edit("region", 1, () => ({ rev: 1, held: { act: "postpone", order: 1 } }));
    expect(
      submitPress(doc, board.get(), values.record(), AT, NONE_REPORTED, {
        entries: entries.record(),
        state: stateOf(),
      }).kind,
    ).toBe("send");
  });

  test("the confirmation's Submit refuses to send it too, naming the question", () => {
    const entry = { kind: "has-entry", questionId: "region" } as const;
    expect(confirmedPress([], false, entry)).toEqual(entry);
    expect(confirmedPress([], true, entry)).toEqual({ kind: "blocked" });
  });

  test("Submit's state is disabled while a held answer's question holds an entry", () => {
    const { board, entries } = stores();
    mark(board, "region", 0);
    expect(submitStateOf({ ...base, board: board.get() }).disabled).toBe(false);
    entries.set("days", "21");
    mark(board, "region", 0);
    expect(submitStateOf({ ...base, board: board.get(), entries: entries.record() }).disabled).toBe(
      true,
    );
    expect(submitStateOf({ ...base, board: board.get(), entries: entries.record() }).held).toBe(1);
    // An entry on a question holding no answer for Submit leaves it enabled.
    board.edit("region", 1, () => ({ rev: 1, held: { act: "postpone", order: 0 } }));
    expect(submitStateOf({ ...base, board: board.get(), entries: entries.record() }).disabled).toBe(
      false,
    );
  });
});
