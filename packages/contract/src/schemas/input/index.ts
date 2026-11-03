// The input format (owner `contract`, AD-7): what an agent sends. E1 defined the plain question and
// the ask level around it, in English (E1, design decision 1); E3's minor takes several questions,
// areas, FR-3's remaining fields and `update`'s request (ask-lifecycle, design decision 2); E5's
// takes a question's context items: excerpts, references and images (excerpts, design decision 2).
// areas, FR-3's remaining fields and `update`'s request (ask-lifecycle, design decision 2); E8's
// takes it-IT as the ask's language and locale (settings-languages, design decision 2, B8).

import type { SchemaSet } from "../../versions.ts";
import area from "./area.json" with { type: "json" };
import ask from "./ask.json" with { type: "json" };
import excerptProps from "./excerpt-props.json" with { type: "json" };
import id from "./id.json" with { type: "json" };
import imageProps from "./image-props.json" with { type: "json" };
import pointer from "./pointer.json" with { type: "json" };
import question from "./question.json" with { type: "json" };
import questionProps from "./question-props.json" with { type: "json" };
import referenceProps from "./reference-props.json" with { type: "json" };
import update from "./update.json" with { type: "json" };

export const INPUT_FORMAT_VERSION = "1.2";

export const inputFormat: SchemaSet = {
  name: "input",
  title: "input format",
  owner: "contract",
  version: INPUT_FORMAT_VERSION,
  schemas: [
    id,
    questionProps,
    question,
    ask,
    area,
    update,
    pointer,
    excerptProps,
    referenceProps,
    imageProps,
  ],
};

export type ChoiceOption = {
  readonly label: string;
  readonly description?: string;
  /** Plain text shown beside the option (FR-3; proposal, open question 9). */
  readonly preview?: string;
  /** The agent's note on the option, plain text. */
  readonly annotation?: string;
  /** Only labelled: the user still chooses (AD-10). At most one option of a question sets it. */
  readonly recommended?: true;
};

export type QuestionProps = {
  readonly text: string;
  readonly header?: string;
  readonly options: readonly ChoiceOption[];
  readonly multiSelect?: boolean;
  /** Offers the "Other…" row (FR-3). */
  readonly allowOther?: boolean;
  /** The question's context, since input format 1.2 (excerpts, design decision 2). */
  readonly items?: readonly [ContextItem, ...ContextItem[]];
};

export type QuestionItem = {
  readonly type: "question";
  readonly id: string;
  readonly props: QuestionProps;
};

/**
 * An ask as E1 defined it: one plain question, in English. Input format 1.1 accepts several
 * questions and areas, `LifecycleAskInput`, which `validateAskRequest` returns and ask-core reads
 * since ask-lifecycle's task 2.1.
 */
export type AskInput = {
  readonly askId: string;
  readonly title?: string;
  readonly agentName?: string;
  readonly expectedUser?: string;
  readonly presentation?: "sections" | "tabs" | "one-per-view";
  readonly delivery?: "immediate" | "submitted";
  /** Input format 1.2 adds it-IT (settings-languages). */
  readonly language?: "en-US" | "it-IT";
  readonly locale?: "en-US" | "it-IT";
  readonly items: readonly [QuestionItem];
};

// Input format 1.1 (ask-lifecycle, design decision 2).

/** A titled group of questions at the top level of an ask (FR-2). */
export type AreaProps = {
  readonly title: string;
  readonly items: readonly [QuestionItem, ...QuestionItem[]];
};

export type AreaItem = {
  readonly type: "area";
  readonly id: string;
  readonly props: AreaProps;
};

/** A top-level item: a question, or an area holding questions. */
export type AskItem = QuestionItem | AreaItem;

/**
 * An ask as input format 1.1 accepts it: one or more questions, or one or more areas, never both at
 * the top level; areas do not nest.
 */
export type LifecycleAskInput = Omit<AskInput, "items"> & {
  readonly items: readonly [QuestionItem, ...QuestionItem[]] | readonly [AreaItem, ...AreaItem[]];
};

/** The answer the user gave outside the board, which the agent records (FR-6, FR-19). */
export type UpdateAnswer = {
  readonly choice?: readonly string[];
  readonly other?: string;
  readonly note?: string;
};

/**
 * Adds a question to the area `parentId` names, or an item at the top level without it, after the
 * sibling `after` names, or first without it; each is omitted when there is none, never null.
 */
export type AddAction = {
  readonly action: "add";
  readonly item: AskItem;
  readonly parentId?: string;
  readonly after?: string;
};

/** Merges `props` into the item's props key by key, each key replacing its old value whole. */
export type ChangeAction = {
  readonly action: "change";
  readonly itemId: string;
  readonly props: Readonly<Record<string, unknown>>;
};

export type DeleteAction = { readonly action: "delete"; readonly itemId: string };

export type ReopenAction = { readonly action: "reopen"; readonly itemId: string };

export type AnswerAction = {
  readonly action: "answer";
  readonly itemId: string;
  readonly answer: UpdateAnswer;
};

/** Replies to the follow-up event whose cursor `followUp` names. */
export type ReplyAction = {
  readonly action: "reply";
  readonly itemId: string;
  readonly followUp: string;
  readonly text: string;
};

export type CloseAction = { readonly action: "close" };

export type UpdateAction =
  | AddAction
  | ChangeAction
  | DeleteAction
  | ReopenAction
  | AnswerAction
  | ReplyAction
  | CloseAction;

/** `update`'s request as the input format accepts it: actions applied in order, all or none. */
export type UpdateInput = {
  readonly askId: string;
  readonly actions: readonly [UpdateAction, ...UpdateAction[]];
};

// Input format 1.2 (excerpts, design decision 2): a question's context items.

/** An excerpt: a pointer that ask-core resolves, or the text the agent wrote; exactly one. */
export type ExcerptProps =
  | { readonly pointer: string; readonly title?: string }
  | { readonly text: string; readonly title?: string };

/** A project file by pointer, or a web page by its `http:` or `https:` URL; exactly one. */
export type ReferenceProps =
  | { readonly pointer: string; readonly title?: string }
  | { readonly url: string; readonly title?: string };

/** An image by pointer, with no anchor, and its alt text. */
export type ImageProps = { readonly pointer: string; readonly alt: string };

export type ExcerptItem = {
  readonly type: "excerpt";
  readonly id: string;
  readonly props: ExcerptProps;
};
export type ReferenceItem = {
  readonly type: "reference";
  readonly id: string;
  readonly props: ReferenceProps;
};
export type ImageItem = { readonly type: "image"; readonly id: string; readonly props: ImageProps };

/** An item of a question's context, picked by its type. */
export type ContextItem = ExcerptItem | ReferenceItem | ImageItem;
