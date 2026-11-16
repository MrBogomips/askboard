// Completion, in each engine (answering-flow-guidance, task 7.1; view-and-widgets spec: Completion,
// Completion with postponed questions, All ready nothing sent, Status messages for the guided flow,
// Focus after Answer and Submit; D3, D6, D7; #168). At 1280x800, on short boards of plain questions:
// the panel counts the receipts the board logged, never the ask pill; it takes focus only from an
// act; it leaves with an added question and on a closed board; "All together" shows "All ready"
// beside Send until the user sends. Controls are found by their hooks, the answers are given with
// the keyboard, and each wait is a probe or a condition. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { guidanceAsk } from "./fixtures/guidance-asks.ts";
import {
  eventually,
  expectNoCspProblem,
  isFocused,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsSent,
  answerOf,
  card,
  headingOf,
  lifecycleScenario,
  openBoard,
  optionOf,
  postponeOf,
  receiptOf,
  sentActs,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
type Start = ReturnType<typeof useEngine>["start"];

const open = async (
  start: Start,
  count: number,
  options: Parameters<typeof guidanceAsk>[1] = {},
) => {
  const run = await start(lifecycleScenario(guidanceAsk(count, options), dist));
  const ids = Array.from({ length: count }, (_, at) => `p${at + 1}`);
  return { run, board: await openBoard(run, ids) };
};

// The hooks of the completion (D6): the panel, its heading, and the line beside Send.
const panelOf = (board: Board): Locator => board.view.locator("[data-askboard-completion]");
const panelHeading = (board: Board): Locator =>
  panelOf(board).locator("[data-askboard-completion-heading]");
const allReadyLine = (board: Board): Locator => board.view.locator("[data-askboard-all-ready]");
const stateOf = (board: Board, id: string): Locator =>
  card(board, id).locator("[data-askboard-state]");

const answerWithKeys = async (board: Board, id: string, label = "Yes"): Promise<void> => {
  await optionOf(board, id, label).focus();
  await board.page.keyboard.press(" ");
  await eventually(() => optionOf(board, id, label).isChecked(), `${label} chosen on ${id}`);
  await answerOf(board, id).focus();
  await board.page.keyboard.press("Enter");
};

/** Sends each question in turn with the keyboard, waiting for its command. */
const sendAll = async (
  run: Parameters<typeof actsSent>[0],
  board: Board,
  ids: readonly string[],
  label = "Yes",
): Promise<void> => {
  let sent = 0;
  for (const id of ids) {
    await answerWithKeys(board, id, label);
    sent += 1;
    await actsSent(run, sent);
  }
};

const panelText = async (board: Board): Promise<string> =>
  ((await panelOf(board).textContent({ timeout: STEP_TIMEOUT_MS })) ?? "").replace(/\s+/g, " ");
const regionText = async (board: Board): Promise<string> =>
  (await board.status.textContent({ timeout: STEP_TIMEOUT_MS })) ?? "";

const expectPanel = (board: Board, text: string): Promise<void> =>
  eventually(
    async () => (await panelOf(board).count()) === 1 && (await panelText(board)).includes(text),
    `the panel reading "${text}"`,
  );

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: completion`, () => {
    const { start } = useEngine(engine);

    test(
      "all sent and none collected: the panel counts the receipts, its heading has focus, and it says nothing of closing or of the agent having read",
      async () => {
        const { run, board } = await open(start, 2);
        expect(await panelOf(board).count()).toBe(0);
        await sendAll(run, board, ["p1", "p2"]);
        await expectPanel(board, "Every question has an answer.");
        await expectPanel(board, "Sent: 2. Delivered to the agent: 0.");
        await eventually(() => isFocused(panelHeading(board)), "focus on the panel's heading");
        // The ask pill may read "Answered": the panel's count is the receipts', not the pill's.
        expect(await panelText(board)).not.toMatch(/clos|read|safe/i);
        // The panel's icon beside its heading, hidden from assistive technology (D11).
        const icon = panelOf(board).locator("svg");
        expect(await icon.count()).toBe(1);
        expect(await icon.getAttribute("aria-hidden")).toBe("true");
        expect(await icon.getAttribute("class")).toContain("lucide-circle-check-big");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "in Italian the panel reads «Consegnate all'agente: 0.»",
      async () => {
        const { run, board } = await open(start, 2, { language: "it-IT" });
        await sendAll(run, board, ["p1", "p2"], "Sì");
        await expectPanel(board, "Tutte le domande hanno una risposta.");
        await expectPanel(board, "Inviate: 2. Consegnate all'agente: 0.");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "receipts arriving: the panel's delivered count follows the agent's collect",
      async () => {
        const { run, board } = await open(start, 3);
        await sendAll(run, board, ["p1", "p2"]);
        await run.session.collectJson();
        await receiptOf(board, "p1", "delivered").waitFor({ timeout: STEP_TIMEOUT_MS });
        await receiptOf(board, "p2", "delivered").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await panelOf(board).count()).toBe(0);
        await answerWithKeys(board, "p3");
        await actsSent(run, 3);
        await expectPanel(board, "Sent: 3. Delivered to the agent: 2.");
        await run.session.collectJson();
        await expectPanel(board, "Sent: 3. Delivered to the agent: 3.");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the panel appears without taking focus the user moved during the send",
      async () => {
        const { run, board } = await open(start, 2);
        await answerWithKeys(board, "p1");
        await actsSent(run, 1);
        await answerWithKeys(board, "p2");
        // The user takes focus elsewhere at once: to the first question's option.
        await optionOf(board, "p1", "Yes").focus();
        await actsSent(run, 2);
        await expectPanel(board, "Every question has an answer.");
        await Bun.sleep(300);
        expect(await isFocused(panelHeading(board))).toBe(false);
        expect(await isFocused(optionOf(board, "p1", "Yes"))).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a revision keeps the panel: editing an answered question without sending leaves the counts and reads Draft",
      async () => {
        const { run, board } = await open(start, 2);
        await sendAll(run, board, ["p1", "p2"]);
        await expectPanel(board, "Sent: 2. Delivered to the agent: 0.");
        await optionOf(board, "p1", "No").check({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => ((await stateOf(board, "p1").textContent()) ?? "").includes("Draft"),
          "p1 reading Draft",
        );
        await expectPanel(board, "Sent: 2. Delivered to the agent: 0.");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a question the agent adds removes the panel, and the count to do is 1",
      async () => {
        const { run, board } = await open(start, 2);
        await sendAll(run, board, ["p1", "p2"]);
        await expectPanel(board, "Every question has an answer.");
        await run.session.update([
          {
            action: "add",
            item: {
              type: "question",
              id: "p3",
              props: {
                text: "Is step p3 needed for the release?",
                header: "P3",
                options: [{ label: "Yes" }, { label: "No" }],
              },
            },
          },
        ]);
        await eventually(async () => (await panelOf(board).count()) === 0, "the panel gone");
        await board.header.getByText("1 to do", { exact: true }).waitFor({
          timeout: STEP_TIMEOUT_MS,
        });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one postponed left: the panel says so and that closing loses the ask, never that every question has an answer, and Go to the first focuses it",
      async () => {
        const { run, board } = await open(start, 3);
        await postponeOf(board, "p3").click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, 1);
        await answerWithKeys(board, "p1");
        await actsSent(run, 2);
        await answerWithKeys(board, "p2");
        await actsSent(run, 3);
        await expectPanel(board, "1 postponed question remains. Closing loses this ask.");
        expect(await panelText(board)).not.toContain("Every question has an answer.");
        await eventually(() => isFocused(panelHeading(board)), "focus on the panel's heading");
        await panelOf(board)
          .getByRole("button", { name: "Go to the first", exact: true })
          .click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(headingOf(board, "p3")), "focus on the p3 heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "All together, the last confirm: focus is on Send with the All ready line and no panel, until the user sends",
      async () => {
        const { run, board } = await open(start, 3, { delivery: "submitted" });
        for (const id of ["p1", "p2", "p3"]) await answerWithKeys(board, id);
        await eventually(() => isFocused(board.submit), "focus on Send");
        expect((await board.submit.textContent())?.trim()).toBe("Send 3 answers");
        await allReadyLine(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect((await allReadyLine(board).textContent())?.trim()).toBe(
          "All ready: nothing has been sent yet.",
        );
        await eventually(
          async () => (await regionText(board)).includes("All ready: nothing has been sent yet."),
          "the region reading All ready",
        );
        expect(await panelOf(board).count()).toBe(0);
        expect(sentActs(run)).toEqual([]);
        await board.submit.press("Enter");
        await actsSent(run, 1);
        await expectPanel(board, "Sent: 3. Delivered to the agent: 0.");
        await eventually(() => isFocused(panelHeading(board)), "focus on the panel's heading");
        expect(await allReadyLine(board).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the delivered count is said once for two receipts within five seconds",
      async () => {
        const { run, board } = await open(start, 2);
        await sendAll(run, board, ["p1", "p2"]);
        await expectPanel(board, "Sent: 2. Delivered to the agent: 0.");
        await run.session.collectJson();
        await eventually(
          async () => (await regionText(board)) === "Delivered to the agent: 2 of 2.",
          "the region reading the delivered count",
          12_000,
        );
        // Said once: nothing else follows it.
        await Bun.sleep(1_000);
        expect(await regionText(board)).toBe("Delivered to the agent: 2 of 2.");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "every question answered is said in the region",
      async () => {
        const { run, board } = await open(start, 2);
        await sendAll(run, board, ["p1", "p2"]);
        await eventually(
          async () =>
            (await regionText(board)).includes("Every question has an answer.") &&
            (await regionText(board)).includes("Sent: 2. Delivered to the agent: 0."),
          "the region reading the two lines",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a closed board shows no panel",
      async () => {
        const { run, board } = await open(start, 2);
        await sendAll(run, board, ["p1", "p2"]);
        await expectPanel(board, "Every question has an answer.");
        await run.session.update([{ action: "close" }]);
        await board.header.getByText("Closed", { exact: true }).waitFor({
          timeout: STEP_TIMEOUT_MS,
        });
        await eventually(async () => (await panelOf(board).count()) === 0, "the panel gone");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
