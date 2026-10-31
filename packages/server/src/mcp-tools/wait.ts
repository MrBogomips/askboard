// A waiting `collect` (AD-4, design decision 4): a waiter on ask-core's subscription, raced against
// the longest wait and the request's abort signal, with progress at the contract's interval when
// the request carries a progress token. A wait names a question (ask-lifecycle, design decision 4):
// it ends on any event of that question in a command, follow-ups included, on the ask closing or
// being discarded, and on the agent's own change to the question's state; at once when the question
// is postponed or the ask closed.

import {
  COLLECT_MAX_WAIT_MS,
  COLLECT_PROGRESS_INTERVAL_MS,
  type CollectRequest,
  type CollectResult,
  type QuestionState,
} from "@askboard/contract";
import type { RequestProblem } from "@askboard/contract/validate";
import type { CoreEvent } from "@askboard/core";
import { failure } from "./diagnostics.ts";
import type { CallContext, ToolCore, ToolDeps } from "./ports.ts";

export type WaitEnd = "event" | "timeout" | "aborted";

type Wait = NonNullable<CollectRequest["wait"]>;

const PROGRESS_MESSAGE = "waiting for the user on the board";

// What the waited ID names in the ask's board document: a question, an area, an item inside a
// question (a widget, once the input format admits them), or nothing.
const placeOf = (
  core: ToolCore,
  wait: Wait,
): { kind: "question" | "area" | "none" } | { kind: "inside"; question: string } => {
  const view = core.lifecycleBoard(wait.askId);
  if (view === undefined || view.state === "discarded") return { kind: "none" };
  for (const item of view.document.items) {
    if (item.id === wait.itemId) return { kind: item.type === "area" ? "area" : "question" };
    const questions = item.type === "area" ? item.props.items : [item];
    for (const question of questions) {
      if (question.id === wait.itemId) return { kind: "question" };
      const inner = (question.props as { readonly items?: unknown }).items;
      const held =
        Array.isArray(inner) &&
        inner.some((entry: { readonly id?: unknown } | null) => entry?.id === wait.itemId);
      if (held) return { kind: "inside", question: question.id };
    }
  }
  return { kind: "none" };
};

const problemOf = (expected: string, message: string): RequestProblem => ({
  path: "/wait/itemId",
  field: "wait.itemId",
  expected,
  message: `wait.itemId: ${message}`,
});

/** Why a wait cannot name its item: it names a question of an ask that is not discarded. */
export const waitProblem = (core: ToolCore, wait: Wait): RequestProblem | undefined => {
  const place = placeOf(core, wait);
  const expected = "the ID of a question of that ask";
  const { askId, itemId } = wait;
  switch (place.kind) {
    case "question":
      return undefined;
    case "inside":
      return problemOf(
        expected,
        `"${itemId}" is an item inside the question "${place.question}": wait on "${place.question}"`,
      );
    case "area":
      return problemOf(expected, `"${itemId}" is an area: wait on one of its questions`);
    default: {
      const deleted = core.fullValue(askId, itemId).kind === "deleted";
      const why = deleted ? `: "${itemId}" was deleted by an update` : "";
      return problemOf(expected, `the ask "${askId}" has no item "${itemId}"${why}`);
    }
  }
};

// The waited question's state now, or "gone" once the ask or the question is.
const questionState = (core: ToolCore, wait: Wait): QuestionState | "gone" => {
  const view = core.lifecycleBoard(wait.askId);
  if (view === undefined || view.state === "discarded") return "gone";
  return view.questions.find((question) => question.itemId === wait.itemId)?.state ?? "gone";
};

/**
 * Why a wait ends without waiting for an event of its question: the ask is closed, or the question
 * postponed. A discarded ask says so in its state instead.
 */
export const waitedOutcome = (core: ToolCore, wait: Wait): CollectResult["outcome"] => {
  if (core.lifecycleBoard(wait.askId)?.state === "closed") return "closed";
  return questionState(core, wait) === "postponed" ? "postponed" : undefined;
};

// Whether a core event ends the wait: an event of the question or a discard in the command, the
// ask closed or discarded, or an agent change that left the question's state other than it was.
const ends = (core: ToolCore, wait: Wait, start: string, event: CoreEvent): boolean => {
  if (event.askId !== wait.askId) return false;
  switch (event.type) {
    case "appended":
      return event.events.some(
        (logged) =>
          logged.type === "discarded" || ("itemId" in logged && logged.itemId === wait.itemId),
      );
    case "closed":
    case "discarded":
      return true;
    case "document":
    case "state":
      return questionState(core, wait) !== start;
    default:
      return false;
  }
};

/**
 * Waits until the log gains an event for the question or the ask closes or is discarded, until the
 * longest wait passes, or until the request is aborted. Whatever ends it, it leaves no subscription
 * and no timer behind.
 */
export const waitForItem = (
  { core, timers, diagnostics }: ToolDeps,
  wait: Wait,
  context: CallContext,
): Promise<WaitEnd> =>
  new Promise((resolve) => {
    const start = questionState(core, wait);
    const cancels: (() => void)[] = [];
    let ended = false;
    const end = (how: WaitEnd) => {
      if (ended) return;
      ended = true;
      for (const cancel of cancels) cancel();
      context.signal.removeEventListener("abort", aborted);
      resolve(how);
    };
    const aborted = () => end("aborted");
    if (context.signal.aborted) {
      end("aborted");
      return;
    }
    context.signal.addEventListener("abort", aborted, { once: true });
    cancels.push(
      core.subscribe((event) => {
        if (ends(core, wait, start, event)) end("event");
      }),
    );
    cancels.push(timers.after(COLLECT_MAX_WAIT_MS, () => end("timeout")));
    const { progress } = context;
    if (progress === undefined) return;
    let sent = 0;
    const tick = () => {
      sent += 1;
      progress(sent, PROGRESS_MESSAGE).catch((error: unknown) => {
        diagnostics.write(failure("progress failed", error));
      });
      cancels.push(timers.after(COLLECT_PROGRESS_INTERVAL_MS, tick));
    };
    cancels.push(timers.after(COLLECT_PROGRESS_INTERVAL_MS, tick));
  });
