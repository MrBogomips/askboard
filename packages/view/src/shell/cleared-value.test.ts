import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type CatalogComponent, type ItemProps, register } from "../catalog/port.ts";
import type { ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createRevisions } from "./agent-change.ts";
import { createAnswerActs } from "./answer-acts.ts";
import { createAnsweredResults, createBoardContent } from "./board-content.ts";
import { createBoardDraft } from "./board-draft.ts";
import { answer, startRevision } from "./card-acts.ts";
import type { ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { itemCallbacks, itemValueOf } from "./item-callbacks.ts";
import { createReadyTracker } from "./ready-tracker.ts";
import { type RenderContext, RenderItem } from "./renderer.tsx";
import { createRevisingSnapshot, questionRevising } from "./revising.ts";
import { createStore } from "./store.ts";

// A widget value the user returns to the agent's version during a revision (reopen-start-from-
// answer, design decision 2; view-and-widgets: "An edit returned to the agent's version during a
// revision"; Issue #107, values): the Tree, the Gantt and the Table write `undefined` when an edit
// comes back to the agent's props. Once the revision has started the card shows the draft alone,
// so the item shows the agent's props, "Answer" sends no value for it and the live graph reads
// the same board (re-review 2.13 X-1).

Object.assign(globalThis, { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });

const [database] = plainChoiceBoardDocument.items;
const ACTION_ID = "AAAAAAAAAAAAAAAAAAAAAA";

const edited = (id: string): WidgetItem => ({
  type: id === "wbs" ? "tree" : id === "plan" ? "gantt" : "table",
  id,
  props: { label: `${id} as the agent sent it` },
});
const name: WidgetItem = { type: "text-field", id: "name", props: { label: "Name" } };
const days: WidgetItem = { type: "number-field", id: "days", props: { label: "Days" } };
const EDITABLE = ["wbs", "plan", "grid"] as const;
const ANSWERED_VALUES = Object.fromEntries(
  EDITABLE.map((id) => [id, { label: `${id} edited by the user` }]),
);

const question = {
  ...database,
  props: { text: "Details?", items: [...EDITABLE.map(edited), name, days] },
} as unknown as ViewQuestion;
const document = { ...plainChoiceBoardDocument, items: [question] } as unknown as ViewDocument;
const loggedAnswer = {
  values: ANSWERED_VALUES,
  results: { name: "abc" },
  when: "2026-11-08T10:00:00Z",
  receipt: "delivered",
};
const state = {
  ask: "waiting",
  questions: [{ itemId: question.id, rev: question.rev, state: "answered", answer: loggedAnswer }],
} as unknown as LifecycleBoardState;
const accepting = () => ({ fits: () => true });

// A question of one edit widget and one TextField, no note: the revision is held by the seeded
// result alone once the widget's edit is returned (re-review 2.15 X-2).
const slimQuestion = {
  ...database,
  props: { text: "Details?", items: [edited("wbs"), name] },
} as unknown as ViewQuestion;
const slimAnswer = { ...loggedAnswer, values: { wbs: ANSWERED_VALUES.wbs as { label: string } } };
const slimScenario = {
  question: slimQuestion,
  document: { ...plainChoiceBoardDocument, items: [slimQuestion] } as unknown as ViewDocument,
  answer: slimAnswer,
  ids: ["wbs", name.id],
};
const fullScenario = {
  question,
  document,
  answer: loggedAnswer,
  ids: [...EDITABLE, name.id, days.id],
};

const setUp = ({ question, document, answer, ids } = fullScenario) => {
  const answered = {
    ask: "waiting",
    questions: [{ itemId: question.id, rev: question.rev, state: "answered", answer }],
  } as unknown as LifecycleBoardState;
  const sent: ViewMessage[] = [];
  const channel: ViewChannel = {
    send: async (message) => {
      sent.push(message);
      return { outcome: "sent", actionId: ACTION_ID };
    },
    onUpdate: () => () => {},
    onTheme: () => () => {},
  };
  const draft = createDraftStore();
  const results = createDraftStore();
  const board = createBoardDraft("immediate");
  const context = {
    channel,
    acts: createAnswerActs(),
    draft,
    results,
    board,
    derived: createDerivedStore(),
    delivery: "immediate" as const,
    facts: accepting,
  };
  const revisions = createRevisions();
  revisions.record(document);
  const entries = createDraftStore();
  const cellEntries = createDraftStore();
  // The shell's own snapshot of the questions under revision, over the stores.
  const view = createStore({ document, state: answered });
  const revising = createRevisingSnapshot({
    view,
    draft,
    board,
    revisions,
    results,
    entries,
    cellEntries,
  });
  const boardOf = createBoardContent(() => view.get(), revising.get);
  // The card's own step before an edit: the first one starts the revision from the answer.
  const revise = () => {
    const input = {
      work: board.work(question.id),
      revisions,
      values: draft.record(),
      results: results.record(),
      entries: entries.record(),
    };
    if (!questionRevising(question, input)) startRevision(question, answer, context);
  };
  const callbacksOf = (itemId: string) =>
    itemCallbacks({
      draft,
      results,
      itemId,
      questionId: question.id,
      itemIds: [question.id, ...ids],
      onBeforeChange: revise,
      onError: (error) => {
        throw error;
      },
    });
  const shownOf = (itemId: string): unknown =>
    itemValueOf(undefined, boardOf(draft.record()), itemId);
  return { sent, draft, entries, cellEntries, context, boardOf, callbacksOf, shownOf };
};

describe("a value the user returns to the agent's version during a revision", () => {
  test("a held result alone keeps the revision: one edit widget and one TextField, no note", () => {
    const { sent, context, callbacksOf, shownOf } = setUp(slimScenario);
    expect(shownOf("wbs")).toEqual(ANSWERED_VALUES.wbs);
    // The first edit starts the revision, which seeds the widget's value and the result "abc".
    callbacksOf("wbs").onValueChange({ label: "wbs moved" });
    callbacksOf("wbs").onValueChange(undefined);
    // The draft holds no value now: only the seeded result keeps the revision under way.
    expect(shownOf("wbs")).toBeUndefined();
    answer(slimQuestion, context);
    const [message] = sent as readonly {
      values?: Record<string, unknown>;
      results?: Record<string, unknown>;
    }[];
    expect(message?.results).toEqual({ name: "abc" });
    expect(Object.hasOwn(message?.values ?? {}, "wbs")).toBe(false);
  });

  for (const returned of EDITABLE) {
    test(`the ${returned} item shows the agent's props, and Answer sends no value for it`, () => {
      const { sent, context, callbacksOf, shownOf } = setUp();
      // Before any edit the lookup serves the logged value (the answered card's fallback).
      expect(shownOf(returned)).toEqual(ANSWERED_VALUES[returned]);
      // A held result keeps the revision under way while the item's edit comes back.
      callbacksOf(name.id).onResultChange("kept text");
      callbacksOf(returned).onValueChange(undefined);
      expect(shownOf(returned)).toBeUndefined();
      for (const other of EDITABLE.filter((id) => id !== returned)) {
        expect(shownOf(other)).toEqual(ANSWERED_VALUES[other]);
      }
      answer(question, context);
      const [message] = sent as readonly { values?: Record<string, unknown> }[];
      expect(message?.values).toBeDefined();
      expect(Object.hasOwn(message?.values ?? {}, returned)).toBe(false);
      for (const other of EDITABLE.filter((id) => id !== returned)) {
        expect(message?.values?.[other]).toEqual(ANSWERED_VALUES[other]);
      }
    });
  }

  test("an item with a value in the draft shows it, and a question not revising shows the answer", () => {
    const { draft, callbacksOf, shownOf } = setUp();
    const moved = { label: "wbs moved again" };
    callbacksOf("wbs").onValueChange(moved);
    expect(shownOf("wbs")).toEqual(moved);
    const other = createBoardContent(() => ({ document, state }));
    expect(itemValueOf(undefined, other(draft.record()), "plan")).toEqual(ANSWERED_VALUES.plan);
  });

  test("any answer work keeps the revision: an entry, a cell entry or a note stops the answer filling the board", () => {
    const entries = setUp();
    entries.entries.set(days.id, "12x");
    expect(entries.shownOf("wbs")).toBeUndefined();
    const cells = setUp();
    cells.cellEntries.set("grid", new Map([["r1.cost", "1x"]]));
    expect(cells.shownOf("grid")).toBeUndefined();
    const noted = setUp();
    noted.context.board.edit(question.id, question.rev, (work) => ({ ...work, note: "why" }));
    expect(noted.shownOf("plan")).toBeUndefined();
  });

  test("the answered results' own lookup is unaffected: it serves its fallback until a revision starts", () => {
    const answered = createAnsweredResults(() => ({ document, state }), accepting);
    expect(answered("name")).toBe("abc");
  });
});

// A computing item: it reports what it derives from the value the board shows for the Tree.
const Graph: CatalogComponent = ({ item, board, onDerived }: ItemProps) => {
  const shown = board.shown.get("wbs") as { label?: string } | undefined;
  const props = (board.items.find((entry) => entry.id === "wbs")?.props ?? {}) as {
    label?: string;
  };
  onDerived({ label: shown?.label ?? props.label ?? "none" });
  return createElement("span", null, (item as { id: string }).id);
};
register("graph-probe", Graph);

describe("the live graph during a revision (re-review 2.13 X-1)", () => {
  test("the derived values follow the shown value: the agent's props once the edit comes back", () => {
    const { draft, callbacksOf, boardOf } = setUp();
    const graph = { type: "graph-probe", id: "graph", props: {} };
    const derived = createDerivedStore();
    const render = () =>
      renderToStaticMarkup(
        createElement(RenderItem, {
          item: graph as unknown as WidgetItem,
          component: "graph-probe",
          questionId: question.id,
          itemIds: ["graph"],
          context: {
            draft,
            tracker: createReadyTracker([{ questionId: question.id, itemIds: ["graph"] }], {
              onVisible: () => {},
              onFailed: () => {},
            }),
            boardContent: boardOf,
            derived,
          } as RenderContext,
          disabled: false,
        }),
      );
    render();
    expect(derived.reported("graph")).toEqual({ label: "wbs edited by the user" });
    callbacksOf("name").onResultChange("kept text");
    callbacksOf("wbs").onValueChange(undefined);
    render();
    expect(derived.reported("graph")).toEqual({ label: "wbs as the agent sent it" });
  });
});
