// The content an answer may carry for a revision of a question (AD-10, FR-3): labels of its options,
// one unless `multiSelect`; "Other…" text only with `allowOther`; option notes on its labels; a note;
// and a label or "Other…" text unless it declines. Commands come from outside the process, so the
// shapes are checked here too, not only typed.

import {
  NOTE_MAX_CHARS,
  OPTION_NOTE_MAX_CHARS,
  OTHER_MAX_CHARS,
  type QuestionProps,
  WIDGET_TYPES,
  type WidgetType,
  widgetTypeOf,
} from "@askboard/contract";
import type { AnswerContent } from "./model.ts";
import { holdsEditWidget, namesOf, type WidgetContent } from "./widget-values.ts";

export type ContentProblem = { readonly refusal: "choice" | "content"; readonly detail: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Why a value is not text of 1 to `max` characters, counted in code points as the schemas count. */
export const textProblem = (value: unknown, max: number, what: string): string | undefined => {
  if (typeof value !== "string") return `${what} is not text`;
  const length = [...value].length;
  if (length === 0) return `${what} is empty`;
  return length > max ? `${what} is longer than ${max} characters` : undefined;
};

/** Why a choice cannot answer a question with these props, or undefined when it can. */
export const choiceProblem = (choice: unknown, props: QuestionProps): string | undefined => {
  if (!Array.isArray(choice) || !choice.every((label) => typeof label === "string")) {
    return "the choice is not a list of option labels";
  }
  if (choice.length === 0) return "the choice is empty";
  if (new Set(choice).size !== choice.length) return "the choice names an option twice";
  if (props.multiSelect !== true && choice.length > 1) return "the question takes one option";
  const labels = new Set((props.options ?? []).map((option) => option.label));
  const unknown = choice.find((label) => !labels.has(label));
  return unknown === undefined ? undefined : "the choice names a label that is not an option";
};

const notesProblem = (notes: unknown, props: QuestionProps): string | undefined => {
  if (!isRecord(notes)) return "the option notes are not an object of notes by label";
  const entries = Object.entries(notes);
  if (entries.length === 0) return "the option notes are empty";
  const labels = new Set((props.options ?? []).map((option) => option.label));
  for (const [label, note] of entries) {
    if (!labels.has(label)) return `the option notes name "${label}", which is not an option`;
    const problem = textProblem(note, OPTION_NOTE_MAX_CHARS, `the note on "${label}"`);
    if (problem !== undefined) return problem;
  }
  return undefined;
};

const otherProblem = (other: unknown, props: QuestionProps): string | undefined => {
  if (props.allowOther !== true) return "the question offers no Other… text";
  return textProblem(other, OTHER_MAX_CHARS, "the Other… text");
};

/**
 * Why this content cannot answer a question with these props, or undefined when it can. A decline
 * carries at most its reason, as `note`.
 */
export const contentProblem = (
  content: Readonly<Record<string, unknown>>,
  props: QuestionProps,
  declined: boolean,
  widgetChange = false,
  types: readonly WidgetType[] = WIDGET_TYPES,
  asSent = false,
): ContentProblem | undefined => {
  const { choice, other, optionNotes, note } = content;
  if (choice !== undefined) {
    const detail = choiceProblem(choice, props);
    if (detail !== undefined) return { refusal: "choice", detail };
  }
  const problem =
    (other === undefined ? undefined : otherProblem(other, props)) ??
    (optionNotes === undefined ? undefined : notesProblem(optionNotes, props)) ??
    (note === undefined ? undefined : textProblem(note, NOTE_MAX_CHARS, "the note"));
  if (problem !== undefined) return { refusal: "content", detail: problem };
  if (!declined && !widgetChange && !asSent && choice === undefined && other === undefined) {
    return {
      refusal: "content",
      detail: `the answer names no option, has no Other… text, changes no ${namesOf(types)} and gives no result`,
    };
  }
  return undefined;
};

const ACCEPTED = "an answer accepted as sent";

/**
 * Why an answer that accepts the question's content as sent cannot be one, or undefined when it can
 * (accept-as-sent, design decisions 4 and 11; AD-10): the revision it names has options or holds no
 * widget whose content the user edits, it carries a choice, "Other…" text or option notes, a
 * result of an item that is no input field (a type that declares no `fieldCheck`: an Approval's
 * verdict or a Ranking's order would contradict "accepted as is"), or a value that differs from
 * the item as sent. `widgets` is the content `widgetContentOf` kept: any value in it is one that
 * differs. The results of input fields stay; their field checks run after.
 */
export const asSentProblem = (
  content: Readonly<Record<string, unknown>>,
  props: QuestionProps,
  widgets: WidgetContent,
  types: readonly WidgetType[] = WIDGET_TYPES,
): ContentProblem | undefined => {
  const refuse = (detail: string): ContentProblem => ({ refusal: "content", detail });
  if ((props.options ?? []).length > 0) {
    return refuse(`${ACCEPTED} is only for a question with no options`);
  }
  if (!holdsEditWidget(props, types)) {
    return refuse(`${ACCEPTED} needs a ${namesOf(types)} item whose content the user edits`);
  }
  for (const field of ["choice", "other", "optionNotes"] as const) {
    if (content[field] !== undefined) return refuse(`${ACCEPTED} carries no ${field}`);
  }
  if (Object.keys(widgets.values).length > 0) {
    return refuse(`${ACCEPTED} holds values that differ from the content as sent`);
  }
  for (const id of Object.keys(widgets.results)) {
    const item = widgets.sent.find((sent) => sent.id === id);
    if (widgetTypeOf(item?.type ?? "", types)?.fieldCheck === undefined) {
      return refuse(`${ACCEPTED} carries no result of item ${id}, which is no input field`);
    }
  }
  return undefined;
};

/** The content fields that are present, as an answer holds them, copied. */
export const contentOf = (content: Readonly<Record<string, unknown>>): AnswerContent => {
  const { choice, other, optionNotes, note } = content as AnswerContent;
  return {
    ...(choice === undefined ? {} : { choice: [...choice] }),
    ...(other === undefined ? {} : { other }),
    ...(optionNotes === undefined ? {} : { optionNotes: { ...optionNotes } }),
    ...(note === undefined ? {} : { note }),
  };
};
