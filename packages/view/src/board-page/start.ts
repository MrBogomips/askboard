// The board page at run time (design decision 8): the controller (`controller.ts`) given the real
// things it drives. The WebSocket sends the token first; the view is loaded from the manifest and
// the chunks `board-host` serves (`load-view.ts`), set as the srcdoc of the sandboxed frame and
// hosted through ext-apps' `AppBridge` (`view-host.ts`), which listens before the srcdoc is set so
// that it hears the view's handshake. The banners and a load error show above the frame
// (`page-chrome.ts`); the tab is titled after the ask. The theme follows the system's preference,
// on the board page's own root and, through the host context, in the view (EXPERIENCE.md, Dark
// theme). Nothing is kept in Web Storage, IndexedDB or cookies (AD-20).
//
// The token leaves the URL before the view's frame exists (AD-8, NFR-4): a srcdoc document takes
// its base URL from the board page, so the view's `document.baseURI` would hold the link with
// `?t=`. Chromium and WebKit fix that base URL when the frame loads, but Firefox reads the board
// page's URL each time, so the token stays out for the page's life. It lives on in memory, for
// reconnects and "Continue here", and in the history entry's state, which a reload keeps (not Web
// Storage, AD-20).

import { applyTheme, DARK_QUERY, followSystemTheme } from "../theme.ts";
import { type BoardPage, runBoardPage } from "./controller.ts";
import { loadView } from "./load-view.ts";
import { createPageChrome } from "./page-chrome.ts";
import { boardLinkOf, connectBoard, tokenState } from "./socket.ts";
import { hostView, type ViewHost } from "./view-host.ts";

// For a board page that finds no token in its link or its history entry: the invalid-link page's
// sense, since the page cannot connect.
const NO_BOARD = "This link opens no board. Ask the agent for the board's link again.";

export const startBoardPage = (window: Window): void => {
  const { document, history, location } = window;
  const link = boardLinkOf(location, history.state);
  if (link !== undefined) history.replaceState(tokenState(link), "", location.pathname);
  let page: BoardPage | undefined;
  const chrome = createPageChrome(document, () => page?.continueHere());
  let host: ViewHost | undefined;
  const theme = followSystemTheme(window.matchMedia(DARK_QUERY), (next) => {
    applyTheme(document.documentElement, next);
    host?.setTheme(next);
  });
  if (link === undefined) {
    chrome.showLoadError(NO_BOARD);
    return;
  }
  page = runBoardPage({
    connect: (events) => connectBoard(location, link, events),
    openView: async (data, handle) => {
      const assembled = await loadView(data, link.token);
      const peer = chrome.frame.contentWindow;
      if (peer === null) throw new Error("the view's frame is not in the document");
      host = await hostView(peer, window, handle, theme());
      chrome.frame.srcdoc = assembled.srcdoc;
      return host;
    },
    schedule: (ms, run) => {
      const timer = window.setTimeout(run, ms);
      return () => window.clearTimeout(timer);
    },
    showBanner: chrome.showBanner,
    showLoadError: chrome.showLoadError,
    // `document.title` is text: the agent's title never becomes markup (AD-8).
    setTitle: (title) => {
      document.title = title;
    },
    log: (text, detail) => {
      if (detail === undefined) console.error(`askboard: ${text}`);
      else console.error(`askboard: ${text}:`, detail);
    },
  });
  // A page going away does not reconnect; one restored from the back-forward cache does.
  window.addEventListener("pagehide", () => page?.suspend());
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) page?.resume();
  });
};
