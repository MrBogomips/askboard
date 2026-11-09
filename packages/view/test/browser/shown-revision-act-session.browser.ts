// An answer carries what the card shows, on the real board page and the session process, in each
// engine (document-review, task 6.10; Issue #93; spec view-and-widgets: An answer carries what the
// card shows; design decision 15): the user sets a result on each of two TextFields, the agent's
// `update` removes one, "Keep mine" with no reload keeps the card on revision 1, and "Answer" sends
// both results naming revision 1, which `ask-core` logs, refusing nothing (NFR-10, AD-10).
// Task 6.13 adds the board's own wiring of the shown revision: in submitted delivery "Select
// recommended" and Submit send an answer a later revision's field check would refuse, and a hidden
// tab's correction mark follows the revision the card shows, both after "Keep mine" with no reload.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/shown-revision-act-session.browser.ts

import { describe, expect, test } from "bun:test";
import { kanbanAsk } from "./fixtures/kanban-documents.ts";
import { database } from "./fixtures/lifecycle-asks.ts";
import { checkedEvents } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  barButton,
  card,
  lifecycleScenario,
  openBoard,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const fieldA = { type: "text-field", id: "a", props: { label: "First" } };
const fieldB = { type: "text-field", id: "b", props: { label: "Second" } };
const askWith = (items: readonly unknown[]) => ({
  ...kanbanAsk,
  items: [{ ...kanbanAsk.items[0], props: { ...kanbanAsk.items[0].props, items } }],
});

const notice = (board: Board) =>
  card(board, "plan").locator('[data-askboard-notice="agent-change"]');

const keepMine = async (board: Board): Promise<void> => {
  await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
  await notice(board).getByRole("button", { name: "Keep mine", exact: true }).click();
  await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
};

// The agent's revision 2 of the question `plan`, over the props of the kanban ask's question.
const reviseItems = (run: Parameters<typeof actsDone>[0], items: readonly unknown[]) =>
  run.session.update([
    { action: "change", itemId: "plan", props: { ...kanbanAsk.items[0].props, items } },
  ]);

// The field the agent's revision 2 holds to a minimum of five characters: "Ada" fails it there and
// passes revision 1's, which the card shows after "Keep mine".
const who = (minLength?: number) => ({
  type: "text-field",
  id: "who",
  props: { label: "Who", ...(minLength === undefined ? {} : { minLength }) },
});

// Two questions in submitted delivery: `plan` holds the field and recommends PostgreSQL.
const submittedAsk = () => ({
  ...kanbanAsk,
  delivery: "submitted",
  items: [
    { ...database("plan"), props: { ...database("plan").props, items: [who()] } },
    database("other"),
  ],
});

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: an answer carries what the card shows, on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "the agent removes an item that holds a result; Keep mine, Answer: both results go, naming revision 1, and ask-core logs them",
      async () => {
        const run = await start(lifecycleScenario(askWith([fieldA, fieldB]), dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("First", { exact: true }).fill("Ada");
        await board.view.getByLabel("Second", { exact: true }).fill("Grace");
        await eventually(
          () =>
            sentDrafts(run).some(
              (record) =>
                draftHolds([record], "plan", "a", "Ada") &&
                draftHolds([record], "plan", "b", "Grace"),
            ),
          "both fields mirrored to the board page",
        );
        await run.session.update([
          {
            action: "change",
            itemId: "plan",
            props: { ...kanbanAsk.items[0].props, items: [fieldA] },
          },
        ]);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await notice(board).getByRole("button", { name: "Keep mine", exact: true }).click();
        await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
          "edit-choice:2",
          "answer:1",
        ]);
        expect(events[1]?.results).toEqual({ a: "Ada", b: "Grace" });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Select recommended and Submit send the answer the card shows as ready, naming revision 1, though revision 2's field check would refuse the text",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk(), dist));
        const board = await openBoard(run, ["plan", "other"]);
        await board.view.getByLabel("Who", { exact: true }).fill("Ada");
        await eventually(
          () => sentDrafts(run).some((record) => draftHolds([record], "plan", "who", "Ada")),
          "the field mirrored to the board page",
        );
        await run.session.update([
          {
            action: "change",
            itemId: "plan",
            props: { ...database("plan").props, items: [who(5)] },
          },
        ]);
        await keepMine(board);
        await barButton(board, "Select recommended").click();
        await eventually(() => barButton(board, "Submit").isEnabled(), "Submit to be enabled");
        await barButton(board, "Submit").click();
        const answered = () =>
          sentActs(run)
            .flatMap((command) => command.acts)
            .filter((act) => act.type === "answer" && act.itemId === "plan");
        await eventually(() => answered().length === 1, "the answer to go");
        expect(answered()[0]).toMatchObject({
          rev: 1,
          choice: ["PostgreSQL"],
          results: { who: "Ada" },
        });
        const events = checkedEvents(await run.session.collectJson());
        const logged = events.find((event) => event.type === "answer" && event.itemId === "plan");
        expect(logged).toMatchObject({ rev: 1, results: { who: "Ada" } });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a hidden tab's correction mark follows the revision the card shows: a field only revision 2 refuses is not marked, one both refuse is",
      async () => {
        const panel = (id: string, title: string, field: unknown) => ({
          id,
          title,
          items: [field],
        });
        const field = (id: string, label: string, minLength?: number) => ({
          type: "text-field",
          id,
          props: { label, ...(minLength === undefined ? {} : { minLength }) },
        });
        const tabs = (late?: number) => ({
          type: "tabs",
          id: "sections",
          props: {
            tabs: [
              panel("now", "Now", field("now", "Now field")),
              panel("late", "Late", field("late", "Late field", late)),
              panel("early", "Early", field("early", "Early field", 5)),
            ],
          },
        });
        const run = await start(lifecycleScenario(askWith([tabs()]), dist));
        const board = await openBoard(run, ["plan"]);
        const { view } = board;
        await view.getByRole("tab", { name: "Late", exact: true }).click();
        await view.getByLabel("Late field", { exact: true }).fill("Ada");
        await view.getByRole("tab", { name: "Early", exact: true }).click();
        await view.getByLabel("Early field", { exact: true }).fill("Bob");
        await view.getByRole("tab", { name: "Now", exact: true }).click();
        await eventually(
          async () =>
            (await view.getByRole("tab", { name: "Early needs a correction" }).count()) === 1,
          "the mark on the tab both revisions refuse",
        );
        await reviseItems(run, [tabs(5)]);
        await keepMine(board);
        await Bun.sleep(300);
        expect(await view.getByRole("tab", { name: "Early needs a correction" }).count()).toBe(1);
        expect(await view.getByRole("tab", { name: "Late needs a correction" }).count()).toBe(0);
        expect(await view.getByRole("tab", { name: "Late", exact: true }).count()).toBe(1);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
