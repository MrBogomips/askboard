import { describe, expect, test } from "bun:test";
import { revealAndFocus, revealDelta } from "./reveal.ts";

// The scroll that clears the sticky bars (answering-flow-fixes, design decision 2; #180): a
// 800 px viewport between a header 60 px down and a bottom bar 80 px high, with a gap of 8 px, so
// a box is clear when it lies within [68, 712].
const INSET = { top: 60, bottom: 80 };
const VIEWPORT = 800;
const GAP = 8;
const delta = (top: number, bottom: number, inset = INSET) =>
  revealDelta({ top, bottom }, inset, VIEWPORT, GAP);

describe("the scroll that brings a box clear of the bars", () => {
  test("a box inside the band needs none, edges included", () => {
    expect(delta(200, 300)).toBe(0);
    expect(delta(68, 712)).toBe(0);
  });

  test("a box under the bar scrolls down until its bottom is the gap above the bar", () => {
    expect(delta(700, 740)).toBe(28);
    expect(delta(900, 940)).toBe(228);
  });

  test("a box under the header scrolls up until its top is the gap below the header", () => {
    expect(delta(20, 60)).toBe(-48);
    expect(delta(-300, -260)).toBe(-368);
  });

  test("a box taller than the band starts the gap under the header", () => {
    expect(delta(400, 1500)).toBe(332);
    expect(delta(-100, 900)).toBe(-168);
    expect(delta(68, 1500)).toBe(0);
  });

  test("with no header or no bar the inset counts as 0", () => {
    expect(delta(2, 40, { top: 0, bottom: 80 })).toBe(-6);
    expect(delta(0, 40, { top: 0, bottom: 80 })).toBe(-8);
    expect(delta(760, 790, { top: 60, bottom: 0 })).toBe(0);
    expect(delta(780, 800, { top: 60, bottom: 0 })).toBe(8);
    expect(delta(0, 40, { top: 0, bottom: 0 })).toBe(-8);
  });
});

// The DOM glue, against a stand-in document: the real scroll and focus are checked in the browser.
const stubbed = (
  box: { top: number; bottom: number },
  bars: { header?: number; footer?: number },
) => {
  const calls: string[] = [];
  const rect = (edge: number) => ({ getBoundingClientRect: () => ({ top: edge, bottom: edge }) });
  const footers = bars.footer === undefined ? [] : [rect(bars.footer)];
  const view = {
    innerHeight: VIEWPORT,
    scrollBy: (options: { top: number; behavior: string }) =>
      calls.push(`scrollBy ${options.top} ${options.behavior}`),
  };
  const doc = {
    defaultView: view,
    querySelector: () => (bars.header === undefined ? null : rect(bars.header)),
    querySelectorAll: () => ({ length: footers.length, item: (i: number) => footers[i] ?? null }),
  };
  const element = {
    ownerDocument: doc,
    getBoundingClientRect: () => box,
    focus: (options: { preventScroll: boolean }) => calls.push(`focus ${options.preventScroll}`),
  };
  return { calls, element: element as unknown as HTMLElement };
};

describe("revealing and focusing an element", () => {
  test("scrolls clear of the bars at once, then focuses without scrolling again", () => {
    const { calls, element } = stubbed({ top: 700, bottom: 740 }, { header: 60, footer: 720 });
    revealAndFocus(element);
    expect(calls).toEqual(["scrollBy 28 instant", "focus true"]);
  });

  test("does not scroll an element already clear", () => {
    const { calls, element } = stubbed({ top: 200, bottom: 240 }, { header: 60, footer: 720 });
    revealAndFocus(element);
    expect(calls).toEqual(["focus true"]);
  });

  test("with neither bar the viewport's edges are the limits", () => {
    const { calls, element } = stubbed({ top: -20, bottom: 20 }, {});
    revealAndFocus(element);
    expect(calls).toEqual(["scrollBy -28 instant", "focus true"]);
  });
});
