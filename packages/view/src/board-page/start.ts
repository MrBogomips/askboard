// The board page at run time (design decision 8): the WebSocket with the token first, every
// message `board-host` sends checked before use, and, once the board document and the state are
// in, the view loaded into its sandboxed frame and hosted through ext-apps' `AppBridge`, with each
// later state sent on to it. Task 8.6 completes it: the receipt states, the answer queue while
// disconnected, reconnecting and the close codes, the banners and "Continue here", the theme and
// the takeover.

import type { BootData } from "../boot-data.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { loadView } from "./load-view.ts";
import { bootDataOf, EMPTY_MODEL, withHostMessage, withViewMessage } from "./model.ts";
import { boardLinkOf, connectBoard } from "./socket.ts";
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

  const onViewMessage = async (message: ViewMessage): Promise<ViewReply> => {
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

  connectBoard(window.location, {
    onMessage: (message) => {
      model = withHostMessage(model, message);
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
