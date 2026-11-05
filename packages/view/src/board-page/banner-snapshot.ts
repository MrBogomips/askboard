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

/** What the banner's Snapshot needs of the board page. */
export type BannerSnapshotDeps = {
  /** The press: the board page's request, sent or refused. */
  readonly take: () => SnapshotRequestReply;
  /** The button's classes, as the banner's other actions have. */
  readonly buttonClass: string;
};

export type BannerSnapshot = {
  /** The button and the feedback, for a Closed banner just drawn. */
  elements(document: Document): readonly HTMLElement[];
  /** How the request ended. */
  show(feedback: SnapshotFeedback): void;
};

const CODE = "rounded-sm bg-card px-1 font-mono break-all";

// The line's nodes: the note, the words, the path or folder in code type.
const lineNodes = (document: Document, line: SnapshotLine): HTMLElement[] => {
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
    code.textContent = line.code;
    nodes.push(code);
  }
  return nodes;
};

/** The Closed banner's Snapshot, none asked at first. */
export const createBannerSnapshot = (deps: BannerSnapshotDeps): BannerSnapshot => {
  let line: SnapshotLine | undefined;
  let waiting = false;
  let drawn: { readonly button: HTMLButtonElement; readonly feedback: HTMLElement } | undefined;
  const draw = () => {
    if (drawn === undefined) return;
    drawn.button.disabled = waiting;
    const document = drawn.feedback.ownerDocument;
    drawn.feedback.replaceChildren(...(line === undefined ? [] : lineNodes(document, line)));
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
    elements: (document) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = deps.buttonClass;
      button.textContent = "Snapshot";
      button.addEventListener("click", press);
      const feedback = document.createElement("p");
      feedback.setAttribute("role", "status");
      feedback.dataset.askboardSnapshotFeedback = "";
      feedback.className = "flex min-w-0 flex-wrap items-baseline gap-x-2";
      drawn = { button, feedback };
      draw();
      return [feedback, button];
    },
    show: (feedback) => {
      waiting = false;
      line = feedbackLineOf(feedback);
      draw();
    },
  };
};
