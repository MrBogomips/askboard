// The reading panel's and the editor's messages to the board page (excerpts, design decision 5,
// Messages; board protocol 1.2): a source's state, with whether "Open in editor" can open it.

import {
  BOARD_PROTOCOL_VERSION,
  type EditorOutcome,
  type EditorOutcomeMessage,
  type SourceStateMessage,
} from "@askboard/contract";
import type { SourceState } from "@askboard/core";

/** The state of an item that has no source, or of a core that reads none. */
export const NO_SOURCE: SourceState = { status: "missing" };

/**
 * `source-state` for an item: its status, an excerpt's `changed` and the anchor's line when ask-core
 * gave them, and `editor` when a command is set and the file is available.
 */
export const sourceStateMessage = (
  itemId: string,
  state: SourceState,
  editorSet: boolean,
): SourceStateMessage => {
  const available = state.status === "available";
  return {
    version: BOARD_PROTOCOL_VERSION,
    type: "source-state",
    itemId,
    status: state.status,
    ...(available && state.changed !== undefined ? { changed: state.changed } : {}),
    ...(available && state.line !== undefined ? { line: state.line } : {}),
    editor: editorSet && available,
  };
};

/** `editor-outcome` for an item: what "Open in editor" did. */
export const editorOutcomeMessage = (
  itemId: string,
  outcome: EditorOutcome,
): EditorOutcomeMessage => ({
  version: BOARD_PROTOCOL_VERSION,
  type: "editor-outcome",
  itemId,
  outcome,
});
