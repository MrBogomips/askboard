// The question card's options and prompt, in each engine (ask-lifecycle, task 6.4; view spec:
// Nothing chosen for the user, Answer sends at once, Open prompt, Other row, Recommended option,
// Option previews, Option annotations and notes, Agent content as text): every scenario runs on
// the session process, and what reaches the agent is read back through `collect`.

import { describe, expect, test } from "bun:test";
import { MARKUP, markupAsk, singleAsk, twoAsk } from "./fixtures/lifecycle-asks.ts";
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
  actsDone,
  answerOf,
  card,
  lifecycleScenario,
  noteOf,
  openBoard,
  optionOf,
  sentActs,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const sent = (board: Board, id: string) =>
  card(board, id).getByText("sent", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });

const checked = async (board: Board, id: string, labels: readonly string[]) => {
  const states: Record<string, boolean> = {};
  for (const label of labels) states[label] = await optionOf(board, id, label).isChecked();
  return states;
};

const ALL = ["PostgreSQL", "SQLite", "DynamoDB", "Other…"];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the question card`, () => {
    const { start } = useEngine(engine);

    test(
      "a board with a recommended option opens with nothing selected, the badge shown, Answer disabled; the arrow keys select nothing",
      async () => {
        const run = await start(lifecycleScenario(singleAsk, dist));
        const board = await openBoard(run, ["database"]);
        expect(await checked(board, "database", ALL)).toEqual({
          PostgreSQL: false,
          SQLite: false,
          DynamoDB: false,
          "Other…": false,
        });
        await card(board, "database").getByText("Recommended", { exact: true }).waitFor();
        expect(await answerOf(board, "database").isDisabled()).toBe(true);
        await optionOf(board, "database", "PostgreSQL").focus();
        for (const [key, label] of [
          ["ArrowDown", "SQLite"],
          ["ArrowDown", "DynamoDB"],
          ["ArrowDown", "Other…"],
          ["ArrowUp", "DynamoDB"],
        ] as const) {
          await board.page.keyboard.press(key);
          await eventually(
            () => isFocused(optionOf(board, "database", label)),
            `${key} to ${label}`,
          );
        }
        expect(Object.values(await checked(board, "database", ALL))).toEqual([
          false,
          false,
          false,
          false,
        ]);
        expect(sentActs(run)).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the user selects PostgreSQL, writes a note and presses Answer: one act with the choice and the note, sent, Answered",
      async () => {
        const run = await start(lifecycleScenario(singleAsk, dist));
        const board = await openBoard(run, ["database"]);
        await optionOf(board, "database", "PostgreSQL").click();
        await noteOf(board, "database").fill("Use the read replica.");
        await answerOf(board, "database").click();
        await sent(board, "database");
        await board.header
          .getByText("Answered", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        const acts = await actsDone(run, 1);
        expect(acts).toHaveLength(1);
        expect(acts[0]?.acts).toEqual([
          {
            type: "answer",
            itemId: "database",
            rev: 1,
            choice: ["PostgreSQL"],
            note: "Use the read replica.",
            when: expect.stringMatching(/Z$/),
          },
        ]);
        const { events } = await run.session.collect();
        expect(events.filter((event) => event.type === "answer")).toEqual([
          expect.objectContaining({ choice: ["PostgreSQL"], note: "Use the read replica." }),
        ]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Other…: choosing it clears the option and an option clears it; the answer carries MariaDB and no label",
      async () => {
        const run = await start(lifecycleScenario(singleAsk, dist));
        const board = await openBoard(run, ["database"]);
        await optionOf(board, "database", "SQLite").click();
        await optionOf(board, "database", "Other…").click();
        expect(await checked(board, "database", ["SQLite", "Other…"])).toEqual({
          SQLite: false,
          "Other…": true,
        });
        const other = card(board, "database").getByRole("textbox", { name: "Other…" });
        await other.fill("MariaDB");
        await optionOf(board, "database", "DynamoDB").click();
        expect(await other.count()).toBe(0);
        await optionOf(board, "database", "Other…").click();
        await other.fill("MariaDB");
        await answerOf(board, "database").click();
        await sent(board, "database");
        const [command] = await actsDone(run, 1);
        expect(command?.acts).toEqual([
          {
            type: "answer",
            itemId: "database",
            rev: 1,
            other: "MariaDB",
            when: expect.any(String),
          },
        ]);
        const { events } = await run.session.collect();
        const [answer] = events.filter((event) => event.type === "answer");
        expect(answer?.other).toBe("MariaDB");
        expect(answer?.choice).toBeUndefined();
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Accept recommended selects the recommended option and sends the answer at once",
      async () => {
        const run = await start(lifecycleScenario(singleAsk, dist));
        const board = await openBoard(run, ["database"]);
        await card(board, "database").getByRole("button", { name: "Accept recommended" }).click();
        await sent(board, "database");
        expect(await optionOf(board, "database", "PostgreSQL").isChecked()).toBe(true);
        expect((await actsDone(run, 1))[0]?.acts).toEqual([
          {
            type: "answer",
            itemId: "database",
            rev: 1,
            choice: ["PostgreSQL"],
            when: expect.any(String),
          },
        ]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "previews open below their option as text, one at a time; the agent's annotation shows under its option",
      async () => {
        const run = await start(lifecycleScenario(singleAsk, dist));
        const board = await openBoard(run, ["database"]);
        const view = card(board, "database");
        await view.getByText("Agent:", { exact: true }).waitFor();
        await view.getByText("The team runs it already for billing.").waitFor();
        const previews = view.getByRole("button", { name: "Show preview" });
        expect(await previews.count()).toBe(2);
        await previews.nth(0).click();
        await view.getByText("Single writer; fine below 100 writes a second.").waitFor();
        await previews.nth(1).click();
        await view.getByText("Pay per request; no joins.").waitFor();
        expect(await view.getByText("Single writer; fine below 100 writes a second.").count()).toBe(
          0,
        );
        expect(await previews.nth(1).getAttribute("aria-expanded")).toBe("true");
        expect(await previews.nth(0).getAttribute("aria-expanded")).toBe("false");
        expect(sentActs(run)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a note on an option not chosen returns with the answer under its label",
      async () => {
        const run = await start(lifecycleScenario(singleAsk, dist));
        const board = await openBoard(run, ["database"]);
        const view = card(board, "database");
        await optionOf(board, "database", "DynamoDB").focus();
        const add = view.getByRole("button", { name: "+ Add your note to this option" });
        await add.first().click();
        await view.getByRole("textbox", { name: "Your note on DynamoDB" }).fill("too costly");
        await optionOf(board, "database", "PostgreSQL").click();
        await answerOf(board, "database").click();
        await sent(board, "database");
        expect((await actsDone(run, 1))[0]?.acts).toEqual([
          {
            type: "answer",
            itemId: "database",
            rev: 1,
            choice: ["PostgreSQL"],
            optionNotes: { DynamoDB: "too costly" },
            when: expect.any(String),
          },
        ]);
        const { events } = await run.session.collect();
        expect(events.find((event) => event.type === "answer")?.optionNotes).toEqual({
          DynamoDB: "too costly",
        });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a note without an answer: Answer sends the note alone, and the question still counts as open",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        await board.header.getByText("2 open", { exact: true }).waitFor();
        expect(await answerOf(board, "database").isDisabled()).toBe(true);
        await noteOf(board, "database").fill("Ask the ops team first.");
        await answerOf(board, "database").click();
        await eventually(
          async () => (await noteOf(board, "database").inputValue()) === "",
          "the note to leave the draft",
        );
        expect((await actsDone(run, 1))[0]?.acts).toEqual([
          {
            type: "note",
            itemId: "database",
            rev: 1,
            note: "Ask the ops team first.",
            when: expect.any(String),
          },
        ]);
        await board.header.getByText("2 open", { exact: true }).waitFor();
        expect(await answerOf(board, "database").isDisabled()).toBe(true);
        const { events } = await run.session.collect();
        expect(events.map((event) => event.type)).toEqual(["note"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "markup in a label, a preview and an annotation shows as text",
      async () => {
        const run = await start(lifecycleScenario(markupAsk, dist));
        const board = await openBoard(run, ["markup"]);
        const view = card(board, "markup");
        await view.getByRole("button", { name: "Show preview" }).click();
        for (const text of [MARKUP, "<b>preview</b>", "<i>annotation</i>"]) {
          await view.getByText(text, { exact: false }).first().waitFor();
        }
        const frame = await board.viewFrame();
        const created = await frame.evaluate(
          () => document.querySelectorAll('img[src="x"], [onerror], b, i').length,
        );
        expect(created).toBe(0);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
