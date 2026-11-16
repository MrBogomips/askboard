// Agent and user text with a bidirectional override, in the browser (answering-flow-visual, review
// X-21 and X-22; AD-8): an option's label and description each sit in their own isolated element, so
// "Recommended" and the description keep their place in reading order; the answered look's line
// draws each chosen label and the Other… text in an element of its own, so a label's override
// cannot reorder the text after it. Order is read from the layout, never from the text alone.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsSent,
  answerOf,
  card,
  lifecycleScenario,
  openBoard,
  optionOf,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const OVERRIDE = "‮";
const ask = {
  askId: "bidi-text-a1",
  title: "Isolated text",
  items: [
    {
      type: "question",
      id: "bidi",
      props: {
        text: "Which should ship?",
        header: "Release",
        multiSelect: true,
        allowOther: true,
        options: [
          {
            label: `Postgres${OVERRIDE}`,
            description: "Relational and familiar",
            recommended: true,
          },
          { label: `Ship${OVERRIDE} it`, description: "Embedded" },
        ],
      },
    },
  ],
};

const box = async (locator: Locator) => {
  const rect = await locator.first().boundingBox();
  if (rect === null) throw new Error(`no box for ${locator}`);
  return rect;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: agent text with an override`, () => {
    const { start } = useEngine(engine);

    test(
      "an option's label with an override keeps 'Recommended' and the description after it, in reading order",
      async () => {
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["bidi"]);
        const bidi = card(board, "bidi");
        const label = bidi.locator("bdi", { hasText: "Postgres" });
        const badge = bidi.getByText("Recommended", { exact: true });
        const description = bidi.locator("bdi", { hasText: "Relational and familiar" });
        const [l, b, d] = [await box(label), await box(badge), await box(description)];
        // Left to right on one line, or the next line: never before the label's start.
        const after = (first: typeof l, second: typeof l) =>
          second.y >= first.y + first.height - 1 || second.x >= first.x + first.width - 1;
        expect(after(l, b)).toBe(true);
        expect(after(b, d)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the answer's line keeps the Other… text readable in order after a label with an override",
      async () => {
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["bidi"]);
        await optionOf(board, "bidi", `Ship${OVERRIDE} it`).click({ timeout: STEP_TIMEOUT_MS });
        await optionOf(board, "bidi", "Other…").click({ timeout: STEP_TIMEOUT_MS });
        await card(board, "bidi").getByRole("textbox", { name: "Other…" }).fill("approve");
        await answerOf(board, "bidi").click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, 1);
        const line = card(board, "bidi").locator("[data-askboard-answer-line]");
        await line.waitFor({ timeout: STEP_TIMEOUT_MS });
        const ship = line.locator("bdi", { hasText: "Ship" });
        const approve = line.locator("bdi", { hasText: "approve" });
        await eventually(
          async () => (await approve.count()) === 1,
          "the Other… text in its own element",
        );
        const [s, a] = [await box(ship), await box(approve)];
        expect(a.x).toBeGreaterThanOrEqual(s.x + s.width - 1);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
