import { describe, expect, test } from "bun:test";
import { FRAME_MS, SCROLL_MS, scrollFrames } from "./reveal.ts";

// The smooth move's frames (answering-flow-guidance, design decision 4): pure, so the 250 ms bound
// and the ease-out are checked without a browser.
describe("scrollFrames", () => {
  test("ends exactly on the target, at the duration", () => {
    for (const [from, to] of [
      [0, 800],
      [1200, 40],
      [3, 3.5],
    ] as const) {
      const frames = scrollFrames(from, to, 200);
      expect(frames.at(-1)).toEqual({ at: 200, y: to });
    }
  });

  test("never exceeds 250 ms, however long the duration asked", () => {
    expect(SCROLL_MS).toBe(250);
    for (const duration of [250, 251, 1000, 60_000]) {
      const frames = scrollFrames(0, 500, duration);
      expect(Math.max(...frames.map((frame) => frame.at))).toBe(250);
      expect(frames.at(-1)?.y).toBe(500);
    }
  });

  test("never goes past the target, and moves toward it, down or up", () => {
    const down = scrollFrames(100, 900, 250).map((frame) => frame.y);
    expect(down.every((y) => y > 100 && y <= 900)).toBe(true);
    expect([...down].sort((a, b) => a - b)).toEqual(down);
    const up = scrollFrames(900, 100, 250).map((frame) => frame.y);
    expect(up.every((y) => y < 900 && y >= 100)).toBe(true);
    expect([...up].sort((a, b) => b - a)).toEqual(up);
  });

  test("eases out: each step is smaller than the one before", () => {
    const ys = [0, ...scrollFrames(0, 1000, 250).map((frame) => frame.y)];
    const steps = ys.slice(1).map((y, n) => y - (ys[n] ?? 0));
    for (let n = 1; n < steps.length - 1; n++) {
      expect(steps[n] ?? 0).toBeLessThan(steps[n - 1] ?? 0);
    }
    expect(steps.length).toBeGreaterThan(5);
  });

  test("frames are one frame apart, the last at the duration", () => {
    const frames = scrollFrames(0, 100, 100);
    expect(frames[0]?.at).toBe(FRAME_MS);
    for (let n = 1; n < frames.length - 1; n++) {
      expect((frames[n]?.at ?? 0) - (frames[n - 1]?.at ?? 0)).toBe(FRAME_MS);
    }
  });

  test("a zero delta, or no duration, gives one frame, at once, on the target", () => {
    expect(scrollFrames(40, 40, 250)).toEqual([{ at: 0, y: 40 }]);
    expect(scrollFrames(0, 500, 0)).toEqual([{ at: 0, y: 500 }]);
    expect(scrollFrames(0, 500, -5)).toEqual([{ at: 0, y: 500 }]);
  });
});
