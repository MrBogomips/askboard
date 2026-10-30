// The board's status and the banner it shows (EXPERIENCE.md, Board banner; AD-21; design decision
// 5): connecting, live, retrying after an ordinary close, moved to another tab until "Continue
// here", or discarded for good. Moved and discarded lock the view (EXPERIENCE.md, Board page or
// view). Each event gives the next status; a status whose kind does not change stays the same
// object, so the board page redraws only on a change.

import type { ViewLock } from "../view-protocol.ts";
import { closeKindOf } from "./reconnect.ts";

export type BoardStatus =
  /** A socket is opening, at first or after "Continue here"; no banner. */
  | { readonly kind: "connecting" }
  /** The current socket's connect was accepted and its state has come. */
  | { readonly kind: "live" }
  /** The socket closed as a drop does; the board page reconnects with backoff. */
  | { readonly kind: "retrying" }
  /** Another tab took the board; only "Continue here" reconnects. */
  | { readonly kind: "moved" }
  /** The ask is discarded, or the token was refused, as after a restart: final. */
  | { readonly kind: "discarded" };

export type StatusEvent =
  /** The current socket's state came after its board document: `board-host` accepted it. */
  | { readonly type: "accepted" }
  | { readonly type: "closed"; readonly code: number }
  /** `moved` came on the current socket. */
  | { readonly type: "moved" }
  /** `discarded` came, or `refused` for the token before the socket was accepted. */
  | { readonly type: "discarded" }
  /** The user pressed "Continue here". */
  | { readonly type: "continue" };

export const INITIAL_STATUS: BoardStatus = { kind: "connecting" };

const kindAfter = (status: BoardStatus, event: StatusEvent): BoardStatus["kind"] => {
  if (status.kind === "discarded") return "discarded";
  switch (event.type) {
    case "discarded":
      return "discarded";
    case "moved":
      return "moved";
    case "continue":
      return status.kind === "moved" ? "connecting" : status.kind;
    case "accepted":
      return status.kind === "moved" ? "moved" : "live";
    case "closed": {
      const kind = closeKindOf(event.code);
      if (kind === "refused" || kind === "discarded") return "discarded";
      if (kind === "moved" || status.kind === "moved") return "moved";
      return "retrying";
    }
  }
};

export const nextStatus = (status: BoardStatus, event: StatusEvent): BoardStatus => {
  const kind = kindAfter(status, event);
  return kind === status.kind ? status : { kind };
};

/** Why the view is read-only, if it is (AD-21). */
export const lockOf = (status: BoardStatus): ViewLock | undefined =>
  status.kind === "discarded" || status.kind === "moved" ? status.kind : undefined;

export type Banner = {
  readonly variant: "connection-lost" | "moved" | "discarded";
  readonly text: string;
  /** A second line: on a discarded board, that answers the user gave were never sent. */
  readonly detail?: string;
  readonly action?: "Continue here";
  /** The discarded banner takes the focus (EXPERIENCE.md, Accessibility Floor, Focus). */
  readonly takesFocus: boolean;
};

// "Connection lost, retrying", "Your unsent work was not sent" and "Continue here" are
// EXPERIENCE.md's (Voice and Tone); the moved and discarded wordings are not recorded there.
const CONNECTION_LOST: Banner = {
  variant: "connection-lost",
  text: "Connection lost, retrying",
  takesFocus: false,
};
const MOVED: Banner = {
  variant: "moved",
  text: "This board moved to another tab.",
  action: "Continue here",
  takesFocus: false,
};
const DISCARDED: Banner = {
  variant: "discarded",
  text: "This ask was discarded. The board is read-only.",
  takesFocus: true,
};

/** The banner the board page shows, if any; `unsent` when a discard dropped unsent answers. */
export const bannerOf = (status: BoardStatus, unsent = false): Banner | undefined => {
  switch (status.kind) {
    case "retrying":
      return CONNECTION_LOST;
    case "moved":
      return MOVED;
    case "discarded":
      return unsent ? { ...DISCARDED, detail: "Your unsent work was not sent" } : DISCARDED;
    default:
      return undefined;
  }
};
