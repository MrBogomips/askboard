import { describe, expect, test } from "bun:test";
import { DEFAULT_PRESENTATION, fixedBy } from "./presentation-controls.ts";
import { segmentAfterKey } from "./segment-keys.ts";

describe("the key that fixes a toggle", () => {
  test("names the project file and the key, and only for a key the project sets", () => {
    const fixed = { ...DEFAULT_PRESENTATION, locked: ["density"] } as const;
    expect(fixedBy(fixed, "density")).toBe(".askboard/config.json · density");
    expect(fixedBy(fixed, "theme")).toBeUndefined();
    expect(fixedBy(DEFAULT_PRESENTATION, "density")).toBeUndefined();
  });

  test("a view with no word from the board page is compact, follows the system and is free", () => {
    expect(DEFAULT_PRESENTATION).toEqual({
      theme: "system",
      density: "compact",
      contextPlacement: "beside",
      locked: [],
    });
  });
});

describe("the segmented control's keys", () => {
  test("the arrows move and wrap, Home and End go to the ends, other keys do nothing", () => {
    expect(segmentAfterKey("ArrowRight", 0, 3)).toBe(1);
    expect(segmentAfterKey("ArrowDown", 2, 3)).toBe(0);
    expect(segmentAfterKey("ArrowLeft", 0, 3)).toBe(2);
    expect(segmentAfterKey("ArrowUp", 1, 3)).toBe(0);
    expect(segmentAfterKey("Home", 2, 3)).toBe(0);
    expect(segmentAfterKey("End", 0, 3)).toBe(2);
    expect(segmentAfterKey("Tab", 0, 3)).toBeUndefined();
    expect(segmentAfterKey("a", 0, 3)).toBeUndefined();
  });
});
