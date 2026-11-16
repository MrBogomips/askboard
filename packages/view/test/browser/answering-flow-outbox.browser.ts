// The outbox and its ledger in the browser (answering-flow-visual, task 4.1; view-and-widgets spec:
// The outbox, The outbox ledger, and the delivery switch and Send they hold). At 1280x800, with the
// board of nine questions: the switch, its helper and the ledger with no Send in "One by one"; "Send
// 3 answers" with its line in English and Italian; an agent-change notice in the line's place; a
// closed board that still counts; the ledger's Sent and Delivered from the receipts. Every scenario
// runs on the session process.

import { describe, expect, test } from "bun:test";
import { answeringAsk, type Language } from "./fixtures/answering-flow-asks.ts";
import {
  eventually,
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
  chooseFromMore,
  headingOf,
  lifecycleScenario,
  openBoard,
  optionOf,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];

const text = async (locator: ReturnType<Board["ledger"]>): Promise<string> =>
  ((await locator.textContent()) ?? "").replace(/\s+/g, " ").trim();

/** The ledger's count of a cell: the number, or the dash. */
const cell = async (board: Board, name: "drafts" | "ready" | "sent" | "delivered") =>
  (await board.ledger(name).locator("[data-askboard-count]").textContent())?.trim();

const ready = async (board: Board, id: string, label: string): Promise<void> => {
  await optionOf(board, id, label).click({ timeout: STEP_TIMEOUT_MS });
  await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
  await eventually(
    async () => (await answerOf(board, id).getAttribute("aria-pressed")) === "true",
    `${id} ready`,
  );
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the outbox and its ledger`, () => {
    const { start } = useEngine(engine);

    const open = async (delivery: "immediate" | "submitted", language: Language = "en-US") => {
      const run = await start(
        lifecycleScenario(answeringAsk("sections", language, delivery), dist),
      );
      return { run, board: await openBoard(run, ALL) };
    };

    test(
      "One by one: the switch, its helper and the ledger show, no Send; the Ready cell is a dash that says it is not used",
      async () => {
        const { board } = await open("immediate");
        const outbox = board.outbox;
        await outbox.getByText("Each answer goes to the agent as soon as you send it.").waitFor();
        expect(
          await outbox.getByRole("group", { name: "Sending answers" }).count(),
        ).toBeGreaterThan(0);
        expect(await board.submit.count()).toBe(0);
        for (const name of ["drafts", "ready", "sent", "delivered"] as const) {
          expect(await board.ledger(name).count()).toBe(1);
        }
        expect(await cell(board, "ready")).toBe("–");
        expect(await text(board.ledger("ready"))).toContain('Not used in "One by one"');
        expect(await cell(board, "sent")).toBe("0");
      },
      TEST_TIMEOUT_MS,
    );

    for (const [language, yes, line, send] of [
      ["en-US", "Yes", "3 answers ready: nothing has been sent yet.", "Send 3 answers"],
      ["it-IT", "Sì", "3 risposte pronte: niente è stato ancora inviato.", undefined],
    ] as const) {
      test(
        `All together, three ready (${language}): Send shows its count, the line says nothing was sent, Ready is 3, Sent 0 and the ask pill stays`,
        async () => {
          const { board } = await open("submitted", language);
          const before = await board.askRow
            .locator("[data-askboard-ask-pill]")
            .getAttribute("data-askboard-ask-pill");
          for (const id of ["q1", "q2", "q3"]) await ready(board, id, yes);
          await board.outbox.getByText(line, { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
          if (send !== undefined) expect(await text(board.submit)).toBe(send);
          expect(await cell(board, "ready")).toBe("3");
          expect(await cell(board, "sent")).toBe("0");
          expect(
            await board.askRow
              .locator("[data-askboard-ask-pill]")
              .getAttribute("data-askboard-ask-pill"),
          ).toBe(before);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "an agent-change notice on a ready answer: Send is disabled, the line reads '1 update needs a choice' in place of the ready line, and it moves focus to that heading",
      async () => {
        const { run, board } = await open("submitted");
        await ready(board, "q2", "Yes");
        await run.session.update([
          {
            action: "change",
            itemId: "q2",
            props: { text: "Is step q2 still needed for the release?" },
          },
        ]);
        const updates = board.outbox.getByRole("button", { name: "1 update needs a choice" });
        await updates.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await board.submit.isDisabled()).toBe(true);
        expect(await board.outbox.getByText("answer ready: nothing").count()).toBe(0);
        await updates.click();
        await eventually(() => isFocused(headingOf(board, "q2")), "focus on the changed question");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one question per view, all together: two confirmed questions go in one command from the outbox's Send 2 answers, and Sent reads 2",
      async () => {
        const run = await start(
          lifecycleScenario(answeringAsk("one-per-view", "en-US", "submitted"), dist),
        );
        const board = await openBoard(run, ["q1"]);
        for (const [at, id] of ["q1", "q2"].entries()) {
          await optionOf(board, id, "Yes").click({ timeout: STEP_TIMEOUT_MS });
          await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
          await eventually(
            async () => (await cell(board, "ready")) === String(at + 1),
            `Ready ${at + 1}`,
          );
        }
        await board.submit.click({ timeout: STEP_TIMEOUT_MS });
        const [command] = await actsSent(run, 1);
        expect(command?.acts.map((act) => act.itemId).sort()).toEqual(["q1", "q2"]);
        await eventually(async () => (await cell(board, "sent")) === "2", "Sent 2");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a closed board: the outbox still shows the ledger's counts, and its switch takes no input",
      async () => {
        const { run, board } = await open("submitted");
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await board.ledger("ready").count()).toBe(1);
        expect(await board.delivery("immediate").isDisabled()).toBe(true);
        expect(await board.delivery("submitted").isDisabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Sent and Delivered come from the receipts: one answer sent reads Sent 1 and Delivered 0 until the agent collects it",
      async () => {
        const { run, board } = await open("immediate");
        await optionOf(board, "q1", "Yes").click({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, 1);
        await eventually(async () => (await cell(board, "sent")) === "1", "Sent 1");
        expect(await cell(board, "delivered")).toBe("0");
        await run.session.collect();
        await eventually(async () => (await cell(board, "delivered")) === "1", "Delivered 1");
        expect(await cell(board, "sent")).toBe("1");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a decline in One by one counts as sent, and as delivered once the agent has it",
      async () => {
        const { run, board } = await open("immediate");
        await chooseFromMore(board, "q1", "Decline");
        const confirm = board.view.getByRole("button", { name: /^Decline$/ }).last();
        if (await confirm.isVisible().catch(() => false)) await confirm.click();
        await eventually(async () => (await cell(board, "sent")) === "1", "Sent 1");
        expect(await cell(board, "delivered")).toBe("0");
        await run.session.collect();
        await eventually(async () => (await cell(board, "delivered")) === "1", "Delivered 1");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
