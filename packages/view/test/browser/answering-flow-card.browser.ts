// The question card in the browser (answering-flow-visual, task 6.1; view-and-widgets spec: The
// question's state on its card, The answered look and Edit, A blocked primary with nothing chosen).
// At 1280x800: the badge and the stripe of each state, "Edit" on an answered card, the answer's line
// in Italian, "Choose an option", a 300-character option description that wraps, the open prompt on
// every card, and "More" in the card's head. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
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
  buttonOf,
  card,
  chooseFromMore,
  labelText,
  lifecycleScenario,
  noteOf,
  openBoard,
  optionOf,
  postponeOf,
  receiptOf,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];

const badgeOf = (board: Board, id: string): Locator =>
  card(board, id).locator("[data-askboard-card-head] [data-askboard-state]");

/** The stripe's style on the card's left edge, from the computed style. */
const stripeOf = (board: Board, id: string): Promise<{ style: string; state: string | null }> =>
  card(board, id).evaluate((element) => ({
    style: getComputedStyle(element).borderLeftStyle,
    state: element.getAttribute("data-askboard-stripe"),
  }));

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the question card`, () => {
    const { start } = useEngine(engine);

    const open = async (
      delivery: "immediate" | "submitted" = "immediate",
      language: Language = "en-US",
    ) => {
      const run = await start(
        lifecycleScenario(answeringAsk("sections", language, delivery), dist),
      );
      return { run, board: await openBoard(run, ALL) };
    };

    test(
      "sent, then delivered: the badge reads Sent with a dashed stripe, then Delivered to the agent with a solid one",
      async () => {
        const { run, board } = await open();
        await optionOf(board, "q1", "Yes").click({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await receiptOf(board, "q1", "sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await labelText(badgeOf(board, "q1"))).toBe("Sent");
        expect(await stripeOf(board, "q1")).toEqual({ style: "dashed", state: "sent" });
        await run.session.collect();
        await receiptOf(board, "q1", "delivered").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await labelText(badgeOf(board, "q1"))).toBe("Delivered to the agent");
        expect(await stripeOf(board, "q1")).toEqual({ style: "solid", state: "delivered" });
      },
      TEST_TIMEOUT_MS,
    );

    for (const language of ["en-US", "it-IT"] as const) {
      test(
        `every state is named in text beside its icon (${language})`,
        async () => {
          const { board } = await open("submitted", language);
          const yes = language === "it-IT" ? "Sì" : "Yes";
          await optionOf(board, "q2", yes).click({ timeout: STEP_TIMEOUT_MS });
          await optionOf(board, "q3", yes).click({ timeout: STEP_TIMEOUT_MS });
          await answerOf(board, "q3").click({ timeout: STEP_TIMEOUT_MS });
          await postponeOf(board, "q5").click({ timeout: STEP_TIMEOUT_MS });
          if (language === "en-US") await chooseFromMore(board, "q8", "Decline");
          for (const id of ["q1", "q2", "q3", "q5"]) {
            await eventually(async () => (await badgeOf(board, id).count()) === 1, `${id} badge`);
          }
          const outline = async (id: string) =>
            (
              (await board.view
                .locator(`[data-askboard-outline="${id}"] [data-askboard-state]`)
                .textContent()) ?? ""
            ).trim();
          for (const id of ["q1", "q2", "q3", "q5"]) {
            const badge = await labelText(badgeOf(board, id));
            expect(badge.length).toBeGreaterThan(0);
            expect(badge).toBe(await outline(id));
          }
          const states = await Promise.all(
            ["q1", "q2", "q3", "q5"].map((id) =>
              badgeOf(board, id).getAttribute("data-askboard-state"),
            ),
          );
          expect(states).toEqual(["todo", "draft", "ready", "postponed"]);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "Edit on a sent answer moves focus to the chosen option, sends nothing and the card still reads Sent",
      async () => {
        const { run, board } = await open();
        await optionOf(board, "q1", "Yes").click({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await receiptOf(board, "q1", "sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        const sent = (await actsSent(run, 1)).length;
        await board.edit("q1").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => isFocused(optionOf(board, "q1", "Yes")),
          "focus on the chosen option",
        );
        expect((await actsSent(run, 1)).length).toBe(sent);
        expect(await labelText(badgeOf(board, "q1"))).toBe("Sent");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an edit starts a revision: Draft, and the primary reads Send the change",
      async () => {
        const { board } = await open();
        await optionOf(board, "q1", "Yes").click({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await receiptOf(board, "q1", "sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await optionOf(board, "q1", "No").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(async () => (await labelText(badgeOf(board, "q1"))) === "Draft", "Draft");
        // Change 4's spec has a revision read Draft with no receipt; this change's scenario says "its
        // receipt still shown": the two disagree (reported to the architect), the base's rule stands.
        expect(await receiptOf(board, "q1", "sent").count()).toBe(0);
        expect(await labelText(answerOf(board, "q1"))).toBe("Send the change");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the answer's line reads 'Risposta: Sì' with 'Modifica' on an it-IT board",
      async () => {
        const { board } = await open("immediate", "it-IT");
        await optionOf(board, "q1", "Sì").click({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await receiptOf(board, "q1", "sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await card(board, "q1").getByText("Risposta: Sì", { exact: true }).waitFor();
        expect(await labelText(board.edit("q1"))).toBe("Modifica");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "nothing chosen on an it-IT board: the disabled primary reads 'Invia risposta' with 'Scegli un'opzione' as its description; a note alone clears it",
      async () => {
        const { board } = await open("immediate", "it-IT");
        const primary = answerOf(board, "q1");
        expect(await primary.isDisabled()).toBe(true);
        expect(await labelText(primary)).toBe("Invia risposta");
        const reason = (await primary.getAttribute("aria-describedby")) ?? "";
        expect(await board.view.locator(`[id="${reason}"]`).textContent()).toBe(
          "Scegli un'opzione",
        );
        await card(board, "q1").locator('[id="q1:note"]').fill("Una nota");
        await eventually(
          async () => (await primary.getAttribute("aria-describedby")) === null,
          "the reason gone",
        );
        expect(await primary.isDisabled()).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the open prompt shows on every question, and More in the card's head opens Explain and Decline",
      async () => {
        const { board } = await open();
        for (const id of ["q1", "q2", "q3"]) await noteOf(board, id).waitFor();
        const more = card(board, "q1").locator("[data-askboard-card-head]").getByRole("button", {
          name: "More",
          exact: true,
        });
        await more.click({ timeout: STEP_TIMEOUT_MS });
        await board.view.getByRole("menuitem", { name: "Explain", exact: true }).waitFor();
        await board.view.getByRole("menuitemcheckbox", { name: "Decline", exact: true }).waitFor();
        expect(await buttonOf(board, "q1", "More").count()).toBe(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a 300-character option description wraps and is never cut",
      async () => {
        const long = `${"A long reason that goes on. ".repeat(11)}`.slice(0, 300);
        const ask = {
          askId: "card-long-description-d6",
          title: "Long descriptions",
          items: [
            {
              type: "question",
              id: "long",
              props: {
                text: "Which?",
                header: "Long",
                options: [{ label: "One", description: long }, { label: "Two" }],
              },
            },
            {
              type: "question",
              id: "other",
              props: {
                text: "Other?",
                header: "Other",
                options: [{ label: "Yes" }, { label: "No" }],
              },
            },
          ],
        };
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["long", "other"]);
        const description = card(board, "long").getByText(long, { exact: true });
        await description.waitFor();
        const measures = await description.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            wraps:
              element.getBoundingClientRect().height > Number.parseFloat(style.lineHeight) * 1.5,
            ellipsis: style.textOverflow === "ellipsis",
            clipped: element.scrollHeight > element.clientHeight + 1,
          };
        });
        expect(measures).toEqual({ wraps: true, ellipsis: false, clipped: false });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
