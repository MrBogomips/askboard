import { describe, expect, test } from "bun:test";
import { INSET_MAX } from "../view-protocol.ts";
import { insetFrom } from "./inset.ts";

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
