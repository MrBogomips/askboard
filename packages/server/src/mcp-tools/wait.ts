// A waiting `collect` (AD-4, design decision 4): a waiter on ask-core's subscription, raced against
// the longest wait and the request's abort signal, with progress at the contract's interval when
// the request carries a progress token. A wait names a question (ask-lifecycle, design decision 4):
// as AD-4 says, it ends on any event of that question in a command, follow-ups included, and on a
// command whose events change the ask's state from the state the waiter last heard; also on the ask
// closing or being discarded, and on the agent's own change to the question; at once when the
// question is postponed or the ask closed.

import {
  COLLECT_MAX_WAIT_MS,
  COLLECT_PROGRESS_INTERVAL_MS,
  type CollectRequest,
  type CollectResult,
  nestedItemsOf,
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
      // Every depth of the question's layouts (layouts, design decision 5).
      const held =
        Array.isArray(inner) &&
        nestedItemsOf(inner).some(
          ({ item: entry }) => (entry as { readonly id?: unknown } | null)?.id === wait.itemId,
        );
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

// The states the waiter last heard: the ask's and the waited question's, as of the wait's start or
// the last event of the ask it heard, an agent change included.
type Heard = { readonly ask: string | undefined; readonly question: string };

const heardNow = (core: ToolCore, wait: Wait): Heard => ({
  ask: core.lifecycleBoard(wait.askId)?.state,
  question: questionState(core, wait),
});

// Whether a core event of the ask ends the wait (AD-4): an event of the question or a discard in
// the command, or a command that changed the ask's state from the one last heard; the ask closed
// or discarded; or an agent change that deleted the question or changed its state.
const ends = (core: ToolCore, wait: Wait, heard: Heard, event: CoreEvent): boolean => {
  switch (event.type) {
    case "appended":
      return (
        event.events.some(
          (logged) =>
            logged.type === "discarded" || ("itemId" in logged && logged.itemId === wait.itemId),
        ) || core.lifecycleBoard(wait.askId)?.state !== heard.ask
      );
    case "closed":
    case "discarded":
      return true;
    case "document":
    case "state":
      return questionState(core, wait) !== heard.question;
    default:
      return false;
  }
};

/**
 * Waits until the log gains an event for the question or one that changes the ask's state, or the
 * ask closes or is discarded, until the longest wait passes, or until the request is aborted.
 * Whatever ends it, it leaves no subscription and no timer behind.
 */
export const waitForItem = (
  { core, timers, diagnostics }: ToolDeps,
  wait: Wait,
  context: CallContext,
): Promise<WaitEnd> =>
  new Promise((resolve) => {
    let heard = heardNow(core, wait);
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
        if (event.askId !== wait.askId) return;
        if (ends(core, wait, heard, event)) end("event");
        else heard = heardNow(core, wait);
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
