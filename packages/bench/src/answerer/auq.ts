// The scripted user of the AskUserQuestion arm (early-benchmark design decision 6): a PreToolUse
// hook registered only in the run's settings (AD-10, AD-17), and the permission host `-p` needs
// (addendum, measurement protocol). Both fill AskUserQuestion's `answers`, keyed by question text,
// with the plan's labels (research §5.1). Records hold counts and outcomes, never question text.

import { chooseFor, type PlanEntry } from "../scenarios.ts";

export const AUQ_TOOL = "AskUserQuestion";

type AuqQuestion = {
  readonly question: string;
  readonly options: readonly { readonly label: string }[];
  readonly multiSelect?: boolean;
};

type AuqInput = {
  readonly questions: readonly AuqQuestion[];
  readonly answers?: Readonly<Record<string, string>>;
};

export type AuqHookRecord = {
  readonly kind: "auq-hook";
  readonly toolUseId: string | null;
  readonly questions: number;
  readonly matched: readonly boolean[];
};

export type PermissionRecord = {
  readonly kind: "permission";
  readonly tool: string;
  readonly behavior: "allow" | "deny";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isQuestion = (value: unknown): value is AuqQuestion =>
  isRecord(value) &&
  typeof value.question === "string" &&
  Array.isArray(value.options) &&
  value.options.every((option) => isRecord(option) && typeof option.label === "string");

const asInput = (value: unknown): AuqInput | undefined =>
  isRecord(value) && Array.isArray(value.questions) && value.questions.every(isQuestion)
    ? (value as AuqInput)
    : undefined;

/** The input with the plan's answers; answers already present are kept as they are. */
export const answeredInput = (
  input: AuqInput,
  plan: readonly PlanEntry[],
): { input: AuqInput; matched: boolean[] } => {
  const picks = input.questions.map((question) =>
    chooseFor(
      plan,
      question.options.map((option) => option.label),
    ),
  );
  const matched = picks.map((pick) => pick.matched);
  if (input.answers !== undefined && Object.keys(input.answers).length > 0) {
    return { input, matched };
  }
  const answers = Object.fromEntries(
    input.questions.map((question, index) => [
      question.question,
      (picks[index]?.choice ?? []).join(", "),
    ]),
  );
  return { input: { ...input, answers }, matched };
};

/** What the PreToolUse hook prints, and its record; nothing for another tool or bad input. */
export const hookOutput = (
  hookInput: unknown,
  plan: readonly PlanEntry[],
): { output: unknown; record: AuqHookRecord | undefined } => {
  const toolInput = isRecord(hookInput) ? asInput(hookInput.tool_input) : undefined;
  if (!isRecord(hookInput) || hookInput.tool_name !== AUQ_TOOL || toolInput === undefined) {
    return { output: undefined, record: undefined };
  }
  const { input, matched } = answeredInput(toolInput, plan);
  const toolUseId = typeof hookInput.tool_use_id === "string" ? hookInput.tool_use_id : null;
  return {
    output: {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: "benchmark: the scripted user answered",
        updatedInput: input,
      },
    },
    record: { kind: "auq-hook", toolUseId, questions: input.questions.length, matched },
  };
};

/** The permission host's decision: AskUserQuestion with the plan's answers, nothing else. */
export const approve = (
  request: unknown,
  plan: readonly PlanEntry[],
): { decision: unknown; record: PermissionRecord } => {
  const tool = isRecord(request) && typeof request.tool_name === "string" ? request.tool_name : "?";
  const input = isRecord(request) ? asInput(request.input) : undefined;
  if (tool !== AUQ_TOOL || input === undefined) {
    return {
      decision: { behavior: "deny", message: "the benchmark allows only AskUserQuestion here" },
      record: { kind: "permission", tool, behavior: "deny" },
    };
  }
  return {
    decision: { behavior: "allow", updatedInput: answeredInput(input, plan).input },
    record: { kind: "permission", tool, behavior: "allow" },
  };
};
