import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA_IDS } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import type { Locator } from "playwright";
import { launchBrowser, openRealBoard, type RealBoard, STEP_TIMEOUT_MS } from "./real-board.ts";
import { cleanUp, RUNTIME, type Session, startSession } from "./session.ts";

// UJ-2 with the five editing features (widget-editing-plus, task 6.1; view spec, "Gantt plan
// duration resize", "Tree bulk percentage adjustment panel", "Tree drag has a keyboard path and is
// a change"): the built session process on Bun or Node 24, driven over stdio by the MCP client. An
// agent sends the approved `asks/uj2-wbs-gantt.json` unchanged; on the real board page in Chromium
// the user widens the TASK column, switches the critical path off, lengthens the portal's bar with
// the pointer, raises the billing's estimates by 10% and drags `reporting` before `billing`, then
// answers `plan`, postpones `erp-export` and submits. `collect` returns an answer event that
// validates as the output format's `collectResult` and holds the plan's `set` of a duration, the
// Tree's `set` operations on `billing` and one `move`, with `derived` values; the column and the
// switch, view state, leave nothing in it. Run it with run.ts beside it.

console.error(`conformance: ${RUNTIME}, widget editing`);

afterEach(cleanUp);

const ASK = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "contract",
  "test",
  "fixtures",
  "asks",
  "uj2-wbs-gantt.json",
);

type Json = Record<string, unknown>;
type Change = { readonly op: string; readonly target: string; readonly value?: unknown };
type Event = Json & { readonly changes?: readonly Change[]; readonly derived?: Json };
type Collected = Json & {
  readonly asks: readonly (Json & { readonly events: readonly Event[] })[];
};

const WAIT_MS = 10_000;
const COLUMN_STEP_PX = 60;
const BAR_STEP_PX = 90;

const checked = (outcome: { text: string; json: unknown }): Json => {
  expect(outcome.text).toStartWith("{");
  const validation = validateAgainst(SCHEMA_IDS.collectResult, outcome.json);
  expect(validation.ok ? [] : validation.problems).toEqual([]);
  return outcome.json as Json;
};

/** Collects until the ask holds its two events, the answer and the postponement. */
const collectedAnswer = async (session: Session, askId: string, epoch: string) => {
  const until = Date.now() + WAIT_MS;
  for (;;) {
    const result = checked(
      await session.call("collect", { asks: [{ askId, after: `${epoch}.0` }] }),
    ) as Collected;
    if ((result.asks[0]?.events.length ?? 0) >= 2 || Date.now() > until) return result;
    await Bun.sleep(100);
  }
};

/** The page coordinates of a locator's centre. */
const centreOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("the element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, height: box.height };
};

/** Presses the pointer at a locator's centre and moves it sideways by `dx`, then releases. */
const dragSideways = async (board: RealBoard, from: Locator, dx: number): Promise<void> => {
  const { x, y } = await centreOf(from);
  const { mouse } = board.page;
  await mouse.move(x, y);
  await mouse.down();
  await mouse.move(x + dx, y, { steps: 6 });
  await mouse.up();
};

/** Drags a Tree row by its handle to the top quarter of another row. */
const dropBefore = async (board: RealBoard, nodeId: string, targetId: string): Promise<void> => {
  const row = (id: string) => board.view.locator(`[data-node-id="${id}"]`);
  const handle = await centreOf(row(nodeId).locator("[data-drag-handle]"));
  const { mouse } = board.page;
  await mouse.move(handle.x, handle.y);
  await mouse.down();
  await mouse.move(handle.x + 12, handle.y - 4, { steps: 4 });
  const target = await row(targetId).boundingBox();
  if (target === null) throw new Error(`${targetId} has no row`);
  await mouse.move(target.x + target.width / 2, target.y + target.height * 0.1, { steps: 10 });
  await mouse.up();
};

/** The five edits, on the real board page, with the pointer. */
const makeTheEdits = async (board: RealBoard): Promise<void> => {
  await board.view.getByRole("treegrid").waitFor({ timeout: STEP_TIMEOUT_MS });
  const edge = board.view.getByRole("separator", { name: "Resize the Task column" });
  await dragSideways(board, edge, COLUMN_STEP_PX);
  const critical = board.view.getByRole("switch", { name: "Critical path" });
  await critical.click();
  expect(await critical.getAttribute("aria-checked")).toBe("false");
  await dragSideways(board, board.view.locator('[data-gantt-handle="portal"]'), BAR_STEP_PX);
  await board.view.locator('[data-node-id="billing"] [data-select]').click();
  await board.view.getByRole("button", { name: "Adjust by %…", exact: true }).click();
  const panel = board.view.getByRole("dialog");
  await panel.getByLabel("Percentage").fill("+10");
  await panel.getByRole("button", { name: "Apply" }).click();
  await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
  await dropBefore(board, "reporting", "billing");
  await board.view
    .locator('[data-node-id="reporting"] [data-change="moved"]')
    .waitFor({ timeout: STEP_TIMEOUT_MS });
  await board.buttonIn("plan", "Answer").click();
};

describe("UJ-2 with the five editing features on the real session process", () => {
  test("the user's duration, adjustment and move reach the agent as changes and derived values; the column and the switch do not", async () => {
    const ask = JSON.parse(readFileSync(ASK, "utf8")) as Json;
    const askId = ask.askId as string;
    const session = await startSession();
    const asked = await session.call("ask", ask);
    const epoch = (asked.json as { epoch: string }).epoch;
    const [link] = await session.nextOpened();
    const browser = await launchBrowser();
    try {
      const board = await openRealBoard(browser, link ?? "");
      await makeTheEdits(board);
      await board.buttonIn("erp-export", "Postpone").click();
      await board.barButton("Submit").click();

      const collected = await collectedAnswer(session, askId, epoch);
      const [entry] = collected.asks;
      expect(entry).toMatchObject({ askId, state: "answered" });
      const [answer] = entry?.events ?? [];
      expect(answer).toMatchObject({ type: "answer", questionId: "plan" });
      const changes = answer?.changes ?? [];
      // The plan's one request of a duration, longer than the estimates' 13 days.
      const durations = changes.filter(({ target }) => /^schedule\.[^.]+\.duration$/.test(target));
      expect(durations).toHaveLength(1);
      expect(durations[0]).toMatchObject({ op: "set", target: "schedule.portal.duration" });
      expect(durations[0]?.value).toBeGreaterThan(13);
      // The Tree's: sets on the billing's estimates only, and one move of `reporting`.
      const treeSets = changes.filter(({ target }) => target.startsWith("wbs.billing."));
      expect(treeSets.length).toBeGreaterThan(0);
      expect(treeSets.every(({ op }) => op === "set")).toBe(true);
      expect(changes.filter(({ op }) => op === "move")).toEqual([
        expect.objectContaining({ target: "wbs.reporting" }),
      ]);
      // Nothing of the view state, and the derived values of the edited plan.
      expect(JSON.stringify(changes)).not.toMatch(/column|critical|width/i);
      expect(Object.keys(answer?.derived ?? {}).length).toBeGreaterThan(0);
      expect(board.errors).toEqual([]);
    } finally {
      await browser.close();
    }
    expect(await session.end()).toBe(0);
  });
});
