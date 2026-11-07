// An answer sends what its widgets show, on the real board page and the session process, in each
// engine (latex-kanban-timeline, task 5b.2; view spec: An answer sends what its widgets show;
// security review X-2): the user moves a card or an entry and does not answer; the agent changes
// the widget (relabels an element, or moves one itself); "Keep mine" and "Answer" follow, with a
// reload of the tab between the change and the choice or without one. What the answer sends is
// exactly what the widget showed as moved: with no reload the user's move, after a reload nothing,
// since the page then shows a revision the work was not made on and holds no base to count the
// agent's own changes against.

import { describe, expect, test } from "bun:test";
import { kanbanAsk, kanbanItem } from "./fixtures/kanban-documents.ts";
import { timelineAsk, timelineItem } from "./fixtures/timeline-documents.ts";
import {
  eventually,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { beginDrag, cardOf, columnOf, dragOver, release } from "./harness/kanban-drag.ts";
import {
  actsDone,
  answerOf,
  card,
  lifecycleScenario,
  openBoard,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import {
  dragEntry,
  laneMiddle,
  PER_DAY,
  release as releaseEntry,
  zoomOf,
} from "./harness/timeline-drag.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const notice = (board: Board) =>
  card(board, "plan").locator('[data-askboard-notice="agent-change"]');

type Widget = {
  readonly name: string;
  readonly ask: { readonly askId: string } & Readonly<Record<string, unknown>>;
  readonly itemId: string;
  /** The user's move: one element is moved and the move is left unsent. */
  readonly move: (board: Board) => Promise<void>;
  /** The IDs of the elements the widget marks as moved. */
  readonly shown: (board: Board) => Promise<readonly string[]>;
  /** The moved element's ID in a change's target, `<item>.<element>.<field>`. */
  readonly movedId: string;
  /** The agent's changes: one that relabels an element, one that moves another element itself. */
  readonly relabel: unknown;
  readonly agentMoves: unknown;
};

const marked = (board: Board, selector: string, attribute: string): Promise<string[]> =>
  board.view
    .locator(selector)
    .evaluateAll(
      (elements, name) => elements.map((element) => element.getAttribute(name) ?? ""),
      attribute,
    );

const kanbanProps = kanbanItem().props;
const timelineProps = timelineItem().props;

const WIDGETS: readonly Widget[] = [
  {
    name: "the Kanban",
    ask: kanbanAsk,
    itemId: "board",
    movedId: "a",
    move: async (board) => {
      await beginDrag(board, cardOf(board, "a"));
      await dragOver(board, columnOf(board, "doing"));
      await release(board);
    },
    shown: (board) => marked(board, '[data-kanban-card][data-change="moved"]', "data-kanban-card"),
    relabel: {
      ...kanbanProps,
      cards: kanbanProps.cards.map((each) =>
        each.id === "c" ? { ...each, label: "Write more tests" } : each,
      ),
    },
    agentMoves: {
      ...kanbanProps,
      cards: kanbanProps.cards.map((each) =>
        each.id === "b" ? { ...each, column: "doing" } : each,
      ),
    },
  },
  {
    name: "the Timeline",
    ask: timelineAsk,
    itemId: "roadmap",
    movedId: "checkout",
    move: async (board) => {
      await dragEntry(board, "checkout", {
        dx: 7 * PER_DAY[await zoomOf(board)],
        y: await laneMiddle(board, "mobile"),
      });
      await releaseEntry(board);
    },
    shown: (board) =>
      marked(board, '[data-timeline-entry][data-change="moved"]', "data-timeline-entry"),
    relabel: {
      ...timelineProps,
      entries: timelineProps.entries.map((each) =>
        each.id === "launch" ? { ...each, label: "Go live" } : each,
      ),
    },
    agentMoves: {
      ...timelineProps,
      entries: timelineProps.entries.map((each) =>
        each.id === "launch" ? { ...each, date: "2026-02-09" } : each,
      ),
    },
  },
];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  for (const widget of WIDGETS) {
    describe(`${engine}: an answer sends what ${widget.name} shows`, () => {
      const { start } = useEngine(engine);

      for (const [change, props] of [
        ["relabels an element", widget.relabel],
        ["moves another element itself", widget.agentMoves],
      ] as const) {
        for (const reload of [false, true]) {
          test(
            `the agent ${change}, ${reload ? "the tab reloads, " : ""}Keep mine, Answer: what is sent is what is shown`,
            async () => {
              const run = await start(lifecycleScenario(widget.ask, dist));
              const board = await openBoard(run, ["plan"]);
              await widget.move(board);
              await eventually(
                () =>
                  sentDrafts(run).some(
                    (record) => record.questions.plan?.values?.[widget.itemId] !== undefined,
                  ),
                "the draft to hold the move",
              );
              await run.session.update([{ action: "change", itemId: widget.itemId, props }]);
              if (reload) {
                await reloadBoard(board, run, () =>
                  board.view
                    .locator('[data-askboard-question="plan"]:not([aria-busy="true"])')
                    .waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS }),
                );
              }
              await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
              await notice(board).getByRole("button", { name: "Keep mine" }).click();
              await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
              // The widget shows the user's move with no reload and none after one.
              const expected = reload ? [] : [widget.movedId];
              await eventually(
                async () => Bun.deepEquals(await widget.shown(board), expected, true),
                `the widget to mark ${JSON.stringify(expected)} as moved`,
              );
              const shown = await widget.shown(board);
              let sent: string[] = [];
              if (await answerOf(board, "plan").isEnabled()) {
                const acts = sentActs(run).length;
                await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
                await actsDone(run, acts + 1);
                const { events } = await run.session.collect();
                const answered = events.find((event) => event.type === "answer");
                const changes = (answered?.changes ?? []) as readonly { target: string }[];
                sent = [...new Set(changes.map((each) => each.target.split(".")[1] ?? ""))];
              }
              expect(sent).toEqual([...shown]);
            },
            TEST_TIMEOUT_MS * 2,
          );
        }
      }
    });
  }
}
