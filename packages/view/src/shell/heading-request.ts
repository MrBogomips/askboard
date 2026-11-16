// A request for focus on a question's heading (Accessibility Floor): the board moves it once the
// navigation has rendered, and the update step makes one when the agent deletes the focused
// question (document-review, task 6.18 moved it out of `board.tsx`, which the update step's unit
// tests do not load). Plain functions, tested without a DOM.

import type { Store } from "./store.ts";

export type HeadingRequest = {
  readonly id: string;
  readonly n: number;
  /** The move After an answer and "Continue" make: a smooth scroll and the arrival mark (decision 4). */
  readonly smooth?: boolean;
  /**
   * Where the focus goes instead of the heading: the send button ("All ready"), or the completion
   * panel's heading once the panel shows (D3, D6); `id` is then the question the act was taken on.
   */
  readonly to?: "send" | "completion";
};

/** Asks for focus on a question's heading, once the board has rendered. */
export const requestHeading = (
  focus: Store<HeadingRequest | undefined>,
  id: string,
  smooth = false,
): void => focus.set({ id, n: (focus.get()?.n ?? 0) + 1, ...(smooth ? { smooth } : {}) });

/** Asks for focus on the send button, or on the completion panel's heading once it shows (D3, D6). */
export const requestFocusTo = (
  focus: Store<HeadingRequest | undefined>,
  id: string,
  to: "send" | "completion",
): void => focus.set({ id, n: (focus.get()?.n ?? 0) + 1, to });
