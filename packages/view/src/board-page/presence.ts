// The board page's presence messages (design decision 10; AD-2, AD-7): on each socket whose connect
// `board-host` accepts, which it says with the board document, the board's working flag at once,
// then on each change while the socket is open. A refused socket sends none, and the message
// carries the flag and nothing else. It wraps the socket the controller opens, which it leaves as
// it is; the view's activity reaches the signal through the controller's `onActivity`.

import { BOARD_PROTOCOL_VERSION, type PresenceMessage } from "@askboard/contract";
import type { BoardSocketHandlers, PageConnection } from "./socket.ts";
import type { WorkingSignal } from "./working-signal.ts";

/** The contract's presence message for a working flag. */
export const presenceMessage = (working: boolean): PresenceMessage => ({
  version: BOARD_PROTOCOL_VERSION,
  type: "presence",
  working,
});

type Connect = (events: BoardSocketHandlers) => PageConnection;

/** `connect`, each of whose sockets also sends the board's presence once it is accepted. */
export const withPresence =
  (connect: Connect, signal: Pick<WorkingSignal, "working" | "subscribe">): Connect =>
  (events) => {
    let stop: (() => void) | undefined;
    let accepted = false;
    const connection = connect({
      onMessage: (message) => {
        if (!accepted && message.type === "board") {
          accepted = true;
          const send = (working: boolean) => connection.send(presenceMessage(working));
          send(signal.working());
          stop = signal.subscribe(send);
        }
        events.onMessage(message);
      },
      onInvalid: events.onInvalid,
      onClose: (code) => {
        stop?.();
        stop = undefined;
        events.onClose(code);
      },
    });
    return connection;
  };
