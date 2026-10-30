// The input format (owner `contract`, AD-7): what an agent sends. E1 defines the plain question and
// the ask level around it: one question per ask, in English (design decision 1).

import type { SchemaSet } from "../../versions.ts";
import ask from "./ask.json" with { type: "json" };
import id from "./id.json" with { type: "json" };
import question from "./question.json" with { type: "json" };
import questionProps from "./question-props.json" with { type: "json" };

export const INPUT_FORMAT_VERSION = "1.0";

export const inputFormat: SchemaSet = {
  name: "input",
  title: "input format",
  owner: "contract",
  version: INPUT_FORMAT_VERSION,
  schemas: [id, questionProps, question, ask],
};

export type ChoiceOption = {
  readonly label: string;
  readonly description?: string;
};

export type QuestionProps = {
  readonly text: string;
  readonly header?: string;
  readonly options: readonly ChoiceOption[];
  readonly multiSelect?: boolean;
};

export type QuestionItem = {
  readonly type: "question";
  readonly id: string;
  readonly props: QuestionProps;
};

/** An ask as the input format accepts it in E1: one plain question, in English. */
export type AskInput = {
  readonly askId: string;
  readonly title?: string;
  readonly agentName?: string;
  readonly expectedUser?: string;
  readonly presentation?: "sections" | "tabs" | "one-per-view";
  readonly delivery?: "immediate" | "submitted";
  readonly language?: "en-US";
  readonly locale?: "en-US";
  readonly items: readonly [QuestionItem];
};
