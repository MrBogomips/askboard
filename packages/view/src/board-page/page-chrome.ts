// What the board page shows around the view (EXPERIENCE.md, Board banner; DESIGN.md, Board
// banner): a region for the banners above the view's frame, which fills the rest of the page. The
// view's context header lives in the frame, so a banner sits above it rather than under it. Each
// banner takes the colours and the marker of the state it stands for: connection lost as the
// waiting pill (hollow ring), discarded as the discarded pill (bar), closed as the closed pill
// (square), moved as the info chip (filled dot) with "Continue here" as a secondary button; a
// closed or discarded board with unsent work offers "Copy my unsent work" the same way (F-17). The
// closed and discarded banners take the focus (Accessibility Floor, Focus). Everything is built
// from text nodes: no markup is parsed.

import type { Banner } from "./board-status.ts";

/** What the banners' actions do. */
export type BannerActions = {
  readonly continueHere: () => void;
  readonly copyUnsentWork: () => void;
};

export type PageChrome = {
  /** The view's iframe: exactly `sandbox="allow-scripts"` (AD-8). */
  readonly frame: HTMLIFrameElement;
  showBanner(banner: Banner | undefined): void;
  /** Says the view did not load; undefined removes it. */
  showLoadError(text: string | undefined): void;
};

const BANNER = "flex items-center gap-3 border-b border-border px-4 py-2 text-body outline-none";

const VARIANTS: Readonly<Record<Banner["variant"], { banner: string; marker: string }>> = {
  "connection-lost": {
    banner: "bg-muted text-foreground-secondary",
    marker: "size-2 rounded-full border border-ask-waiting",
  },
  discarded: {
    banner: "bg-destructive-subtle text-destructive-text",
    marker: "h-0.5 w-2 bg-ask-discarded",
  },
  moved: {
    banner: "bg-info-subtle text-info-text",
    marker: "size-2 rounded-full bg-info",
  },
  closed: {
    banner: "bg-muted text-foreground",
    marker: "size-2 bg-ask-closed",
  },
};

// `button-secondary` (DESIGN.md), with the focus ring.
const SECONDARY_BUTTON =
  "h-7 shrink-0 rounded-md border border-border bg-muted px-3 text-control text-foreground " +
  "hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

const LOAD_ERROR =
  "border-b border-border bg-destructive-subtle px-4 py-2 text-body text-destructive-text";

const element = <K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const created = document.createElement(tag);
  created.className = className;
  if (text !== undefined) created.textContent = text;
  return created;
};

const bannerElement = (document: Document, banner: Banner, actions: BannerActions) => {
  const variant = VARIANTS[banner.variant];
  const root = element(document, "div", `${BANNER} ${variant.banner}`);
  root.dataset.askboardBanner = banner.variant;
  const marker = element(document, "span", `shrink-0 ${variant.marker}`);
  marker.setAttribute("aria-hidden", "true");
  const message = element(document, "div", "min-w-0 flex-1");
  message.append(element(document, "p", "", banner.text));
  if (banner.detail !== undefined) message.append(element(document, "p", "", banner.detail));
  root.append(marker, message);
  if (banner.action !== undefined) {
    const button = element(document, "button", SECONDARY_BUTTON, banner.action);
    button.type = "button";
    button.addEventListener(
      "click",
      banner.action === "Continue here" ? actions.continueHere : actions.copyUnsentWork,
    );
    root.append(button);
  }
  if (banner.takesFocus) root.tabIndex = -1;
  return root;
};

/** Lays the board page out: the banner region, then the view's frame filling the rest. */
export const createPageChrome = (document: Document, actions: BannerActions): PageChrome => {
  document.body.className = "flex h-screen flex-col overflow-hidden";
  const region = element(document, "div", "shrink-0");
  region.setAttribute("aria-live", "polite");
  const bannerSlot = element(document, "div", "");
  const errorSlot = element(document, "div", "");
  region.append(bannerSlot, errorSlot);
  const frame = element(document, "iframe", "block min-h-0 w-full flex-1 border-0");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.title = "AskBoard";
  document.body.append(region, frame);
  return {
    frame,
    showBanner: (banner) => {
      if (banner === undefined) {
        bannerSlot.replaceChildren();
        return;
      }
      const shown = bannerElement(document, banner, actions);
      bannerSlot.replaceChildren(shown);
      if (banner.takesFocus) {
        // Firefox keeps the focus in the view's frame unless the frame gives it up first.
        if (document.activeElement === frame) frame.blur();
        shown.focus();
      }
    },
    showLoadError: (text) => {
      if (text === undefined) {
        errorSlot.replaceChildren();
        return;
      }
      const error = element(document, "p", LOAD_ERROR, text);
      error.setAttribute("role", "alert");
      errorSlot.replaceChildren(error);
    },
  };
};
