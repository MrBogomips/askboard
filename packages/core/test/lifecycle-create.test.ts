import { describe, expect, test } from "bun:test";
import { lifecycleBoardDocument } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { fakeClock } from "./fakes.ts";
import {
  areasAsk,
  boardOf,
  created,
  FLAT_ID,
  flatAsk,
  LIFECYCLE_ID,
  statesOf,
} from "./lifecycle-fakes.ts";

// Core spec: Creating an ask, for several questions and areas (ask-lifecycle, task 2.1).

describe("creating an ask of several questions", () => {
  test("an ask with areas holds both areas in order, every question at rev 1 and open", async () => {
    const { core } = await created(areasAsk());
    const board = boardOf(core, LIFECYCLE_ID);
    expect(board.document).toEqual(lifecycleBoardDocument);
    expect(validateAgainst("urn:askboard:board-document:board-document", board.document).ok).toBe(
      true,
    );
    expect(board.state).toBe("waiting");
    expect(board.questions.map(({ itemId, rev, state }) => [itemId, rev, state])).toEqual([
      ["region", 1, "open"],
      ["payment", 1, "open"],
      ["analytics", 1, "open"],
      ["rollout", 1, "open"],
      ["erp-export", 1, "open"],
    ]);
  });

  test("questions without areas keep the order the ask gives", async () => {
    const { core } = await created(flatAsk());
    const { document } = boardOf(core, FLAT_ID);
    expect(document.items.map((item) => [item.type, item.id])).toEqual([
      ["question", "q1"],
      ["question", "q2"],
      ["question", "q3"],
    ]);
    expect(statesOf(core, FLAT_ID)).toEqual({ q1: "open", q2: "open", q3: "open" });
  });

  test("the ask's first cursor is <epoch>.0 and its state waiting", async () => {
    const { core } = await created(areasAsk());
    expect(core.read(LIFECYCLE_ID, `${core.epoch}.0`)).toEqual({
      kind: "events",
      askId: LIFECYCLE_ID,
      state: "waiting",
      cursor: `${core.epoch}.0`,
      events: [],
      groups: [],
    });
  });

  test("the derived title comes from the first question in board order, inside an area", async () => {
    const { title: _, ...untitled } = areasAsk();
    const { core } = await created(untitled);
    expect(boardOf(core, LIFECYCLE_ID).document.title).toBe(
      "Which regions does the first release of the new checkout cover?",
    );
  });

  test("the presentation and delivery the ask requests reach the board document, and only then", async () => {
    const { core } = await created(flatAsk());
    const { document } = boardOf(core, FLAT_ID);
    expect("presentation" in document || "delivery" in document).toBe(false);
    const requesting = await created({ ...flatAsk(), presentation: "one-per-view" });
    expect(boardOf(requesting.core, FLAT_ID).document.presentation).toBe("one-per-view");
  });

  test("E1's board view lists every question, areas' included, in board order", async () => {
    const { core } = await created(areasAsk());
    expect(core.board(LIFECYCLE_ID)?.questions.map((question) => question.itemId)).toEqual([
      "region",
      "payment",
      "analytics",
      "rollout",
      "erp-export",
    ]);
  });

  test("creating an ask reads the clock for nothing and starts no timer", async () => {
    const clock = fakeClock();
    await created(areasAsk(), { clock });
    expect(clock.pending).toBe(0);
  });
});
