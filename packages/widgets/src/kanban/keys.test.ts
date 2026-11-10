import { describe, expect, test } from "bun:test";
import { KANBAN_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { MODIFIED_FLAGS, pressOf, pressWith } from "../../test/key-presses.ts";
import { kanbanKeyOf, kanbanTools, otherColumns } from "./keys.ts";
import { columnsOf } from "./model.ts";

// The Kanban at the keyboard (view-and-widgets spec: Kanban at the keyboard; design decision 9):
// the arrow keys are the cards' and nothing else is; "Move to…" acts only for a current card of a
// Kanban that can change, and offers the other columns.
const COLUMNS = columnsOf(KANBAN_FIXTURE_ITEM.props);

describe("kanbanKeyOf", () => {
  test("names the four arrow keys with no modifier and no other key", () => {
    expect(
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].map((key) => kanbanKeyOf(pressWith(key))),
    ).toEqual(["up", "down", "left", "right"]);
    for (const key of ["Home", "End", "Enter", " ", "a", "toString", "__proto__"]) {
      expect(kanbanKeyOf(pressWith(key))).toBeUndefined();
    }
  });

  test("Alt, Shift, Ctrl and Cmd with each arrow, Home and End give nothing (spec: Keys left to the browser)", () => {
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]) {
      for (const flags of MODIFIED_FLAGS) {
        expect({ key, flags, card: kanbanKeyOf(pressOf(key, flags)) }).toEqual({
          key,
          flags,
          card: undefined,
        });
      }
    }
  });

  test("a press during composition gives nothing", () => {
    expect(kanbanKeyOf({ ...pressWith("ArrowUp"), composing: true })).toBeUndefined();
  });
});

describe("kanbanTools", () => {
  test("Move to is on for a current card of a Kanban that can change", () => {
    expect(kanbanTools("fix-login", false, COLUMNS)).toEqual({ moveTo: true });
  });

  test("it is off with no current card, with a card the columns do not hold, and read-only", () => {
    expect(kanbanTools(undefined, false, COLUMNS)).toEqual({ moveTo: false });
    expect(kanbanTools("zz", false, COLUMNS)).toEqual({ moveTo: false });
    expect(kanbanTools("fix-login", true, COLUMNS)).toEqual({ moveTo: false });
  });
});

describe("otherColumns", () => {
  test("are the columns but the current card's, in the agent's order, by ID and label", () => {
    expect(otherColumns(COLUMNS, "fix-login")).toEqual([
      { id: "doing", label: "Doing" },
      { id: "done", label: "Done" },
    ]);
    expect(otherColumns(COLUMNS, "release-notes").map(({ id }) => id)).toEqual(["todo", "doing"]);
  });

  test("are none for no current card or one the columns do not hold", () => {
    expect(otherColumns(COLUMNS, undefined)).toEqual([]);
    expect(otherColumns(COLUMNS, "zz")).toEqual([]);
  });
});
