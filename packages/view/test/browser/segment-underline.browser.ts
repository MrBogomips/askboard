// The segmented controls' one look, in each engine (widget-editing-plus task 1.3; review F-17):
// the chosen segment of the header's Theme and Density, of the settings panel and of the delivery
// switch carries the 2px `primary` underline and the semibold weight, and the others do not.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import { STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { tokenColor } from "./harness/design-colors.ts";
import { enginesFrom } from "./harness/engines.ts";
import { buttonOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const ask = { ...twoAsk, askId: "two-segments-t1f17" };

const underline = (segment: Locator) =>
  segment.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      width: style.borderBottomWidth,
      colour: style.borderBottomColor,
      weight: style.fontWeight,
    };
  });

const CHOSEN = { width: "2px", colour: tokenColor("primary", "light"), weight: "600" };

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the segmented controls' underline`, () => {
    const { start } = useEngine(engine);

    test(
      "the header's Theme and Density, the settings panel and the delivery switch underline the chosen segment only",
      async () => {
        const run = await start({ ...lifecycleScenario(ask, dist), config: {} });
        const board = await openBoard(run, ["database", "cache"]);
        await buttonOf(board, "database", "Answer").waitFor({ timeout: STEP_TIMEOUT_MS });
        const header = board.view.getByRole("banner");
        for (const [group, chosen, other] of [
          ["Theme", "System", "Dark"],
          ["Density", "Compact", "Comfortable"],
        ] as const) {
          const radios = header.getByRole("radiogroup", { name: group });
          expect(await underline(radios.getByRole("radio", { name: chosen }))).toEqual(CHOSEN);
          const resting = await underline(radios.getByRole("radio", { name: other }));
          expect(resting.width).toBe("2px");
          expect(resting.colour).not.toBe(CHOSEN.colour);
          expect(resting.weight).not.toBe("600");
        }
        // The delivery switch of the bottom bar.
        const delivery = board.view.getByRole("group", { name: /delivery/i });
        const pressed = delivery.locator('[aria-pressed="true"]');
        expect(await underline(pressed)).toEqual(CHOSEN);
        // The settings panel, on the board page.
        await header.getByRole("button", { name: "Settings", exact: true }).click();
        const panel = board.page
          .getByRole("complementary", { name: "Settings" })
          .getByRole("radiogroup", { name: "Theme" });
        await panel.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await underline(panel.locator('[aria-checked="true"]'))).toEqual(CHOSEN);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
