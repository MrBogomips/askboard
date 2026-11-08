import { describe, expect, test } from "bun:test";
import {
  BOARD_PROTOCOL_VERSION,
  type BoardDocument,
  type BoardState,
  type HostMessage,
  type LifecycleBoardState,
} from "@askboard/contract";
import {
  ganttPlanBoardDocument,
  lifecycleBoardDocument,
  plainChoiceBoardDocument,
  settingsWithEveryKey,
} from "@askboard/contract/fixtures";
import type { ViewAct, ViewAnswer } from "../view-protocol.ts";
import {
  actsFor,
  answerActFor,
  type BoardModel,
  basisOf,
  bootDataOf,
  EMPTY_MODEL,
  type PassedOn,
  stateProblem,
  withHostMessage,
  withViewMessage,
} from "./model.ts";

const version = BOARD_PROTOCOL_VERSION;
const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
const board: HostMessage = { version, type: "board", document: plainChoiceBoardDocument };
const state: HostMessage = { version, type: "state", state: waiting };

describe("what the board page knows of its board (design decision 8)", () => {
  test("a board loads once it has both the board document and the state, in either order", () => {
    expect(bootDataOf(EMPTY_MODEL)).toBeUndefined();
    expect(bootDataOf(withHostMessage(EMPTY_MODEL, board))).toBeUndefined();
    expect(bootDataOf(withHostMessage(EMPTY_MODEL, state))).toBeUndefined();
    const expected = { document: plainChoiceBoardDocument, state: waiting };
    expect(bootDataOf(withHostMessage(withHostMessage(EMPTY_MODEL, board), state))).toEqual(
      expected,
    );
    expect(bootDataOf(withHostMessage(withHostMessage(EMPTY_MODEL, state), board))).toEqual(
      expected,
    );
  });

  test("a later state replaces the earlier one in a new model", () => {
    const first = withHostMessage(withHostMessage(EMPTY_MODEL, board), state);
    const answered: BoardState = {
      ask: "answered",
      questions: [
        {
          itemId: "database",
          rev: 1,
          state: "answered",
          answer: { choice: ["PostgreSQL"], when: "2026-10-29T09:41:27Z", receipt: "sent" },
        },
      ],
    };
    const next = withHostMessage(first, { version, type: "state", state: answered });
    expect(next.state).toBe(answered);
    expect(first.state).toBe(waiting);
  });

  test("moved, discarded and refused leave the model as it is: the board page's status has them", () => {
    const model = withHostMessage(EMPTY_MODEL, board);
    for (const message of [
      { version, type: "moved" },
      { version, type: "discarded", reason: "session-exit" },
      { version, type: "refused", reason: "token", detail: "no" },
    ] as const) {
      expect(withHostMessage(model, message)).toBe(model);
    }
  });

  test("a receipt marks the question's logged answer delivered to the agent (FR-22)", () => {
    const sent: BoardState = {
      ask: "answered",
      questions: [
        {
          itemId: "database",
          rev: 1,
          state: "answered",
          answer: { choice: ["PostgreSQL"], when: "2026-10-29T09:41:27Z", receipt: "sent" },
        },
      ],
    };
    const model = withHostMessage(withHostMessage(EMPTY_MODEL, board), {
      version,
      type: "state",
      state: sent,
    });
    const receipt = { version, type: "receipt", itemId: "database", receipt: "delivered" } as const;
    const delivered = withHostMessage(model, receipt);
    expect(delivered.state?.questions[0]).toEqual({
      itemId: "database",
      rev: 1,
      state: "answered",
      answer: { choice: ["PostgreSQL"], when: "2026-10-29T09:41:27Z", receipt: "delivered" },
    });
    expect(delivered.state?.ask).toBe("answered");
    expect(model.state).toBe(sent);
  });

  test("a receipt for no logged answer leaves the model as it is", () => {
    const receipt = { version, type: "receipt", itemId: "database", receipt: "delivered" } as const;
    const loaded = withHostMessage(withHostMessage(EMPTY_MODEL, board), state);
    expect(withHostMessage(loaded, receipt)).toBe(loaded);
    expect(withHostMessage(EMPTY_MODEL, receipt)).toBe(EMPTY_MODEL);
    const other = { ...receipt, itemId: "cache" };
    expect(withHostMessage(loaded, other)).toBe(loaded);
  });

  test("the view's ready and item-error messages are recorded per item (AD-9)", () => {
    const ready = withViewMessage(EMPTY_MODEL, { type: "ready", itemId: "database" });
    expect([...ready.visible]).toEqual(["database"]);
    const failed = withViewMessage(ready, {
      type: "item-error",
      itemId: "database",
      error: "boom",
    });
    expect([...failed.failed]).toEqual([["database", "boom"]]);
    expect(EMPTY_MODEL.visible.size + EMPTY_MODEL.failed.size).toBe(0);
  });
});

describe("a state the board page can act on (AD-10)", () => {
  test("names each question of the board document at its revision, and nothing else", () => {
    expect(stateProblem(plainChoiceBoardDocument, waiting)).toBeUndefined();
    expect(stateProblem(undefined, waiting)).toBe("the state came before the board document");
  });

  test("a state with another question, a missing one or another revision is refused", () => {
    const at = (questions: BoardState["questions"]): BoardState => ({ ask: "waiting", questions });
    expect(
      stateProblem(plainChoiceBoardDocument, at([{ itemId: "cache", rev: 1, state: "open" }])),
    ).toBe('the state names "cache", which the board document does not hold at revision 1');
    expect(
      stateProblem(plainChoiceBoardDocument, at([{ itemId: "database", rev: 2, state: "open" }])),
    ).toBe('the state names "database", which the board document does not hold at revision 2');
    // E1's types hold one question; the check is written for more.
    const two = {
      ...plainChoiceBoardDocument,
      items: [
        ...plainChoiceBoardDocument.items,
        { ...plainChoiceBoardDocument.items[0], id: "cache" },
      ],
    } as unknown as BoardDocument;
    expect(stateProblem(two, waiting)).toBe('the state leaves out "cache"');
  });
});

describe("an answer from the view becomes an answer act only if it can be (AD-10)", () => {
  const answer: ViewAnswer = {
    type: "answer",
    itemId: "database",
    rev: 1,
    choice: ["PostgreSQL"],
    when: "2026-10-30T09:41:27.123Z",
  };
  const ready = (document: BoardDocument = plainChoiceBoardDocument): BoardModel =>
    withViewMessage(withHostMessage(withHostMessage(EMPTY_MODEL, { ...board, document }), state), {
      type: "ready",
      itemId: "database",
    });
  const detailOf = (model: BoardModel, message: ViewAnswer = answer) => {
    const acts = answerActFor(model, message);
    return acts.ok ? undefined : acts.detail;
  };

  test("an answer to the visible question goes as one answer act", () => {
    expect(answerActFor(ready(), answer)).toEqual({
      ok: true,
      value: [
        {
          type: "answer",
          itemId: "database",
          rev: 1,
          choice: ["PostgreSQL"],
          when: "2026-10-30T09:41:27.123Z",
        },
      ],
    });
  });

  test("not before the board has its document and state", () => {
    expect(detailOf(EMPTY_MODEL)).toContain("no board");
  });

  test("not to an item the board does not hold, or at a later revision than the board's", () => {
    expect(detailOf(ready(), { ...answer, itemId: "other" })).toContain('"other"');
    expect(detailOf(ready(), { ...answer, rev: 2 })).toContain("revision");
  });

  test("not on a closed ask (FR-6)", () => {
    const closed: BoardState = { ...waiting, ask: "closed" } as unknown as BoardState;
    const model = withHostMessage(ready(), { version, type: "state", state: closed });
    expect(detailOf(model)).toContain("closed");
  });

  test("not to a question that never counted as visible, or whose item failed (AD-9)", () => {
    const loaded = withHostMessage(withHostMessage(EMPTY_MODEL, board), state);
    expect(detailOf(loaded)).toContain("visible");
    const failed = withViewMessage(ready(), {
      type: "item-error",
      itemId: "database",
      error: "boom",
    });
    expect(detailOf(failed)).toContain("failed");
  });

  test("not with a label the question does not offer", () => {
    expect(detailOf(ready(), { ...answer, choice: ["Oracle"] })).toContain('"Oracle"');
  });

  test("not with widget values for an item the question does not hold, or with no content at all", () => {
    // A test-only `probe` widget item's value: the plain-choice question holds no widget item.
    const values = { sketch: { size: 4 } };
    const foreign =
      'the answer carries a value for "sketch", which is not a widget item of the question';
    expect(detailOf(ready(), { ...answer, values })).toBe(foreign);
    const { choice: _, ...widgetOnly } = answer;
    expect(detailOf(ready(), { ...widgetOnly, values })).toBe(foreign);
    expect(detailOf(ready(), widgetOnly)).toBe(
      "the answer carries no choice, no Other… text, no widget value and no result",
    );
    expect(detailOf(EMPTY_MODEL, { ...answer, values })).toBe("there is no board yet");
  });

  test("one label, unless the question is multiSelect", () => {
    const two = { ...answer, choice: ["PostgreSQL", "SQLite"] };
    expect(detailOf(ready(), two)).toContain("one");
    const [question] = plainChoiceBoardDocument.items;
    const multiple: BoardDocument = {
      ...plainChoiceBoardDocument,
      items: [{ ...question, props: { ...question.props, multiSelect: true } }],
    };
    expect(answerActFor(ready(multiple), two).ok).toBe(true);
  });
});

describe("an item that fails stops every act of its question (document-review, design decision 15; Issue #103)", () => {
  const when = "2026-11-08T09:41:27.123Z";
  const [{ id: question }] = ganttPlanBoardDocument.items;
  const planState: LifecycleBoardState = {
    ask: "waiting",
    questions: [{ itemId: question, rev: 1, state: "open" }],
  };
  // The board of one question `plan`, holding a Tree and a Gantt plan, which counted as visible.
  const visible = (): BoardModel =>
    withViewMessage(
      withHostMessage(
        withHostMessage(EMPTY_MODEL, {
          version,
          type: "board",
          document: ganttPlanBoardDocument,
        } as unknown as HostMessage),
        { version, type: "state", state: planState } as unknown as HostMessage,
      ),
      { type: "ready", itemId: question },
    );
  const failing = (itemId: string): BoardModel =>
    withViewMessage(visible(), { type: "item-error", itemId, error: "boom" });
  const acts: readonly ViewAct[] = [
    { type: "answer", itemId: question, rev: 1, values: { schedule: { size: 1 } }, when },
    { type: "postpone", itemId: question, rev: 1 },
    { type: "note", itemId: question, rev: 1, note: "x", when },
  ];

  test("at the head, the question's acts go", () => {
    for (const act of acts) expect(actsFor(visible(), [act]).ok).toBe(true);
  });

  test("a widget item of the question that failed refuses each act, naming the failure", () => {
    for (const itemId of ["schedule", "wbs"]) {
      const model = failing(itemId);
      for (const act of acts) {
        expect(actsFor(model, [act])).toEqual({
          ok: false,
          detail: "the question's item failed in the view",
        });
      }
    }
  });

  test("and refuses the whole command that holds acts for it, naming the first", () => {
    const checked = actsFor(failing("schedule"), [acts[1] as ViewAct, acts[2] as ViewAct]);
    expect(checked).toEqual({
      ok: false,
      detail: "act 1: the question's item failed in the view",
    });
  });
});

describe("an item inside a layout that fails stops every act of its question (document-review, re-review 6.23 S-2; Issue #103)", () => {
  const when = "2026-11-08T09:41:27.123Z";
  const [question] = plainChoiceBoardDocument.items;
  const field = (id: string) => ({ type: "text-field", id, props: { label: id } });
  // The question `database` holding a TextField in a Group and one in the second panel of Tabs.
  const nested = {
    ...plainChoiceBoardDocument,
    items: [
      {
        ...question,
        props: {
          ...question.props,
          items: [
            { type: "group", id: "details", props: { title: "Details", items: [field("name")] } },
            {
              type: "tabs",
              id: "panels",
              props: {
                tabs: [
                  { id: "one", title: "One", items: [field("first")] },
                  { id: "two", title: "Two", items: [field("second")] },
                ],
              },
            },
          ],
        },
      },
    ],
  } as unknown as BoardDocument;
  const visible = (): BoardModel =>
    withViewMessage(
      withHostMessage(withHostMessage(EMPTY_MODEL, { version, type: "board", document: nested }), {
        version,
        type: "state",
        state: waiting,
      }),
      { type: "ready", itemId: question.id },
    );
  const failing = (itemId: string): BoardModel =>
    withViewMessage(visible(), { type: "item-error", itemId, error: "boom" });
  const acts: readonly ViewAct[] = [
    { type: "postpone", itemId: question.id, rev: 1 },
    { type: "note", itemId: question.id, rev: 1, note: "x", when },
  ];

  test("at the head, the question's acts go", () => {
    for (const act of acts) expect(actsFor(visible(), [act]).ok).toBe(true);
  });

  test("a TextField inside a Group or a Tabs panel that failed refuses each act", () => {
    for (const itemId of ["name", "first", "second"]) {
      for (const act of acts) {
        expect(actsFor(failing(itemId), [act])).toEqual({
          ok: false,
          detail: "the question's item failed in the view",
        });
      }
    }
  });

  test("an item the document does not hold refuses nothing", () => {
    expect(actsFor(failing("elsewhere"), [acts[0] as ViewAct]).ok).toBe(true);
  });
});

describe("the user's acts become one act command only if each can be (ask-lifecycle, AD-10)", () => {
  const when = "2026-10-31T09:41:27.123Z";
  const lifecycleState: LifecycleBoardState = {
    ask: "waiting",
    questions: [
      { itemId: "region", rev: 1, state: "open" },
      { itemId: "payment", rev: 1, state: "open" },
      { itemId: "analytics", rev: 1, state: "postponed" },
      { itemId: "rollout", rev: 1, state: "open" },
      { itemId: "erp-export", rev: 1, state: "open" },
    ],
  };
  const loaded = (): BoardModel => {
    let model = withHostMessage(EMPTY_MODEL, {
      version,
      type: "board",
      document: lifecycleBoardDocument,
    } as unknown as HostMessage);
    model = withHostMessage(model, {
      version,
      type: "state",
      state: lifecycleState,
    } as unknown as HostMessage);
    for (const itemId of ["region", "payment", "analytics", "rollout", "erp-export"]) {
      model = withViewMessage(model, { type: "ready", itemId });
    }
    return model;
  };
  const detailOf = (acts: readonly ViewAct[], model = loaded()) => {
    const checked = actsFor(model, acts);
    return checked.ok ? undefined : checked.detail;
  };

  test("a board of areas: the state names every question of every area (AD-10)", () => {
    expect(stateProblem(lifecycleBoardDocument, lifecycleState)).toBeUndefined();
    const missing = { ...lifecycleState, questions: lifecycleState.questions.slice(1) };
    expect(stateProblem(lifecycleBoardDocument, missing as unknown as LifecycleBoardState)).toBe(
      'the state leaves out "region"',
    );
  });

  test("each act of a command, in the user's order, as the board protocol has it", () => {
    const acts: ViewAct[] = [
      { type: "postpone", itemId: "rollout", rev: 1 },
      { type: "answer", itemId: "payment", rev: 1, other: "Mollie", note: "Cheaper.", when },
      { type: "answer", itemId: "region", rev: 1, choice: ["EU", "US"], when },
      { type: "reopen", itemId: "analytics" },
      { type: "note", itemId: "erp-export", rev: 1, note: "Ask finance.", when },
      { type: "follow-up", itemId: "rollout", rev: 1, text: "Why?", when },
      { type: "decline", itemId: "erp-export", rev: 1, note: "Not mine.", when },
      { type: "edit-choice", itemId: "region", rev: 1, edit: "reload" },
    ];
    expect(actsFor(loaded(), acts)).toEqual({ ok: true, value: acts as never });
  });

  test("an answer act's derived values beside a choice reach board-host (design decision 10)", () => {
    const act = { type: "answer", itemId: "region", rev: 1, choice: ["EU"], when } as const;
    const derived = { "plan.finish": "2026-12-02" };
    expect(actsFor(loaded(), [{ ...act, derived }])).toEqual({
      ok: true,
      value: [{ ...act, derived }],
    });
  });

  test("an answer's option notes name the question's options; Other only where it is offered", () => {
    expect(
      detailOf([
        {
          type: "answer",
          itemId: "payment",
          rev: 1,
          choice: ["Stripe"],
          optionNotes: { Adyen: "Costly." },
          when,
        },
      ]),
    ).toBeUndefined();
    expect(
      detailOf([
        {
          type: "answer",
          itemId: "payment",
          rev: 1,
          choice: ["Stripe"],
          optionNotes: { Mollie: "?" },
          when,
        },
      ]),
    ).toContain('"Mollie"');
    expect(
      detailOf([{ type: "answer", itemId: "rollout", rev: 1, other: "Canary", when }]),
    ).toContain("Other");
  });

  test("a refused act refuses the whole command, naming the act", () => {
    const detail = detailOf([
      { type: "postpone", itemId: "rollout", rev: 1 },
      { type: "postpone", itemId: "rollout", rev: 2 },
    ]);
    expect(detail).toContain("act 2");
    expect(detail).toContain("revision");
    expect(detailOf([{ type: "reopen", itemId: "nothing" }])).toContain('"nothing"');
  });

  test("a postpone, a note or an edit choice names the question's current revision", () => {
    for (const act of [
      { type: "postpone", itemId: "rollout", rev: 2 },
      { type: "note", itemId: "rollout", rev: 2, note: "n", when },
      { type: "edit-choice", itemId: "rollout", rev: 2, edit: "reload" },
    ] as const) {
      expect(detailOf([act])).toContain("revision");
    }
    expect(
      detailOf([{ type: "edit-choice", itemId: "rollout", rev: 1, edit: "ignore", keptRev: 1 }]),
    ).toContain("revision");
  });

  test("nothing on a closed ask, and nothing on a question that is not visible (AD-9)", () => {
    const closed = withHostMessage(loaded(), {
      version,
      type: "state",
      state: { ...lifecycleState, ask: "closed" },
    } as unknown as HostMessage);
    expect(detailOf([{ type: "postpone", itemId: "rollout", rev: 1 }], closed)).toContain("closed");
    const hidden = withHostMessage(
      withHostMessage(EMPTY_MODEL, {
        version,
        type: "board",
        document: lifecycleBoardDocument,
      } as unknown as HostMessage),
      { version, type: "state", state: lifecycleState } as unknown as HostMessage,
    );
    expect(
      detailOf([{ type: "follow-up", itemId: "rollout", rev: 1, text: "?", when }], hidden),
    ).toContain("visible");
  });

  test("each act's question as it stood when the user acted: its revision and its state", () => {
    expect(basisOf(loaded(), [{ itemId: "analytics" }, { itemId: "rollout" }])).toEqual([
      { itemId: "analytics", rev: 1, state: "postponed" },
      { itemId: "rollout", rev: 1, state: "open" },
    ]);
  });

  test("a receipt marks a decline delivered too, on a board of areas", () => {
    const declined = {
      ...lifecycleState,
      ask: "partly-answered",
      questions: lifecycleState.questions.map((question) =>
        question.itemId === "rollout"
          ? {
              itemId: "rollout",
              rev: 1,
              state: "declined",
              answer: { declined: true, when, receipt: "sent" },
            }
          : question,
      ),
    } as unknown as LifecycleBoardState;
    const model = withHostMessage(loaded(), {
      version,
      type: "state",
      state: declined,
    } as unknown as HostMessage);
    const delivered = withHostMessage(model, {
      version,
      type: "receipt",
      itemId: "rollout",
      receipt: "delivered",
    });
    const rollout = delivered.state?.questions.find((question) => question.itemId === "rollout");
    expect(rollout).toEqual({
      itemId: "rollout",
      rev: 1,
      state: "declined",
      answer: { declined: true, when, receipt: "delivered" },
    });
  });
});

describe("what the model passes on (snapshot task 6.2)", () => {
  test("is no Snapshot's end: the controller makes that field from its own tracking", () => {
    const passedOn: PassedOn = {
      // @ts-expect-error: `snapshot` is one of the controller's fields, not one the model keeps
      snapshot: { requestId: "aB3cD5eF7gH9jK1lM3nP5q", outcome: "failed", reason: "unconfirmed" },
    };
    expect(Object.keys(passedOn)).toEqual(["snapshot"]);
    expect(EMPTY_MODEL.passedOn).toEqual({});
  });
});

describe("the settings in the model (settings-languages, task 8.2)", () => {
  test("the presentation passes on the values in effect and the keys the project fixes", () => {
    const model = withHostMessage(EMPTY_MODEL, settingsWithEveryKey);
    expect(model.settings).toBe(settingsWithEveryKey);
    expect(model.passedOn.presentation).toEqual({
      theme: "dark",
      density: "compact",
      contextPlacement: "inline",
      locked: ["contextPlacement"],
    });
  });

  test("a later settings message replaces the earlier one and keeps what else is passed on", () => {
    const origin = { version, type: "origin", who: { label: "Main agent" } } as const;
    const first = withHostMessage(withHostMessage(EMPTY_MODEL, origin), settingsWithEveryKey);
    const light = {
      ...settingsWithEveryKey,
      keys: {
        ...settingsWithEveryKey.keys,
        theme: { value: "light", from: "user", writable: true },
      },
    } as const;
    const second = withHostMessage(first, light);
    expect(second.passedOn.presentation?.theme).toBe("light");
    expect(second.passedOn.origin).toEqual({ who: { label: "Main agent" } });
  });

  test("the boot data holds the presentation, which the view's first render reads", () => {
    const model = withHostMessage(
      withHostMessage(withHostMessage(EMPTY_MODEL, board), state),
      settingsWithEveryKey,
    );
    expect(bootDataOf(model)?.presentation?.theme).toBe("dark");
  });
});
