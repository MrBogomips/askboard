// The reading panel (excerpts, design decision 7; DESIGN.md, Reading panel; EXPERIENCE.md,
// Reading panel): a non-modal side sheet on the board page, since the source view cannot be framed
// inside the sandboxed view (AD-8). It is `{spacing.side-sheet}` wide at the right edge, between
// the view's header and bottom bar as the view reported them. A header holds the file's path, the
// "Changed since the agent asked" chip, "Open in editor" and the close control; the body is the
// loading look, one line saying why a source is not shown, or the source view framed at the anchor
// with an empty `sandbox` and no referrer. The panel reads nothing of the file: the frame fetches
// it from the source route with the token, and everything shown is text (AD-8).

import type { EditorOutcomeMessage, SourceStateMessage } from "@askboard/contract";
import { markedString } from "../catalog/context/marks.ts";
import type { ReferenceInset } from "../view-protocol.ts";
import {
  LOADING,
  noteRuns,
  outcomeNote,
  type PanelView,
  panelViewOf,
  sourceUrlOf,
} from "./reading-panel-state.ts";

/** What opens the panel: the item, the file's path from the board document, the view's insets. */
export type PanelRequest = {
  readonly itemId: string;
  readonly path: string;
  readonly inset: ReferenceInset;
};

/** What the panel asks of the board page: the click on "Open in editor", and its own closing. */
export type PanelActions = {
  readonly openEditor: () => void;
  /** The user closed the panel (Esc or the close control): focus goes back to the reference. */
  readonly closed: () => void;
};

export type ReadingPanel = {
  /** Opens the panel for an item, in the loading state; one already open is replaced. */
  open(request: PanelRequest, actions: PanelActions): void;
  /** The source's state for the item the panel shows; any other item's is ignored. */
  sourceState(message: SourceStateMessage): void;
  /** The editor's outcome for the item the panel shows. */
  editorOutcome(message: EditorOutcomeMessage): void;
  /** Closes the panel with no focus change: the board moved or was discarded. */
  close(): void;
  /** The item the panel shows, if it is open. */
  readonly itemId: string | undefined;
};

/** What the panel needs of the page: the address of its frame's source. */
export type PanelOptions = {
  readonly askId: string;
  readonly token: string;
  readonly scheme: () => "light" | "dark";
};

const PANEL =
  "fixed right-0 z-10 flex w-[560px] max-w-full flex-col border-l border-border bg-popover shadow-lg";
const HEADER = "flex shrink-0 items-center gap-2 border-b border-border px-3 py-2";
const PATH = "min-w-0 flex-1 truncate font-mono text-code text-foreground";
const CHIP = "shrink-0 rounded-md bg-info-subtle px-1.5 py-0.5 text-badge text-info-text";
const BUTTON =
  "inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-muted px-3 text-control text-foreground " +
  "enabled:hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring " +
  "disabled:text-muted-foreground disabled:opacity-50";
const CLOSE = `${BUTTON} w-7 justify-center px-0`;
const NOTE = "shrink-0 border-b border-border px-3 py-1 text-body text-muted-foreground";
const BODY = "relative min-h-0 flex-1";
const MESSAGE = "flex flex-col gap-1 p-4 text-body text-muted-foreground";
const SKELETON = "m-4 h-4 w-1/2 animate-pulse rounded-md bg-muted";
const FRAME = "absolute inset-0 block size-full border-0 bg-popover";

const made = <K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

type Open = {
  readonly itemId: string;
  readonly path: string;
  readonly actions: PanelActions;
  readonly elements: {
    readonly root: HTMLElement;
    readonly chip: HTMLElement;
    readonly editor: HTMLButtonElement;
    readonly close: HTMLButtonElement;
    readonly note: HTMLElement;
    readonly body: HTMLElement;
  };
};

/** Builds the panel's elements, hidden until the first `open`. */
export const createReadingPanel = (document: Document, options: PanelOptions): ReadingPanel => {
  let current: Open | undefined;

  const remove = () => {
    current?.elements.root.remove();
    current = undefined;
  };

  const showNote = (open: Open, text: string | undefined) => {
    const { note } = open.elements;
    note.replaceChildren(
      ...noteRuns(text ?? "").map((run) =>
        run.code
          ? made(document, "code", "font-mono text-code", run.text)
          : document.createTextNode(run.text),
      ),
    );
    open.elements.note.hidden = text === undefined;
  };

  const showBody = (open: Open, view: PanelView) => {
    const { body } = open.elements;
    const { body: content } = view;
    if (content.kind === "loading") {
      body.replaceChildren(made(document, "div", SKELETON));
      return;
    }
    if (content.kind === "message") {
      const message = made(document, "div", MESSAGE);
      message.append(
        made(document, "p", "", content.text),
        made(document, "p", "font-mono text-code text-foreground", open.path),
      );
      body.replaceChildren(message);
      return;
    }
    const frame = made(document, "iframe", FRAME);
    // Empty `sandbox`: the source view runs nothing and has no origin (AD-8); no referrer.
    frame.setAttribute("sandbox", "");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.title = `Source of ${open.path}`;
    // Hidden until it has loaded, so the loading look shows meanwhile.
    frame.classList.add("invisible");
    const loading = made(document, "div", SKELETON);
    frame.addEventListener("load", () => {
      loading.remove();
      frame.classList.remove("invisible");
    });
    frame.src = sourceUrlOf({
      askId: options.askId,
      itemId: open.itemId,
      token: options.token,
      scheme: options.scheme(),
      ...(content.line === undefined ? {} : { line: content.line }),
    });
    body.replaceChildren(loading, frame);
  };

  const apply = (open: Open, view: PanelView) => {
    open.elements.chip.hidden = !view.changed;
    open.elements.editor.disabled = !view.editorEnabled;
    showNote(open, view.editorNote);
    showBody(open, view);
  };

  const build = (request: PanelRequest, actions: PanelActions): Open => {
    const root = made(document, "aside", PANEL);
    root.setAttribute("aria-label", "Reading panel");
    root.style.top = `${request.inset.top}px`;
    root.style.bottom = `${request.inset.bottom}px`;
    const header = made(document, "div", HEADER);
    // The controls that could reorder a path show as their escapes, as in the source view.
    const shown = markedString(request.path);
    const path = made(document, "span", PATH, shown);
    path.title = shown;
    path.dir = "auto";
    const chip = made(document, "span", CHIP, "Changed since the agent asked");
    chip.hidden = true;
    const editor = made(document, "button", BUTTON, "Open in editor");
    editor.type = "button";
    editor.disabled = true;
    const close = made(document, "button", CLOSE, "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close reading panel");
    header.append(path, chip, editor, close);
    const note = made(document, "div", NOTE);
    note.hidden = true;
    note.setAttribute("role", "status");
    const body = made(document, "div", BODY);
    root.append(header, note, body);
    const open: Open = {
      itemId: request.itemId,
      path: markedString(request.path),
      actions,
      elements: { root, chip, editor, close, note, body },
    };
    const dismiss = () => {
      if (current !== open) return;
      remove();
      actions.closed();
    };
    close.addEventListener("click", dismiss);
    editor.addEventListener("click", () => actions.openEditor());
    root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !header.contains(event.target as Node | null)) return;
      event.preventDefault();
      dismiss();
    });
    return open;
  };

  return {
    open: (request, actions) => {
      remove();
      const open = build(request, actions);
      current = open;
      apply(open, LOADING);
      document.body.append(open.elements.root);
      open.elements.close.focus({ preventScroll: true });
    },
    sourceState: (message) => {
      if (current === undefined || message.itemId !== current.itemId) return;
      apply(current, panelViewOf(message));
    },
    editorOutcome: (message) => {
      if (current === undefined || message.itemId !== current.itemId) return;
      showNote(current, outcomeNote(message.outcome));
    },
    close: remove,
    get itemId() {
      return current?.itemId;
    },
  };
};
