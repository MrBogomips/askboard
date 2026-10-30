// The board page at run time (design decision 8): the WebSocket with the token first, every
// message `board-host` sends checked before use, the tab titled after the ask, and, once the board
// document and the state are in, the view loaded into its sandboxed frame and hosted through
// ext-apps' `AppBridge`, with each later state sent on to it. An answer from the view goes on as
// the board-protocol command once the board page has checked it (AD-10). Task 8.6 completes it:
// the receipt states, the answer queue while disconnected, reconnecting and the close codes, the
// banners and "Continue here", the theme and the takeover.

import type { BootData } from "../boot-data.ts";
import type { AnswerReply, ViewAnswer, ViewMessage } from "../view-protocol.ts";
import { loadView } from "./load-view.ts";
import {
  answerCommandFor,
  bootDataOf,
  EMPTY_MODEL,
  withHostMessage,
  withViewMessage,
} from "./model.ts";
import { type BoardConnection, boardLinkOf, connectBoard } from "./socket.ts";
import { tabTitle } from "./tab-title.ts";
import { hostView, type ViewHost, type ViewReply } from "./view-host.ts";

/**
 * The view's iframe: exactly `sandbox="allow-scripts"`, so the view's origin is opaque and it
 * makes no request (AD-8). It fills the page.
 */
export const createViewFrame = (document: Document): HTMLIFrameElement => {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.title = "AskBoard";
  frame.className = "block h-screen w-full border-0";
  return frame;
};

export const startBoardPage = (window: Window): void => {
  const frame = createViewFrame(window.document);
  window.document.body.append(frame);
  const link = boardLinkOf(window.location);
  if (link === undefined) return;
  let model = EMPTY_MODEL;
  let view: ViewHost | undefined;
  let loading = false;
  let connection: BoardConnection | undefined;

  // Task 8.6 queues the answer while the connection is lost; until then it is refused.
  const answer = (message: ViewAnswer): AnswerReply => {
    const command = answerCommandFor(model, message);
    if (!command.ok) return { outcome: "refused", detail: command.detail };
    if (connection?.send(command.value) !== true) {
      return { outcome: "refused", detail: "the board is not connected" };
    }
    return { outcome: "sent" };
  };

  const onViewMessage = async (message: ViewMessage): Promise<ViewReply> => {
    if (message.type === "answer") return answer(message);
    model = withViewMessage(model, message);
    if (message.type === "item-error") {
      console.error(`askboard: the item "${message.itemId}" failed in the view: ${message.error}`);
    }
    return {};
  };

  // The bridge listens before the srcdoc is set, so it hears the view's handshake.
  const openView = async (data: BootData): Promise<void> => {
    const assembled = await loadView(data, link.token);
    const peer = frame.contentWindow;
    if (peer === null) throw new Error("the view's frame is not in the document");
    view = await hostView(peer, window, onViewMessage);
    view.update(bootDataOf(model)?.state ?? data.state);
    frame.srcdoc = assembled.srcdoc;
  };

  connection = connectBoard(window.location, {
    onMessage: (message) => {
      model = withHostMessage(model, message);
      if (message.type === "board") window.document.title = tabTitle(message.document.title);
      const data = bootDataOf(model);
      if (data === undefined) return;
      if (view !== undefined) {
        view.update(data.state);
        return;
      }
      if (loading) return;
      loading = true;
      openView(data).catch((error: unknown) => {
        console.error("askboard: the view did not load:", error);
      });
    },
    onInvalid: (problems) => {
      console.error("askboard: board-host sent a message the board protocol refuses:", problems);
    },
  });
};
