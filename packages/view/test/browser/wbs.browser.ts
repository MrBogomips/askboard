// The work breakdown on the board, in each engine, on the widget host (molecules design decisions
// 14 and 15; view spec, "WBS layout", "WBS opening depth"): the expanded UJ-2 question, whose Tree
// has `pert`, counts as visible; the Tree's header names the work package, the three estimates and
// the two values; each leaf shows its estimates and each row its expected effort and spread with
// the "d" affix, read from the board's graph; a parent shows no estimate; a Total row ends the
// grid when there are several top-level packages; the Tree opens to its `openDepth`; agent markup
// shows as text; and no CSP violation is reported.

import { describe, expect, test } from "bun:test";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import { MARKUP_LABEL } from "./fixtures/markup-document.ts";
import {
  cellTexts,
  oneLevelDocument,
  oneTopLevelDocument,
  totalRow,
  uxNamedDocument,
  WBS_HEADERS,
  wbsQuestion,
} from "./fixtures/wbs-documents.ts";
import { eventually, LOAD_TIMEOUT_MS, QUIET_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { chevronAngle, rightGaps, treeGridOf } from "./harness/tree-grid.ts";
import { FIXTURE_ROWS, readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

/** A row's level, place and expansion, as `FIXTURE_ROWS` gives them. */
const rowFacts = (rows: ReturnType<typeof treeGridOf>["rows"]) =>
  rows.evaluateAll((elements) =>
    elements.map((row) => ({
      id: row.getAttribute("data-node-id"),
      level: row.getAttribute("aria-level"),
      posinset: row.getAttribute("aria-posinset"),
      setsize: row.getAttribute("aria-setsize"),
      expanded: row.getAttribute("aria-expanded"),
    })),
  );

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the WBS's layout`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the expanded UJ-2 question counts as visible, its ready message recorded, with no CSP violation",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await eventually(
          () => run.messages.length > 0,
          "the question's ready message",
          LOAD_TIMEOUT_MS,
        );
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: wbsQuestion.id }]);
        const card = run.board.question(wbsQuestion.id);
        expect(await card.getAttribute("aria-busy")).toBe("false");
        expect(await card.getByRole("alert").count()).toBe(0);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the header names the work package, the estimates and the values; UX design, Design and the Total row show theirs",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        // The header row is in upper case, so its text is read without the rendering's case.
        expect(await tree.headers.allTextContents()).toEqual(WBS_HEADERS);
        expect(await cellTexts(tree.row("ux"))).toEqual([
          "UX design",
          "3 d",
          "5 d",
          "10 d",
          "5.5 d",
          "1.2 d",
        ]);
        // A parent's own estimates PERT ignores: it shows none, only its roll-ups.
        expect(await cellTexts(tree.row("design"))).toEqual([
          "Design",
          "",
          "",
          "",
          "14.0 d",
          "1.6 d",
        ]);
        // The Total row is the treegrid's last row, read-only, with no level.
        const total = totalRow(tree);
        expect(await cellTexts(total)).toEqual(["Total", "", "", "", "40.7 d", "3.2 d"]);
        expect(await total.getAttribute("aria-level")).toBeNull();
        expect(await total.getAttribute("data-node-id")).toBeNull();
        expect(await tree.grid.getByRole("row").count()).toBe(1 + FIXTURE_ROWS.length + 1);
        const last = tree.grid.getByRole("row").last();
        expect(await last.getAttribute("data-total-row")).not.toBeNull();
        // Estimates and values right-aligned in their cells.
        const numbers = tree.grid.locator('[data-cell]:not([data-cell="0"])');
        const gaps = await rightGaps(numbers);
        expect(gaps.length).toBeGreaterThan(0);
        expect(gaps.every((gap) => gap === 0)).toBe(true);
        expect(await rightGaps(total.getByRole("gridcell").filter({ hasText: " d" }))).toEqual([
          0, 0,
        ]);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with openDepth 2, Design and Build show open chevrons and their six children",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        expect(await rowFacts(tree.rows)).toEqual(FIXTURE_ROWS);
        expect(await chevronAngle(tree.chevron("design"))).toBe(90);
        expect(await chevronAngle(tree.chevron("build"))).toBe(90);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with openDepth 1, only Design and Build show, with closed chevrons, their roll-ups and the Total unchanged",
      async () => {
        const run = await host(dist, oneLevelDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        expect(await rowFacts(tree.rows)).toEqual([
          { id: "design", level: "1", posinset: "1", setsize: "2", expanded: "false" },
          { id: "build", level: "1", posinset: "2", setsize: "2", expanded: "false" },
        ]);
        expect(await chevronAngle(tree.chevron("design"))).toBe(0);
        expect(await chevronAngle(tree.chevron("build"))).toBe(0);
        expect(await cellTexts(tree.row("design"))).toEqual([
          "Design",
          "",
          "",
          "",
          "14.0 d",
          "1.6 d",
        ]);
        expect(await cellTexts(totalRow(tree))).toEqual(["Total", "", "", "", "40.7 d", "3.2 d"]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a single top-level package shows the totals in its own row, and there is no Total row",
      async () => {
        const run = await host(dist, oneTopLevelDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        expect(await cellTexts(tree.row("project"))).toEqual([
          "Customer portal SOW",
          "",
          "",
          "",
          "40.7 d",
          "3.2 d",
        ]);
        expect(await totalRow(tree).count()).toBe(0);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "markup in a work package's name shows as text, and no element is made from it",
      async () => {
        const run = await host(dist, uxNamedDocument(MARKUP_LABEL));
        await readyIn(run);
        const tree = treeGridOf(run.board);
        expect((await cellTexts(tree.row("ux")))[0]).toBe(MARKUP_LABEL);
        const view = await run.board.viewFrame();
        const created = await view.evaluate(() =>
          [...document.querySelectorAll('img[src="x"], [onerror]')].map((element) =>
            element.outerHTML.slice(0, 80),
          ),
        );
        expect(created).toEqual([]);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
