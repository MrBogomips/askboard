import { describe, expect, test } from "bun:test";
import { INSET_MAX } from "../view-protocol.ts";
import { boardInsetFrom, insetFrom } from "./inset.ts";

describe("the heights the panels sit between (excerpts, task 6.5; answering-flow-visual, D12)", () => {
  test("the header's bottom edge from the top; the bottom is the viewport's: no bar, no inset", () => {
    expect(insetFrom({ headerBottom: 96.4 })).toEqual({ top: 96, bottom: 0 });
  });

  test("no header is no inset", () => {
    expect(insetFrom({})).toEqual({ top: 0, bottom: 0 });
  });

  test("a header scrolled out of the viewport, or off it, never makes a negative or a huge inset", () => {
    expect(insetFrom({ headerBottom: -20 })).toEqual({ top: 0, bottom: 0 });
    expect(insetFrom({ headerBottom: 1e9 })).toEqual({ top: INSET_MAX, bottom: 0 });
  });
});

describe("the heights a move on the board clears (answering-flow-guidance, decision 4; visual, D11)", () => {
  test("with no strip of tabs and no tray it is the panels' inset", () => {
    expect(boardInsetFrom({ headerBottom: 96.4 })).toEqual(insetFrom({ headerBottom: 96.4 }));
  });

  test("the top is raised to the strip's bottom edge", () => {
    expect(boardInsetFrom({ headerBottom: 96, stripBottom: 136.6 })).toEqual({
      top: 137,
      bottom: 0,
    });
  });

  test("the top is raised to the tray's bottom edge while it holds a message", () => {
    expect(boardInsetFrom({ headerBottom: 96, trayBottom: 180 })).toEqual({ top: 180, bottom: 0 });
    expect(boardInsetFrom({ headerBottom: 96, stripBottom: 136, trayBottom: 180 }).top).toBe(180);
    expect(boardInsetFrom({ headerBottom: 96, stripBottom: 200, trayBottom: 180 }).top).toBe(200);
  });

  test("a strip or a tray above the header's bottom edge changes nothing, and none without a header", () => {
    expect(boardInsetFrom({ headerBottom: 96, stripBottom: 30, trayBottom: 40 })).toEqual({
      top: 96,
      bottom: 0,
    });
    expect(boardInsetFrom({ stripBottom: 90 })).toEqual({ top: 90, bottom: 0 });
  });

  test("a strip or a tray scrolled off, or far off, never makes a negative or a huge inset", () => {
    expect(boardInsetFrom({ stripBottom: -50 }).top).toBe(0);
    expect(boardInsetFrom({ stripBottom: 1e9 }).top).toBe(INSET_MAX);
    expect(boardInsetFrom({ trayBottom: 1e9 }).top).toBe(INSET_MAX);
  });
});
