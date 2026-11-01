// E3's recorded exchanges (ask-lifecycle, design decision 8, step 4), on the lifecycle ask. They are
// kept in their own record beside E1's `transcripts` (`transcript.ts`), whose replays (board-host's
// protocol test, the conformance suite, the view's test server) type its steps as protocol 1.0's
// messages and play them against E1's units. A replay of these makes the session steps happen as
// E1's do, and an `update` step applies the agent's request through ask-core; the rest of
// replaying is as `transcript.ts` says.

import { BOARD_CLOSE_CODES, type BoardCloseCode } from "../constants.ts";
import {
  BOARD_PROTOCOL_VERSION,
  type LifecycleHostMessage,
  type LifecyclePageMessage,
} from "../schemas/board-protocol/index.ts";
import type { UpdateInput } from "../schemas/input/index.ts";
import { LIFECYCLE } from "./lifecycle.ts";
import {
  closing,
  lifecycleBoard,
  lifecycleClosed,
  lifecycleClosedRefusal,
  lifecycleClosedState,
  lifecycleDone,
  lifecycleFirstDraft,
  lifecycleLastDraft,
  lifecycleLateAnswer,
  lifecycleRevisedBoard,
  lifecycleRevisedWaiting,
  lifecycleStaleRefusal,
  lifecycleStaleSubmit,
  lifecycleSubmit,
  lifecycleSubmitted,
  lifecycleWaiting,
  paymentRewording,
} from "./lifecycle-messages.ts";

const version = BOARD_PROTOCOL_VERSION;

/** A step of a lifecycle transcript: E1's kinds of step over protocol 1.1, and the agent's update. */
export type LifecycleTranscriptStep =
  | { readonly socket: number; readonly from: "page"; readonly message: LifecyclePageMessage }
  | {
      readonly socket: number;
      readonly from: "page";
      readonly invalid: Readonly<Record<string, unknown>>;
    }
  | { readonly socket: number; readonly from: "host"; readonly message: LifecycleHostMessage }
  | { readonly socket: number; readonly from: "host"; readonly close: BoardCloseCode }
  | { readonly socket: number; readonly from: "network"; readonly drop: true }
  | { readonly socket?: undefined; readonly from: "session"; readonly event: "collected" | "exit" }
  /** The agent's `update`, applied with this request. */
  | {
      readonly socket?: undefined;
      readonly from: "session";
      readonly event: "update";
      readonly request: UpdateInput;
    };

export type LifecycleTranscript = {
  readonly askId: string;
  readonly token: string;
  readonly steps: readonly LifecycleTranscriptStep[];
};

const lifecycle = { askId: LIFECYCLE.askId, token: LIFECYCLE.token } as const;

/** The opening of an accepted socket on the lifecycle ask: connect, the board, the state. */
const lifecycleOpening = (socket: number): LifecycleTranscriptStep[] => [
  { socket, from: "page", message: { version, type: "connect", token: LIFECYCLE.token } },
  { socket, from: "host", message: lifecycleBoard },
  { socket, from: "host", message: lifecycleWaiting },
];

/** Submit: one act command of two answers and a postpone, acknowledged by done, then the state. */
export const submitTranscript: LifecycleTranscript = {
  ...lifecycle,
  steps: [
    ...lifecycleOpening(1),
    { socket: 1, from: "page", message: lifecycleSubmit },
    { socket: 1, from: "host", message: lifecycleDone },
    { socket: 1, from: "host", message: lifecycleSubmitted },
  ],
};

/**
 * A stale submit: the agent rewords the payment question meanwhile, the board gets its new
 * revision, and a submit whose second act still names revision 1 is refused whole, naming its
 * action ID, the act's index and its question; the state follows, unchanged (AD-20).
 */
export const staleSubmitTranscript: LifecycleTranscript = {
  ...lifecycle,
  steps: [
    ...lifecycleOpening(1),
    { from: "session", event: "update", request: paymentRewording },
    { socket: 1, from: "host", message: lifecycleRevisedBoard },
    { socket: 1, from: "host", message: lifecycleRevisedWaiting },
    { socket: 1, from: "page", message: lifecycleStaleSubmit },
    { socket: 1, from: "host", message: lifecycleStaleRefusal },
    { socket: 1, from: "host", message: lifecycleRevisedWaiting },
  ],
};

/**
 * A takeover with the old tab's last draft: the second tab connects, the first is told it moved
 * and sends its last draft within the takeover flush wait, then is closed with 4409; the second
 * gets the board, the state and that draft (AD-21).
 */
export const takeoverDraftTranscript: LifecycleTranscript = {
  ...lifecycle,
  steps: [
    ...lifecycleOpening(1),
    { socket: 1, from: "page", message: lifecycleFirstDraft },
    { socket: 2, from: "page", message: { version, type: "connect", token: LIFECYCLE.token } },
    { socket: 1, from: "host", message: { version, type: "moved" } },
    { socket: 1, from: "page", message: lifecycleLastDraft },
    { socket: 1, from: "host", close: BOARD_CLOSE_CODES.moved },
    { socket: 2, from: "host", message: lifecycleBoard },
    { socket: 2, from: "host", message: lifecycleWaiting },
    { socket: 2, from: "host", message: lifecycleLastDraft },
  ],
};

/** A draft restored on connect: after a drop, the new socket gets the record last mirrored. */
export const restoredDraftTranscript: LifecycleTranscript = {
  ...lifecycle,
  steps: [
    ...lifecycleOpening(1),
    { socket: 1, from: "page", message: lifecycleLastDraft },
    { socket: 1, from: "network", drop: true },
    ...lifecycleOpening(2),
    { socket: 2, from: "host", message: lifecycleLastDraft },
  ],
};

/**
 * A closed ask: the agent closes it, the board is told so and stays connected, and an answer sent
 * afterwards is refused with reason closed, then the state (FR-6).
 */
export const closedAskTranscript: LifecycleTranscript = {
  ...lifecycle,
  steps: [
    ...lifecycleOpening(1),
    { from: "session", event: "update", request: closing },
    { socket: 1, from: "host", message: lifecycleClosed },
    { socket: 1, from: "page", message: lifecycleLateAnswer },
    { socket: 1, from: "host", message: lifecycleClosedRefusal },
    { socket: 1, from: "host", message: lifecycleClosedState },
  ],
};

/** E3's transcripts, by name. */
export const lifecycleTranscripts: Readonly<Record<string, LifecycleTranscript>> = {
  submit: submitTranscript,
  staleSubmit: staleSubmitTranscript,
  takeoverDraft: takeoverDraftTranscript,
  restoredDraft: restoredDraftTranscript,
  closedAsk: closedAskTranscript,
};
