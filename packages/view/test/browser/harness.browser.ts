// The harness's own checks, in each engine: the test server's board page loads under its policy,
// and the violation collector catches a caught `eval` on the board page and in the view, the
// negative controls that make "no violation" mean something (renderer row 17).

import { describe, expect, test } from "bun:test";
import { boardPagePolicy } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import {
  eventually,
  expectNoCspProblem,
  LOAD_TIMEOUT_MS,
  linkToken,
  QUIET_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { policyDirectives } from "./harness/policy.ts";
import { replayTranscripts } from "./harness/transcripts.ts";
import {
  assembledSrcdoc,
  readViewBuild,
  withBoardPageProbe,
  withViewProbe,
} from "./harness/view-build.ts";

const dist = await readViewBuild();
const { opening } = replayTranscripts;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the harness`, () => {
    const { start } = useEngine(engine);

    test(
      "serves the board page under the manifest's policy; it loads with no violation and sends its token first",
      async () => {
        const run = await start({ transcript: opening, view: dist });
        const response = await fetch(run.session.link);
        // The same directives and sources as the rule computes, in whatever order they come.
        const served = response.headers.get("Content-Security-Policy") ?? "";
        expect(policyDirectives(served)).toEqual(policyDirectives(boardPagePolicy(dist.manifest)));
        await run.openTab();
        await eventually(
          () => run.browser.pageMessages().length > 0,
          "the board page's first message",
          LOAD_TIMEOUT_MS,
        );
        await Bun.sleep(QUIET_MS);
        expect(run.browser.pageMessages()[0]).toEqual({
          socket: 1,
          message: { version: "1.0", type: "connect", token: linkToken(run) },
        });
        expect(run.browser.errors).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "catches a caught eval on the board page",
      async () => {
        const run = await start({ transcript: opening, view: withBoardPageProbe(dist) });
        await run.openTab();
        await eventually(
          () => run.browser.cspProblems().some((problem) => /eval/i.test(problem)),
          "the board page's eval to be reported",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "catches a caught eval in the view the board page builds",
      async () => {
        const run = await start({ transcript: opening, view: withViewProbe(dist) });
        await run.openTab();
        await eventually(
          () => run.browser.cspProblems().some((problem) => /eval/i.test(problem)),
          "the view's eval to be reported",
          LOAD_TIMEOUT_MS,
        );
      },
      TEST_TIMEOUT_MS,
    );

    // The same control without the board page's part: the harness sets the frame's srcdoc itself,
    // under the board page's policy, so the collector's reach into the view is known before 8.6.
    test(
      "catches a caught eval in a view the harness assembles into the board page's frame",
      async () => {
        const probed = withViewProbe(dist);
        const run = await start({ transcript: opening, view: probed });
        const board = await run.openTab();
        await board.frame.waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS });
        const srcdoc = assembledSrcdoc(probed, plainChoiceBoardDocument);
        await board.frame.evaluate((frame, text) => frame.setAttribute("srcdoc", text), srcdoc);
        await eventually(
          () => run.browser.cspProblems().some((problem) => /eval/i.test(problem)),
          "the view's eval to be reported",
          LOAD_TIMEOUT_MS,
        );
      },
      TEST_TIMEOUT_MS,
    );
  });
}
