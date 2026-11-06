import { describe, expect, test } from "bun:test";
import {
  BIG_STEP,
  COLUMN_DEFAULT,
  COLUMN_MIN,
  clampWidth,
  fitWidth,
  keyWidth,
  maxWidth,
  STEP,
} from "./column-width.ts";

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
