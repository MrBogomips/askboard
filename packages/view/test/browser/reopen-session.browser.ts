// A reopened question starts from the user's last answer, on the real board page and the session
// process, in each engine (reopen-start-from-answer, task 3.1; Issue #70; view-and-widgets
// scenarios of "A reopened question starts from the previous answer", "A reopened question the
// agent changed starts from the agent's version", "An answer carried into the draft brings back
// widget values", "The prefill is remembered" and "Derived values of a reopened question's
// answer"):
//
// (a) the Issue's steps: a Timeline move, "Answer", a reopen, a reload; the moved entry shows with
//     its mark and the carried line, and a second move answers both;
// (b) "Answer" at once after a reopen sends the previous choice and Scale value;
// (c) a reopen and a lane rename in one update fill nothing, and "Start from my previous answer"
//     carries nothing onto the changed Timeline;
// (d) a Timeline and a Kanban reopened, then a card added to the Kanban: "Reload, losing my work"
//     and "Start from my previous answer" carry the Timeline alone, and the answer is accepted;
// (e) a prefill undone by hand is not filled again by a reload;
// (f) a Gantt reopened unchanged answers the derived values of the plan it shows;
// (g) a closed ask: nothing is filled after a reload and leaving the page asks nothing;
// (h) the board opened after the reopen, with no draft record held for the question (design
//     decision 9): filled, with the carried line, and the mark mirrored;
// (i) case (e)'s steps and an agent change before any reload: the change shows at once, with no
//     agent-change notice (the mark alone is no unsent work, design decision 4), and a reload
//     fills nothing, and the line says the question starts from the agent's version (S-1 of
//     re-review 4.5);
// (j) a Timeline and a Kanban reopened, the user's own move of the Timeline, then the agent's
//     change drops the Timeline: the agent-change notice shows with "Your 1 change", and the
//     move is still in the mirrored record, and the notice survives a reload (X-1 of re-review
//     4.5; the value itself after a reload is Issue #96).
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/reopen-session.browser.ts

import { describe, expect, test } from "bun:test";
import { ganttBoardDocument } from "@askboard/contract/fixtures";
import { WEEK_PX } from "./fixtures/gantt-documents.ts";
import { dragBy, grabPoint } from "./fixtures/gantt-input.ts";
import { ganttOf } from "./fixtures/gantt-view.ts";
import { kanbanItem } from "./fixtures/kanban-documents.ts";
import { database } from "./fixtures/lifecycle-asks.ts";
import { timelineAsk, timelineItem } from "./fixtures/timeline-documents.ts";
import { checkedEvents } from "./harness/approval-board.ts";
import {
  type BoardRun,
  eventually,
  expectNoCspProblem,
  LOAD_TIMEOUT_MS,
  QUIET_MS,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { beginDrag, cardOf, cardsIn, columnOf, dragOver, release } from "./harness/kanban-drag.ts";
import {
  actsDone,
  actsSent,
  answerOf,
  card,
  lifecycleScenario,
  mirrored,
  openBoard,
  optionOf,
  promptArmed,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import {
  dragEntry,
  entryOf,
  laneMiddle,
  PER_DAY,
  release as releaseEntry,
  zoomOf,
} from "./harness/timeline-drag.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const CARRIED = "Your previous answer is filled in. Change it or answer again.";
const NOT_CARRIED =
  'This question starts from the agent\'s version, not from your previous answer. "Start from my previous answer" brings back what still fits.';
const START = "Start from my previous answer";

type Event = Readonly<Record<string, unknown>>;
type Change = { readonly op: string; readonly target: string; readonly value?: unknown };

const reopenedNotice = (board: Board, id = "plan") =>
  card(board, id).locator('[data-askboard-notice="reopened"]');
const changeNotice = (board: Board) =>
  card(board, "plan").locator('[data-askboard-notice="agent-change"]');
const reopen = (run: BoardRun, id = "plan") =>
  run.session.update([{ action: "reopen", itemId: id }]);

// Waits for the reopened notice and its line, which says where the question started.
const lineShows = async (board: Board, line: string, id = "plan"): Promise<void> => {
  await reopenedNotice(board, id).waitFor({ timeout: STEP_TIMEOUT_MS });
  await reopenedNotice(board, id)
    .getByText(line, { exact: true })
    .waitFor({ timeout: STEP_TIMEOUT_MS });
};

const reloaded = (board: Board, run: BoardRun, id = "plan") =>
  reloadBoard(board, run, () =>
    board.view
      .locator(`[data-askboard-question="${id}"]:not([aria-busy="true"])`)
      .waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS }),
  );

// Presses "Answer", waits for board-host's done on every command the page sent, and returns the
// answer events `collect` then gives, each checked against the collect result's schema.
const answerAndCollect = async (
  run: BoardRun,
  board: Board,
  id = "plan",
): Promise<readonly Event[]> => {
  await eventually(() => answerOf(board, id).isEnabled(), "Answer to be enabled");
  const before = sentActs(run).length;
  await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
  await actsSent(run, before + 1);
  await actsDone(run, before + 1);
  return checkedEvents(await run.session.collectJson()).filter((event) => event.type === "answer");
};

const targetsOf = (event: Event | undefined): readonly string[] =>
  ((event?.changes ?? []) as readonly Change[]).map(({ target }) => target).sort();

const CHECKOUT_MOVED = ["roadmap.checkout.end", "roadmap.checkout.lane", "roadmap.checkout.start"];

// Moves the Timeline's `checkout` a week later and into `mobile`, or back to where the agent put it.
const moveCheckout = async (board: Board, lane: "mobile" | "web"): Promise<void> => {
  const zoom = await zoomOf(board);
  const sign = lane === "mobile" ? 1 : -1;
  await dragEntry(board, "checkout", {
    dx: sign * 7 * PER_DAY[zoom],
    y: await laneMiddle(board, lane),
  });
  await releaseEntry(board);
  await eventually(
    async () => (await entryOf(board, "checkout").getAttribute("data-lane")) === lane,
    `checkout to show in ${lane}`,
  );
};
const moveLaunch = async (board: Board): Promise<void> => {
  const zoom = await zoomOf(board);
  await dragEntry(board, "launch", { dx: 7 * PER_DAY[zoom] });
  await releaseEntry(board);
  await eventually(
    async () => (await entryOf(board, "launch").getAttribute("data-date")) === "2026-02-09",
    "launch a week later",
  );
};

// The Timeline as the card shows it: the lane and the mark of `checkout`.
const checkoutShown = async (board: Board) => ({
  lane: await entryOf(board, "checkout").getAttribute("data-lane"),
  start: await entryOf(board, "checkout").getAttribute("data-start"),
  change: await entryOf(board, "checkout").getAttribute("data-change"),
});
const AS_SENT = { lane: "web", start: "2026-01-05", change: null };
const MOVED = { lane: "mobile", start: "2026-01-12", change: "moved" };

// The question `plan` with a Timeline and a Kanban, as the agent sends them.
const twoWidgetsAsk = {
  askId: "two-widgets-r4q7",
  title: "Two widgets",
  items: [
    {
      type: "question",
      id: "plan",
      props: { text: "Plan the quarter", items: [timelineItem(), kanbanItem()] },
    },
  ],
} as const;

// The Kanban with a card the agent adds after the reopen.
const kanbanWithD = () => ({
  ...kanbanItem().props,
  cards: [...kanbanItem().props.cards, { id: "d", label: "Review", column: "todo" }],
});

// The database question with a Scale beside its options.
const choiceAndScaleAsk = {
  askId: "choice-and-scale-s3c4",
  title: "Choice and Scale",
  items: [
    {
      type: "question",
      id: "plan",
      props: {
        ...database().props,
        items: [{ type: "scale", id: "share", props: { min: 0, max: 100, step: 5 } }],
      },
    },
  ],
} as const;
const share = (board: Board) => board.view.locator("[data-scale-value]");

// The fixture Gantt alone, as the agent sends it.
const [{ rev: _rev, ...scheduleQuestion }] = ganttBoardDocument.items;
const GANTT_QUESTION = scheduleQuestion.id;
const ganttAsk = {
  askId: "release-schedule-g5h6",
  title: "Release schedule",
  items: [scheduleQuestion],
} as const;

/** Past the board page's 300 ms draft mirror debounce. */
const MIRROR_SETTLE_MS = 600;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a reopened question starts from the previous answer, on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "(a) the Issue's steps: a Timeline move answered, the question reopened and the tab reloaded shows the move with its mark and the line, and a second move answers both at the new revision",
      async () => {
        const run = await start(lifecycleScenario(timelineAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await moveCheckout(board, "mobile");
        const [first] = await answerAndCollect(run, board);
        expect(first).toMatchObject({ rev: 1 });
        expect(targetsOf(first)).toEqual(CHECKOUT_MOVED);

        await reopen(run);
        await reloaded(board, run);
        await lineShows(board, CARRIED);
        await eventually(
          async () => Bun.deepEquals(await checkoutShown(board), MOVED, true),
          "the moved entry with its mark",
        );
        expect(await entryOf(board, "launch").getAttribute("data-change")).toBeNull();

        await moveLaunch(board);
        const [second] = await answerAndCollect(run, board);
        expect(second).toMatchObject({ rev: 2 });
        expect(targetsOf(second)).toEqual([...CHECKOUT_MOVED, "roadmap.launch.date"]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(b) Answer at once after the reopen sends the previous choice and Scale value",
      async () => {
        const run = await start(lifecycleScenario(choiceAndScaleAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await optionOf(board, "plan", "SQLite").click({ timeout: STEP_TIMEOUT_MS });
        await board.view.locator("[data-scale-unset]").focus();
        await board.page.keyboard.press("End");
        await eventually(async () => (await share(board).textContent()) === "100", "the maximum");
        const [first] = await answerAndCollect(run, board);
        expect(first).toMatchObject({
          rev: 1,
          choice: ["SQLite"],
          results: { share: { value: 100 } },
        });

        await reopen(run);
        await lineShows(board, CARRIED);
        await eventually(async () => (await share(board).textContent()) === "100", "100 again");
        expect(await optionOf(board, "plan", "SQLite").getAttribute("aria-checked")).toBe("true");
        const [second] = await answerAndCollect(run, board);
        expect(second).toMatchObject({
          rev: 2,
          choice: ["SQLite"],
          results: { share: { value: 100 } },
        });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(c) a reopen and a lane rename in one update fill nothing: the agent's Timeline and the other line, and Start from my previous answer carries nothing onto it",
      async () => {
        const run = await start(lifecycleScenario(timelineAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await moveCheckout(board, "mobile");
        await answerAndCollect(run, board);
        // Past the mirror's debounce, so the user's own move is already in the records.
        await Bun.sleep(MIRROR_SETTLE_MS);
        const draftsBefore = sentDrafts(run).length;

        await run.session.update([
          { action: "reopen", itemId: "plan" },
          {
            action: "change",
            itemId: "roadmap",
            props: {
              ...timelineItem().props,
              lanes: [{ id: "web", label: "Website" }, timelineItem().props.lanes[1]],
            },
          },
        ]);
        await lineShows(board, NOT_CARRIED);
        await eventually(
          async () =>
            (
              (await board.view
                .locator('[data-timeline-lane-label="web"]')
                .first()
                .textContent()) ?? ""
            ).includes("Website"),
          "the lane's new label",
        );
        // Nothing fills it late: the question stays as the agent sent it.
        await Bun.sleep(QUIET_MS);
        expect(await checkoutShown(board)).toEqual(AS_SENT);
        expect(
          sentDrafts(run)
            .slice(draftsBefore)
            .every((record) => record.questions.plan?.prefilled !== true),
        ).toBe(true);

        await reopenedNotice(board).getByRole("button", { name: START }).click();
        await Bun.sleep(QUIET_MS / 3);
        expect(await checkoutShown(board)).toEqual(AS_SENT);
        expect(await entryOf(board, "launch").getAttribute("data-change")).toBeNull();
        await Bun.sleep(MIRROR_SETTLE_MS);
        expect(
          sentDrafts(run)
            .slice(draftsBefore)
            .every((record) => record.questions.plan?.values?.roadmap === undefined),
        ).toBe(true);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(d) a Timeline and a Kanban reopened, then a card added to the Kanban: the agent-change notice shows, Reload losing my work and Start from my previous answer carry the Timeline alone, and Answer is accepted with the Timeline's move only",
      async () => {
        const run = await start(lifecycleScenario(twoWidgetsAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await moveCheckout(board, "mobile");
        await beginDrag(board, cardOf(board, "a"));
        await dragOver(board, columnOf(board, "doing"));
        await release(board);
        await eventually(async () => (await cardsIn(board, "doing")).join() === "a", "a in doing");
        const [first] = await answerAndCollect(run, board);
        expect(targetsOf(first)).toEqual(["board.a.column", ...CHECKOUT_MOVED]);

        await reopen(run);
        await lineShows(board, CARRIED);
        await eventually(
          async () =>
            (await checkoutShown(board)).change === "moved" &&
            (await cardsIn(board, "doing")).join() === "a",
          "both widgets prefilled",
        );
        await run.session.update([{ action: "change", itemId: "board", props: kanbanWithD() }]);
        await changeNotice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await changeNotice(board)
          .getByRole("button", { name: "Reload, losing my work", exact: true })
          .click();
        await changeNotice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await lineShows(board, NOT_CARRIED);
        await eventually(
          async () =>
            (await checkoutShown(board)).change === null &&
            (await cardsIn(board, "todo")).join() === "a,c,d",
          "the agent's version of both widgets",
        );

        await reopenedNotice(board).getByRole("button", { name: START }).click();
        await eventually(
          async () => Bun.deepEquals(await checkoutShown(board), MOVED, true),
          "the Timeline's previous move",
        );
        // The Kanban the agent changed shows the agent's revision, not the earlier move.
        expect(await cardsIn(board, "todo")).toEqual(["a", "c", "d"]);
        expect(await cardsIn(board, "doing")).toEqual([]);
        const [second] = await answerAndCollect(run, board);
        expect(second).toMatchObject({ rev: 3 });
        expect(targetsOf(second)).toEqual(CHECKOUT_MOVED);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(e) a prefill undone by hand is not filled again by a reload",
      async () => {
        const run = await start(lifecycleScenario(timelineAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await moveCheckout(board, "mobile");
        await answerAndCollect(run, board);

        await reopen(run);
        await lineShows(board, CARRIED);
        await eventually(
          async () => Bun.deepEquals(await checkoutShown(board), MOVED, true),
          "the prefilled move",
        );
        await moveCheckout(board, "web");
        await eventually(
          async () => Bun.deepEquals(await checkoutShown(board), AS_SENT, true),
          "the move undone",
        );
        // The mirror holds the mark and no Timeline value: the question is as the agent sent it.
        await eventually(() => {
          const work = sentDrafts(run).at(-1)?.questions.plan;
          return work?.prefilled === true && work.values?.roadmap === undefined;
        }, "the mark mirrored with no Timeline value");

        await reloaded(board, run);
        await reopenedNotice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await Bun.sleep(QUIET_MS);
        expect(await checkoutShown(board)).toEqual(AS_SENT);
        expect(await entryOf(board, "launch").getAttribute("data-change")).toBeNull();
        expect(await promptArmed(board)).toBe(false);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(f) a Gantt reopened unchanged answers the derived values of the plan it shows",
      async () => {
        const run = await start(lifecycleScenario(ganttAsk, dist));
        const board = await openBoard(run, [GANTT_QUESTION]);
        const gantt = ganttOf(board);
        await dragBy(board, await grabPoint(gantt, "reporting"), 5 * WEEK_PX);
        await eventually(
          async () => (await gantt.bar("reporting").getAttribute("data-start")) === "2026-12-09",
          "the reporting bar five days later",
        );
        const [first] = await answerAndCollect(run, board, GANTT_QUESTION);
        const moved = first?.derived as Record<string, unknown>;
        expect(moved["release.finish"]).toBe("2026-12-16");

        await reopen(run, GANTT_QUESTION);
        await lineShows(board, CARRIED, GANTT_QUESTION);
        await eventually(
          async () => (await gantt.bar("reporting").getAttribute("data-start")) === "2026-12-09",
          "the prefilled plan",
        );
        const [second] = await answerAndCollect(run, board, GANTT_QUESTION);
        expect(second).toMatchObject({ rev: 2 });
        expect(second?.derived).toEqual(moved);
        // The Gantt's own edit travels as `changes` (an answer event has no `values`).
        expect(((first?.changes ?? []) as readonly unknown[]).length).toBeGreaterThan(0);
        expect(second?.changes).toEqual(first?.changes);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(h) the board opened after the reopen, with no draft record held for the question: filled once, with the carried line and the mark mirrored",
      async () => {
        const run = await start(lifecycleScenario(timelineAsk, dist));
        const first = await openBoard(run, ["plan"]);
        await moveCheckout(first, "mobile");
        await answerAndCollect(run, first);
        await eventually(
          async () => (await promptArmed(first)) === false,
          "no unsent work after the answer",
        );
        // The tab goes, and the agent reopens with no board open: the next tab is the first to see it.
        await first.page.close();
        await reopen(run);
        const draftsBefore = sentDrafts(run).length;

        const board = await openBoard(run, ["plan"]);
        await lineShows(board, CARRIED);
        await eventually(
          async () => Bun.deepEquals(await checkoutShown(board), MOVED, true),
          "the moved entry with its mark",
        );
        await mirrored(
          run,
          (record) => record.questions.plan?.prefilled === true,
          "the mark of the prefill",
        );
        expect(sentDrafts(run).length).toBeGreaterThan(draftsBefore);
        const [second] = await answerAndCollect(run, board);
        expect(second).toMatchObject({ rev: 2 });
        expect(targetsOf(second)).toEqual(CHECKOUT_MOVED);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(i) a prefill undone by hand, then the agent renames a lane before any reload: the change shows at once with no agent-change notice, and a reload fills nothing",
      async () => {
        const run = await start(lifecycleScenario(timelineAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await moveCheckout(board, "mobile");
        await answerAndCollect(run, board);

        await reopen(run);
        await lineShows(board, CARRIED);
        await eventually(
          async () => Bun.deepEquals(await checkoutShown(board), MOVED, true),
          "the prefilled move",
        );
        await moveCheckout(board, "web");
        await eventually(
          async () => Bun.deepEquals(await checkoutShown(board), AS_SENT, true),
          "the move undone",
        );
        await eventually(() => {
          const work = sentDrafts(run).at(-1)?.questions.plan;
          return work?.prefilled === true && work.values?.roadmap === undefined;
        }, "the mark mirrored with no Timeline value");

        await run.session.update([
          {
            action: "change",
            itemId: "roadmap",
            props: {
              ...timelineItem().props,
              lanes: [{ id: "web", label: "Website" }, timelineItem().props.lanes[1]],
            },
          },
        ]);
        await eventually(
          async () =>
            (
              (await board.view
                .locator('[data-timeline-lane-label="web"]')
                .first()
                .textContent()) ?? ""
            ).includes("Website"),
          "the lane's new label, at once",
        );
        expect(await changeNotice(board).count()).toBe(0);
        expect(
          await card(board, "plan")
            .getByText(/Your \d+ changes? on this question/)
            .count(),
        ).toBe(0);
        expect(await promptArmed(board)).toBe(false);
        // The agent changed the question: the line no longer says the answer is filled in.
        await lineShows(board, NOT_CARRIED);

        await reloaded(board, run);
        await reopenedNotice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await Bun.sleep(QUIET_MS);
        await lineShows(board, NOT_CARRIED);
        expect(await changeNotice(board).count()).toBe(0);
        expect(await checkoutShown(board)).toEqual(AS_SENT);
        expect(await promptArmed(board)).toBe(false);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(j) a Timeline and a Kanban reopened, the user's own move of the Timeline, then the agent drops the Timeline: the agent-change notice shows with Your 1 change and Keep mine, the move is still mirrored, and the notice survives a reload",
      async () => {
        const run = await start(lifecycleScenario(twoWidgetsAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await moveCheckout(board, "mobile");
        await answerAndCollect(run, board);

        await reopen(run);
        await lineShows(board, CARRIED);
        await eventually(
          async () => Bun.deepEquals(await checkoutShown(board), MOVED, true),
          "the prefilled move",
        );
        await moveLaunch(board);
        await mirrored(
          run,
          (record) =>
            record.questions.plan?.prefilled === true &&
            record.questions.plan.values?.roadmap !== undefined,
          "the Timeline's value and the mark",
        );

        await run.session.update([
          { action: "change", itemId: "plan", props: { items: [kanbanItem()] } },
        ]);
        await changeNotice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await changeNotice(board).getByText("Your 1 change on this question").waitFor();
        await changeNotice(board)
          .getByRole("button", { name: "Keep mine", exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        // The card still shows what the user made it on: the Timeline with its moves.
        expect(await entryOf(board, "launch").getAttribute("data-date")).toBe("2026-02-09");
        await Bun.sleep(MIRROR_SETTLE_MS);
        const last = sentDrafts(run).at(-1)?.questions.plan;
        expect(last?.rev).toBe(2);
        expect(last?.values?.roadmap).toBeDefined();

        await reloaded(board, run);
        await changeNotice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await changeNotice(board)
          .getByRole("button", { name: "Keep mine", exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        // The value itself cannot come back on a Timeline-less revision after a reload (Issue #96);
        // the work and its notice are still there for the user to choose.
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(g) a closed ask: the agent reopens an answered question and closes the ask before a draft is mirrored; a reload fills nothing and leaving the page asks nothing",
      async () => {
        const run = await start(lifecycleScenario(timelineAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await moveCheckout(board, "mobile");
        await answerAndCollect(run, board);
        await eventually(
          async () => (await promptArmed(board)) === false,
          "no unsent work after the answer",
        );
        const mirroredBefore = sentDrafts(run).length;

        await run.session.update([{ action: "reopen", itemId: "plan" }, { action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await reloaded(board, run);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await Bun.sleep(QUIET_MS);
        expect(await checkoutShown(board)).toEqual(AS_SENT);
        expect(await promptArmed(board)).toBe(false);
        // No record held work after the reopen: nothing was mirrored for the question.
        expect(
          sentDrafts(run)
            .slice(mirroredBefore)
            .every((record) => record.questions.plan === undefined),
        ).toBe(true);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
