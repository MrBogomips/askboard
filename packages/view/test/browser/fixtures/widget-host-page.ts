// The widget host's page script (design decision 9 of the tree-widget change), bundled into one
// classic script by `harness/widget-host.ts`: a test-only stand-in for the board page that hosts a
// view from any board document. It reads the srcdoc and the state from its JSON data block,
// creates the view's frame with the board page's own chrome (exactly `sandbox="allow-scripts"`,
// AD-8), connects the board page's own `hostView` before it sets the srcdoc, so that it hears the
// view's handshake, and sends one update with the question open; a later one comes only from the
// test, through a function on the page's window, as the board page sends each new state or lock.
// Every view message goes to the test through a Playwright binding; an answer or an act command is
// answered as sent, under an action ID as the board page gives one since the ask lifecycle, and
// nothing more follows unless the test sends it, so the card stays at "sent" (proposal, open
// question 5). zod's `jitless` comes first, as on the board page (renderer rows 16 and 17).

import "../../../src/zod-jitless.ts";
import { createPageChrome } from "../../../src/board-page/page-chrome.ts";
import { hostView, type ViewReply } from "../../../src/board-page/view-host.ts";
import { DARK_QUERY, systemTheme } from "../../../src/theme.ts";
import type { ViewMessage, ViewUpdate } from "../../../src/view-protocol.ts";
import {
  WIDGET_HOST_BINDING,
  WIDGET_HOST_DATA_ID,
  WIDGET_HOST_UPDATE,
  type WidgetHostData,
} from "./widget-host-data.ts";

const report = (message: ViewMessage): void => {
  const binding = (globalThis as unknown as Record<string, unknown>)[WIDGET_HOST_BINDING];
  if (typeof binding !== "function") {
    console.error(`askboard widget host: no ${WIDGET_HOST_BINDING} binding for the view's message`);
    return;
  }
  void binding(message);
};

// The action ID the host gives every command: the board page draws a fresh one (controller.ts).
const ACTION_ID = "WidgetHostActionId0000";

// What the board page replies: an answer or a command it sent, and nothing for the rest.
const handle = async (message: ViewMessage): Promise<ViewReply> => {
  report(message);
  return message.type === "answer" || message.type === "act"
    ? { outcome: "sent", actionId: ACTION_ID }
    : {};
};

const start = async (): Promise<void> => {
  const text = document.getElementById(WIDGET_HOST_DATA_ID)?.textContent;
  if (text === null || text === undefined) throw new Error("the host page has no data block");
  const data = JSON.parse(text) as WidgetHostData;
  const chrome = createPageChrome(document, {
    continueHere: () => {},
    copyUnsentWork: () => {},
    takeSnapshot: () => ({ outcome: "refused", detail: "the widget host takes no Snapshot" }),
  });
  const peer = chrome.frame.contentWindow;
  if (peer === null) throw new Error("the view's frame is not in the document");
  const host = await hostView(peer, window, handle, systemTheme(window.matchMedia(DARK_QUERY)));
  (globalThis as unknown as Record<string, unknown>)[WIDGET_HOST_UPDATE] = (update: ViewUpdate) =>
    host.update(update);
  chrome.frame.srcdoc = data.srcdoc;
  host.update({ type: "state", state: data.state });
};

start().catch((error: unknown) => {
  console.error("askboard widget host: the view could not be hosted:", error);
});
