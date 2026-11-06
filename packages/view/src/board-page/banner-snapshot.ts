// The Closed banner's "Snapshot" (snapshot task 7.2; EXPERIENCE.md, Board banner: Closed): the
// button and, beside it, its feedback in a live region, in the words of `snapshot-line.ts`. A
// press asks the board page; while the request waits the button is disabled and the line says the
// Snapshot is being taken, with the unsent-work note when the board held some. The feedback is
// kept, so that the banner, drawn again, shows it again. Built from DOM nodes, never markup: a
// path is text.

import type { SnapshotFeedback, SnapshotRequestReply } from "../snapshot-feedback.ts";
import {
  feedbackLineOf,
  refusedLineOf,
  type SnapshotLine,
  takingLineOf,
} from "../snapshot-line.ts";
import { shownPath } from "../snapshot-path.ts";

/** What the banner's Snapshot needs of the board page. */
export type BannerSnapshotDeps = {
  /** The press: the board page's request, sent or refused. */
  readonly take: () => SnapshotRequestReply;
  /** The button's classes, as the banner's other actions have. */
  readonly buttonClass: string;
  /** The saved path's "Copy path": the full path, on the clipboard. */
  readonly copyPath: (path: string) => void;
};

export type BannerSnapshot = {
  /**
   * The button and the feedback, for a Closed banner just drawn: the button goes on the banner's
   * row, the feedback on its own line under it (review F-06). `copyLabel` names "Copy path".
   */
  elements(
    document: Document,
    copyLabel: string,
  ): { readonly button: HTMLButtonElement; readonly feedback: HTMLElement };
  /** How the request ended. */
  show(feedback: SnapshotFeedback): void;
};

// The path is cut in the middle by `shownPath`, shown on one line, its full text in the tooltip.
const CODE = "min-w-0 truncate rounded-sm bg-card px-1 font-mono";

const COPY =
  "shrink-0 rounded-md text-control text-primary-text hover:underline " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

// The line's nodes: the note, the words, the path or folder in code type, and a saved path's copy.
const lineNodes = (
  document: Document,
  line: SnapshotLine,
  copy: { readonly label: string; readonly onCopy: (path: string) => void },
): HTMLElement[] => {
  const span = (text: string, className: string) => {
    const node = document.createElement("span");
    node.className = className;
    node.textContent = text;
    return node;
  };
  const nodes = line.note === undefined ? [] : [span(line.note, "")];
  nodes.push(span(line.text, line.failed ? "text-destructive-text" : ""));
  if (line.code !== undefined) {
    const code = document.createElement("code");
    code.className = CODE;
    code.textContent = shownPath(line.code);
    code.title = line.code;
    nodes.push(code);
  }
  const { savedPath } = line;
  if (savedPath !== undefined) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = COPY;
    button.textContent = copy.label;
    button.addEventListener("click", () => copy.onCopy(savedPath));
    nodes.push(button);
  }
  return nodes;
};

/** The Closed banner's Snapshot, none asked at first. */
export const createBannerSnapshot = (deps: BannerSnapshotDeps): BannerSnapshot => {
  let line: SnapshotLine | undefined;
  let waiting = false;
  let copyLabel = "";
  let drawn: { readonly button: HTMLButtonElement; readonly feedback: HTMLElement } | undefined;
  const draw = () => {
    if (drawn === undefined) return;
    drawn.button.disabled = waiting;
    const document = drawn.feedback.ownerDocument;
    const copy = { label: copyLabel, onCopy: deps.copyPath };
    drawn.feedback.replaceChildren(...(line === undefined ? [] : lineNodes(document, line, copy)));
  };
  const press = () => {
    if (waiting) return;
    const reply = deps.take();
    if (reply.outcome === "refused") {
      line = refusedLineOf(reply.detail);
    } else {
      waiting = true;
      line = takingLineOf(reply.unsentWork === true);
    }
    draw();
  };
  return {
    elements: (document, label) => {
      copyLabel = label;
      const button = document.createElement("button");
      button.type = "button";
      button.className = deps.buttonClass;
      button.textContent = "Snapshot";
      button.addEventListener("click", press);
      const feedback = document.createElement("p");
      feedback.setAttribute("role", "status");
      feedback.dataset.askboardSnapshotFeedback = "";
      // Empty, it takes no room but stays in the page for the live region.
      feedback.className = "flex min-w-0 items-baseline gap-x-2 empty:sr-only";
      drawn = { button, feedback };
      draw();
      return drawn;
    },
    show: (feedback) => {
      waiting = false;
      line = feedbackLineOf(feedback);
      draw();
    },
  };
};
