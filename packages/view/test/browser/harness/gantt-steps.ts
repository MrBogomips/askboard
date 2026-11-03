// What the Gantt's browser scenarios share (gantt-widget design decisions 9 and 12): the step that
// opens a widget host on a Gantt and waits for its question's ready message, and what a read-only
// Gantt takes, as `fixtures/gantt-view.ts` and `fixtures/gantt-input.ts` find and drive its parts.

import { expect } from "bun:test";
import { ganttBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";
import { WEEK_PX } from "../fixtures/gantt-documents.ts";
import { dragBy, grabPoint, keysTo } from "../fixtures/gantt-input.ts";
import { barFacts, ganttOf, rowTexts } from "../fixtures/gantt-view.ts";
import { eventually, LOAD_TIMEOUT_MS } from "./board-test.ts";
import type { ViewBuild } from "./view-build.ts";
import type { WidgetHostRun } from "./widget-host-test.ts";

/** A widget host for the document with the view from `build`, as `useWidgetHost` gives it. */
type Host = (build: ViewBuild, document: ViewDocument) => Promise<WidgetHostRun>;

/**
 * The scenarios' `opened`: a widget host for the document, the fixture Gantt's unless another is
 * given, with the view from `build`, once its question has reported ready.
 */
export const openerFor =
  (host: Host, build: ViewBuild) =>
  async (document: ViewDocument = ganttBoardDocument): Promise<WidgetHostRun> => {
    const run = await host(build, document);
    await eventually(
      () => run.messages.some((message) => message.type === "ready"),
      "the question's ready message",
      LOAD_TIMEOUT_MS,
    );
    return run;
  };

/** What a read-only Gantt takes: its keys move the focus, and nothing edits it. */
export const expectReadOnly = async (run: WidgetHostRun) => {
  const gantt = ganttOf(run.board);
  const before = { rows: await rowTexts(gantt), bars: await barFacts(gantt) };
  expect(await gantt.root.locator("[data-gantt-handle]").count()).toBe(0);
  await dragBy(run.board, await grabPoint(gantt, "portal"), 3 * WEEK_PX);
  await dragBy(run.board, await grabPoint(gantt, "ux"), 2 * WEEK_PX);
  await keysTo(run.board, "reporting", "start");
  for (const key of ["Enter", "F2", "Delete", "Backspace"]) {
    await run.board.page.keyboard.press(key);
    expect(await gantt.grid.locator("input").count()).toBe(0);
  }
  await keysTo(run.board, "billing", "duration");
  await run.board.page.keyboard.press("Enter");
  await keysTo(run.board, "billing", "dependencies");
  await run.board.page.keyboard.press("Enter");
  expect(await gantt.root.locator("[data-gantt-panel]").count()).toBe(0);
  expect(await gantt.grid.locator("input").count()).toBe(0);
  expect({ rows: await rowTexts(gantt), bars: await barFacts(gantt) }).toEqual(before);
  expect(run.browser.cspProblems()).toEqual([]);
};
