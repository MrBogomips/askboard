// The input format (owner `contract`, AD-7): what an agent sends. E1 defines the plain question;
// the ask level around it comes with the agent-side sets.

import type { SchemaSet } from "../../versions.ts";
import id from "./id.json" with { type: "json" };
import question from "./question.json" with { type: "json" };
import questionProps from "./question-props.json" with { type: "json" };

export const INPUT_FORMAT_VERSION = "1.0";

export const inputFormat: SchemaSet = {
  name: "input",
  title: "input format",
  owner: "contract",
  version: INPUT_FORMAT_VERSION,
  schemas: [id, questionProps, question],
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
