// E5's recorded exchange (excerpts, design decision 5; task 1.5): the reading panel's and the
// editor's messages on the context ask's board. Kept in its own record, as E3 keeps its own beside
// E1's `transcripts` (`lifecycle-transcripts.ts`), so that E1's replays still play E1's alone; the
// rest of replaying is as `transcript.ts` says.

import { BOARD_CLOSE_CODES, type BoardCloseCode } from "../constants.ts";
import { boardLink } from "../routes.ts";
import {
  BOARD_PROTOCOL_VERSION,
  type ContextHostMessage,
  type ContextPageMessage,
  type LifecycleHostMessage,
  type LifecyclePageMessage,
} from "../schemas/board-protocol/index.ts";
import { type ContextBoardDocument, contextBoardDocument } from "./context.ts";

const version = BOARD_PROTOCOL_VERSION;

/** The context session: its epoch, ask, port and token, and the ask's board link. */
export const CONTEXT = {
  epoch: "k3x9",
  askId: contextBoardDocument.askId,
  port: 47213,
  token: "Qm8vT3xR6kWp2LnZ9cYbHd",
  get link(): string {
    return boardLink(this);
  },
} as const;

/** The board message of a board document holding context items. */
export type ContextBoardMessage = {
  readonly version: string;
  readonly type: "board";
  readonly document: ContextBoardDocument;
};

/** A step of a context transcript: E3's kinds of step, with E5's messages. */
export type ContextTranscriptStep =
  | {
      readonly socket: number;
      readonly from: "page";
      readonly message: LifecyclePageMessage | ContextPageMessage;
    }
  | {
      readonly socket: number;
      readonly from: "page";
      readonly invalid: Readonly<Record<string, unknown>>;
    }
  | {
      readonly socket: number;
      readonly from: "host";
      readonly message: LifecycleHostMessage | ContextHostMessage | ContextBoardMessage;
    }
  | { readonly socket: number; readonly from: "host"; readonly close: BoardCloseCode };

export type ContextTranscript = {
  readonly askId: string;
  readonly token: string;
  readonly steps: readonly ContextTranscriptStep[];
};

const board: ContextBoardMessage = { version, type: "board", document: contextBoardDocument };

/** Every question of the context ask open, at rev 1. */
export const contextWaiting = {
  version,
  type: "state",
  state: {
    ask: "waiting",
    questions: contextBoardDocument.items.map(({ id, rev }) => ({
      itemId: id,
      rev,
      state: "open",
    })),
  },
} as unknown as LifecycleHostMessage;

const opening = (socket: number): ContextTranscriptStep[] => [
  { socket, from: "page", message: { version, type: "connect", token: CONTEXT.token } },
  { socket, from: "host", message: board },
  { socket, from: "host", message: contextWaiting },
];

const page = (socket: number, type: "open-source" | "open-editor", itemId: string) =>
  ({ socket, from: "page", message: { version, type, itemId } }) as const;

/**
 * The user opens the excerpt's source and a FILE reference in the reading panel, presses "Open in
 * editor" with none set, and the page's open-source naming a path is refused; a second tab then
 * takes the board over and opens the unresolved excerpt's source, which is missing.
 */
export const readingPanelTranscript: ContextTranscript = {
  askId: CONTEXT.askId,
  token: CONTEXT.token,
  steps: [
    ...opening(1),
    page(1, "open-source", "retry-adr"),
    {
      socket: 1,
      from: "host",
      message: {
        version,
        type: "source-state",
        itemId: "retry-adr",
        status: "available",
        changed: false,
        line: 7,
        editor: false,
      },
    },
    page(1, "open-source", "retry-src"),
    {
      socket: 1,
      from: "host",
      message: {
        version,
        type: "source-state",
        itemId: "retry-src",
        status: "available",
        line: 1,
        editor: false,
      },
    },
    page(1, "open-editor", "retry-src"),
    {
      socket: 1,
      from: "host",
      message: { version, type: "editor-outcome", itemId: "retry-src", outcome: "no-editor" },
    },
    {
      socket: 1,
      from: "page",
      invalid: { version, type: "open-source", itemId: "retry-src", path: "/etc/passwd" },
    },
    {
      socket: 1,
      from: "host",
      message: {
        version,
        type: "refused",
        reason: "message",
        detail: '/path: unknown field "path"',
      },
    },
    { socket: 2, from: "page", message: { version, type: "connect", token: CONTEXT.token } },
    { socket: 1, from: "host", message: { version, type: "moved" } },
    { socket: 1, from: "host", close: BOARD_CLOSE_CODES.moved },
    { socket: 2, from: "host", message: board },
    { socket: 2, from: "host", message: contextWaiting },
    page(2, "open-source", "missing-doc"),
    {
      socket: 2,
      from: "host",
      message: {
        version,
        type: "source-state",
        itemId: "missing-doc",
        status: "missing",
        editor: false,
      },
    },
  ],
};

/** One valid example of each of E5's messages in each direction, as E3's examples are. */
export const contextProtocolExamples: {
  readonly toHost: readonly ContextPageMessage[];
  readonly toPage: readonly ContextHostMessage[];
} = {
  toHost: [
    { version, type: "open-source", itemId: "retry-adr" },
    { version, type: "open-editor", itemId: "retry-src" },
  ],
  toPage: [
    {
      version,
      type: "source-state",
      itemId: "retry-adr",
      status: "available",
      changed: true,
      line: 9,
      editor: true,
    },
    { version, type: "editor-outcome", itemId: "retry-src", outcome: "opened" },
  ],
};
