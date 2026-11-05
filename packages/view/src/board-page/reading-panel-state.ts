// What the reading panel shows (excerpts, design decision 7; DESIGN.md, Reading panel: States),
// apart from the elements that show it: from a source state `board-host` sent, the body (the
// source view framed at the anchor, or one line saying why not), whether the range changed since
// the agent asked, and whether "Open in editor" can be used and, if not, why. Pure: no DOM, so a
// table of states can be tested.

import {
  BOARD_TOKEN_QUERY,
  type EditorOutcomeMessage,
  SOURCE_SCHEME_QUERY,
  type SourceStateMessage,
  sourcePath,
} from "@askboard/contract";

export type PanelBody =
  | { readonly kind: "loading" }
  | { readonly kind: "frame"; readonly line?: number }
  | { readonly kind: "message"; readonly text: string };

export type PanelView = {
  readonly body: PanelBody;
  /** The range changed since the agent asked: the header says so. */
  readonly changed: boolean;
  readonly editorEnabled: boolean;
  /** Why "Open in editor" is disabled, when the missing editor is the reason. */
  readonly editorNote?: string;
};

export const NO_EDITOR_NOTE = "No editor set: `editor` in ~/.config/askboard/config.json";

/** The panel as it opens, before `board-host` has answered. */
export const LOADING: PanelView = {
  body: { kind: "loading" },
  changed: false,
  editorEnabled: false,
};

const UNAVAILABLE: Readonly<Record<Exclude<SourceStateMessage["status"], "available">, string>> = {
  missing: "This file is not available",
  "outside-root": "This file is not available",
  "not-text": "This file cannot be shown as text",
  "too-large": "This file is too large to show here",
};

/** The panel for a source state. */
export const panelViewOf = (state: SourceStateMessage): PanelView => {
  if (state.status !== "available") {
    return {
      body: { kind: "message", text: UNAVAILABLE[state.status] },
      changed: false,
      // Board-host says whether an editor is set and can open the file: a file too large to show
      // can still be opened in one.
      editorEnabled: state.editor,
    };
  }
  return {
    body: state.line === undefined ? { kind: "frame" } : { kind: "frame", line: state.line },
    changed: state.changed === true,
    editorEnabled: state.editor,
    ...(state.editor ? {} : { editorNote: NO_EDITOR_NOTE }),
  };
};

const OUTCOMES: Readonly<Record<Exclude<EditorOutcomeMessage["outcome"], "opened">, string>> = {
  "no-editor": NO_EDITOR_NOTE,
  unavailable: "This file is not available",
  failed: "Could not start the editor",
  busy: "The editor was opened a moment ago. Try again shortly.",
};

/** What to tell the user of an editor launch: nothing when it opened. */
export const outcomeNote = (outcome: EditorOutcomeMessage["outcome"]): string | undefined =>
  outcome === "opened" ? undefined : OUTCOMES[outcome];

/** The file's path of a pointer: what the header shows. */
export const pathOf = (pointer: string): string => {
  const at = pointer.indexOf("#");
  return at < 0 ? pointer : pointer.slice(0, at);
};

type SourceAddress = {
  readonly askId: string;
  readonly itemId: string;
  readonly token: string;
  readonly scheme: "light" | "dark";
  readonly line?: number;
};

/** The source view's address for the frame: token and scheme in the query, the line as fragment. */
export const sourceUrlOf = ({ askId, itemId, token, scheme, line }: SourceAddress): string =>
  `${sourcePath(askId, itemId)}?${BOARD_TOKEN_QUERY}=${encodeURIComponent(token)}&${SOURCE_SCHEME_QUERY}=${scheme}${line === undefined ? "" : `#L${line}`}`;
