// The agent's `update` (ask-lifecycle, design decision 3; AD-6, AD-20): its actions applied in order
// to a copy of the ask's items, each checked against what the earlier ones leave, so that one
// refused action leaves the ask unchanged. The agent's own changes are reported in the result and
// never logged (AD-3).

import {
  type AppliedAction,
  type AskState,
  type FormulaWarning,
  type QuestionProps,
  type UnresolvedPointerWarning,
  type UpdateAction,
  WIDGET_TYPES,
  type WidgetType,
} from "@askboard/contract";
import { validateAskRequestOver } from "@askboard/contract/validate";
import { referencesIn } from "../molecules/references.ts";
import { parseCursor } from "../text.ts";
import { contentOf, contentProblem } from "./answers.ts";
import type { EventLog } from "./log.ts";
import { type BoardModel, itemIdsOf, type QuestionRecord } from "./model.ts";
import { type QuestionStatus, questionStatus } from "./states.ts";
import { fullAnswer } from "./views.ts";
import {
  changedReference,
  expandAdded,
  holderOf,
  mergedWidget,
  replaceQuestionItems,
  type WidgetHolder,
  type WidgetUpdate,
} from "./widget-update.ts";

/** Why an action cannot apply. */
export type UpdateRefusal =
  | "unknown-item"
  | "deleted"
  /** An ID the ask holds or held: item IDs are never reused (FR-5). */
  | "in-use"
  /** `parentId` names no area of the ask. */
  | "parent"
  /** `after` names no item where the new one goes. */
  | "after"
  /** Areas are all the top-level items of an ask, or none (FR-2). */
  | "area-rule"
  /** A question whose latest answer or decline is logged or recorded: reopen it first. */
  | "answered"
  /** A reopen of a question with no answer or decline. */
  | "not-answered"
  /** An action that applies to questions only, naming an area. */
  | "not-question"
  /** Props the input format refuses once merged. */
  | "props"
  /** No question would remain: close the ask instead. */
  | "last-question"
  /** A reply naming no follow-up of its question in this epoch. */
  | "follow-up"
  /** A recorded answer the question cannot hold. */
  | "choice"
  | "content"
  /** An action after `close` in the same update. */
  | "closed";

export type UpdateOutcome =
  | {
      readonly kind: "updated";
      readonly askId: string;
      readonly state: AskState;
      readonly applied: readonly AppliedAction[];
      /**
       * The pointers its new revisions hold unresolved (excerpts, design decision 4), then the
       * formulas in error in the board as changed (widgets, design decision 5).
       */
      readonly warnings?: readonly (UnresolvedPointerWarning | FormulaWarning)[];
    }
  | {
      readonly kind: "refused";
      readonly askId: string;
      /** The refused action's index in the request. */
      readonly index: number;
      readonly itemId?: string;
      /** The cursor the refusal is about: the logged answer that stops it, or a reply's follow-up. */
      readonly cursor?: string;
      readonly refusal: UpdateRefusal;
      readonly detail: string;
    };

export type UpdateContext = {
  readonly askId: string;
  readonly epoch: string;
  /** Who answers the ask (FR-19), for an answer the agent records. */
  readonly who: string;
  /** The core's time, RFC 3339 UTC, for recorded answers and replies (FR-19). */
  readonly now: string;
  /** The copy of the ask's items the actions change. */
  readonly model: BoardModel;
  readonly log: EventLog;
  /** The ask's molecules, as copies the update changes and the aggregate keeps if all apply. */
  readonly widgets: WidgetUpdate;
  /** The widget types the ask's items are checked against: the shipped registry unless a test passes another. */
  readonly types?: readonly WidgetType[];
};

/** What an update changed, for the subscription: the board document, the board's state, closing. */
export type UpdateEffects = { document: boolean; state: boolean; closed: boolean };

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
const answeredRefusal = (
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
  const checked = validateAskRequestOver(
    { askId: context.askId, items: [item] },
    context.types ?? WIDGET_TYPES,
  );
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

type Action<A extends UpdateAction["action"]> = Extract<UpdateAction, { action: A }>;

// The question an action names, or why it names none: an area is not a question.
const questionOf = (context: UpdateContext, itemId: string): QuestionRecord | Refusal => {
  const question = context.model.question(itemId);
  if (question !== undefined) return question;
  if (context.model.area(itemId) === undefined) return missing(context, itemId);
  return refuse(
    "not-question",
    `"${itemId}" is an area; this action applies to a question`,
    itemId,
  );
};

// Why an added item cannot go where the action places it.
const placementProblem = (context: UpdateContext, action: Action<"add">): Refusal | undefined => {
  const { item, parentId, after } = action;
  const { model } = context;
  if (parentId !== undefined && (item.type === "area" || model.area(parentId) === undefined)) {
    return refuse("parent", `parentId "${parentId}" names no area the item can go in`, item.id);
  }
  if (parentId === undefined && (model.layout === "areas") !== (item.type === "area")) {
    const detail =
      model.layout === "areas"
        ? "every top-level item of this ask is an area: add the question to one with parentId"
        : "this ask has no areas: an area cannot join its questions at the top level";
    return refuse("area-rule", detail, item.id);
  }
  if (after !== undefined && !model.siblings(parentId).includes(after)) {
    const where = parentId === undefined ? "at the top level" : `in the area "${parentId}"`;
    return refuse("after", `after "${after}" names no item ${where}`, item.id);
  }
  return undefined;
};

// Every ID an added item holds: its own, and for an area each question's, and for a question each
// item's at every depth of its layouts (layouts, design decision 5).
const idsHeldBy = (item: Action<"add">["item"]): string[] => {
  if (item.type === "area") {
    return [item.id, ...item.props.items.flatMap((question) => idsHeldBy(question))];
  }
  return [item.id, ...itemIdsOf(item.props)];
};

// Whether a molecule reference's ID is held: the update's references are never pruned, so one stays
// held after its question is deleted, and no plain item takes it, its own question's included
// (layouts, review X-1: a question that replaced its reference could neither change nor be fetched).
const referenceHeld = ({ widgets }: UpdateContext, id: string): boolean =>
  widgets.references.has(id);

// The refusal of an ID the ask holds elsewhere or held: `except` names the question whose own items
// do not count, for its change; `sending` names the references of the item being added, which its
// expansion checks itself.
const inUseRefusal = (
  context: UpdateContext,
  ids: readonly string[],
  except?: string,
  sending: ReadonlySet<string> = new Set(),
  sentItems = false,
): Refusal | undefined => {
  const { model } = context;
  const used = ids.find(
    (id) => model.inUse(id, except) || (!sending.has(id) && referenceHeld(context, id)),
  );
  if (used === undefined) return sentItems ? expandedHeldRefusal(context, ids) : undefined;
  const holder = model.heldBy(used);
  // An expanded ID is no item the agent can name: the refusal names its reference's ID instead.
  const entry = context.widgets.expansion.get(used);
  if (entry !== undefined) {
    const by = holder === undefined ? "" : ` of the question "${holder}"`;
    const detail = `the ID "${entry.reference}" is in use in the ask, held by the molecule reference "${entry.reference}"${by}; item IDs are unique`;
    return refuse("in-use", detail, entry.reference);
  }
  const deleted = model.isDeleted(used) ? ", by an item deleted earlier" : "";
  const by = holder === undefined ? "" : `, held by an item of the question "${holder}"`;
  const reuse = holder === undefined ? "; item IDs are never reused" : "; item IDs are unique";
  return refuse("in-use", `the ID "${used}" is in use in the ask${deleted}${by}${reuse}`, used);
};

// The refusal of an item the agent sends whose ID a molecule reference of the ask once expanded to,
// held for the ask's life though the reference was dropped: two owners of one ID would make `fetch`
// and the answer's addressing read the wrong one (agent-facing-gaps review 3.3, X-1). Only for
// items the agent sends: a question's own expanded items are no new IDs.
const expandedHeldRefusal = (
  context: UpdateContext,
  ids: readonly string[],
): Refusal | undefined => {
  const { expansion } = context.widgets;
  const id = ids.find((candidate) => expansion.has(candidate));
  if (id === undefined) return undefined;
  const reference = expansion.get(id)?.reference;
  const detail = `the ID "${id}" is in use in the ask, held by the expansion of the molecule reference "${reference}"; item IDs are never reused`;
  return refuse("in-use", detail, id);
};

const add = (context: UpdateContext, action: Action<"add">): Step => {
  const { item } = action;
  const taken = inUseRefusal(
    context,
    idsHeldBy(item),
    undefined,
    new Set(referencesIn([item]).keys()),
    true,
  );
  if (taken !== undefined) return taken;
  const misplaced = placementProblem(context, action);
  if (misplaced !== undefined) return misplaced;
  const expanded = expandAdded(context.model, context.widgets, item, context.types);
  if (!expanded.ok) {
    return refuse(expanded.inUse ? "in-use" : "props", expanded.detail, expanded.itemId ?? item.id);
  }
  const { parentId, after } = action;
  context.model.add(expanded.item, {
    ...(parentId === undefined ? {} : { parentId }),
    ...(after === undefined ? {} : { after }),
  });
  return { action: "add", itemId: item.id, ...(item.type === "question" ? { rev: 1 } : {}) };
};

const change = (context: UpdateContext, action: Action<"change">): Step => {
  const { itemId } = action;
  const props = { ...action.props };
  const question = context.model.question(itemId);
  if (question === undefined) return changeWidget(context, itemId, props);
  const stands = answeredRefusal(question, statusOf(context, question), "change");
  if (stands !== undefined) return stands;
  const merged = { ...context.model.propsOf(question), ...props };
  const problems = itemProblems(context, { type: "question", id: itemId, props: merged });
  if (problems !== undefined) return refuse("props", problems, itemId);
  const sending = new Set(referencesIn([{ type: "question", id: itemId, props: merged }]).keys());
  const sentItems = Object.hasOwn(props, "items");
  const taken = inUseRefusal(context, itemIdsOf(merged), itemId, sending, sentItems);
  if (taken !== undefined) return taken;
  const replacement = !Object.hasOwn(props, "items")
    ? { ok: true as const, props: merged as QuestionProps }
    : replaceQuestionItems(context.model, context.widgets, question, merged as QuestionProps);
  if (!replacement.ok) return refuse("props", replacement.detail, replacement.itemId ?? itemId);
  const expandedTaken = inUseRefusal(context, itemIdsOf(replacement.props), itemId);
  if (expandedTaken !== undefined) return expandedTaken;
  const rev = context.model.revise(question, replacement.props);
  return { action: "change", itemId, rev };
};

// A change naming a widget item or a reference of a question; any other ID names an area or nothing.
const changeWidget = (context: UpdateContext, itemId: string, props: Record<string, unknown>) => {
  const { model, widgets } = context;
  const holder = holderOf(model, widgets, itemId, context.types);
  if (holder === undefined) return changeArea(context, itemId, props);
  const { question } = holder;
  const stands = answeredRefusal(question, statusOf(context, question), "change");
  if (stands !== undefined) return { ...stands, itemId };
  const changed = widgetProps(context, holder, props);
  if (!changed.ok) return refuse("props", changed.detail, changed.itemId ?? itemId);
  const taken = inUseRefusal(context, itemIdsOf(changed.props), question.id);
  if (taken !== undefined) return taken;
  const rev = model.revise(question, changed.props);
  return { action: "change", itemId, rev } as const;
};

// The question's props once the widget item or reference takes the props, checked as an ask's are.
const widgetProps = (
  context: UpdateContext,
  holder: WidgetHolder,
  props: Record<string, unknown>,
) => {
  const { model, widgets } = context;
  if (holder.reference !== undefined) {
    return changedReference(model, widgets, { ...holder, reference: holder.reference }, props);
  }
  const merged = mergedWidget(model, holder, props);
  const problems = itemProblems(context, {
    type: "question",
    id: holder.question.id,
    props: merged,
  });
  return problems === undefined
    ? ({ ok: true, props: merged } as const)
    : ({ ok: false, detail: problems } as const);
};

const remove = (context: UpdateContext, action: Action<"delete">): Step => {
  const { itemId } = action;
  const { model } = context;
  const area = model.area(itemId);
  const question = model.question(itemId);
  const ids = area?.questions ?? (question === undefined ? [] : [itemId]);
  if (ids.length === 0) return missing(context, itemId);
  for (const id of ids) {
    const held = model.question(id) as QuestionRecord;
    const stands = answeredRefusal(held, statusOf(context, held), "delete");
    if (stands !== undefined) return { ...stands, itemId };
  }
  if (model.questions().length === ids.length) {
    const detail = "no question of the ask would remain; close the ask instead";
    return refuse("last-question", detail, itemId);
  }
  model.delete(itemId);
  return { action: "delete", itemId };
};

const reopen = (context: UpdateContext, action: Action<"reopen">): Step => {
  const question = questionOf(context, action.itemId);
  if ("refusal" in question) return question;
  const status = statusOf(context, question);
  if (status.answer === undefined) {
    const detail = `the question "${question.id}" is ${status.state}; only an answered or declined question is reopened`;
    return refuse("not-answered", detail, question.id);
  }
  const previous = fullAnswer(question, status.answer);
  const rev = context.model.reopen(question, previous, context.log.latestSeq);
  return { action: "reopen", itemId: question.id, rev };
};

const record = (context: UpdateContext, action: Action<"answer">): Step => {
  const question = questionOf(context, action.itemId);
  if ("refusal" in question) return question;
  const stands = answeredRefusal(question, statusOf(context, question), "record an answer on");
  if (stands !== undefined) return stands;
  const content = action.answer as Readonly<Record<string, unknown>>;
  const bad = contentProblem(content, context.model.propsOf(question), false);
  if (bad !== undefined) return refuse(bad.refusal, bad.detail, question.id);
  const { who, now: when } = context;
  context.model.record(question, { content: contentOf(content), who, when }, context.log.latestSeq);
  return { action: "answer", itemId: question.id, rev: question.rev, recorded: { who, when } };
};

const reply = (context: UpdateContext, action: Action<"reply">): Step => {
  const question = questionOf(context, action.itemId);
  if ("refusal" in question) return question;
  const { followUp, text } = action;
  const cursor = parseCursor(followUp);
  const entry = cursor?.epoch === context.epoch ? context.log.at(cursor.seq) : undefined;
  const { event } = entry ?? {};
  if (event?.type !== "follow-up" || event.itemId !== question.id) {
    const detail = `${followUp} is not a follow-up the user wrote on "${question.id}" in this session`;
    return { ...refuse("follow-up", detail, question.id), cursor: followUp };
  }
  context.model.reply(question, followUp, { text, when: context.now });
  return { action: "reply", itemId: question.id };
};

const close = (): Step => ({ action: "close" });

const STEPS: Readonly<
  Record<UpdateAction["action"], (context: UpdateContext, action: never) => Step>
> = {
  add,
  change,
  delete: remove,
  reopen,
  answer: record,
  reply,
  close,
};

const EFFECTS: Readonly<Record<UpdateAction["action"], Partial<UpdateEffects>>> = {
  add: { document: true, state: true },
  change: { document: true, state: true },
  delete: { document: true, state: true },
  reopen: { document: true, state: true },
  answer: { state: true },
  reply: { state: true },
  close: { closed: true },
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
 * applies; stops at the first refusal. `close` applies last: an action after it is refused.
 */
export const applyActions = (context: UpdateContext, actions: readonly UpdateAction[]): Applied => {
  const applied: AppliedAction[] = [];
  const effects: UpdateEffects = { document: false, state: false, closed: false };
  for (const [index, action] of actions.entries()) {
    const outcome: Step = effects.closed
      ? refuse("closed", "an earlier action of this update closes the ask")
      : STEPS[action.action](context, action as never);
    if ("refusal" in outcome) return { ok: false, index, ...outcome };
    applied.push(outcome);
    const effect = EFFECTS[action.action];
    effects.document ||= effect.document ?? false;
    effects.state ||= effect.state ?? false;
    effects.closed ||= effect.closed ?? false;
  }
  return { ok: true, applied, effects };
};
