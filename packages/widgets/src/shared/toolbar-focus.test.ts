import { describe, expect, test } from "bun:test";
import { FLAG_SETS, MODIFIED_FLAGS, pressOf, pressWith } from "../../test/key-presses.ts";
import { toolbarMoveOf, toolbarPressMove } from "./toolbar-focus.ts";

// A toolbar's roving focus (keyboard-shortcuts-help, design decision 7; spec: Keys left to the
// browser): the horizontal arrows, Home and End move the focus with no modifier held, and with
// any other hold the key is the browser's.
const MOVES = [
  ["ArrowLeft", "previous"],
  ["ArrowRight", "next"],
  ["Home", "first"],
  ["End", "last"],
] as const;

describe("toolbarPressMove", () => {
  test.each(MOVES)("%s with no modifier moves %s", (key, move) => {
    expect(toolbarPressMove(pressWith(key))).toBe(move);
  });

  test("every hold but none gives nothing, for each of the four keys", () => {
    for (const [key] of MOVES) {
      for (const flags of MODIFIED_FLAGS) {
        expect({ key, flags, move: toolbarPressMove(pressOf(key, flags)) }).toEqual({
          key,
          flags,
          move: undefined,
        });
      }
    }
    expect(FLAG_SETS.length - MODIFIED_FLAGS.length).toBe(1);
  });

  test("another key gives nothing, and a press during composition gives nothing", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Enter", " ", "Tab", "x"]) {
      expect(toolbarPressMove(pressWith(key))).toBeUndefined();
    }
    expect(toolbarPressMove({ ...pressWith("ArrowLeft"), composing: true })).toBeUndefined();
  });

  test("toolbarMoveOf stays as it is: the key alone, whatever the hold", () => {
    expect(MOVES.map(([key]) => toolbarMoveOf(key))).toEqual(["previous", "next", "first", "last"]);
    expect(toolbarMoveOf("ArrowUp")).toBeUndefined();
  });
});
