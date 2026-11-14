// The round-trip probes of `harness/probes.ts` (e2e-cadence, decision 7), checked in each engine
// with an action that does send: the probe returns, and what the action sent is there at once, with
// no wait of its own. A probe that returned early would leave the read empty. The probes replace
// the fixed quiet wait in the other browser files; the mutation check of task 4.6 shows that those
// files fail on a fault.

import { describe, expect, test } from "bun:test";
import { submittedAsk } from "./fixtures/lifecycle-asks.ts";
import {
  answerWith,
  RECONNECT_TIMEOUT_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  lifecycleScenario,
  noteOf,
  openBoard,
  promptArmed,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import {
  draftSettled,
  hostSettled,
  noReconnectWaitMs,
  timerSettled,
  viewSettled,
} from "./harness/probes.ts";
import { replayTranscripts } from "./harness/transcripts.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const QUESTIONS = ["database", "cache", "audit"];
const NOTE = "Only for the catalogue.";

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the round-trip probes`, () => {
    const { start } = useEngine(engine);

    test(
      "viewSettled: a note typed in the view has reached the board page, which arms its leave-page prompt, when it returns",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, QUESTIONS);
        expect(await promptArmed(board)).toBe(false);
        await noteOf(board, "cache").fill(NOTE);
        await viewSettled(board);
        expect(await promptArmed(board)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "hostSettled: an answer the board page sent is in the recorded sockets when it returns",
      async () => {
        const run = await start({ transcript: replayTranscripts.plainChoice, view: dist });
        const board = await run.open();
        await answerWith(board, "PostgreSQL");
        await hostSettled(board);
        expect(sentActs(run)).toHaveLength(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "draftSettled: a draft the view mirrored is in the recorded sockets when it returns, after the debounce",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk, dist));
        const board = await openBoard(run, QUESTIONS);
        expect(sentDrafts(run)).toEqual([]);
        await noteOf(board, "cache").fill(NOTE);
        await draftSettled(board);
        const notes = sentDrafts(run).map((record) => record.questions.cache?.note);
        expect(notes).toContain(NOTE);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "timerSettled: the board page's first reconnect, after a drop, has opened its socket when the reconnect delay and the flush are over",
      async () => {
        const run = await start({ transcript: replayTranscripts.shortDrop, view: dist });
        const board = await run.open();
        await run.session.drop();
        await board
          .banner("Connection lost, retrying")
          .filter({ visible: true })
          .first()
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        const before = run.browser.sockets.length;
        await timerSettled(noReconnectWaitMs(before), board);
        expect(run.browser.sockets.length).toBeGreaterThan(before);
        await run.session.restore();
        await board
          .banner("Connection lost, retrying")
          .waitFor({ state: "hidden", timeout: RECONNECT_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
