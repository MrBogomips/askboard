// The user's acts of one command, checked in order against the state the earlier ones leave, each
// turned into its event (ask-lifecycle, design decision 3; AD-10, AD-20): all of them, or a refusal
// naming the first act that cannot apply. Nothing here appends: the aggregate appends the events in
// one step.

import {
  type AnswerEvent,
  FOLLOW_UP_MAX_CHARS,
  NOTE_MAX_CHARS,
  type OutputEvent,
  type QuestionProps,
  WIDGET_TYPES,
  type WidgetType,
} from "@askboard/contract";
import type { ExpansionMap } from "../molecules/map.ts";
import { cursorOf, isRealUtcTime } from "../text.ts";
import { contentOf, contentProblem, textProblem } from "./answers.ts";
import type { Entry, EventLog } from "./log.ts";
import type { BoardModel, QuestionRecord } from "./model.ts";
import { type QuestionStatus, questionStatus } from "./states.ts";
import {
  answerRequirementProblem,
  fieldCheckProblem,
  type KeptAnswer,
  sharedResultAddress,
  type WidgetFields,
  widgetFieldsOf,
  withinLimit,
} from "./widget-event.ts";
import { type WidgetContent, widgetContentOf } from "./widget-values.ts";

/** Why an act cannot apply. */
export type ActRefusal =
  /** Not an act the board protocol defines, or a field of the wrong type. */
  | "act"
  | "unknown-item"
  /** A revision that is not current, nor kept by the user's edit choice. */
  | "stale-rev"
  /** An edit choice keeping a revision that is not an older kept one. */
  | "kept-rev"
  /** The act does not apply in the question's state. */
  | "state"
  | "choice"
  | "content"
  | "when";

export type ActProblem = {
  readonly refusal: ActRefusal;
  readonly detail: string;
  readonly itemId?: string;
};

export type ActsContext = {
  readonly epoch: string;
  /** Who answers this ask (FR-19). */
  readonly who: string;
  readonly model: BoardModel;
  readonly log: EventLog;
  /** The ask's expansion map, for the addressing of an answer's widget content. */
  readonly expansion: ExpansionMap;
  /** The widget types the answers' content is checked through; the shipped registry unless a test passes one. */
  readonly types?: readonly WidgetType[];
};

export type ActsOutcome =
  | {
      readonly ok: true;
      readonly events: readonly OutputEvent[];
      /** The widget content kept for each answer event that has any, by the event's cursor. */
      readonly kept: ReadonlyMap<string, KeptAnswer>;
    }
  | { readonly ok: false; readonly index: number; readonly problem: ActProblem };

type Fields = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// What one act sees: its question, the question's entries with the earlier acts' events, and the
// state they leave.
type Target = {
  readonly act: Fields;
  readonly itemId: string;
  readonly question: QuestionRecord;
  readonly entries: readonly Entry[];
  readonly status: QuestionStatus;
  readonly cursor: string;
  readonly expansion: ExpansionMap;
  readonly types: readonly WidgetType[];
  /** What the acts of this command keep of their widget content, by cursor. */
  readonly kept: Map<string, KeptAnswer>;
};

type Built = OutputEvent | ActProblem;

const problem = (refusal: ActRefusal, detail: string, itemId?: string): ActProblem => ({
  refusal,
  detail,
  ...(itemId === undefined ? {} : { itemId }),
});

const isProblem = (built: Built | undefined): built is ActProblem =>
  built !== undefined && "refusal" in built;

// A field the act needs, of the type it needs.
const shapeProblem = (act: Fields, itemId: string, needs: Readonly<Record<string, string>>) => {
  for (const [field, kind] of Object.entries(needs)) {
    const value = act[field];
    const fits = kind === "integer" ? Number.isInteger(value) : typeof value === kind;
    if (!fits)
      return problem(
        "act",
        `the act's ${field} is not ${kind === "integer" ? "an integer" : "text"}`,
        itemId,
      );
  }
  return undefined;
};

const staleRev = (target: Target): ActProblem =>
  problem("stale-rev", `the question is at revision ${target.question.rev}`, target.itemId);

const whenProblem = (target: Target): ActProblem | undefined =>
  isRealUtcTime(target.act.when as string)
    ? undefined
    : problem("when", "the act's time is not a real RFC 3339 UTC time", target.itemId);

// The latest edit choice the user made about the question's current revision.
const latestChoice = (target: Target) =>
  target.entries.findLast(
    ({ event }) => event.type === "edit-choice" && event.rev === target.question.rev,
  )?.event;

// The props an answer or decline naming `rev` is checked against: the current revision's, or an
// older one the user kept with an `ignore` that is the current revision's latest edit choice.
const propsFor = (target: Target, rev: number): QuestionProps | undefined => {
  const { question } = target;
  if (rev === question.rev) return question.revs.get(rev);
  const choice = latestChoice(target);
  const kept = choice?.type === "edit-choice" && choice.edit === "ignore" && choice.keptRev === rev;
  return kept ? question.revs.get(rev) : undefined;
};

const replacesOf = ({ status }: Target) =>
  status.answer?.kind === "logged" ? { replaces: status.answer.entry.event.cursor } : {};

// What stays apart from the log: the full edited values, the results and the derived values as sent.
const keepWidgets = (target: Target, { values, results, derived }: WidgetContent): void => {
  const held = [values, results, derived].some((part) => Object.keys(part).length > 0);
  if (held) target.kept.set(target.cursor, { itemId: target.itemId, values, results, derived });
};

// What an answer's widget content makes of it: Widget values, results and derived values
// (widget-answers; widget-registry), or why it is refused. A decline reads none of them, and
// refuses results: a result is the user's answer, which a decline is not.
const widgetsOf = (target: Target, props: QuestionProps, declined: boolean) => {
  if (!declined) return widgetContentOf(target.act, props, target.types);
  return target.act.results === undefined
    ? undefined
    : problem("content", "a decline carries no results", target.itemId);
};

const answered = (target: Target, declined: boolean, who: string): Built => {
  const { act, itemId } = target;
  const shape = shapeProblem(act, itemId, { rev: "integer", when: "string" });
  if (shape !== undefined) return shape;
  const rev = act.rev as number;
  const props = propsFor(target, rev);
  if (props === undefined) return staleRev(target);
  // A decline carries at most its reason; anything else on it is not read.
  const reason = act.note === undefined ? {} : { note: act.note };
  const widgets = widgetsOf(target, props, declined);
  if (widgets !== undefined && "refusal" in widgets) {
    return problem(widgets.refusal, widgets.detail, itemId);
  }
  const shared =
    widgets === undefined ? undefined : sharedResultAddress(target.expansion, widgets.results);
  if (shared !== undefined) {
    return problem("content", `two results would be given as "${shared}"`, itemId);
  }
  const widgetChange =
    widgets !== undefined &&
    (Object.keys(widgets.values).length > 0 || Object.keys(widgets.results).length > 0);
  const bad = contentProblem(declined ? reason : act, props, declined, widgetChange, target.types);
  if (bad !== undefined) return problem(bad.refusal, bad.detail, itemId);
  const late = whenProblem(target);
  if (late !== undefined) return late;
  const head = { cursor: target.cursor, type: "answer", itemId, rev, who, when: act.when };
  const body = declined ? { declined: true, ...reason } : contentOf(act);
  const widget: WidgetFields =
    widgets === undefined ? {} : widgetFieldsOf(target.expansion, props, widgets, target.types);
  const unmet =
    widgets === undefined
      ? undefined
      : answerRequirementProblem(
          widgets,
          widget,
          typeof act.note === "string" ? act.note : undefined,
          target.types,
        );
  if (unmet !== undefined) return problem("content", unmet, itemId);
  const unchecked = widgets === undefined ? undefined : fieldCheckProblem(widgets, target.types);
  if (unchecked !== undefined) return problem("content", unchecked, itemId);
  if (widgets !== undefined) keepWidgets(target, widgets);
  return withinLimit({ ...head, ...body, ...widget, ...replacesOf(target) } as AnswerEvent);
};

const postponed = (target: Target): Built => {
  const { act, itemId, question, status } = target;
  const shape = shapeProblem(act, itemId, { rev: "integer" });
  if (shape !== undefined) return shape;
  if (act.rev !== question.rev) return staleRev(target);
  if (status.state !== "open") {
    return problem(
      "state",
      `only an open question can be postponed; it is ${status.state}`,
      itemId,
    );
  }
  return { cursor: target.cursor, type: "postponed", itemId, rev: question.rev };
};

const reopened = ({ itemId, question, status, cursor }: Target): Built => {
  if (status.state !== "postponed" && status.state !== "declined") {
    const detail = `only a sent postpone or decline can be undone; the question is ${status.state}`;
    return problem("state", detail, itemId);
  }
  return { cursor, type: "reopened", itemId, rev: question.rev };
};

const noted = (target: Target, who: string): Built => {
  const { act, itemId, question, status } = target;
  const shape = shapeProblem(act, itemId, { rev: "integer", when: "string" });
  if (shape !== undefined) return shape;
  if (act.rev !== question.rev) return staleRev(target);
  if (status.state !== "open" && status.state !== "postponed") {
    return problem(
      "state",
      `a note alone goes on an open or postponed question; it is ${status.state}`,
      itemId,
    );
  }
  const text = textProblem(act.note, NOTE_MAX_CHARS, "the note");
  if (text !== undefined) return problem("content", text, itemId);
  const late = whenProblem(target);
  if (late !== undefined) return late;
  const { cursor } = target;
  return {
    cursor,
    type: "note",
    itemId,
    rev: question.rev,
    who,
    when: act.when as string,
    note: act.note as string,
  };
};

const followUp = (target: Target, who: string): Built => {
  const { act, itemId, question } = target;
  const shape = shapeProblem(act, itemId, { rev: "integer", when: "string" });
  if (shape !== undefined) return shape;
  const rev = act.rev as number;
  if (!question.revs.has(rev)) return staleRev(target);
  const text = textProblem(act.text, FOLLOW_UP_MAX_CHARS, "the follow-up");
  if (text !== undefined) return problem("content", text, itemId);
  const late = whenProblem(target);
  if (late !== undefined) return late;
  const { cursor } = target;
  return {
    cursor,
    type: "follow-up",
    itemId,
    rev,
    who,
    when: act.when as string,
    text: act.text as string,
  };
};

const editChoice = (target: Target): Built => {
  const { act, itemId, question, cursor } = target;
  const shape = shapeProblem(act, itemId, { rev: "integer" });
  if (shape !== undefined) return shape;
  if (act.rev !== question.rev) return staleRev(target);
  const { rev } = question;
  if (act.edit === "reload") return { cursor, type: "edit-choice", itemId, rev, edit: "reload" };
  if (act.edit !== "ignore" || !Number.isInteger(act.keptRev)) {
    return problem(
      "act",
      'the edit choice is "reload", or "ignore" with the revision it keeps',
      itemId,
    );
  }
  const keptRev = act.keptRev as number;
  if (keptRev >= rev || !question.revs.has(keptRev)) {
    return problem(
      "kept-rev",
      `revision ${keptRev} is not an older revision the question keeps`,
      itemId,
    );
  }
  return { cursor, type: "edit-choice", itemId, rev, edit: "ignore", keptRev };
};

const BUILDERS: Readonly<Record<string, (target: Target, who: string) => Built>> = {
  answer: (target, who) => answered(target, false, who),
  decline: (target, who) => answered(target, true, who),
  postpone: postponed,
  reopen: reopened,
  note: noted,
  "follow-up": followUp,
  "edit-choice": editChoice,
};

// The question an act names, or why it names none.
const questionOf = (model: BoardModel, act: unknown): Target["question"] | ActProblem => {
  if (!isRecord(act) || typeof act.type !== "string" || !Object.hasOwn(BUILDERS, act.type)) {
    return problem("act", "not an act the board protocol defines");
  }
  if (typeof act.itemId !== "string") return problem("act", "the act's itemId is not text");
  const question = model.question(act.itemId);
  if (question !== undefined) return question;
  const why = model.isDeleted(act.itemId)
    ? "the agent deleted the question"
    : "the ask has no such question";
  return problem("unknown-item", why, act.itemId);
};

/**
 * Checks each act against the state the earlier acts leave and builds its event, with consecutive
 * cursors after the log's latest. Either every act's event, or the first refusal with its index.
 */
export const eventsOfActs = (context: ActsContext, acts: readonly unknown[]): ActsOutcome => {
  const { epoch, who, model, log, expansion, types = WIDGET_TYPES } = context;
  const pending: Entry[] = [];
  const kept = new Map<string, KeptAnswer>();
  for (const [index, act] of acts.entries()) {
    const question = questionOf(model, act);
    if ("refusal" in question) return { ok: false, index, problem: question };
    const fields = act as Fields;
    const entries = [
      ...log.ofItem(question.id),
      ...pending.filter(({ event }) => "itemId" in event && event.itemId === question.id),
    ];
    const seq = log.latestSeq + pending.length + 1;
    const target: Target = {
      act: fields,
      itemId: question.id,
      question,
      entries,
      status: questionStatus(question.mark, entries),
      cursor: cursorOf(epoch, seq),
      expansion,
      types,
      kept,
    };
    const built = BUILDERS[fields.type as string]?.(target, who);
    if (built === undefined || isProblem(built)) {
      return { ok: false, index, problem: built ?? problem("act", "not an act") };
    }
    pending.push({ seq, group: 0, event: built });
  }
  return { ok: true, events: pending.map(({ event }) => event), kept };
};
