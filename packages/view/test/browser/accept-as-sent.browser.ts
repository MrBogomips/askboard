// "Accept as is", in each engine, on the session process (accept-as-sent, tasks 5.1 and 5.2; spec
// view-and-widgets: When Accept as is is offered, Accept as is answers as Answer does, Accept as
// is in All together; core and contract specs through the agent's `collect` and `fetch`):
//
// (a) a Tree question with no options accepted in "One by one" with a note: one answer act with
//     `asSent`, the note and no `values`; the agent collects the event and fetches the answer, both
//     checked against their schemas; the status, the card's line and the move to the next question;
// (b) the button is gone with an edit and back once the edit is undone;
// (c) a question with options and a Tree shows "Accept recommended" and no "Accept as is";
// (d) an untouched Table beside an empty required TextField: the button waits and says why, and
//     nothing is sent;
// (e) the keyboard: Tab to the button and Enter acts as a click, and Ctrl+Enter on an untouched
//     card sends nothing;
// (f) in "All together" a Kanban question is marked ready, and Submit sends it with `asSent`;
// (g) a reload keeps a Timeline question ready and accepted, and Submit sends it with `asSent`;
// (h) a Snapshot of an accepted question names the acceptance and offers no button;
// (i) revising an accepted answer: "Edit", a Tree edit and "Answer" replace it.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/accept-as-sent.browser.ts

import { describe, expect, test } from "bun:test";
import { SNAPSHOT_DATA_ELEMENT, type SnapshotData } from "@askboard/contract";
import { validateSnapshotData } from "@askboard/contract/validate";
import type { Locator } from "playwright";
import { kanbanItem } from "./fixtures/kanban-documents.ts";
import { plain } from "./fixtures/lifecycle-asks.ts";
import { tableItem } from "./fixtures/table-documents.ts";
import { timelineItem } from "./fixtures/timeline-documents.ts";
import { plan, wbs } from "./fixtures/tree-documents.ts";
import { checkedEvents, checkedFetchItem, renameNode } from "./harness/approval-board.ts";
import {
  type BoardRun,
  eventually,
  expectNoCspProblem,
  isFocused,
  LOAD_TIMEOUT_MS,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  actsSent,
  answerOf,
  buttonOf,
  card,
  headingOf,
  lifecycleScenario,
  mirrored,
  noteOf,
  openBoard,
  sentActs,
  tabTo,
} from "./harness/lifecycle-test.ts";
import { quiet } from "./harness/probes.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const NOTE = "Fine as it is";
const MOD_ENTER = "Control+Enter";

type Event = Readonly<Record<string, unknown>>;
type Start = ReturnType<typeof useEngine>["start"];
type Items = readonly unknown[];

const treeQuestion = (extra: Readonly<Record<string, unknown>> = {}) => ({
  type: "question",
  id: "plan",
  props: { ...plan.props, items: [wbs], ...extra },
});
const questionWith = (items: Items, extra: Readonly<Record<string, unknown>> = {}) => ({
  type: "question",
  id: "plan",
  props: { ...plan.props, items, ...extra },
});
const cache = () => plain("cache", "Should the order service cache reads?", "Cache");
const askOf = (askId: string, items: Items, delivery?: "submitted") => ({
  askId,
  title: "Customer portal SOW plan",
  ...(delivery === undefined ? {} : { delivery }),
  items,
});

const acceptOf = (board: Board, id = "plan"): Locator =>
  card(board, id).locator("[data-askboard-accept-as-is]");
const markOf = (board: Board, id = "plan"): Locator =>
  card(board, id).locator("[data-askboard-state]");
const lineOf = (board: Board, id = "plan"): Locator =>
  card(board, id).locator("[data-askboard-answer-line]");

const said = (board: Board, text: string): Promise<void> =>
  eventually(async () => ((await board.status.textContent()) ?? "").includes(text), `"${text}"`);

const answersOf = (run: BoardRun): readonly Event[] =>
  sentActs(run).flatMap((command) => command.acts.filter((act) => act.type === "answer"));

const collectedAnswers = async (run: BoardRun): Promise<readonly Event[]> =>
  checkedEvents(await run.session.collectJson()).filter((event) => event.type === "answer");

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: Accept as is, on the session process`, () => {
    const { start } = useEngine(engine);

    const open = async (scenario: ReturnType<typeof askOf>, ids: readonly string[]) => {
      const run = await start(lifecycleScenario(scenario, dist));
      return { run, board: await openBoard(run, ids) };
    };

    test(
      "(a) a Tree accepted in One by one with a note: one answer act with asSent, the note and no values, collected and fetched, the status, the line and the move to the next question",
      async () => {
        const { run, board } = await open(askOf("accept-tree-a1b2", [treeQuestion(), cache()]), [
          "plan",
          "cache",
        ]);
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await noteOf(board, "plan").fill(NOTE);
        await acceptOf(board).click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, 1);
        await actsDone(run, 1);
        const [act, ...more] = answersOf(run);
        expect(more).toEqual([]);
        expect(act).toMatchObject({ itemId: "plan", rev: 1, asSent: true, note: NOTE });
        for (const field of ["values", "choice", "results", "other"]) {
          expect(act).not.toHaveProperty(field);
        }

        await said(board, "Answer sent: accepted as is.");
        await eventually(
          async () => ((await lineOf(board).textContent()) ?? "") === "Answer: Accepted as is",
          "the card's line",
        );
        await eventually(() => isFocused(headingOf(board, "cache")), "focus on the next question");

        const [event, ...others] = await collectedAnswers(run);
        expect(others).toEqual([]);
        expect(event).toMatchObject({ itemId: "plan", rev: 1, asSent: true, note: NOTE });
        expect(event).not.toHaveProperty("changes");
        const item = checkedFetchItem(await run.session.fetch("plan"));
        expect(item).toMatchObject({ id: "plan", state: "answered" });
        expect(item.answer).toMatchObject({ asSent: true, note: NOTE });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(b) Gone with an edit, back when the edit is undone",
      async () => {
        const { board } = await open(askOf("accept-undo-b2c3", [treeQuestion(), cache()]), [
          "plan",
          "cache",
        ]);
        await acceptOf(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await renameNode(board, "ux", "UX design, moved");
        await eventually(async () => (await acceptOf(board).count()) === 0, "no Accept as is");
        await renameNode(board, "ux", "UX design");
        await eventually(async () => (await acceptOf(board).count()) === 1, "Accept as is again");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(c) not on a question with options: Accept recommended, and no Accept as is",
      async () => {
        const options = [{ label: "Keep it", recommended: true }, { label: "Change it" }];
        const { board } = await open(askOf("accept-options-c3d4", [treeQuestion({ options })]), [
          "plan",
        ]);
        await buttonOf(board, "plan", "Accept recommended").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await acceptOf(board).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(d) blocked by a field: an untouched Table beside an empty required TextField waits and names the field, and nothing is sent",
      async () => {
        const field = {
          type: "text-field",
          id: "who",
          props: { label: "Who signs", required: true },
        };
        const { run, board } = await open(
          askOf("accept-blocked-d4e5", [questionWith([tableItem(), field]), cache()]),
          ["plan", "cache"],
        );
        await acceptOf(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => acceptOf(board).isDisabled(), "the button to wait");
        expect(
          await card(board, "plan").getByText("Who signs", { exact: false }).count(),
        ).toBeGreaterThan(0);
        await acceptOf(board)
          .click({ force: true, timeout: STEP_TIMEOUT_MS })
          .catch(() => {});
        await quiet("a press that sends nothing has no probe: the page and the host stay silent");
        expect(sentActs(run)).toHaveLength(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(e) from the keyboard: Tab to the button and Enter acts as a click, and Ctrl+Enter on an untouched card sends nothing",
      async () => {
        const { run, board } = await open(askOf("accept-keys-e5f6", [treeQuestion(), cache()]), [
          "plan",
          "cache",
        ]);
        await noteOf(board, "plan").focus();
        await board.page.keyboard.press(MOD_ENTER);
        await quiet("a key that sends nothing has no probe: the page and the host stay silent");
        expect(sentActs(run)).toHaveLength(0);

        await tabTo(board, acceptOf(board));
        await board.page.keyboard.press("Enter");
        await actsSent(run, 1);
        expect(answersOf(run)[0]).toMatchObject({ itemId: "plan", asSent: true });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(f) Ready, then sent by Submit: a Kanban is marked ready in All together, nothing is sent, and Submit's command carries asSent and no values",
      async () => {
        const { run, board } = await open(
          askOf("accept-kanban-f6a7", [questionWith([kanbanItem()]), cache()], "submitted"),
          ["plan", "cache"],
        );
        await acceptOf(board).click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await markOf(board).getAttribute("data-askboard-state")) === "ready",
          "plan ready",
        );
        await said(board, "Answer ready, not sent. 1 ready.");
        expect(sentActs(run)).toHaveLength(0);
        await board.submit.click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, 1);
        await actsDone(run, 1);
        const [act, ...more] = answersOf(run);
        expect(more).toEqual([]);
        expect(act).toMatchObject({ itemId: "plan", asSent: true });
        expect(act).not.toHaveProperty("values");
        const [event] = await collectedAnswers(run);
        expect(event).toMatchObject({ itemId: "plan", asSent: true });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(g) a reload keeps a Timeline question ready and accepted, and Submit sends it with asSent",
      async () => {
        const { run, board } = await open(
          askOf("accept-timeline-g7h8", [questionWith([timelineItem()]), cache()], "submitted"),
          ["plan", "cache"],
        );
        await acceptOf(board).click({ timeout: STEP_TIMEOUT_MS });
        await mirrored(
          run,
          (record) => record.questions.plan?.held?.asSent === true,
          "the held answer accepted as sent",
        );
        await reloadBoard(board, run, () =>
          board.view
            .locator('[data-askboard-question="plan"]:not([aria-busy="true"])')
            .waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS }),
        );
        await eventually(
          async () => (await markOf(board).getAttribute("data-askboard-state")) === "ready",
          "plan still ready",
        );
        await eventually(
          async () => ((await lineOf(board).textContent()) ?? "") === "Answer: Accepted as is",
          "the line after the reload",
        );
        const before = sentActs(run).length;
        await board.submit.click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, before + 1);
        const [act] = answersOf(run).slice(-1);
        expect(act).toMatchObject({ itemId: "plan", asSent: true });
        expect(act).not.toHaveProperty("values");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(h) a Snapshot of an accepted question shows Answer: Accepted as is and no button",
      async () => {
        const { run, board } = await open(askOf("accept-snapshot-h8i9", [treeQuestion()]), [
          "plan",
        ]);
        await acceptOf(board).click({ timeout: STEP_TIMEOUT_MS });
        await board.header.getByText("Answered").waitFor({ timeout: STEP_TIMEOUT_MS });
        const taken = await run.session.snapshot();
        await run.session.exit();
        const html = await Bun.file(taken.path).text();
        const opening = `id="${SNAPSHOT_DATA_ELEMENT}">`;
        const start = html.indexOf(opening) + opening.length;
        const data = JSON.parse(
          html.slice(start, html.indexOf("</script>", start)),
        ) as SnapshotData;
        expect(validateSnapshotData(data).ok).toBe(true);
        expect(data.state.questions[0]).toMatchObject({ answer: { asSent: true } });

        const browser = await launchEngine(engine);
        try {
          const context = await browser.newContext({ offline: true });
          const page = await context.newPage();
          await page.goto(`file://${taken.path}`);
          const line = page.locator("[data-askboard-answer-line]");
          await line.first().waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(((await line.first().textContent()) ?? "").trim()).toBe("Answer: Accepted as is");
          expect(await page.locator("[data-askboard-accept-as-is]").count()).toBe(0);
        } finally {
          await browser.close();
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(i) revising an accepted answer: Edit, a Tree edit and Answer send the Tree's value and replace the accepted answer",
      async () => {
        const { run, board } = await open(askOf("accept-revise-i9j1", [treeQuestion(), cache()]), [
          "plan",
          "cache",
        ]);
        await acceptOf(board).click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await card(board, "plan")
          .locator('[data-askboard-edit="plan"]')
          .click({ timeout: STEP_TIMEOUT_MS });
        await renameNode(board, "ux", "UX design, revised");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, 2);
        await actsDone(run, 2);
        const [first, second] = await collectedAnswers(run);
        expect(first).toMatchObject({ asSent: true });
        expect(second).toMatchObject({ itemId: "plan", replaces: first?.cursor });
        expect(second).not.toHaveProperty("asSent");
        expect(JSON.stringify(second?.changes)).toContain("UX design, revised");
        const item = checkedFetchItem(await run.session.fetch("plan"));
        expect(item.answer).not.toHaveProperty("asSent");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
