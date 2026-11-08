// An answer and a draft too large for the board's limits, on the real board page and the session
// process, in each engine (oversized-acts, task 1.5; spec view-and-widgets: An answer too large to
// send, Work too large to keep across a reload, Leave-page prompt): one question holds enough
// TextFields, each filled to its bound in four-byte characters, to pass both the draft limit and
// the message limit, beside two questions with a note each. (a) Once the draft record passes its
// limit the card says its work is too large to keep and the leave-page prompt is armed by that work
// alone. (b) "Answer" on it shows the act line with its size and the limit, sends nothing, opens
// no new socket and shows no "Connection lost", and an answer to another question then goes and is
// collected. (c) A reload restores the third question's note and none of the first question's
// fields. Each case fills the question itself, so each fails on its own when its behaviour is gone.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/oversized-acts-session.browser.ts

import { describe, expect, test } from "bun:test";
import {
  BOARD_MESSAGE_MAX_BYTES,
  DRAFT_RECORD_MAX_CHARS,
  TEXT_FIELD_MAX_CHARS,
} from "@askboard/contract";
import { plain } from "./fixtures/lifecycle-asks.ts";
import { checkedEvents } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  expectNoReconnect,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  barButton,
  card,
  lifecycleScenario,
  mirrored,
  noteOf,
  openBoard,
  optionOf,
  promptArmed,
  sentActs,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

// Four bytes and two UTF-16 units per character: the most bytes of an answer for the fewest units.
const CHARACTER = "😀";
const FILL = CHARACTER.repeat(TEXT_FIELD_MAX_CHARS);
const BYTES_PER_FIELD = 4 * TEXT_FIELD_MAX_CHARS;
const UNITS_PER_FIELD = 2 * TEXT_FIELD_MAX_CHARS;
// The fewest fields whose answer passes the message limit; they then pass the draft limit too.
const FIELDS = Math.floor(BOARD_MESSAGE_MAX_BYTES / BYTES_PER_FIELD) + 1;

const BIG = "big";
const SECOND = "second";
const THIRD = "third";
const fieldId = (n: number) => `f${String(n).padStart(3, "0")}`;
const ask = {
  askId: "oversized-acts-w4x5",
  title: "Oversized work",
  items: [
    {
      type: "question",
      id: BIG,
      props: {
        text: "Write everything down.",
        items: Array.from({ length: FIELDS }, (_, n) => ({
          type: "text-field",
          id: fieldId(n),
          props: { label: `Field ${n + 1}` },
        })),
      },
    },
    plain(SECOND, "Should the order service cache reads?", "Cache"),
    plain(THIRD, "Should every order change be audited?", "Audit"),
  ],
};

const field = (board: Board, n: number) =>
  card(board, BIG).getByLabel(`Field ${n + 1}`, { exact: true });
const draftLine = (board: Board) =>
  card(board, BIG).getByText(/^Too large to keep across a reload/);
const actLine = (board: Board, id: string) =>
  card(board, id).getByText(/^Not sent: this answer is too large/);
const submitLine = (board: Board, id: string) =>
  card(board, id).getByText(/^Not sent: Submit is too large to send at once/);
const submittedAsk = { ...ask, askId: "oversized-submit-w4x6", delivery: "submitted" };
const connectionLost = (board: Board) => board.banner("Connection lost, retrying");

// Each field of the big question, filled to its bound.
const fillAll = async (board: Board) => {
  for (let n = 0; n < FIELDS; n += 1) await field(board, n).fill(FILL);
};

// How many of the big question's fields hold any text, read in one pass.
const filledFields = (board: Board): Promise<number> =>
  card(board, BIG)
    .locator("input, textarea")
    .evaluateAll(
      (controls) => controls.filter((control) => (control as HTMLInputElement).value !== "").length,
    );

// Opens the board and fills the big question to its bound in every field.
const filled = async (start: Start, scenarioAsk: typeof ask = ask) => {
  // The fixtures pass the limits they are meant to pass, whatever the contract's values.
  expect(FIELDS * BYTES_PER_FIELD).toBeGreaterThan(BOARD_MESSAGE_MAX_BYTES);
  expect(FIELDS * UNITS_PER_FIELD).toBeGreaterThan(DRAFT_RECORD_MAX_CHARS);
  const run = await start(lifecycleScenario(scenarioAsk, dist));
  const board = await openBoard(run, [BIG, SECOND, THIRD]);
  expect(await promptArmed(board)).toBe(false);
  await fillAll(board);
  return { run, board };
};

// A choice and a note on a small question.
const work = async (board: Board, id: string, label: string, note: string) => {
  await optionOf(board, id, label).click();
  await noteOf(board, id).fill(note);
};

type Start = ReturnType<typeof useEngine>["start"];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: an answer and a draft too large, on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "(a) the work passes the draft limit: the card says it is too large to keep, the record mirrored holds none of it, and the leave-page prompt is armed by it alone",
      async () => {
        const { run, board } = await filled(start);
        await draftLine(board).waitFor({ timeout: STEP_TIMEOUT_MS * 4 });
        await mirrored(
          run,
          (record) => Object.keys(record.questions).length === 0,
          "no question's work, the large one's left out",
        );
        expect(await promptArmed(board)).toBe(true);
        // Other questions' work is mirrored, the large one's never in part; the line stays.
        await work(board, SECOND, "Yes", "Reads are hot.");
        await mirrored(
          run,
          (record) =>
            record.questions[SECOND]?.note === "Reads are hot." &&
            !Object.hasOwn(record.questions, BIG),
          "the second question's note and none of the large question's work",
        );
        await draftLine(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(b) Answer on the big question shows the act line with the size and the limit, sends nothing, opens no socket and shows no Connection lost; an answer to another question then goes and is collected",
      async () => {
        const { run, board } = await filled(start);
        await work(board, SECOND, "Yes", "Reads are hot.");
        const socketsBefore = run.browser.sockets.length;
        await answerOf(board, BIG).click({ timeout: STEP_TIMEOUT_MS });
        await actLine(board, BIG).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect((await actLine(board, BIG).textContent()) ?? "").toMatch(
          /\(6\.\d MB, at most 6 MB\)/,
        );
        expect(sentActs(run)).toEqual([]);
        await expectNoReconnect(run);
        expect(run.browser.sockets.length).toBe(socketsBefore);
        expect(await connectionLost(board).count()).toBe(0);
        // The user's work is still there.
        expect(await filledFields(board)).toBe(FIELDS);

        await answerOf(board, SECOND).click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          type: "answer",
          itemId: SECOND,
          choice: ["Yes"],
          note: "Reads are hot.",
        });
        expect(sentActs(run)).toHaveLength(1);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(d) Submit over the message limit: each held question shows the Submit line, nothing is sent or collected, and every act stays held",
      async () => {
        const { run, board } = await filled(start, submittedAsk);
        await optionOf(board, SECOND, "Yes").click({ timeout: STEP_TIMEOUT_MS });
        for (const id of [BIG, SECOND]) {
          await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
          await eventually(
            async () => (await answerOf(board, id).getAttribute("aria-pressed")) === "true",
            `${id} held`,
          );
        }
        expect(sentActs(run)).toEqual([]);
        await barButton(board, "Submit").click({ timeout: STEP_TIMEOUT_MS });
        for (const id of [BIG, SECOND])
          await submitLine(board, id).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect((await submitLine(board, BIG).textContent()) ?? "").toMatch(
          /\(6\.\d MB, at most 6 MB\)/,
        );
        expect(sentActs(run)).toEqual([]);
        expect(checkedEvents(await run.session.collectJson())).toEqual([]);
        for (const id of [BIG, SECOND]) {
          expect(await answerOf(board, id).getAttribute("aria-pressed")).toBe("true");
        }
        expect(await filledFields(board)).toBe(FIELDS);
        expect(await connectionLost(board).count()).toBe(0);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "(c) after a reload the third question's note is back and none of the first question's fields",
      async () => {
        const { run, board } = await filled(start);
        await work(board, THIRD, "No", "Audit later.");
        await mirrored(
          run,
          (record) =>
            record.questions[THIRD]?.note === "Audit later." &&
            !Object.hasOwn(record.questions, BIG),
          "the third question's note and none of the large question's work",
        );
        await reloadBoard(board, run, () =>
          card(board, THIRD).waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS }),
        );
        await eventually(
          async () => (await noteOf(board, THIRD).inputValue()) === "Audit later.",
          "the third question's note restored",
        );
        expect(await filledFields(board)).toBe(0);
        expect(await draftLine(board).count()).toBe(0);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
