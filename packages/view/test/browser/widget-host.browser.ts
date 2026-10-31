// The widget host's own scenarios, in each engine (design decision 9 of the tree-widget change),
// on the plain Choice board document: the question counts as visible with no CSP violation, an
// answer reaches the test and is answered as sent, a later update from the test reaches the view
// as the board page's would, the view takes a dark system's theme, and a caught `eval` in the host
// page and in the view is reported, the negative controls that make "no violation" mean something
// (renderer row 17). The widgets' own scenarios run on the same host.

import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import {
  enabledCount,
  eventually,
  LOAD_TIMEOUT_MS,
  QUESTION,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openStateOf, readViewBuild, withViewProbe } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const reportsEval = (problems: readonly string[]): boolean =>
  problems.some((problem) => /eval/i.test(problem));

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the widget host`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "hosts the plain Choice question: visible, its ready message recorded, with no CSP violation",
      async () => {
        const run = await host(dist, plainChoiceBoardDocument);
        await run.board.loaded(QUESTION).waitFor({ state: "visible", timeout: LOAD_TIMEOUT_MS });
        await eventually(
          () => run.messages.length > 0,
          "the question's ready message",
          LOAD_TIMEOUT_MS,
        );
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: QUESTION }]);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "passes an answer on to the test and answers it as sent",
      async () => {
        const run = await host(dist, plainChoiceBoardDocument);
        await run.board.loaded(QUESTION).waitFor({ state: "visible", timeout: LOAD_TIMEOUT_MS });
        await run.board.option("SQLite").click({ timeout: STEP_TIMEOUT_MS });
        await run.board.answer.click({ timeout: STEP_TIMEOUT_MS });
        await run.board.receipt("sent").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        const answers = run.messages.filter((message) => message.type === "answer");
        expect(answers).toEqual([
          {
            type: "answer",
            itemId: QUESTION,
            rev: 1,
            choice: ["SQLite"],
            when: expect.stringMatching(/Z$/),
          },
        ]);
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "passes a later update on to the view: a lock makes the question read-only, and its end answerable again",
      async () => {
        const run = await host(dist, plainChoiceBoardDocument);
        await run.board.loaded(QUESTION).waitFor({ state: "visible", timeout: LOAD_TIMEOUT_MS });
        await run.board.option("SQLite").click({ timeout: STEP_TIMEOUT_MS });
        expect(await run.board.answer.isEnabled()).toBe(true);
        const state = openStateOf(plainChoiceBoardDocument);
        await run.update({ type: "state", state, lock: "moved" });
        await eventually(
          async () => (await enabledCount(run.board.options)) === 0,
          "the locked question's options to turn read-only",
        );
        expect(await run.board.answer.isDisabled()).toBe(true);
        await run.update({ type: "state", state });
        await eventually(
          async () => (await enabledCount(run.board.options)) > 0,
          "the question to be answerable again",
        );
        expect(await run.board.option("SQLite").isChecked()).toBe(true);
        expect(await run.board.answer.isEnabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: QUESTION }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "opens the view in a dark system's theme when asked to",
      async () => {
        const run = await host(dist, plainChoiceBoardDocument, { colorScheme: "dark" });
        await run.board.loaded(QUESTION).waitFor({ state: "visible", timeout: LOAD_TIMEOUT_MS });
        const view = await run.board.viewFrame();
        expect(await view.evaluate(() => document.querySelector(".dark") !== null)).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "catches a caught eval in the host page",
      async () => {
        const run = await host(dist, plainChoiceBoardDocument, { probe: true });
        await eventually(
          () => reportsEval(run.browser.cspProblems()),
          "the host page's eval to be reported",
          LOAD_TIMEOUT_MS,
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "catches a caught eval in the view it hosts",
      async () => {
        const run = await host(withViewProbe(dist), plainChoiceBoardDocument);
        await eventually(
          () => reportsEval(run.browser.cspProblems()),
          "the view's eval to be reported",
          LOAD_TIMEOUT_MS,
        );
      },
      TEST_TIMEOUT_MS,
    );
  });
}
