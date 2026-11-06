// What the board page shows around the view (EXPERIENCE.md, Board banner; DESIGN.md, Board
// banner): a region for the banners above the view's frame, which fills the rest of the page. The
// view's context header lives in the frame, so a banner sits above it rather than under it. Each
// banner takes the colours and the marker of the state it stands for: connection lost as the
// waiting pill (hollow ring), discarded as the discarded pill (bar), closed as the closed pill
// (square), moved as the info chip (filled dot) with "Continue here" as a secondary button; a
// closed or discarded board with unsent work offers "Copy my unsent work" the same way (F-17). The
// closed and discarded banners take the focus (Accessibility Floor, Focus). Everything is built
// from text nodes: no markup is parsed.

import type { SnapshotFeedback, SnapshotRequestReply } from "../snapshot-feedback.ts";
import { type BannerSnapshot, createBannerSnapshot } from "./banner-snapshot.ts";
import type { Banner } from "./board-status.ts";

/** What the banners' actions do. */
export type BannerActions = {
  readonly continueHere: () => void;
  readonly copyUnsentWork: () => void;
  /** The Closed banner's "Snapshot" (snapshot task 7.2). */
  readonly takeSnapshot: () => SnapshotRequestReply;
  /** The saved Snapshot's "Copy path": the full path, on the clipboard (review F-06). */
  readonly copyPath: (path: string) => void;
};

export type PageChrome = {
  /** The view's iframe: exactly `sandbox="allow-scripts"` (AD-8). */
  readonly frame: HTMLIFrameElement;
  showBanner(banner: Banner | undefined): void;
  /** Shows how the Closed banner's Snapshot request ended, beside its action. */
  showSnapshot(feedback: SnapshotFeedback): void;
  /** Says the view did not load; undefined removes it. */
  showLoadError(text: string | undefined): void;
};

const BANNER = "flex flex-col gap-xs border-b border-border px-lg py-sm text-body outline-none";

// The banner's row: the marker, the message, the actions; the Snapshot's feedback has the next line.
const ROW = "flex items-center gap-md";

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
  "h-control-height shrink-0 rounded-md border border-border bg-muted px-md text-control text-foreground " +
  "hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

const LOAD_ERROR =
  "border-b border-border bg-destructive-subtle px-lg py-sm text-body text-destructive-text";

export const element = <K extends keyof HTMLElementTagNameMap>(
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

const bannerElement = (
  document: Document,
  banner: Banner,
  actions: BannerActions,
  snapshot: BannerSnapshot,
) => {
  const variant = VARIANTS[banner.variant];
  const root = element(document, "div", `${BANNER} ${variant.banner}`);
  root.dataset.askboardBanner = banner.variant;
  const row = element(document, "div", ROW);
  const marker = element(document, "span", `shrink-0 ${variant.marker}`);
  marker.setAttribute("aria-hidden", "true");
  const message = element(document, "div", "min-w-0 flex-1");
  // The message stays on one line, cut with an ellipsis rather than broken (review F-06).
  const text = element(document, "p", "truncate", banner.text);
  text.title = banner.text;
  message.append(text);
  if (banner.detail !== undefined) message.append(element(document, "p", "", banner.detail));
  row.append(marker, message);
  root.append(row);
  if (banner.action !== undefined) {
    const button = element(document, "button", SECONDARY_BUTTON, banner.action);
    button.type = "button";
    button.addEventListener(
      "click",
      banner.variant === "moved" ? actions.continueHere : actions.copyUnsentWork,
    );
    row.append(button);
  }
  if (banner.snapshot === true) {
    const { button, feedback } = snapshot.elements(document, banner.copyPath ?? "");
    row.append(button);
    root.append(feedback);
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
  const snapshot = createBannerSnapshot({
    take: actions.takeSnapshot,
    buttonClass: SECONDARY_BUTTON,
    copyPath: actions.copyPath,
  });
  return {
    frame,
    showSnapshot: snapshot.show,
    showBanner: (banner) => {
      if (banner === undefined) {
        bannerSlot.replaceChildren();
        return;
      }
      const shown = bannerElement(document, banner, actions, snapshot);
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
