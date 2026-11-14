import { describe, expect, test } from "bun:test";
import {
  BIG_STEP,
  COLUMN_DEFAULT,
  COLUMN_MIN,
  clampWidth,
  type EdgeAction,
  edgeKeyAction,
  fitWidth,
  keyWidth,
  maxWidth,
  STEP,
} from "./column-width.ts";
import type { KeyPress } from "./keys.ts";

describe("the limits", () => {
  test("the widest is 60% of the widget, rounded down", () => {
    expect(maxWidth(1000)).toBe(600);
    expect(maxWidth(1279)).toBe(767);
  });

  test("the widest never falls under the narrowest", () => {
    expect(maxWidth(100)).toBe(COLUMN_MIN);
    expect(maxWidth(0)).toBe(COLUMN_MIN);
  });

  test("a width is held between the two", () => {
    expect(clampWidth(10, 1000)).toBe(COLUMN_MIN);
    expect(clampWidth(300, 1000)).toBe(300);
    expect(clampWidth(5000, 1000)).toBe(600);
  });

  test("a width that is no number takes the default, held to the limits", () => {
    expect(clampWidth(Number.NaN, 1000)).toBe(COLUMN_DEFAULT);
    expect(clampWidth(Number.NaN, 100)).toBe(COLUMN_MIN);
  });

  test("the default lies within the limits of a 1280 px widget", () => {
    expect(COLUMN_DEFAULT).toBeGreaterThanOrEqual(COLUMN_MIN);
    expect(COLUMN_DEFAULT).toBeLessThanOrEqual(maxWidth(1280));
  });
});

describe("the keys", () => {
  test("the arrows step by 16 px, with Shift by 64", () => {
    expect(STEP).toBe(16);
    expect(BIG_STEP).toBe(64);
    expect(keyWidth(200, "ArrowRight", false, 1000)).toBe(216);
    expect(keyWidth(200, "ArrowLeft", false, 1000)).toBe(184);
    expect(keyWidth(200, "ArrowRight", true, 1000)).toBe(264);
    expect(keyWidth(200, "ArrowLeft", true, 1000)).toBe(136);
  });

  test("three steps right grow the column by 48 px", () => {
    const widths = [1, 2, 3].reduce((w) => keyWidth(w, "ArrowRight", false, 1000) ?? w, 200);
    expect(widths).toBe(248);
  });

  test("Home and End take the narrowest and the widest", () => {
    expect(keyWidth(200, "Home", false, 1000)).toBe(COLUMN_MIN);
    expect(keyWidth(200, "End", false, 1000)).toBe(600);
  });

  test("a step stops at the limits", () => {
    expect(keyWidth(125, "ArrowLeft", true, 1000)).toBe(COLUMN_MIN);
    expect(keyWidth(590, "ArrowRight", true, 1000)).toBe(600);
  });

  test("another key is not the edge's", () => {
    expect(keyWidth(200, "ArrowUp", false, 1000)).toBeUndefined();
    expect(keyWidth(200, "a", false, 1000)).toBeUndefined();
  });
});

describe("the fit", () => {
  test("the longest name and the cell's padding", () => {
    expect(fitWidth([90, 230, 140], 1000)).toBe(230 + 16);
  });

  test("within the limits", () => {
    expect(fitWidth([40], 1000)).toBe(COLUMN_MIN);
    expect(fitWidth([900], 1000)).toBe(600);
  });

  test("no name leaves the default", () => {
    expect(fitWidth([], 1000)).toBe(COLUMN_DEFAULT);
  });
});

// The edge takes its keys with exactly the holds its table names (keyboard-shortcuts-help, design
// decision 7, review 1.6 S-1): the arrows left and right with no modifier or Shift, Home, End and
// Enter with no modifier, nothing else.
const press = (key: string, held: Partial<KeyPress> = {}): KeyPress => ({
  key,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...held,
});

const width = (value: number): EdgeAction => ({ kind: "width", width: value });

describe("the keys of the focused edge, by press", () => {
  test("the arrows step by 16 px with no modifier, as keyWidth does", () => {
    expect(edgeKeyAction(press("ArrowRight"), 200, 1000)).toEqual(width(216));
    expect(edgeKeyAction(press("ArrowLeft"), 200, 1000)).toEqual(width(184));
  });

  test("Shift with an arrow steps by 64 px", () => {
    expect(edgeKeyAction(press("ArrowRight", { shiftKey: true }), 200, 1000)).toEqual(width(264));
    expect(edgeKeyAction(press("ArrowLeft", { shiftKey: true }), 200, 1000)).toEqual(width(136));
  });

  test("Home and End take the limits, and Enter fits, with no modifier", () => {
    expect(edgeKeyAction(press("Home"), 200, 1000)).toEqual(width(COLUMN_MIN));
    expect(edgeKeyAction(press("End"), 200, 1000)).toEqual(width(600));
    expect(edgeKeyAction(press("Enter"), 200, 1000)).toEqual({ kind: "fit" });
  });

  test("a step stops at the limits", () => {
    expect(edgeKeyAction(press("ArrowLeft"), COLUMN_MIN, 1000)).toEqual(width(COLUMN_MIN));
    expect(edgeKeyAction(press("ArrowRight", { shiftKey: true }), 590, 1000)).toEqual(width(600));
  });

  test.each(["Home", "End", "Enter"])(
    "Shift with %s gives nothing: the column keeps its width and the key its default",
    (key) => {
      expect(edgeKeyAction(press(key, { shiftKey: true }), 200, 1000)).toBeUndefined();
    },
  );

  test.each(["ArrowLeft", "ArrowRight", "Home", "End", "Enter"])(
    "Alt, Ctrl or Cmd with %s gives nothing, alone or with Shift",
    (key) => {
      for (const held of [
        { altKey: true },
        { ctrlKey: true },
        { metaKey: true },
        { altKey: true, shiftKey: true },
        { ctrlKey: true, shiftKey: true },
        { metaKey: true, shiftKey: true },
      ] satisfies Partial<KeyPress>[]) {
        expect(edgeKeyAction(press(key, held), 200, 1000)).toBeUndefined();
      }
    },
  );

  test("another key is not the edge's, with any hold", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Escape", "Tab", " ", "F2", "a", "toString"]) {
      expect(edgeKeyAction(press(key), 200, 1000)).toBeUndefined();
      expect(edgeKeyAction(press(key, { shiftKey: true }), 200, 1000)).toBeUndefined();
    }
  });

  test("agrees with keyWidth on every key it takes", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
      for (const shiftKey of [false, true]) {
        const taken = edgeKeyAction(press(key, { shiftKey }), 333, 1100);
        const wide = keyWidth(333, key, shiftKey, 1100);
        // Shift is the arrows' own; Home and End take it not.
        if (shiftKey && (key === "Home" || key === "End")) expect(taken).toBeUndefined();
        else expect(taken).toEqual(width(wide ?? Number.NaN));
      }
    }
  });
});
