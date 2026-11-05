// The bottom action bar's Snapshot in each engine (snapshot task 7.1; view-and-widgets spec: The
// Snapshot control, A Snapshot not confirmed, The unsent-work note). On the test server it replays
// E7's transcript, whose four outcomes no one session gives, and the two parts derived from it;
// those tests run on the test-server target only. Asks sent as they are run on the session
// process whatever the target: they take real Snapshots under a project folder, or none without
// one.

import { describe, expect, test } from "bun:test";
import { lifecycleSnapshotResult } from "@askboard/contract/fixtures";
import { singleAsk, submittedAsk, twoAsk } from "./fixtures/lifecycle-asks.ts";
import type { Asker } from "./harness/asker.ts";
import {
  type BoardRun,
  eventually,
  expectNoCspProblem,
  QUIET_MS,
  RECONNECT_TIMEOUT_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  barButton,
  buttonOf,
  lifecycleScenario,
  mirrored,
  noteOf,
  openBoard,
  optionOf,
} from "./harness/lifecycle-test.ts";
import { targetFrom } from "./harness/target.ts";
import { replayTranscripts } from "./harness/transcripts.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ON_TEST_SERVER = targetFrom(process.env.ASKBOARD_E2E_TARGET) === "test-server";

const NOTE = "Your unsent work will not be in the Snapshot";
const CONNECTION_LOST = "Connection lost, retrying";
const SNAPSHOTS = "/home/sara/shop/.askboard/snapshots";
/** The project the session process saves Snapshots under. */
const ASKER: Asker = { project: "order-service", gitUser: "Sara Rossi" };

const snapshotButton = (board: Board) => barButton(board, "Snapshot");
const feedbackOf = (board: Board) => board.view.locator("[data-askboard-snapshot-feedback]");

// Waits until the bar's feedback holds the text.
const says = (board: Board, text: string | RegExp, timeout = STEP_TIMEOUT_MS) =>
  feedbackOf(board).filter({ hasText: text }).waitFor({ state: "visible", timeout });

const snapshotRequests = (run: BoardRun): number =>
  run.browser.sockets
    .flatMap((socket) => socket.frames)
    .filter((frame) => frame.dir === "sent" && frame.text.includes('"type":"snapshot"')).length;

// The path the bar shows, in code type.
const shownPath = async (board: Board): Promise<string> =>
  (await feedbackOf(board).locator("code").textContent()) ?? "";

const expectSavedFile = async (path: string, askId: string): Promise<string> => {
  expect(path).toMatch(new RegExp(`/\\.askboard/snapshots/${askId}-[^/]+\\.html$`));
  const file = Bun.file(path);
  expect(await file.exists()).toBe(true);
  return file.text();
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Snapshot control`, () => {
    const { start } = useEngine(engine);

    test.if(ON_TEST_SERVER)(
      "E7's transcript: the path, the folder with the unsent-work note, CLAUDE_PROJECT_DIR, discarded",
      async () => {
        const run = await start({ transcript: replayTranscripts.snapshot, view: dist });
        const board = await openBoard(run, ["region"]);
        await snapshotButton(board).click({ timeout: STEP_TIMEOUT_MS });
        await says(board, "Snapshot saved:");
        expect(await shownPath(board)).toBe(lifecycleSnapshotResult.path);
        expect(await feedbackOf(board).textContent()).not.toContain(NOTE);
        await noteOf(board, "region").fill("Ask legal first");
        await mirrored(run, (record) => record.questions.region?.note !== undefined, "a note");
        await snapshotButton(board).click({ timeout: STEP_TIMEOUT_MS });
        await says(board, "it could not be written in");
        expect(await shownPath(board)).toBe(SNAPSHOTS);
        await says(board, NOTE);
        await noteOf(board, "region").fill("");
        await mirrored(run, (record) => record.questions.region === undefined, "no note");
        await snapshotButton(board).click({ timeout: STEP_TIMEOUT_MS });
        await says(board, "CLAUDE_PROJECT_DIR");
        expect(await feedbackOf(board).textContent()).not.toContain(NOTE);
        await snapshotButton(board).click({ timeout: STEP_TIMEOUT_MS });
        await says(board, "No Snapshot was taken: the ask was discarded.");
        expect(run.session.problems()).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test.if(ON_TEST_SERVER)(
      "a Snapshot AskBoard fails to take says no Snapshot was taken, naming no folder",
      async () => {
        const run = await start({
          transcript: replayTranscripts.snapshotInternalError,
          view: dist,
        });
        const board = await openBoard(run, ["region"]);
        await snapshotButton(board).click({ timeout: STEP_TIMEOUT_MS });
        await says(board, "No Snapshot was taken: AskBoard failed to take it.");
        expect(await feedbackOf(board).locator("code").count()).toBe(0);
        expect(run.session.problems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test.if(ON_TEST_SERVER)(
      "a drop before the reply: not confirmed, disabled while lost, and not sent again",
      async () => {
        const run = await start({ transcript: replayTranscripts.snapshotDropped, view: dist });
        const board = await openBoard(run, ["region"]);
        await snapshotButton(board).click({ timeout: STEP_TIMEOUT_MS });
        await run.session.drop();
        await says(board, "The Snapshot was not confirmed");
        expect(await feedbackOf(board).textContent()).not.toContain("No Snapshot was taken");
        await board.banner(CONNECTION_LOST).first().waitFor({ timeout: RECONNECT_TIMEOUT_MS });
        await eventually(() => snapshotButton(board).isDisabled(), "Snapshot disabled");
        await run.session.restore();
        await board
          .banner(CONNECTION_LOST)
          .waitFor({ state: "hidden", timeout: RECONNECT_TIMEOUT_MS });
        await eventually(async () => !(await snapshotButton(board).isDisabled()), "enabled again");
        await Bun.sleep(QUIET_MS);
        expect(snapshotRequests(run)).toBe(1);
        expect(run.session.problems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the single-question board: Snapshot in the bar, and the saved file's path after a press",
      async () => {
        const run = await start({ ...lifecycleScenario(singleAsk, dist), asker: ASKER });
        const board = await openBoard(run, ["database"]);
        await snapshotButton(board).click({ timeout: STEP_TIMEOUT_MS });
        await says(board, "Snapshot saved:", RECONNECT_TIMEOUT_MS);
        await expectSavedFile(await shownPath(board), singleAsk.askId);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "submitted delivery with a ready answer: the note shows, and the Snapshot is still taken",
      async () => {
        const run = await start({ ...lifecycleScenario(submittedAsk, dist), asker: ASKER });
        const board = await openBoard(run, ["database", "cache", "audit"]);
        await optionOf(board, "database", "PostgreSQL").click({ timeout: STEP_TIMEOUT_MS });
        await buttonOf(board, "database", "Answer").click({ timeout: STEP_TIMEOUT_MS });
        await mirrored(run, (record) => record.questions.database?.held !== undefined, "held");
        await snapshotButton(board).click({ timeout: STEP_TIMEOUT_MS });
        await says(board, "Snapshot saved:", RECONNECT_TIMEOUT_MS);
        await says(board, NOTE);
        const html = await expectSavedFile(await shownPath(board), submittedAsk.askId);
        expect(html).toContain('"unsentWork":true');
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a session without CLAUDE_PROJECT_DIR: the failure names it, and nothing is saved",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await snapshotButton(board).click({ timeout: STEP_TIMEOUT_MS });
        await says(board, "CLAUDE_PROJECT_DIR", RECONNECT_TIMEOUT_MS);
        expect(await feedbackOf(board).locator("code").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Connection lost, retrying: Snapshot is disabled, and no request leaves the page",
      async () => {
        const run = await start({ ...lifecycleScenario(singleAsk, dist), asker: ASKER });
        const board = await openBoard(run, ["database"]);
        await run.session.drop();
        await board.banner(CONNECTION_LOST).first().waitFor({ timeout: RECONNECT_TIMEOUT_MS });
        await eventually(() => snapshotButton(board).isDisabled(), "Snapshot disabled");
        await snapshotButton(board).click({ force: true, timeout: STEP_TIMEOUT_MS });
        await Bun.sleep(QUIET_MS);
        expect(snapshotRequests(run)).toBe(0);
        expect(await feedbackOf(board).textContent()).toBe("");
        await run.session.restore();
      },
      TEST_TIMEOUT_MS,
    );
  });
}
