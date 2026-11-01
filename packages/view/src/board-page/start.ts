// The board page at run time (design decision 8): the controller (`controller.ts`) given the real
// things it drives. The WebSocket sends the token first; the view is loaded from the manifest and
// the chunks `board-host` serves (`load-view.ts`), set as the srcdoc of the sandboxed frame and
// hosted through ext-apps' `AppBridge` (`view-host.ts`), which listens before the srcdoc is set so
// that it hears the view's handshake. The banners and a load error show above the frame
// (`page-chrome.ts`); the tab is titled after the ask. The theme follows the system's preference,
// on the board page's own root and, through the host context, in the view (EXPERIENCE.md, Dark
// theme). Nothing is kept in Web Storage, IndexedDB or cookies (AD-20). The token stays in the
// link, so a reload works; the board page's `<base href="/">` keeps it out of the view's base URL
// (AD-8, `tools/build/board-page.ts`). Since the ask lifecycle (ask-lifecycle, design decision 6):
// the draft record goes at once when the page is hidden or going away, the browser's leave-page
// prompt is armed as the controller says (FR-25), and "Copy my unsent work" uses the clipboard.

import { applyTheme, DARK_QUERY, followSystemTheme } from "../theme.ts";
import { type BoardPage, runBoardPage } from "./controller.ts";
import { loadView } from "./load-view.ts";
import { createPageChrome } from "./page-chrome.ts";
import { boardLinkOf, connectBoard } from "./socket.ts";
import { hostView, type ViewHost } from "./view-host.ts";

export const startBoardPage = (window: Window): void => {
  const { document, location } = window;
  const link = boardLinkOf(location);
  let page: BoardPage | undefined;
  const chrome = createPageChrome(document, {
    continueHere: () => page?.continueHere(),
    copyUnsentWork: () => void page?.copyUnsentWork(),
  });
  let host: ViewHost | undefined;
  const theme = followSystemTheme(window.matchMedia(DARK_QUERY), (next) => {
    applyTheme(document.documentElement, next);
    host?.setTheme(next);
  });
  if (link === undefined) return;
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
    copyText: (text) => copyText(window, text),
  });
  // A page going away mirrors its draft and does not reconnect; one restored from the
  // back-forward cache does.
  window.addEventListener("pagehide", () => {
    page?.flushDraft();
    page?.suspend();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) page?.resume();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") page?.flushDraft();
  });
  // Browsers show their own text: the view's bottom action bar carries the warning (L190).
  window.addEventListener("beforeunload", (event) => {
    if (page?.leavePromptArmed() !== true) return;
    event.preventDefault();
    event.returnValue = "";
  });
};

/**
 * Puts text on the clipboard on the user's click: the asynchronous Clipboard API, or, where the
 * browser does not grant it, a selected text area copied the old way.
 */
const copyText = async (window: Window, text: string): Promise<void> => {
  try {
    await window.navigator.clipboard.writeText(text);
    return;
  } catch {
    // Falls through to the text area.
  }
  const { document } = window;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.className = "fixed -left-[9999px] top-0";
  document.body.append(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) throw new Error("the browser did not copy the text");
};
