// The board document (owner `ask-core`, AD-12): what `board-host` ships to the board page and what
// the view renders. E1's held one plain question as accepted, with its revision; E3's minor holds
// several questions or areas, and the presentation and delivery the ask requests (ask-lifecycle,
// design decision 2); E5's carries a question's context items as ask-core resolved them (excerpts,
// design decision 2), and E8's names the ask's language and locale (settings-languages, design
// decision 7).

import type { ImageMediaType, TextMediaType, UnresolvedReason } from "../../context/resolution.ts";
import type { SchemaSet } from "../../versions.ts";
import type { GanttItem } from "../../widgets/gantt/index.ts";
import type { TreeItem } from "../../widgets/tree/index.ts";
import type { QuestionProps } from "../input/index.ts";
import boardDocument from "./board-document.json" with { type: "json" };
import excerptProps from "./excerpt-props.json" with { type: "json" };
import imageProps from "./image-props.json" with { type: "json" };
import referenceProps from "./reference-props.json" with { type: "json" };

export const BOARD_DOCUMENT_VERSION = "1.4";

export const boardDocumentSet: SchemaSet = {
  name: "board-document",
  title: "board document",
  owner: "ask-core",
  version: BOARD_DOCUMENT_VERSION,
  schemas: [boardDocument, excerptProps, referenceProps, imageProps],
};

export type BoardQuestion = {
  readonly type: "question";
  readonly id: string;
  /** The question's revision; 1 when the ask is created (AD-20). */
  readonly rev: number;
  /** Its props, with its context items as ask-core resolved them since 1.2 (excerpts). */
  readonly props: BoardQuestionProps;
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
  /** Board document 1.3 (settings-languages): absent in an earlier minor's, read as en-US. */
  readonly language?: "en-US" | "it-IT";
  readonly locale?: "en-US" | "it-IT";
  readonly items:
    | readonly [BoardQuestion, ...BoardQuestion[]]
    | readonly [BoardArea, ...BoardArea[]];
};

// Board document 1.2 (excerpts, design decision 2; proposal B8): a question's context items with
// what ask-core resolved.

/** A range of 1-based lines, both ends included, `start` at most `end`. */
export type ContextLines = { readonly start: number; readonly end: number };

/** An excerpt by pointer, resolved or not, or the text the agent wrote. */
export type BoardExcerptProps =
  | {
      readonly pointer: string;
      readonly title?: string;
      readonly status: "resolved";
      /** The source text: the anchor's lines joined by LF. */
      readonly text: string;
      readonly mediaType: TextMediaType;
      readonly lines: ContextLines;
    }
  | {
      readonly pointer: string;
      readonly title?: string;
      readonly status: "unresolved";
      readonly reason: UnresolvedReason;
    }
  | { readonly text: string; readonly title?: string };

/** A project file by pointer, of kind `file`, or a web page by URL, of kind `github` or `web`. */
export type BoardReferenceProps =
  | {
      readonly pointer: string;
      readonly title?: string;
      readonly kind: "file";
      readonly status: "resolved";
      /** The anchor's lines, when the pointer has an anchor. */
      readonly lines?: ContextLines;
    }
  | {
      readonly pointer: string;
      readonly title?: string;
      readonly kind: "file";
      readonly status: "unresolved";
      readonly reason: UnresolvedReason;
    }
  | { readonly url: string; readonly title?: string; readonly kind: "github" | "web" };

/** An image by pointer: its bytes in base64 when resolved, its reason when not. */
export type BoardImageProps =
  | {
      readonly pointer: string;
      readonly alt: string;
      readonly status: "resolved";
      readonly mediaType: ImageMediaType;
      readonly bytes: string;
    }
  | {
      readonly pointer: string;
      readonly alt: string;
      readonly status: "unresolved";
      readonly reason: UnresolvedReason;
    };

export type BoardContextItem =
  | { readonly type: "excerpt"; readonly id: string; readonly props: BoardExcerptProps }
  | { readonly type: "reference"; readonly id: string; readonly props: BoardReferenceProps }
  | { readonly type: "image"; readonly id: string; readonly props: BoardImageProps };

/**
 * An item of a question as the board document holds it: a resolved context item, or since 1.4 a Tree
 * or a Gantt as ask-core expanded it; a molecule reference is never one (widget-answers).
 */
export type BoardQuestionItem = BoardContextItem | TreeItem | GanttItem;

/** A question's props as the board document holds them: its items resolved. */
export type BoardQuestionProps = Omit<QuestionProps, "items"> & {
  readonly items?: readonly [BoardQuestionItem, ...BoardQuestionItem[]];
};
