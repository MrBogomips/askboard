// The Gantt on the ask lifecycle's boards, in each engine, on the widget host (gantt-widget design
// decisions 7 and 10; ask-lifecycle, design decision 6; cross-review H1): the board a Gantt reads
// follows the shell's document, every question's widget items, areas' included. An agent update
// that puts the fixture's question in an area and adds a question holding a second Gantt in
// another gives that Gantt the new board's items: it computes the schedule compute's UJ-2 plan
// gives, and its question counts as visible, with no item error.

import { describe, expect, test } from "bun:test";
import { ganttBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument, ViewQuestion } from "../../src/view-document.ts";
import { release, schedule, UJ2 } from "./fixtures/gantt-documents.ts";
import { barDates, ganttOf } from "./fixtures/gantt-view.ts";
import { eventually, LOAD_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openerFor } from "./harness/gantt-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

/** Each task's bar as compute's UJ-2 plan schedules it, `start..finish`. */
const UJ2_DATES = Object.fromEntries(
  UJ2.map(([task, start, finish]) => [task, `${start}..${finish}`]),
);

// The question the agent adds: a second Gantt, its tasks the fixture's.
const LATER = "later";
const followOn: ViewQuestion = {
  type: "question",
  id: "follow-on",
  rev: 1,
  props: { text: "Does the follow-on schedule hold?", items: [{ ...release, id: LATER }] },
};

// The board after the agent's update: the fixture's question and the added one, each in an area.
const updated: ViewDocument = {
  ...ganttBoardDocument,
  items: [
    { type: "area", id: "release-area", props: { title: "Release", items: [schedule] } },
    { type: "area", id: "follow-on-area", props: { title: "Follow-on", items: [followOn] } },
  ],
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt on the ask lifecycle's boards`, () => {
    const { host } = useWidgetHost(engine);
    const opened = openerFor(host, dist);

    test(
      "an agent update adding a Gantt in an area gives it the new board's items: it computes, and its question counts as visible",
      async () => {
        const run = await opened();
        expect(await barDates(ganttOf(run.board))).toEqual(UJ2_DATES);
        await run.update({ type: "state", state: openStateOf(updated), document: updated });
        await eventually(
          () =>
            run.messages.some(
              (message) =>
                message.type === "item-error" ||
                (message.type === "ready" && message.itemId === followOn.id),
            ),
          "the added question's ready or item-error message",
          LOAD_TIMEOUT_MS,
        );
        expect(run.messages.filter((message) => message.type === "item-error")).toEqual([]);
        expect(await run.board.question(followOn.id).getByRole("alert").count()).toBe(0);
        expect(await barDates(ganttOf(run.board, LATER))).toEqual(UJ2_DATES);
        expect(await barDates(ganttOf(run.board))).toEqual(UJ2_DATES);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
