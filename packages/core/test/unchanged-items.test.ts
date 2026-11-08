import { describe, expect, test } from "bun:test";
import type { LifecycleAskInput } from "@askboard/contract";
import {
  KANBAN_FIXTURE_ITEM,
  TIMELINE_EDITED_PROPS,
  TIMELINE_FIXTURE_ITEM,
} from "@askboard/contract/fixtures";
import type { QuestionRecord } from "../src/lifecycle/model.ts";
import { unchangedComparisons } from "../src/lifecycle/unchanged.ts";
import { boardOf, command, created, FLAT_ID, flatAsk, logOf, WHEN } from "./lifecycle-fakes.ts";
import { type Item, modelOf } from "./probe-fakes.ts";

// Core spec: What an answer's revision shares with the current one (reopen-start-from-answer,
// design decision 1): the board state's current and previous answer name the question and the items
// whose props equal those of the revision the answer names, and `fetch`, `collect` and the log
// never hold them.

const ASK_ID = "plan-ask-x1k2";
const copy = <T>(value: T): T => structuredClone(value);

const group = {
  type: "group",
  id: "side",
  props: { title: "Side", items: [TIMELINE_FIXTURE_ITEM] },
};

const planAsk = (...extra: unknown[]): LifecycleAskInput =>
  copy({
    askId: ASK_ID,
    items: [
      {
        type: "question",
        id: "plan",
        props: { text: "Plan the quarter", items: [group, ...extra] },
      },
    ],
  }) as unknown as LifecycleAskInput;

type Core = Awaited<ReturnType<typeof created>>["core"];

const update = (core: Core, askId: string, ...actions: Record<string, unknown>[]) =>
  core.update({ askId, actions } as never);

const answerTimeline = (core: Core, rev = 1, extra: Record<string, unknown> = {}) =>
  core.act(
    ASK_ID,
    command([
      {
        type: "answer",
        itemId: "plan",
        rev,
        when: WHEN,
        values: { roadmap: TIMELINE_EDITED_PROPS },
        ...extra,
      } as never,
    ]),
  );

const planOf = (core: Core, askId = ASK_ID) => {
  const question = boardOf(core, askId).questions[0];
  if (question === undefined) throw new Error("no question");
  return question;
};

describe("a reopened question's previous answer", () => {
  test("a Timeline inside a Group, reopened with no change: the question, the Group and the Timeline", async () => {
    const { core } = await created(planAsk());
    expect(answerTimeline(core).ok).toBe(true);
    await update(core, ASK_ID, { action: "reopen", itemId: "plan" });
    expect(planOf(core)).toMatchObject({ rev: 2, state: "open" });
    expect(planOf(core).previous?.unchanged).toEqual(["plan", "side", "roadmap"]);
  });

  test("after a change of the Timeline's lanes: the Group only", async () => {
    const { core } = await created(planAsk());
    answerTimeline(core);
    await update(core, ASK_ID, { action: "reopen", itemId: "plan" });
    await update(core, ASK_ID, {
      action: "change",
      itemId: "roadmap",
      props: {
        lanes: [
          { id: "web", label: "Frontend" },
          { id: "mobile", label: "Mobile" },
        ],
      },
    });
    expect(planOf(core).rev).toBe(3);
    expect(planOf(core).previous?.unchanged).toEqual(["side"]);
  });

  test("a new item in the Group changes the Group's membership: neither the question nor the Group", async () => {
    const { core } = await created(planAsk());
    answerTimeline(core);
    await update(core, ASK_ID, { action: "reopen", itemId: "plan" });
    await update(core, ASK_ID, {
      action: "change",
      itemId: "side",
      props: { items: [TIMELINE_FIXTURE_ITEM, { ...KANBAN_FIXTURE_ITEM }] },
    });
    expect(planOf(core).previous?.unchanged).toEqual(["roadmap"]);
  });

  test("a recorded answer reopened with no change: the question", async () => {
    const { core } = await created(flatAsk());
    await update(core, FLAT_ID, { action: "change", itemId: "q1", props: { text: "Second" } });
    await update(core, FLAT_ID, {
      action: "answer",
      itemId: "q1",
      answer: { choice: ["main"] },
    });
    await update(core, FLAT_ID, { action: "reopen", itemId: "q1" });
    expect(boardOf(core, FLAT_ID).questions[0]).toMatchObject({
      rev: 3,
      previous: { recorded: true, unchanged: ["q1"] },
    });
  });

  test("a recorded answer reopened and then changed lists nothing, and the field is left out", async () => {
    const { core } = await created(flatAsk());
    await update(core, FLAT_ID, { action: "answer", itemId: "q1", answer: { choice: ["main"] } });
    await update(core, FLAT_ID, { action: "reopen", itemId: "q1" });
    await update(core, FLAT_ID, { action: "change", itemId: "q1", props: { text: "Reworded" } });
    const { previous } = boardOf(core, FLAT_ID).questions[0] ?? {};
    expect(previous).toMatchObject({ recorded: true });
    expect(previous).not.toHaveProperty("unchanged");
  });

  test("the recorded answer's revision stays kept after the user's later decision prunes older ones", async () => {
    const { core } = await created(flatAsk());
    await update(core, FLAT_ID, { action: "answer", itemId: "q1", answer: { choice: ["main"] } });
    await update(core, FLAT_ID, { action: "reopen", itemId: "q1" });
    // The user's answer to rev 2 decides it; rev 1, which no event names, would be pruned.
    const outcome = core.act(
      FLAT_ID,
      command([{ type: "answer", itemId: "q1", rev: 2, choice: ["release"], when: WHEN }]),
    );
    expect(outcome.ok).toBe(true);
    expect(boardOf(core, FLAT_ID).questions[0]?.previous).toMatchObject({
      recorded: true,
      unchanged: ["q1"],
    });
  });
});

describe("an answer's own unchanged items", () => {
  test("an answered question's current answer lists every item", async () => {
    const { core } = await created(planAsk());
    answerTimeline(core);
    expect(planOf(core).answer?.unchanged).toEqual(["plan", "side", "roadmap"]);
  });

  test("an answer kept on an earlier revision lists only the items equal in both revisions", async () => {
    const { core } = await created(planAsk({ ...copy(KANBAN_FIXTURE_ITEM) }));
    await update(core, ASK_ID, {
      action: "change",
      itemId: KANBAN_FIXTURE_ITEM.id,
      props: {
        columns: [...KANBAN_FIXTURE_ITEM.props.columns, { id: "later", label: "Later" }],
      },
    });
    const outcome = core.act(
      ASK_ID,
      command([
        { type: "edit-choice", itemId: "plan", rev: 2, edit: "ignore", keptRev: 1 },
        {
          type: "answer",
          itemId: "plan",
          rev: 1,
          when: WHEN,
          values: { roadmap: TIMELINE_EDITED_PROPS },
        } as never,
      ]),
    );
    expect(outcome).toMatchObject({ ok: true });
    expect(planOf(core).rev).toBe(2);
    expect(planOf(core).answer?.unchanged).toEqual(["side", "roadmap"]);
  });

  test("an answer kept on an earlier revision, then reopened: the previous answer names that revision", async () => {
    const { core } = await created(planAsk({ ...copy(KANBAN_FIXTURE_ITEM) }));
    await update(core, ASK_ID, {
      action: "change",
      itemId: KANBAN_FIXTURE_ITEM.id,
      props: {
        columns: [...KANBAN_FIXTURE_ITEM.props.columns, { id: "later", label: "Later" }],
      },
    });
    core.act(
      ASK_ID,
      command([
        { type: "edit-choice", itemId: "plan", rev: 2, edit: "ignore", keptRev: 1 },
        {
          type: "answer",
          itemId: "plan",
          rev: 1,
          when: WHEN,
          values: { roadmap: TIMELINE_EDITED_PROPS },
        } as never,
      ]),
    );
    await update(core, ASK_ID, { action: "reopen", itemId: "plan" });
    expect(planOf(core)).toMatchObject({ rev: 3, state: "open" });
    expect(planOf(core).previous?.unchanged).toEqual(["side", "roadmap"]);
  });

  test("a question with no answer has no unchanged items", async () => {
    const { core } = await created(planAsk());
    expect(planOf(core)).not.toHaveProperty("answer");
    expect(JSON.stringify(planOf(core))).not.toContain("unchanged");
  });
});

describe("where the unchanged items go no further", () => {
  test("fetch, collect's events and the log hold none", async () => {
    const { core } = await created(planAsk());
    answerTimeline(core);
    await update(core, ASK_ID, { action: "reopen", itemId: "plan" });
    expect(planOf(core).previous?.unchanged).toBeDefined();
    for (const id of ["plan", "side", "roadmap"]) {
      expect(JSON.stringify(core.fullValue(ASK_ID, id))).not.toContain("unchanged");
    }
    expect(JSON.stringify(logOf(core, ASK_ID))).not.toContain("unchanged");
  });
});

describe("the comparison is made once", () => {
  test("two board states in a row compare each pair of revisions once", async () => {
    const { core } = await created(planAsk());
    answerTimeline(core);
    await update(core, ASK_ID, { action: "reopen", itemId: "plan" });
    await update(core, ASK_ID, {
      action: "change",
      itemId: "roadmap",
      props: {
        lanes: [
          { id: "web", label: "Frontend" },
          { id: "mobile", label: "Mobile" },
        ],
      },
    });
    const before = unchangedComparisons();
    planOf(core);
    const first = unchangedComparisons() - before;
    expect(first).toBe(1);
    planOf(core);
    planOf(core);
    expect(unchangedComparisons() - before).toBe(first);
  });

  test("a revision the model does not keep gives nothing, so the field is left out", () => {
    const model = modelOf([copy(group) as Item]);
    const question = model.questions()[0] as QuestionRecord;
    expect(model.unchangedSince(question, 99)).toBeUndefined();
    expect(model.unchangedSince(question, 1)).toEqual([question.id, "side", "roadmap"]);
  });
});
