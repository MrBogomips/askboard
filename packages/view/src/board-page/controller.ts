// The board page's controller (design decision 8; design decision 5's close codes; AD-10, AD-21):
// one socket at a time, with the token first; the board document and the state, checked, into the
// model, and the view loaded once both are in; the receipts; the answers from the view, sent at
// once while the board is live and held otherwise, then sent in order once a new socket's state
// shows their questions still open; reconnecting with backoff after an ordinary close, never on
// its own after 4403, 4409 or 4410; the banners, and the view locked while the board moved or once
// it is discarded. Everything it touches comes in `BoardPageDeps`, so it runs without a browser;
// `start.ts` gives it the real socket, view, timers and page.

import type { AnswerCommand, HostMessage, RefusedMessage, StateMessage } from "@askboard/contract";
import type { BootData } from "../boot-data.ts";
import type { AnswerReply, ViewAnswer, ViewMessage, ViewUpdate } from "../view-protocol.ts";
import {
  type Banner,
  type BoardStatus,
  bannerOf,
  INITIAL_STATUS,
  lockOf,
  nextStatus,
  type StatusEvent,
} from "./board-status.ts";
import {
  answerCommandFor,
  bootDataOf,
  EMPTY_MODEL,
  stateProblem,
  withHostMessage,
  withViewMessage,
} from "./model.ts";
import { EMPTY_OUTBOX, flush, hasUnsent, hold, pendingOf, settled, withoutItem } from "./outbox.ts";
import { reconnectDelay } from "./reconnect.ts";
import type { BoardConnection, BoardSocketHandlers } from "./socket.ts";
import { tabTitle } from "./tab-title.ts";
import type { ViewReply } from "./view-host.ts";

/** What the controller uses of the hosted view. */
export type ViewHandle = { update(update: ViewUpdate): void };

export type BoardPageDeps = {
  /** Opens a socket to `board-host`, which sends `connect` with the token once open. */
  readonly connect: (events: BoardSocketHandlers) => BoardConnection;
  /** Loads the view for the board and hosts it, its messages going to `handle`. */
  readonly openView: (
    data: BootData,
    handle: (message: ViewMessage) => Promise<ViewReply>,
  ) => Promise<ViewHandle>;
  /** Runs `run` after `ms`; returns what cancels it. */
  readonly schedule: (ms: number, run: () => void) => () => void;
  readonly showBanner: (banner: Banner | undefined) => void;
  /** Says the view did not load, or, with undefined, that it did. */
  readonly showLoadError: (error: string | undefined) => void;
  readonly setTitle: (title: string) => void;
  /** Reports what the user does not need to see, such as a message the board page refused. */
  readonly log: (text: string, detail?: unknown) => void;
};

export type BoardPage = {
  /** "Continue here" on a moved board: reconnects, which takes the board back. */
  continueHere(): void;
  /** The page is going away: no reconnect from now on. */
  suspend(): void;
  /** The page is back, as from the back-forward cache: reconnects if it was retrying. */
  resume(): void;
};

const refusal = (detail: string): AnswerReply => ({ outcome: "refused", detail });

class BoardPageController implements BoardPage {
  readonly #deps: BoardPageDeps;
  #model = EMPTY_MODEL;
  #outbox = EMPTY_OUTBOX;
  #status: BoardStatus = INITIAL_STATUS;
  // Answers a discard dropped before they were sent: the banner says so.
  #unsent = false;
  #socket: BoardConnection | undefined;
  // Whether the current socket's state has come, which makes the board live.
  #stateSeen = false;
  #attempt = 0;
  #cancelRetry: (() => void) | undefined;
  #suspended = false;
  #view: ViewHandle | undefined;
  #loading = false;
  // A failed load is tried again on the next socket, not on every message.
  #mayLoad = true;

  constructor(deps: BoardPageDeps) {
    this.#deps = deps;
    this.#open();
  }

  continueHere(): void {
    if (this.#status.kind !== "moved") return;
    this.#socket?.close();
    this.#socket = undefined;
    this.#stateSeen = false;
    this.#attempt = 0;
    this.#transition({ type: "continue" });
    this.#open();
  }

  suspend(): void {
    this.#suspended = true;
    this.#cancelRetry?.();
    this.#cancelRetry = undefined;
  }

  resume(): void {
    this.#suspended = false;
    if (this.#status.kind === "retrying" || this.#status.kind === "connecting") this.#open();
  }

  // The state, the lock, and the answers held: the view drops an act the board page no longer
  // holds, so a card is never stuck read-only at a receipt (AD-10).
  #updateView(): void {
    const state = this.#model.state;
    if (this.#view === undefined || state === undefined) return;
    const lock = lockOf(this.#status);
    const pending = pendingOf(this.#outbox);
    this.#view.update({
      type: "state",
      state,
      ...(lock === undefined ? {} : { lock }),
      ...(pending.length === 0 ? {} : { pending }),
    });
  }

  #transition(event: StatusEvent): void {
    const before = this.#status;
    this.#status = nextStatus(before, event);
    if (this.#status === before) return;
    if (this.#status.kind === "discarded") {
      this.#unsent = hasUnsent(this.#outbox);
      this.#outbox = EMPTY_OUTBOX;
    }
    this.#deps.showBanner(bannerOf(this.#status, this.#unsent));
    this.#updateView();
  }

  readonly #onViewMessage = async (message: ViewMessage): Promise<ViewReply> => {
    if (message.type === "answer") return this.#answer(message);
    this.#model = withViewMessage(this.#model, message);
    if (message.type === "item-error") {
      this.#deps.log(`the item "${message.itemId}" failed in the view: ${message.error}`);
    }
    return {};
  };

  #answer(message: ViewAnswer): AnswerReply {
    if (this.#status.kind === "discarded") return refusal("the ask was discarded");
    if (this.#status.kind === "moved") return refusal("the board moved to another tab");
    const command = answerCommandFor(this.#model, message);
    if (!command.ok) return refusal(command.detail);
    const sent = this.#status.kind === "live" && this.#socket?.send(command.value) === true;
    this.#outbox = hold(this.#outbox, message, sent);
    // The view hears it held before the reply.
    this.#updateView();
    return { outcome: sent ? "sent" : "queued" };
  }

  #loadView(): void {
    const data = bootDataOf(this.#model);
    if (data === undefined || this.#view !== undefined || this.#loading || !this.#mayLoad) return;
    this.#loading = true;
    this.#deps.openView(data, this.#onViewMessage).then(
      (opened) => {
        this.#loading = false;
        this.#view = opened;
        this.#deps.showLoadError(undefined);
        this.#updateView();
      },
      (error: unknown) => {
        this.#loading = false;
        this.#mayLoad = false;
        const reason = error instanceof Error ? error.message : String(error);
        this.#deps.showLoadError(`The board could not be loaded: ${reason}`);
        this.#deps.log("the view did not load", error);
      },
    );
  }

  // The first state on a socket: the board is live again, and the held answers go.
  #resume(): void {
    this.#stateSeen = true;
    this.#attempt = 0;
    this.#transition({ type: "accepted" });
    const send = (command: AnswerCommand) => this.#socket?.send(command) === true;
    const flushed = flush(this.#outbox, this.#model, send);
    this.#outbox = flushed.outbox;
    for (const { itemId, detail } of flushed.dropped) {
      this.#deps.log(`the answer to "${itemId}" was not sent: ${detail}`);
    }
  }

  #onState(message: StateMessage): void {
    const problem = stateProblem(this.#model.document, message.state);
    if (problem !== undefined) {
      this.#deps.log(`board-host sent a state the board page cannot act on: ${problem}`);
      return;
    }
    this.#model = withHostMessage(this.#model, message);
    this.#outbox = settled(this.#outbox, message.state);
    if (!this.#stateSeen) this.#resume();
    this.#updateView();
    this.#loadView();
  }

  #onRefused(message: RefusedMessage): void {
    if (message.reason === "token") {
      // Only before `connect` is accepted, as after a restart; 4403 follows (AD-21).
      this.#transition({ type: "discarded" });
      return;
    }
    if (message.reason === "answer") {
      this.#outbox = withoutItem(this.#outbox, message.itemId ?? "");
      this.#deps.log(`board-host refused the answer to "${message.itemId}": ${message.detail}`);
      this.#updateView();
      return;
    }
    this.#deps.log(`board-host refused a message: ${message.detail}`);
  }

  #onHostMessage(message: HostMessage): void {
    switch (message.type) {
      case "board":
        this.#model = withHostMessage(this.#model, message);
        this.#deps.setTitle(tabTitle(message.document.title));
        return;
      case "state":
        this.#onState(message);
        return;
      case "receipt":
        this.#model = withHostMessage(this.#model, message);
        this.#updateView();
        return;
      case "moved":
      case "discarded":
        this.#transition({ type: message.type });
        return;
      case "refused":
        this.#onRefused(message);
        return;
    }
  }

  #retry(): void {
    if (this.#suspended || this.#cancelRetry !== undefined) return;
    if (this.#status.kind !== "retrying") return;
    const delay = reconnectDelay(this.#attempt);
    this.#attempt += 1;
    this.#cancelRetry = this.#deps.schedule(delay, () => {
      this.#cancelRetry = undefined;
      this.#open();
    });
  }

  #onClose(): void {
    this.#socket = undefined;
    this.#stateSeen = false;
  }

  // Each socket's events count only while it is the current one.
  #open(): void {
    if (this.#suspended || this.#socket !== undefined) return;
    this.#mayLoad = true;
    const current = this.#deps.connect({
      onMessage: (message) => {
        if (this.#socket === current) this.#onHostMessage(message);
      },
      onInvalid: (problems) => {
        if (this.#socket !== current) return;
        this.#deps.log("board-host sent a message the board protocol refuses", problems);
      },
      onClose: (code) => {
        if (this.#socket !== current) return;
        this.#onClose();
        this.#transition({ type: "closed", code });
        this.#retry();
      },
    });
    this.#socket = current;
  }
}

/** Starts the board page: its first socket opens at once. */
export const runBoardPage = (deps: BoardPageDeps): BoardPage => new BoardPageController(deps);
