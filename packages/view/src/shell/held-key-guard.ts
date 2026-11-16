// A held key never reaches the card the board moved to (answering-flow-guidance, design decision 3;
// NFR-10). The move happens at the act, while the key that made it may still be down, so a repeat of
// that key would land on the question the board moved to, or on "Continue", and answer, select or
// continue there. Until that key's keyup, repeats of a key that was down at the act are ignored on
// the card moved to and on "Continue". Pure: the DOM listeners feed it key facts and read its verdict.

/** Where a key event landed: the card it is in, and whether it is on a "Continue" button. */
export type KeyPlace = {
  readonly card: string | undefined;
  readonly continue: boolean;
  /** On the board's Send / Submit button. */
  readonly send: boolean;
};

export type KeyEvent = {
  readonly key: string;
  readonly repeat: boolean;
  readonly at: KeyPlace;
};

export type HeldKeyGuard = {
  /** A key went down; `ignore` when the event is a repeat the guard keeps from the card. */
  keydown(event: KeyEvent): "ignore" | "pass";
  keyup(key: string): void;
  /**
   * The board moved to `card` (or shows "Continue" for it): guard it against the keys now down.
   * `toSend` when the focus went to Send: a repeat on Send is ignored too, so a held Enter never
   * sends the held acts the user did not press Send for (NFR-10).
   */
  arm(card: string, toSend?: boolean): void;
  /** Focus left the page: the keyups are lost, so nothing is held or guarded any more. */
  reset(): void;
};

export const createHeldKeyGuard = (): HeldKeyGuard => {
  const down = new Set<string>();
  let guarded:
    | { readonly keys: Set<string>; readonly card: string; readonly send: boolean }
    | undefined;
  return {
    keydown: ({ key, repeat, at }) => {
      if (!repeat) {
        down.add(key);
        return "pass";
      }
      if (guarded === undefined || !guarded.keys.has(key)) return "pass";
      return at.continue || at.card === guarded.card || (guarded.send && at.send)
        ? "ignore"
        : "pass";
    },
    keyup: (key) => {
      down.delete(key);
      if (guarded === undefined) return;
      guarded.keys.delete(key);
      if (guarded.keys.size === 0) guarded = undefined;
    },
    arm: (card, toSend = false) => {
      guarded = down.size === 0 ? undefined : { keys: new Set(down), card, send: toSend };
    },
    reset: () => {
      down.clear();
      guarded = undefined;
    },
  };
};
