// The question card's context layout, in each engine (excerpts, task 6.3; view spec, "A question
// with context splits", "Context placement per question"): every scenario runs on the session
// process, which resolves the pointers against the scenario's project files. A question with a
// resolved or agent-written excerpt splits, its context column beside the question; with none it
// takes the full width, and its references and pointers sit under the question text. A widget
// spans both columns below. "Beside | Inline" moves one question's context and survives a reload
// and a takeover through the draft record, without arming the leave-page prompt.

import { describe, expect, test } from "bun:test";
import { contextAsk, PROJECT_FILES, singleContextAsk } from "./fixtures/context-asks.ts";
import {
  eventually,
  expectNoCspProblem,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  buttonOf,
  card,
  lifecycleScenario,
  mirrored,
  openBoard,
  promptArmed,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const IDS = ["fix", "settings", "rollout"];
const COLUMN_WIDTH = 360;

const scenario = (ask: typeof contextAsk) => ({
  ...lifecycleScenario(ask, dist),
  files: PROJECT_FILES,
});

const contextOf = (board: Board, id: string) => card(board, id).locator("[data-askboard-context]");

const box = async (locator: ReturnType<typeof contextOf>) => {
  const found = await locator.boundingBox();
  if (found === null) throw new Error("the element has no box");
  return found;
};

const heading = (board: Board, id: string) => card(board, id).getByRole("heading", { level: 2 });

const place = (board: Board, id: string, label: "Beside" | "Inline") =>
  contextOf(board, id).getByRole("button", { name: label, exact: true });

const expectBeside = async (board: Board, id: string) => {
  await expect(contextOf(board, id).getAttribute("data-askboard-context")).resolves.toBe("beside");
  const [column, text, whole] = [
    await box(contextOf(board, id)),
    await box(heading(board, id)),
    await box(card(board, id)),
  ];
  expect(Math.round(column.width)).toBeGreaterThanOrEqual(COLUMN_WIDTH);
  expect(column.x).toBeGreaterThan(text.x + text.width - 1);
  expect(column.x + column.width).toBeLessThanOrEqual(whole.x + whole.width + 1);
};

const expectInline = async (board: Board, id: string) => {
  await expect(contextOf(board, id).getAttribute("data-askboard-context")).resolves.toBe("inline");
  const [column, text, whole] = [
    await box(contextOf(board, id)),
    await box(heading(board, id)),
    await box(card(board, id)),
  ];
  expect(column.y).toBeGreaterThan(text.y);
  expect(column.width).toBeGreaterThan(whole.width / 2);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the question card's context`, () => {
    const { start } = useEngine(engine);

    test(
      "a resolved excerpt splits the card: the context column beside the question, titled and with the control",
      async () => {
        const run = await start(scenario(contextAsk));
        const board = await openBoard(run, IDS);
        await expectBeside(board, "fix");
        const column = contextOf(board, "fix");
        await column.getByText("Excerpt and references", { exact: true }).waitFor();
        await place(board, "fix", "Beside").waitFor();
        expect(await place(board, "fix", "Beside").getAttribute("aria-pressed")).toBe("true");
        expect(await place(board, "fix", "Inline").getAttribute("aria-pressed")).toBe("false");
        // Excerpts first, then references.
        const kinds = await column
          .locator("[data-askboard-item]")
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-askboard-item")));
        expect(kinds).toEqual(["fix-spec", "fix-src", "fix-pr"]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an excerpt the agent wrote splits the card too",
      async () => {
        const run = await start(scenario(contextAsk));
        const board = await openBoard(run, IDS);
        await expectBeside(board, "settings");
        await place(board, "settings", "Inline").waitFor();
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "every excerpt unresolved: the card takes the full width, the pointer and the reference inline, no control",
      async () => {
        const run = await start(scenario(contextAsk));
        const board = await openBoard(run, IDS);
        await expectInline(board, "rollout");
        const column = contextOf(board, "rollout");
        await column.getByText("Unresolved", { exact: false }).first().waitFor();
        await column.getByText("docs/missing.md#L1-L3").first().waitFor();
        expect(await column.getByRole("button", { name: "Inline", exact: true }).count()).toBe(0);
        expect(await column.getByRole("button", { name: "Beside", exact: true }).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a widget spans both columns below the split",
      async () => {
        const run = await start(scenario(contextAsk));
        const board = await openBoard(run, IDS);
        const image = card(board, "fix").locator('[data-askboard-item="fix-shot"]');
        await image.waitFor();
        const [shown, column, whole] = [
          await box(image),
          await box(contextOf(board, "fix")),
          await box(card(board, "fix")),
        ];
        expect(shown.y).toBeGreaterThanOrEqual(column.y + column.height - 1);
        expect(shown.width).toBeGreaterThan(whole.width - 40);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Beside | Inline moves one question's context, for that question only, and the choice survives a reload and a takeover",
      async () => {
        const run = await start(scenario(contextAsk));
        const first = await openBoard(run, IDS);
        await place(first, "fix", "Inline").click();
        await expectInline(first, "fix");
        await expectBeside(first, "settings");
        await mirrored(
          run,
          (record) => record.questions.fix?.context === "inline",
          "fix placed inline",
        );
        await first.page.reload();
        for (const id of IDS) await card(first, id).waitFor({ timeout: STEP_TIMEOUT_MS * 6 });
        await eventually(
          async () =>
            (await contextOf(first, "fix").getAttribute("data-askboard-context")) === "inline",
          "inline after the reload",
        );
        await expectBeside(first, "settings");
        const second = await openBoard(run, IDS);
        await first.banner(/moved/i).first().waitFor({ timeout: STEP_TIMEOUT_MS });
        await expectInline(second, "fix");
        await expectBeside(second, "settings");
        expect(sentActs(run)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Inline back to Beside restores the split and leaves nothing in the draft record",
      async () => {
        const run = await start(scenario(contextAsk));
        const board = await openBoard(run, IDS);
        await place(board, "fix", "Inline").click();
        await expectInline(board, "fix");
        await place(board, "fix", "Beside").click();
        await expectBeside(board, "fix");
        await mirrored(run, (record) => record.questions.fix === undefined, "no entry for fix");
        expect(sentDrafts(run).at(-1)?.questions).toEqual({});
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a placement alone arms no leave-page prompt and copies nothing",
      async () => {
        const run = await start(scenario(contextAsk));
        const board = await openBoard(run, IDS);
        expect(await promptArmed(board)).toBe(false);
        await place(board, "fix", "Inline").click();
        await mirrored(run, (record) => record.questions.fix?.context === "inline", "inline");
        expect(await promptArmed(board)).toBe(false);
        // A note is work: the prompt arms, and the placement stays out of what it lists.
        await card(board, "fix")
          .getByRole("textbox", { name: "Note for the agent (optional)" })
          .fill("check");
        await mirrored(run, (record) => record.questions.fix?.note === "check", "the note");
        expect(await promptArmed(board)).toBe(true);
        expect(sentActs(run)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a single-question board still splits, and Answer stays its one primary",
      async () => {
        const run = await start(scenario(singleContextAsk));
        const board = await openBoard(run, ["only"]);
        await expectBeside(board, "only");
        await buttonOf(board, "only", "Answer").waitFor();
      },
      TEST_TIMEOUT_MS,
    );
  });
}
