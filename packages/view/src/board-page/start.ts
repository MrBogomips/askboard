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
// The board's working signal (push delivery, `working-signal.ts`) follows the page's focus and
// visibility and the user's keys and pointer, on the page and, through the view's activity message,
// in the view; each socket sends it once accepted and on each change (`presence.ts`). While it is
// on, it reads the focus again once a second, and it stops doing so when the page goes away.

import { WORKING_WINDOW_MS } from "@askboard/contract";
import { applyTheme, DARK_QUERY, followSystemTheme } from "../theme.ts";
import { type BoardPage, runBoardPage } from "./controller.ts";
import { loadView } from "./load-view.ts";
import { createPageChrome } from "./page-chrome.ts";
import { withPresence } from "./presence.ts";
import { createReadingPanel } from "./reading-panel.ts";
import { boardLinkOf, connectBoard } from "./socket.ts";
import { hostView, type ViewHost } from "./view-host.ts";
import { createWorkingSignal, FOCUS_RECHECK_MS, type WorkingSignal } from "./working-signal.ts";

const INPUTS = ["keydown", "pointerdown"] as const;

// The signal over the page: a hidden tab has no focus. A blur that moves the focus into the view's
// frame leaves `document.hasFocus()` true, so it is read once the focus has settled. A window that
// loses the focus while it is inside the view sends the page no blur: the signal's recheck finds it.
const workingSignalOf = (
  window: Window,
  schedule: (ms: number, run: () => void) => () => void,
): WorkingSignal => {
  const { document } = window;
  const signal = createWorkingSignal({
    focused: () => document.hasFocus() && document.visibilityState !== "hidden",
    schedule,
    windowMs: WORKING_WINDOW_MS,
    recheckMs: FOCUS_RECHECK_MS,
  });
  window.addEventListener("focus", signal.check);
  window.addEventListener("blur", () => schedule(0, signal.check));
  document.addEventListener("visibilitychange", signal.check);
  for (const type of INPUTS) {
    window.addEventListener(type, signal.input, { capture: true, passive: true });
  }
  return signal;
};

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
  const schedule = (ms: number, run: () => void) => {
    const timer = window.setTimeout(run, ms);
    return () => window.clearTimeout(timer);
  };
  const signal = workingSignalOf(window, schedule);
  page = runBoardPage({
    connect: withPresence((events) => connectBoard(location, link, events), signal),
    openView: async (data, handle) => {
      const assembled = await loadView(data, link.token);
      const peer = chrome.frame.contentWindow;
      if (peer === null) throw new Error("the view's frame is not in the document");
      host = await hostView(peer, window, handle, theme());
      chrome.frame.srcdoc = assembled.srcdoc;
      return host;
    },
    schedule,
    showBanner: chrome.showBanner,
    showLoadError: chrome.showLoadError,
    // `document.title` is text: the agent's title never becomes markup (AD-8).
    setTitle: (title) => {
      document.title = title;
    },
    // The static `lang="en"` stays until the first board (settings-languages, B13).
    setLanguage: (lang) => {
      document.documentElement.lang = lang;
    },
    log: (text, detail) => {
      if (detail === undefined) console.error(`askboard: ${text}`);
      else console.error(`askboard: ${text}:`, detail);
    },
    copyText: (text) => copyText(window, text),
    onActivity: signal.input,
    readingPanel: createReadingPanel(document, {
      askId: link.askId,
      token: link.token,
      scheme: () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    }),
    // On the user's click, as a new tab that has no opener and sends no referrer (AD-8).
    openLink: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
  });
  // A page going away mirrors its draft, does not reconnect and stops reading its focus; one
  // restored from the back-forward cache reconnects and reads it again.
  window.addEventListener("pagehide", () => {
    page?.flushDraft();
    page?.suspend();
    signal.stop();
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    signal.check();
    page?.resume();
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
