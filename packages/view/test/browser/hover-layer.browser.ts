// The shared hover, cursor and focus layer, in each engine (widget-editing-plus spec, "Hover
// cursors and looks" and "No hover feedback where nothing responds"; review F-01): the cursor and
// the hover look of a toolbar button, a chevron, an option row and an editable cell, a disabled
// control's none, the dark scheme's tokens, and the read-only Tree's.

import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument, treeBoardDocument } from "@askboard/contract/fixtures";
import type { Locator } from "playwright";
import type { ViewUpdate } from "../../src/view-protocol.ts";
import { plan } from "./fixtures/tree-documents.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { tokenColor } from "./harness/design-colors.ts";
import { enginesFrom } from "./harness/engines.ts";
import { enabledTools, tabIntoTree, treeGridOf } from "./harness/tree-grid.ts";
import { focusPortal, readyIn } from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

type Look = {
  readonly cursor: string;
  readonly background: string;
  readonly border: string;
  readonly outline: string;
};

/** The computed cursor and hover look of an element under the pointer. */
const lookOf = (locator: Locator): Promise<Look> =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      cursor: style.cursor,
      background: style.backgroundColor,
      border: style.borderTopColor,
      outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
    };
  });

const hovered = async (locator: Locator): Promise<Look> => {
  await locator.hover();
  return lookOf(locator);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the hover, cursor and focus layer`, () => {
    const { host } = useWidgetHost(engine);

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in the ${scheme} scheme, a button, a chevron and an editable cell show a cursor and a hover look; a disabled tool and a cell that takes no edit show none`,
        async () => {
          const run = await host(dist, treeBoardDocument, { colorScheme: scheme });
          await readyIn(run);
          const tree = treeGridOf(run.board);
          // Nothing is current yet: the row tools are disabled and do not respond to the pointer.
          const deleteTool = tree.tool("Delete");
          const resting = await lookOf(deleteTool);
          const disabled = await hovered(deleteTool);
          expect(disabled.cursor).toBe("not-allowed");
          expect(disabled.background).toBe(resting.background);
          expect(disabled.border).toBe(resting.border);
          // Once a row is current, a tool shows the strong border on the card fill.
          await focusPortal(run, tree);
          const tool = await hovered(tree.tool("Move down"));
          expect(tool.cursor).toBe("pointer");
          expect(tool.border).toBe(tokenColor("border-strong", scheme));
          expect(tool.background).toBe(tokenColor("card", scheme));
          // A chevron points; an editable cell is a text cursor with the 1px strong outline.
          expect((await hovered(tree.chevron("design"))).cursor).toBe("pointer");
          const editable = await hovered(tree.cell("portal", 1));
          expect(editable.cursor).toBe("text");
          expect(editable.outline).toBe(`1px solid ${tokenColor("border-strong", scheme)}`);
          // A column header takes no edit: no text cursor, no outline.
          const header = await hovered(tree.headers.first());
          expect(header.cursor).not.toBe("text");
          expect(header.outline).not.toContain("1px solid");
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "an option row takes a pointer and the muted fill",
      async () => {
        const run = await host(dist, plainChoiceBoardDocument);
        const option = run.board.option("SQLite");
        await option.waitFor({ timeout: STEP_TIMEOUT_MS });
        const look = await hovered(option);
        expect(look.cursor).toBe("pointer");
        expect(look.background).toBe(tokenColor("muted", "light"));
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "keyboard focus shows the ring, which hover alone does not give",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        expect((await lookOf(tree.cell("portal", 1))).outline).not.toContain("2px solid");
        await tree.cell("portal", 1).hover();
        expect((await lookOf(tree.cell("portal", 1))).outline).not.toContain("2px solid");
        await tabIntoTree(run.board, plan.props.text);
        const ring = await tree.row("design").evaluate((row) => getComputedStyle(row).outlineWidth);
        expect(ring).toBe("2px");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a read-only Tree shows no hover feedback on its cells and tools",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        const update: ViewUpdate = { type: "state", state: openStateOf(treeBoardDocument) };
        await run.update({ ...update, lock: "moved" });
        await eventually(
          async () => (await enabledTools(tree.tools)).length === 0,
          "every tool disabled",
        );
        const cell = await hovered(tree.cell("portal", 1));
        expect(cell.cursor).not.toBe("text");
        expect(cell.outline).not.toContain("1px solid");
        expect((await hovered(tree.tool("Move down"))).cursor).toBe("not-allowed");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
