// An ask's board connections as `board-host` reports them, and its grace timer (AD-21;
// ask-lifecycle, design decision 3): the timer starts when the last live connection of an open ask
// that has connected before closes, a connection cancels it, and closing the ask stops it for good.
// The clock that runs the timer belongs to ask-core; this only keeps the count and the cancel.

export class Connections {
  #live = 0;
  #ever = false;
  #cancel: (() => void) | undefined;

  /** A board connected: the grace timer, if one runs, is cancelled. */
  connected(): void {
    this.#live += 1;
    this.#ever = true;
    this.stop();
  }

  /**
   * A live board closed. Returns whether the grace timer starts now: no live connection is left,
   * the ask has connected before, it is open (`open`), and no timer runs yet.
   */
  disconnected(open: boolean): boolean {
    this.#live = Math.max(this.#live - 1, 0);
    return open && this.#live === 0 && this.#ever && this.#cancel === undefined;
  }

  /** Keeps the cancel function of the timer that has just started. */
  arm(cancel: () => void): void {
    this.#cancel = cancel;
  }

  /** The timer ran out. Returns whether it still discards: no board has connected since. */
  ended(): boolean {
    const running = this.#cancel !== undefined;
    this.#cancel = undefined;
    return running && this.#live === 0;
  }

  /** Cancels the timer, if one runs. */
  stop(): void {
    this.#cancel?.();
    this.#cancel = undefined;
  }
}
