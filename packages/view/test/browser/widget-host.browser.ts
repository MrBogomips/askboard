// The widget host's own scenarios, in each engine (design decision 9 of the tree-widget change),
// on the plain Choice board document: the question counts as visible with no CSP violation, an
// answer reaches the test and is answered as sent, and a caught `eval` in the host page and in the
// view is reported, the negative controls that make "no violation" mean something (renderer
// row 17). The widgets' own scenarios run on the same host.

import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import {
  eventually,
  LOAD_TIMEOUT_MS,
  QUESTION,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readViewBuild, withViewProbe } from "./harness/view-build.ts";
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
