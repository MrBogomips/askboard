// The agent's `update` (ask-lifecycle, design decision 3; AD-6, AD-20): its actions applied in order
// to a copy of the ask's items, each checked against what the earlier ones leave, so that one
// refused action leaves the ask unchanged. The agent's own changes are reported in the result and
// never logged (AD-3).

import type { AppliedAction, AskState, UpdateAction } from "@askboard/contract";
import { validateAskRequest } from "@askboard/contract/validate";
import type { EventLog } from "./log.ts";
import type { BoardModel, QuestionRecord } from "./model.ts";
import { type QuestionStatus, questionStatus } from "./states.ts";

/** Why an action cannot apply. */
export type UpdateRefusal =
  | "unknown-item"
  | "deleted"
  /** A question whose latest answer or decline is logged or recorded: reopen it first. */
  | "answered"
  /** Props the input format refuses once merged. */
  | "props"
  | "unsupported";

export type UpdateOutcome =
  | {
      readonly kind: "updated";
      readonly askId: string;
      readonly state: AskState;
      readonly applied: readonly AppliedAction[];
    }
  | {
      readonly kind: "refused";
      readonly askId: string;
      /** The refused action's index in the request. */
      readonly index: number;
      readonly itemId?: string;
      /** The cursor of the logged answer that stops a change. */
      readonly cursor?: string;
      readonly refusal: UpdateRefusal;
      readonly detail: string;
    };

export type UpdateContext = {
  readonly askId: string;
  readonly model: BoardModel;
  readonly log: EventLog;
};

/** What an update changed, for the subscription: the board document, the board's state. */
export type UpdateEffects = { document: boolean; state: boolean };

type Refusal = Omit<Extract<UpdateOutcome, { kind: "refused" }>, "kind" | "askId" | "index">;

type Step = AppliedAction | Refusal;

const refuse = (refusal: UpdateRefusal, detail: string, itemId?: string): Refusal => ({
  refusal,
  detail,
  ...(itemId === undefined ? {} : { itemId }),
});

const statusOf = (context: UpdateContext, question: QuestionRecord): QuestionStatus =>
  questionStatus(question.mark, context.log.ofItem(question.id));

const missing = (context: UpdateContext, itemId: string): Refusal =>
  context.model.isDeleted(itemId)
    ? refuse("deleted", `the item "${itemId}" was deleted`, itemId)
    : refuse("unknown-item", `the ask has no item "${itemId}"`, itemId);

/** A refusal for a question whose latest answer or decline stands, naming it (AD-20). */
export const answeredRefusal = (
  question: QuestionRecord,
  status: QuestionStatus,
  what: string,
): Refusal | undefined => {
  if (status.answer === undefined) return undefined;
  const { id } = question;
  const declined = status.state === "declined" ? "declined" : "answered";
  if (status.answer.kind === "recorded") {
    return refuse(
      "answered",
      `the question "${id}" holds the answer you recorded; reopen it first to ${what} it`,
      id,
    );
  }
  const { cursor } = status.answer.entry.event;
  return {
    ...refuse(
      "answered",
      `the question "${id}" was ${declined} at ${cursor}; reopen it first to ${what} it`,
      id,
    ),
    cursor,
  };
};

// The first problems the input format finds in an item, in a sentence.
const itemProblems = (context: UpdateContext, item: unknown): string | undefined => {
  const checked = validateAskRequest({ askId: context.askId, items: [item] });
  if (checked.ok) return undefined;
  return checked.problems
    .slice(0, 3)
    .map(({ message }) => message)
    .join("; ");
};

const changeArea = (context: UpdateContext, itemId: string, props: Record<string, unknown>) => {
  const area = context.model.area(itemId);
  if (area === undefined) return missing(context, itemId);
  if (Object.keys(props).some((key) => key !== "title")) {
    const detail = `an area's change sets only its title; add, change and delete its questions with their own actions`;
    return refuse("props", detail, itemId);
  }
  const title = props.title ?? area.title;
  const items = context.model
    .areaQuestions(area)
    .map(({ type, id, props }) => ({ type, id, props }));
  const problems = itemProblems(context, { type: "area", id: itemId, props: { title, items } });
  if (problems !== undefined) return refuse("props", problems, itemId);
  context.model.retitle(area, title as string);
  return { action: "change", itemId } as const;
};

const change = (
  context: UpdateContext,
  action: Extract<UpdateAction, { action: "change" }>,
): Step => {
  const { itemId } = action;
  const props = { ...action.props };
  const question = context.model.question(itemId);
  if (question === undefined) return changeArea(context, itemId, props);
  const stands = answeredRefusal(question, statusOf(context, question), "change");
  if (stands !== undefined) return stands;
  const merged = { ...context.model.propsOf(question), ...props };
  const problems = itemProblems(context, { type: "question", id: itemId, props: merged });
  if (problems !== undefined) return refuse("props", problems, itemId);
  const rev = context.model.revise(question, merged as never);
  return { action: "change", itemId, rev };
};

const STEPS: Readonly<
  Partial<Record<UpdateAction["action"], (context: UpdateContext, action: never) => Step>>
> = {
  change,
};

const EFFECTS: Readonly<Partial<Record<UpdateAction["action"], Partial<UpdateEffects>>>> = {
  change: { document: true, state: true },
};

export type Applied =
  | {
      readonly ok: true;
      readonly applied: readonly AppliedAction[];
      readonly effects: UpdateEffects;
    }
  | ({ readonly ok: false; readonly index: number } & Refusal);

/**
 * Applies the actions in order to `context.model`, a copy the caller keeps only when every action
 * applies; stops at the first refusal.
 */
export const applyActions = (context: UpdateContext, actions: readonly UpdateAction[]): Applied => {
  const applied: AppliedAction[] = [];
  const effects: UpdateEffects = { document: false, state: false };
  for (const [index, action] of actions.entries()) {
    const step = STEPS[action.action];
    const outcome: Step =
      step === undefined
        ? refuse("unsupported", `the action "${action.action}" is not supported yet`)
        : step(context, action as never);
    if ("refusal" in outcome) return { ok: false, index, ...outcome };
    applied.push(outcome);
    effects.document ||= EFFECTS[action.action]?.document ?? false;
    effects.state ||= EFFECTS[action.action]?.state ?? false;
  }
  return { ok: true, applied, effects };
};
