// The board's status and the banner it shows (EXPERIENCE.md, Board banner; AD-21; design decision
// 5): connecting, live, retrying after an ordinary close, moved to another tab until "Continue
// here", or discarded for good. Moved and discarded lock the view (EXPERIENCE.md, Board page or
// view). Each event gives the next status; a status whose kind does not change stays the same
// object, so the board page redraws only on a change. The ask lifecycle adds the closed ask
// (FR-6): locked and banner-ed like a discarded one, though its socket stays open and reconnects,
// and a closed or discarded board with unsent work offers "Copy my unsent work" (F-17).

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
  | { readonly kind: "discarded" }
  /** The agent closed the ask: locked, until it is discarded or another tab takes the board. */
  | { readonly kind: "closed" };

export type StatusEvent =
  /** The current socket's state came after its board document: `board-host` accepted it. */
  | { readonly type: "accepted" }
  | { readonly type: "closed"; readonly code: number }
  /** `moved` came on the current socket. */
  | { readonly type: "moved" }
  /** `discarded` came, or `refused` for the token before the socket was accepted. */
  | { readonly type: "discarded" }
  /** The user pressed "Continue here". */
  | { readonly type: "continue" }
  /** `closed` came, or a state of a closed ask. */
  | { readonly type: "ask-closed" };

export const INITIAL_STATUS: BoardStatus = { kind: "connecting" };

const kindAfter = (status: BoardStatus, event: StatusEvent): BoardStatus["kind"] => {
  if (status.kind === "discarded") return "discarded";
  switch (event.type) {
    case "discarded":
      return "discarded";
    case "moved":
      return "moved";
    case "ask-closed":
      return status.kind === "moved" ? "moved" : "closed";
    case "continue":
      return status.kind === "moved" ? "connecting" : status.kind;
    case "accepted":
      return status.kind === "moved" || status.kind === "closed" ? status.kind : "live";
    case "closed": {
      const kind = closeKindOf(event.code);
      if (kind === "refused" || kind === "discarded") return "discarded";
      if (kind === "moved" || status.kind === "moved") return "moved";
      return status.kind === "closed" ? "closed" : "retrying";
    }
  }
};

export const nextStatus = (status: BoardStatus, event: StatusEvent): BoardStatus => {
  const kind = kindAfter(status, event);
  return kind === status.kind ? status : { kind };
};

/** Why the view is read-only, if it is (AD-21, FR-6). */
export const lockOf = (status: BoardStatus): ViewLock | undefined =>
  status.kind === "discarded" || status.kind === "moved" || status.kind === "closed"
    ? status.kind
    : undefined;

/**
 * Whether the board's connection is lost, as the view hears it: Submit is disabled while it is
 * (EXPERIENCE.md, Submit). A locked board needs no connection.
 */
export const connectionOf = (status: BoardStatus): "lost" | undefined =>
  status.kind === "connecting" || status.kind === "retrying" ? "lost" : undefined;

export type Banner = {
  readonly variant: "connection-lost" | "moved" | "discarded" | "closed";
  readonly text: string;
  /** A second line: on a closed or discarded board, that work the user did was never sent. */
  readonly detail?: string;
  readonly action?: "Continue here" | "Copy my unsent work";
  /**
   * The closed and discarded banners take the focus (EXPERIENCE.md, Accessibility Floor, Focus).
   */
  readonly takesFocus: boolean;
};

// "Connection lost, retrying", "Your unsent work was not sent", "Copy my unsent work" and
// "Continue here" are EXPERIENCE.md's (Voice and Tone); the moved, discarded and closed wordings
// are not recorded there.
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
const CLOSED: Banner = {
  variant: "closed",
  text: "This ask was closed. The board is read-only.",
  takesFocus: true,
};

// A closed or discarded board's banner, saying when unsent work was left and offering its copy.
const ended = (banner: Banner, unsent: boolean): Banner =>
  unsent
    ? { ...banner, detail: "Your unsent work was not sent", action: "Copy my unsent work" }
    : banner;

/** The banner the board page shows, if any; `unsent` when the board ended with unsent work. */
export const bannerOf = (status: BoardStatus, unsent = false): Banner | undefined => {
  switch (status.kind) {
    case "retrying":
      return CONNECTION_LOST;
    case "moved":
      return MOVED;
    case "discarded":
      return ended(DISCARDED, unsent);
    case "closed":
      return ended(CLOSED, unsent);
    default:
      return undefined;
  }
};
