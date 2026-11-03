// The board's working signal (design decision 10; view spec, "The board's working signal"; AD-2):
// the board is working while the page has focus and has had a key or pointer input, on the page or
// in its view, within the window (`WORKING_WINDOW_MS`). Pure: `start.ts` gives it the page's
// focus and timers and tells it of each input and each change of focus or visibility. While it is
// working, it also reads the focus again every `FOCUS_RECHECK_MS`: when the focus is inside the
// view and the browser window loses it to another application, only the view's window hears a
// `blur`, and the page hears nothing (decision 10's review fix).

/** How often the focus is read again while the board is working. */
export const FOCUS_RECHECK_MS = 1_000;

export type WorkingSignal = {
  /** Whether the board is working now. */
  working(): boolean;
  /** A key or pointer input, on the board page or in its view: the window starts again. */
  input(): void;
  /** The page's focus or visibility may have changed. */
  check(): void;
  /** The page is going away: the focus is read again no more, until a check or an input. */
  stop(): void;
  /** Hears each change of the signal; returns what stops it. */
  subscribe(listener: (working: boolean) => void): () => void;
};

export type WorkingSignalDeps = {
  /** Whether the page has the focus and is visible: a hidden tab has no focus. */
  readonly focused: () => boolean;
  /** Runs `run` after `ms`; returns what cancels it. */
  readonly schedule: (ms: number, run: () => void) => () => void;
  readonly windowMs: number;
  /** How often the focus is read again while the board is working. */
  readonly recheckMs: number;
};

export const createWorkingSignal = ({
  focused,
  schedule,
  windowMs,
  recheckMs,
}: WorkingSignalDeps): WorkingSignal => {
  const listeners = new Set<(working: boolean) => void>();
  // Whether an input came within the window, and what ends the window.
  let recent = false;
  let cancel: (() => void) | undefined;
  let told = false;
  // What cancels the next reading of the focus, pending only while the board is told working.
  let recheck: (() => void) | undefined;
  const current = () => recent && focused();
  const stop = () => {
    recheck?.();
    recheck = undefined;
  };
  const check = () => {
    const working = current();
    if (working !== told) {
      told = working;
      for (const listener of listeners) listener(working);
    }
    if (!told) stop();
    else
      recheck ??= schedule(recheckMs, () => {
        recheck = undefined;
        check();
      });
  };
  return {
    working: current,
    input: () => {
      cancel?.();
      recent = true;
      cancel = schedule(windowMs, () => {
        cancel = undefined;
        recent = false;
        check();
      });
      check();
    },
    check,
    stop,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
