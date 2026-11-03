// The board's working signal (view spec, "The board's working signal"; design decision 10) on a
// fake clock: working while the page has focus and has had a key or pointer input, on the page or
// in its view, within the window; a change is told once. While it is working, the focus is read
// again every second, since a window losing the focus from inside the view tells the page nothing
// (task 13.6).

import { describe, expect, test } from "bun:test";
import { createWorkingSignal, FOCUS_RECHECK_MS } from "./working-signal.ts";

const WINDOW_MS = 60_000;
const RECHECK_MS = FOCUS_RECHECK_MS;

const setUp = () => {
  let now = 0;
  let focused = true;
  const timers: { at: number; run: () => void; cancelled: boolean }[] = [];
  const changes: boolean[] = [];
  const signal = createWorkingSignal({
    focused: () => focused,
    windowMs: WINDOW_MS,
    recheckMs: RECHECK_MS,
    schedule: (ms, run) => {
      const timer = { at: now + ms, run, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  });
  signal.subscribe((working) => changes.push(working));
  // Moves the clock on, running each timer that falls due, in order.
  const advance = (ms: number) => {
    now += ms;
    for (;;) {
      const due = timers
        .filter((timer) => !timer.cancelled && timer.at <= now)
        .sort((a, b) => a.at - b.at)[0];
      if (due === undefined) return;
      due.cancelled = true;
      due.run();
    }
  };
  const setFocused = (value: boolean) => {
    focused = value;
  };
  const live = () => timers.filter((timer) => !timer.cancelled).length;
  return { signal, changes, advance, setFocused, live };
};

describe("the working signal", () => {
  test("is off until an input, then on while the page has focus", () => {
    const { signal, changes } = setUp();
    expect(signal.working()).toBe(false);
    signal.input();
    expect(signal.working()).toBe(true);
    expect(changes).toEqual([true]);
  });

  test("goes off a window after the last input, each input starting the window again", () => {
    const { signal, changes, advance, live } = setUp();
    signal.input();
    advance(WINDOW_MS - 1_000);
    signal.input();
    advance(WINDOW_MS - 1_000);
    expect(signal.working()).toBe(true);
    advance(1_000);
    expect(signal.working()).toBe(false);
    expect(changes).toEqual([true, false]);
    // One timer at a time.
    expect(live()).toBe(0);
  });

  test("ends at once when the page loses focus, and comes back with it within the window", () => {
    const { signal, changes, setFocused, advance } = setUp();
    signal.input();
    setFocused(false);
    signal.check();
    expect(signal.working()).toBe(false);
    setFocused(true);
    signal.check();
    expect(signal.working()).toBe(true);
    advance(WINDOW_MS);
    setFocused(false);
    signal.check();
    setFocused(true);
    signal.check();
    expect(changes).toEqual([true, false, true, false]);
  });

  test("an input on a page without focus does not make it working", () => {
    const { signal, changes, setFocused } = setUp();
    setFocused(false);
    signal.input();
    expect(signal.working()).toBe(false);
    expect(changes).toEqual([]);
  });

  test("a check that changes nothing tells nothing", () => {
    const { signal, changes } = setUp();
    signal.check();
    signal.input();
    signal.input();
    signal.check();
    expect(changes).toEqual([true]);
  });

  test("a listener that unsubscribes hears no more", () => {
    const { signal } = setUp();
    const heard: boolean[] = [];
    const stop = signal.subscribe((working) => heard.push(working));
    signal.input();
    stop();
    signal.check();
    expect(heard).toEqual([true]);
  });

  test("while working, a focus lost with no event ends it within a recheck", () => {
    const { signal, changes, setFocused, advance } = setUp();
    signal.input();
    advance(RECHECK_MS * 3);
    setFocused(false);
    advance(RECHECK_MS - 1);
    expect(changes).toEqual([true]);
    advance(1);
    expect(changes).toEqual([true, false]);
  });

  test("reads the focus again only while working", () => {
    const { signal, setFocused, advance, live } = setUp();
    // Off: no timer at all.
    signal.check();
    expect(live()).toBe(0);
    // On: the window and the recheck.
    signal.input();
    expect(live()).toBe(2);
    advance(RECHECK_MS * 5);
    expect(live()).toBe(2);
    // Off by a lost focus: the recheck stops, and the window runs on.
    setFocused(false);
    signal.check();
    expect(live()).toBe(1);
    // Off by the window's end: nothing is left.
    advance(WINDOW_MS);
    expect(live()).toBe(0);
    setFocused(true);
    signal.input();
    advance(WINDOW_MS);
    expect(signal.working()).toBe(false);
    expect(live()).toBe(0);
  });

  test("stop ends the rechecks, and a check while working starts them again", () => {
    const { signal, changes, setFocused, advance, live } = setUp();
    signal.input();
    signal.stop();
    expect(live()).toBe(1);
    setFocused(false);
    advance(RECHECK_MS * 3);
    expect(changes).toEqual([true]);
    setFocused(true);
    signal.check();
    expect(live()).toBe(2);
    setFocused(false);
    advance(RECHECK_MS);
    expect(changes).toEqual([true, false]);
    expect(live()).toBe(1);
  });
});
