// What a canvas draws as text, for a test of a chart's tooltip (chart-widget, task 6.6): an init
// script wraps `fillText` of every canvas of every frame and records the text with the font and the
// fill in force at the call; `drawnTexts` reads the record from the view's frame. Test code, run
// in the page before its own scripts. Not a test file.

import type { Frame } from "playwright";

export type DrawnText = { readonly text: string; readonly font: string; readonly fill: string };

const KEY = "__askboardDrawnTexts";

/** The init script: add it to the browser context before the tab opens. */
export const recordCanvasText = (key: string): void => {
  const drawn: { text: string; font: string; fill: string }[] = [];
  (globalThis as unknown as Record<string, unknown>)[key] = drawn;
  const original = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (
    this: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth?: number,
  ) {
    drawn.push({ text, font: this.font, fill: String(this.fillStyle) });
    if (maxWidth === undefined) original.call(this, text, x, y);
    else original.call(this, text, x, y, maxWidth);
  };
};

/** The name the init script is given. */
export const CANVAS_TEXT_KEY = KEY;

/** Everything the frame's canvases have drawn as text so far. */
export const drawnTexts = (frame: Frame): Promise<readonly DrawnText[]> =>
  frame.evaluate(
    (key) => [...((globalThis as unknown as Record<string, DrawnText[]>)[key] ?? [])],
    KEY,
  );

/** A drawn text without the word joiners the chart puts in agent text (`chartText`). */
export const visibleText = (text: string): string => text.replaceAll("⁠", "");
