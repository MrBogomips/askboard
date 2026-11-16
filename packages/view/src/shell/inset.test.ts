import { describe, expect, test } from "bun:test";
import { INSET_MAX } from "../view-protocol.ts";
import { boardInsetFrom, insetFrom } from "./inset.ts";

describe("the heights the reading panel sits between (excerpts, task 6.5; DESIGN, Reading panel)", () => {
  test("the header's bottom edge and the bottom bar's height from the viewport's bottom", () => {
    expect(insetFrom({ headerBottom: 64.4, footerTop: 752, viewportHeight: 800 })).toEqual({
      top: 64,
      bottom: 48,
    });
  });

  test("no header or no bottom bar is no inset", () => {
    expect(insetFrom({ viewportHeight: 800 })).toEqual({ top: 0, bottom: 0 });
  });

  test("a bar scrolled out of the viewport, or off it, never makes a negative or a huge inset", () => {
    expect(insetFrom({ headerBottom: -20, footerTop: 900, viewportHeight: 800 })).toEqual({
      top: 0,
      bottom: 0,
    });
    expect(insetFrom({ headerBottom: 1e9, footerTop: -1e9, viewportHeight: 800 })).toEqual({
      top: INSET_MAX,
      bottom: INSET_MAX,
    });
  });
});

describe("the heights a move on the board clears (answering-flow-guidance, decision 4)", () => {
  test("with no strip of tabs it is the reading panel's inset", () => {
    expect(boardInsetFrom({ headerBottom: 64.4, footerTop: 752, viewportHeight: 800 })).toEqual(
      insetFrom({ headerBottom: 64.4, footerTop: 752, viewportHeight: 800 }),
    );
  });

  test("the top is raised to the strip's bottom edge, the bottom is the bar's", () => {
    expect(
      boardInsetFrom({ headerBottom: 64, stripBottom: 104.6, footerTop: 752, viewportHeight: 800 }),
    ).toEqual({ top: 105, bottom: 48 });
  });

  test("a strip above the header's bottom edge changes nothing, and none without a header", () => {
    expect(
      boardInsetFrom({ headerBottom: 64, stripBottom: 30, footerTop: 752, viewportHeight: 800 }),
    ).toEqual({ top: 64, bottom: 48 });
    expect(boardInsetFrom({ stripBottom: 90, viewportHeight: 800 })).toEqual({
      top: 90,
      bottom: 0,
    });
  });

  test("a strip scrolled off, or far off, never makes a negative or a huge inset", () => {
    expect(boardInsetFrom({ stripBottom: -50, viewportHeight: 800 }).top).toBe(0);
    expect(boardInsetFrom({ stripBottom: 1e9, viewportHeight: 800 }).top).toBe(INSET_MAX);
  });
});
