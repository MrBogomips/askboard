// The ports ask-core declares and the adapters implement (design decision 3). ask-core stays
// runtime-neutral (AD-1): everything that touches the machine comes through these.

import type { UnavailableReason } from "@askboard/contract";

/** `board-host`: the link of an ask's board, which opens the board listener on first use (AD-2). */
export type BoardAddress = {
  link(askId: string): Promise<string>;
};

/** Whether a board can be shown, by AD-18's detection rule, and why not. */
export type Showing =
  | { readonly showable: true }
  | {
      readonly showable: false;
      readonly reason: UnavailableReason;
      /** What the rule saw, such as "SSH_CONNECTION is set"; names no agent content. */
      readonly detail: string;
    };

/** `notifier`: whether a board can be shown, and opening one in the browser. */
export type BoardShowing = {
  check(): Promise<Showing>;
  /** Starts the browser opener and returns at once; it never throws for a failed start. */
  open(link: string): void;
};

/** The session entry point: who answers when the ask names no expected user (FR-19). */
export type Identity = {
  /** The git user name of the session project, if it has one. */
  gitUserName(): Promise<string | undefined>;
  /** The operating system's login name. */
  loginName(): Promise<string | undefined>;
};

/** Random bytes, for the epoch. */
export type Randomness = {
  bytes(count: number): Uint8Array;
};

/** Where ask-core reports a failure it cannot hand to a caller, such as a listener that threw. */
export type Report = (error: unknown) => void;

export type CorePorts = {
  readonly address: BoardAddress;
  readonly showing: BoardShowing;
  readonly identity: Identity;
  readonly randomness: Randomness;
  readonly report: Report;
};
