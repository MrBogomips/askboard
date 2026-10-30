// The board document (owner `ask-core`, AD-12): what `board-host` ships to the board page and what
// the view renders. E1's holds one plain question as accepted, with its revision.

import type { SchemaSet } from "../../versions.ts";
import type { QuestionProps } from "../input/index.ts";
import boardDocument from "./board-document.json" with { type: "json" };

export const BOARD_DOCUMENT_VERSION = "1.0";

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

export type BoardDocument = {
  readonly version: string;
  readonly askId: string;
  /** The agent's title, or the one derived from the first question (FR-1). */
  readonly title: string;
  readonly items: readonly [BoardQuestion];
};
