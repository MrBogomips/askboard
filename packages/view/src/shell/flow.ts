// What the board does at an act (answering-flow-guidance, design decisions 3, 4 and 7): the card
// hands the act and its result to `Flow.act`, which asks `afterAnswerOf` what follows, records what
// the command's messages will say once the board page reports it sent, and runs the output: the move
// (the target's tab or view, its heading, the arrival mark) or the footer with "Continue". It runs at
// the act, never at the reply, so a focus the user moved during a flight is never taken. Focus for
// `stay` stays with the card (the base's rule); `send-all` asks for the send button and `complete`
// for the completion panel's heading, once the panel shows (decision 6).

import type { LifecycleBoardState } from "@askboard/contract";
import { areaOf, type ViewDocument } from "../view-document.ts";
import {
  type ActResult,
  type AfterAnswer,
  type AfterAnswerSetting,
  afterAnswerOf,
} from "./after-answer.ts";
import type { Delivery, QuestionWork } from "./board-draft.ts";
import type { Ladder } from "./board-view.ts";
import { areaDoneMessageOf, nextMessageOf } from "./flow-messages.ts";
import {
  areaInputOf,
  type Footer,
  flowTargetOf,
  heldActsOf,
  nextOfFlow,
  type SentRecords,
} from "./guided-flow.ts";
import { type HeadingRequest, requestFocusTo, requestHeading } from "./heading-request.ts";
import type { HeldKeyGuard } from "./held-key-guard.ts";
import type { StatusMessages } from "./status-messages.ts";
import type { Store } from "./store.ts";

/** What the board shows now, read afresh at each act: the act may follow a render by a dialog. */
export type FlowView = {
  readonly document: ViewDocument;
  readonly state: LifecycleBoardState;
  readonly work: ReadonlyMap<string, QuestionWork>;
  readonly ladder: Ladder;
  readonly unseen: ReadonlySet<string>;
  readonly setting: AfterAnswerSetting;
  readonly delivery: Delivery;
  readonly single: boolean;
};

export type FlowDeps = {
  readonly view: () => FlowView;
  readonly footer: Store<Footer | undefined>;
  readonly recorded: SentRecords;
  readonly focus: Store<HeadingRequest | undefined>;
  readonly removed: Store<boolean>;
  /** Brings a question into view: its tab is activated, or one question per view shows it. */
  readonly show: (questionId: string) => void;
  readonly status: Pick<StatusMessages, "announce">;
  readonly guard: Pick<HeldKeyGuard, "arm">;
};

export type FlowAct = "answer" | "postpone" | "decline";

/**
 * What follows an act: the output, and `run`, the move or the footer it asks for (nothing for the
 * other outputs). The card runs it at once, or, for Decline, once the More menu has closed.
 */
export type FlowStep = { readonly output: AfterAnswer; readonly run: () => void };

export type Flow = {
  /**
   * The act was taken on `acted`: the footer of an earlier act leaves, the command's messages are
   * recorded, a held act's are said, and the step is returned for the card to run.
   */
  act(
    acted: string,
    act: FlowAct,
    result: ActResult,
    options: { readonly revision: boolean; readonly undo?: boolean },
  ): FlowStep;
  /** "Continue": the move the footer holds. */
  proceed(): void;
};

// A result that took an act in: the footer of an earlier act leaves with it (decision 3).
const TOOK = (result: ActResult): boolean => result !== undefined && result !== "needs-reason";

export const createFlow = (deps: FlowDeps): Flow => {
  const goTo = (target: string): void => {
    deps.removed.set(false);
    deps.show(target);
    requestHeading(deps.focus, target, true);
    deps.guard.arm(target);
  };
  return {
    act: (acted, act, result, { revision, undo = false }) => {
      if (TOOK(result)) deps.footer.set(undefined);
      const view = deps.view();
      const next = nextOfFlow(
        view.document,
        view.state,
        view.work,
        view.ladder,
        view.unseen,
        acted,
      );
      const output = afterAnswerOf({
        act,
        result,
        revision,
        undo,
        single: view.single,
        setting: view.setting,
        delivery: view.delivery,
        next,
        held: heldActsOf(view.work),
        area: areaInputOf(view.document, view.state, view.work, view.ladder, acted, next?.id),
      });
      const moving = output.kind === "move" || output.kind === "footer" ? output : undefined;
      const target = moving === undefined ? undefined : flowTargetOf(view.document, moving.target);
      const record = {
        revision,
        ...(moving === undefined || target === undefined ? {} : { next: target }),
        ...(moving?.areaDone === undefined ? {} : { areaDone: moving.areaDone }),
      };
      // Only a command that goes out now has a reply to say it: a held act says its own at the act.
      if (TOOK(result) && view.delivery === "immediate") deps.recorded.set(acted, record);
      // A held act says its message now, with the move's: nothing was sent, so nothing waits for a reply.
      if (result === "held" && moving !== undefined && target !== undefined) {
        if (moving.areaDone !== undefined) deps.status.announce(areaDoneMessageOf(moving.areaDone));
        deps.status.announce(nextMessageOf(target));
      }
      if (result === "took-effect" && view.delivery === "submitted" && !undo) {
        deps.status.announce({ key: act === "postpone" ? "status.postponed" : "status.declined" });
        if (moving?.areaDone !== undefined)
          deps.status.announce(areaDoneMessageOf(moving.areaDone));
        if (target !== undefined) deps.status.announce(nextMessageOf(target));
      }
      if (output.kind === "send-all") {
        return { output, run: () => requestFocusTo(deps.focus, acted, "send") };
      }
      if (output.kind === "complete") {
        return { output, run: () => requestFocusTo(deps.focus, acted, "completion") };
      }
      if (moving === undefined || target === undefined) return { output, run: () => {} };
      if (output.kind === "move") return { output, run: () => goTo(moving.target) };
      const area = areaOf(view.document, moving.target);
      const footer: Footer = {
        from: acted,
        target: moving.target,
        title: target.title,
        newFromAgent: moving.newFromAgent,
        ...(moving.areaDone === undefined || area === undefined ? {} : { area: area.props.title }),
      };
      return {
        output,
        run: () => {
          deps.footer.set(footer);
          deps.guard.arm(moving.target);
        },
      };
    },
    proceed: () => {
      const footer = deps.footer.get();
      if (footer === undefined) return;
      deps.footer.set(undefined);
      goTo(footer.target);
    },
  };
};
