import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RESULT_VERSIONS, SCHEMA_IDS } from "@askboard/contract";
import { uj2ExpandedEditedValues } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { launchBrowser, openRealBoard, type RealBoard, STEP_TIMEOUT_MS } from "./real-board.ts";
import { cleanUp, GIT_USER, RUNTIME, type Session, startSession } from "./session.ts";
import {
  enterField,
  expectNewNode,
  pressAt,
  pressTool,
  tabUntil,
  treeFocus,
  typeIn,
} from "./widget-keys.ts";

// The widget answers' end-to-end scenario (widget-answers, task 6.2; design decision 9, End to end;
// UJ-2): the built session process on Bun or Node 24, driven over stdio by the MCP client. An agent
// sends the approved `asks/uj2-wbs-gantt.json` unchanged; on the real board page in Chromium the
// user makes the approved edits of the work breakdown with the keyboard, marks `plan` ready,
// postpones `erp-export` and submits; `collect` returns the approved answer once the epoch, the
// cursors, `who` and `when` are normalized as E1's suite does, the `changes` compared as a set and
// the `derived` as a map; `fetch` of `wbs` and `schedule` holds the edited values with no expanded
// ID. Run it with run.ts beside it.

console.error(`conformance: ${RUNTIME}, widget answers`);

afterEach(cleanUp);

const FIXTURES = join(import.meta.dir, "..", "..", "..", "contract", "test", "fixtures");
const approved = (kind: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(FIXTURES, kind, "uj2-wbs-gantt.json"), "utf8"));

type Json = Record<string, unknown>;
type Event = Json & { readonly changes?: readonly unknown[]; readonly derived?: Json };
type Collected = Json & {
  readonly epoch: string;
  readonly asks: readonly (Json & { readonly events: readonly Event[] })[];
};

const WAIT_MS = 10_000;

/** A tool result's JSON, checked against the contract's schema. */
const checked = (schema: keyof typeof SCHEMA_IDS, outcome: { text: string; json: unknown }) => {
  expect(outcome.text).toStartWith("{");
  const validation = validateAgainst(SCHEMA_IDS[schema], outcome.json);
  expect(validation.ok ? [] : validation.problems).toEqual([]);
  return outcome.json as Json;
};

/** Collects until the ask holds its two events, the answer and the postponement. */
const collectedAnswer = async (session: Session, askId: string, epoch: string) => {
  const until = Date.now() + WAIT_MS;
  for (;;) {
    const result = checked(
      "collectResult",
      await session.call("collect", { asks: [{ askId, after: `${epoch}.0` }] }),
    ) as Collected;
    if ((result.asks[0]?.events.length ?? 0) >= 2 || Date.now() > until) return result;
    await Bun.sleep(100);
  }
};

// The session process's words in a result as the approved example writes them: its epoch and
// cursors, and the contract's versions of the day, which the example gives as 1.0.
const asExample = (value: unknown, epoch: string): Json => {
  const { versions } = approved("answers") as { versions: unknown };
  return JSON.parse(
    JSON.stringify(value)
      .replaceAll(
        `"versions":${JSON.stringify(RESULT_VERSIONS)}`,
        `"versions":${JSON.stringify(versions)}`,
      )
      .replaceAll(`"${epoch}"`, '"k3x9"')
      .replaceAll(`"${epoch}.`, '"k3x9.'),
  );
};

/** The user's edits of the work breakdown, by key only, and "Answer" on `plan` (the approved ones). */
const editAndMarkReady = async (board: RealBoard): Promise<void> => {
  await board.view.getByRole("treegrid").waitFor({ timeout: STEP_TIMEOUT_MS });
  const planAnswer = board.buttonIn("plan", "Answer");
  await tabUntil(board, async () => (await treeFocus(board)) !== undefined, "the Tree");
  expect(await treeFocus(board)).toEqual({ nodeId: "design" });
  // `ux`: most likely, 5 to 4.
  await pressAt(board, "ArrowDown", { nodeId: "ux" });
  for (const cell of [0, 1, 2]) await pressAt(board, "ArrowRight", { nodeId: "ux", cell });
  await enterField(board, "4", { nodeId: "ux", cell: 2 });
  // `portal`: renamed, and its three estimates changed.
  for (const nodeId of ["architecture", "prototype", "build", "portal"]) {
    await pressAt(board, "ArrowDown", { nodeId, cell: 2 });
  }
  await pressAt(board, "Home", { nodeId: "portal", cell: 0 });
  await typeIn(board, "Enter", "Customer portal: accounts");
  await pressAt(board, "Enter", { nodeId: "portal", cell: 0 });
  for (const [cell, text] of [
    [1, "4"],
    [2, "6"],
    [3, "10"],
  ] as const) {
    await pressAt(board, "ArrowRight", { nodeId: "portal", cell });
    await enterField(board, text, { nodeId: "portal", cell });
  }
  // `u-1`, split off after `portal` with "Add node", which gives it the portal's predecessors.
  // The toolbar's Tab stop is "Select all", which the Tab into the tree passed.
  await pressTool(board, "Shift+Tab", "Select all");
  await pressTool(board, "Home", "Add node");
  await board.page.keyboard.press("Enter");
  await expectNewNode(board, "u-1");
  await board.page.keyboard.type("Customer portal: dashboards");
  await pressAt(board, "Enter", { nodeId: "u-1", cell: 0 });
  for (const [cell, text] of [
    [1, "4"],
    [2, "7"],
    [3, "12"],
  ] as const) {
    await pressAt(board, "ArrowRight", { nodeId: "u-1", cell });
    await enterField(board, text, { nodeId: "u-1", cell });
  }
  // `billing`: the pessimistic estimate, 15 to 21.
  await pressAt(board, "ArrowDown", { nodeId: "billing", cell: 3 });
  await enterField(board, "21", { nodeId: "billing", cell: 3 });
  // Tab on to "Answer", then Enter.
  expect(await planAnswer.isEnabled()).toBe(true);
  await tabUntil(
    board,
    () => planAnswer.evaluate((button) => button === button.ownerDocument.activeElement),
    "Answer",
  );
  await board.page.keyboard.press("Enter");
};

describe("UJ-2 on the real session process", () => {
  test("the approved ask, the approved edits on the board, the approved answer from collect and the edited values from fetch", async () => {
    const ask = approved("asks");
    const askId = ask.askId as string;
    const session = await startSession();
    const asked = checked("askResult", await session.call("ask", ask));
    const epoch = asked.epoch as string;
    const [link] = await session.nextOpened();
    expect(link).toBe(asked.board as string);
    const browser = await launchBrowser();
    try {
      const board = await openRealBoard(browser, link ?? "");
      await editAndMarkReady(board);
      // `erp-export` is left for later and the board submits.
      await board.buttonIn("erp-export", "Postpone").click();
      await board.barButton("Submit").click();

      const collected = await collectedAnswer(session, askId, epoch);
      const [entry] = collected.asks;
      const [answer] = entry?.events ?? [];
      const expected = approved("answers") as {
        versions: unknown;
        asks: { events: Event[] }[];
      };
      const [want] = expected.asks[0]?.events ?? [];
      // The changes as a set, the derived values as a map, the rest as the example has it.
      expect(answer?.changes).toHaveLength(want?.changes?.length ?? -1);
      expect(answer?.changes).toEqual(expect.arrayContaining([...(want?.changes ?? [])]));
      expect(answer?.derived).toEqual(want?.derived ?? {});
      const strip = (event: Event | undefined) => {
        const { changes, derived, who, when, ...rest } = event ?? {};
        return rest;
      };
      const normalized = asExample(collected, epoch) as Collected;
      const [shown] = normalized.asks[0]?.events ?? [];
      expect(shown).toMatchObject(strip(want));
      expect(shown?.who).toBe(GIT_USER);
      expect(typeof shown?.when).toBe("string");
      expect(normalized.asks[0]?.events.slice(1)).toEqual(expected.asks[0]?.events.slice(1) ?? []);
      expect(normalized).toMatchObject({
        versions: expected.versions,
        epoch: "k3x9",
        asks: [{ askId, state: "answered", cursor: "k3x9.2" }],
      });

      // The agent fetches each item and finds the user's values under the reference's ID.
      // The plan names its work breakdown by the reference, `wbs`, not by the expanded `wbs__tree`.
      const items: [string, string, string, Json][] = [
        ["wbs", "tree", "wbs__tree", {}],
        ["schedule", "gantt", "schedule__plan", { workPackages: "wbs" }],
      ];
      for (const [itemId, type, expanded, named] of items) {
        const outcome = await session.call("fetch", { askId, itemId });
        const fetched = checked("fetchResult", outcome);
        expect(fetched).toMatchObject({
          state: "answered",
          item: { type, id: itemId, questionId: "plan" },
        });
        const { props } = fetched.item as { props: unknown };
        expect(props).toEqual({
          ...(uj2ExpandedEditedValues[expanded as keyof typeof uj2ExpandedEditedValues] as Json),
          ...named,
        });
        expect(outcome.text).not.toContain("__");
      }
      expect(board.errors).toEqual([]);
    } finally {
      await browser.close();
    }
    expect(await session.end()).toBe(0);
  });
});
