// The board document (owner `ask-core`, AD-12): what `board-host` ships to the board page and what
// the view renders. E1's held one plain question as accepted, with its revision; E3's minor holds
// several questions or areas, and the presentation and delivery the ask requests (ask-lifecycle,
// design decision 2).

import type { SchemaSet } from "../../versions.ts";
import type { QuestionProps } from "../input/index.ts";
import boardDocument from "./board-document.json" with { type: "json" };

export const BOARD_DOCUMENT_VERSION = "1.1";

export const boardDocumentSet: SchemaSet = {
  name: "board-document",
  title: "board document",
  owner: "ask-core",
  version: BOARD_DOCUMENT_VERSION,
  schemas: [boardDocument],
};

export type BoardQuestion = {
  readonly type: "question";
  readonly id: string;
  /** The question's revision; 1 when the ask is created (AD-20). */
  readonly rev: number;
  readonly props: QuestionProps;
};

/**
 * A board document as E1's units read it: one question. Board document 1.1 holds several, or areas,
 * `LifecycleBoardDocument`; this type keeps E1's shape until ask-core and the view read them.
 */
export type BoardDocument = {
  readonly version: string;
  readonly askId: string;
  /** The agent's title, or the one derived from the first question (FR-1). */
  readonly title: string;
  readonly items: readonly [BoardQuestion];
};

// Board document 1.1 (ask-lifecycle, design decision 2).

export type BoardAreaProps = {
  readonly title: string;
  readonly items: readonly [BoardQuestion, ...BoardQuestion[]];
};

/** A titled group of questions; it has no revision of its own. */
export type BoardArea = {
  readonly type: "area";
  readonly id: string;
  readonly props: BoardAreaProps;
};

export type BoardItem = BoardQuestion | BoardArea;

/** A board document of several questions, or of areas holding them, never both at the top level. */
export type LifecycleBoardDocument = Omit<BoardDocument, "items"> & {
  readonly presentation?: "sections" | "tabs" | "one-per-view";
  readonly delivery?: "immediate" | "submitted";
  readonly items:
    | readonly [BoardQuestion, ...BoardQuestion[]]
    | readonly [BoardArea, ...BoardArea[]];
};
