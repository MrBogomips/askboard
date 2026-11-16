// The bottom action bar (EXPERIENCE.md, Bottom action bar, Delivery mode switch, Select
// recommended, Submit and Mode-switch confirmation; DESIGN.md, the same; ask-lifecycle, task 6.6;
// FR-3, FR-22, AD-20): sticky, on a board of two or more questions it holds the "Delivery" label
// and the "Immediate | Submitted" switch with its helper text, the postponed warning line, then
// "Select recommended" (only while a question has a recommendation), "Snapshot" with its feedback
// (snapshot task 7.1), the count of agent-change notices on held work, which jumps to the first,
// and "Submit". Switching from submitted to
// immediate with held work asks first, in a modal Radix Alert Dialog whose scroll lock runs
// through the view's style-element shim (S-6): confirming sends the held work as Submit does and
// switches, cancelling stays in submitted delivery; it is blocked as Submit is. On the
// single-question board the bar shows only the postponed warning line, while there is one, and
// "Snapshot".

import type { LifecycleBoardState } from "@askboard/contract";
import { AlertDialog } from "radix-ui";
import { useRef, useState } from "react";
import { useLanguage, useStrings } from "../catalog/port.ts";
import type { ViewDocument, ViewQuestion } from "../view-document.ts";
import type { ViewAct } from "../view-protocol.ts";
import type { ReadOnlyOf, ShownOf } from "./agent-change.ts";
import type { BoardDraft, Delivery } from "./board-draft.ts";
import { type Senders, sendSubmit } from "./card-acts.ts";
import { entriesWithCells } from "./cell-entries.ts";
import type { DerivedStore } from "./derived-store.ts";
import type { DraftStore } from "./draft-store.ts";
import { QuestionMarker } from "./markers.tsx";
import { ReplacedQuestions } from "./replaced-questions.tsx";
import { SnapshotButton, SnapshotFeedback } from "./snapshot-button.tsx";
import type { SnapshotControl, SnapshotOffer } from "./snapshot-control.ts";
import {
  BUTTON_LINK,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  DIALOG,
  SECTION_LABEL,
  SEGMENT,
  SEGMENTS,
} from "./styles.ts";
import {
  confirmedPress,
  immediateBlocked,
  type LoadOf,
  type SubmitState,
  submitPress,
  updatesLabel,
} from "./submit.ts";

const Warning = ({ warning }: { readonly warning: string }) => (
  <span className="flex items-center gap-1.5">
    <QuestionMarker mark="postponed" />
    <span className="text-body text-foreground">{warning}</span>
  </span>
);

export type BottomBarProps = {
  readonly single: boolean;
  readonly document: ViewDocument;
  /** The state of the board: the receipts of the answers Submit would replace. */
  readonly state: LifecycleBoardState;
  readonly delivery: Delivery;
  readonly warning: string | undefined;
  readonly submit: SubmitState;
  readonly recommendations: boolean;
  /** Nothing on the board acts: it moved, or the ask ended. */
  readonly locked: boolean;
  readonly context: Senders & {
    readonly draft: DraftStore;
    readonly results?: DraftStore;
    readonly entries?: DraftStore;
    readonly cellEntries?: DraftStore;
    readonly board: BoardDraft;
    readonly derived: DerivedStore;
  };
  /** "All together", nothing left to do, acts held: the line beside Send (decision 6). */
  readonly allReady?: boolean;
  readonly onSelectRecommended: () => void;
  /** The items of a question the card makes read-only; Submit's field block skips them. */
  readonly readOnlyOf?: ReadOnlyOf;
  /** The question each card shows; Submit's gates read that revision (Issue #92). */
  readonly shownOf?: ShownOf;
  /** The ready tracker's status of each question: Submit sends no act held on one not `visible`. */
  readonly load?: LoadOf;
  /** Submit found a held answer lacking the reason it requires: go to its prompt with the error. */
  readonly onNeedsReason: (questionId: string) => void;
  readonly onJump: (questionId: string) => void;
  /**
   * Submit sent its acts, from the button or from the replace dialog (answering-flow-fixes, design
   * decision 1): focus goes to the question in view's heading. Not called by "Send and switch",
   * which switches to immediate delivery and gives focus to the switch (the dialogs have no
   * trigger, so Radix restores none).
   */
  readonly onSubmitted?: () => void;
  /** The bar's Snapshot, and whether the board offers it now. */
  readonly snapshot: SnapshotControl;
  readonly snapshotOffer: SnapshotOffer;
};

export const BottomBar = (props: BottomBarProps) => {
  const {
    single,
    document,
    state,
    delivery,
    warning,
    submit,
    recommendations,
    locked,
    context,
    readOnlyOf,
    shownOf,
    load,
  } = props;
  const [confirming, setConfirming] = useState(false);
  // Submit asks once more when it would replace a verdict the agent has received (design decision 6).
  const [replacing, setReplacing] = useState<
    | { readonly questions: readonly ViewQuestion[]; readonly then: (() => void) | undefined }
    | undefined
  >();
  const submitButton = useRef<HTMLButtonElement>(null);
  const immediateButton = useRef<HTMLButtonElement>(null);
  // What the replace dialog's Send did, for where focus goes once it has closed: "submitted" sent
  // (the heading), "switched" sent and switched to immediate delivery (the switch, since Send is
  // absent there), nothing: back to Send.
  const sent = useRef<"submitted" | "switched" | undefined>(undefined);
  const text = useStrings();
  const language = useLanguage();
  const snapshot = <SnapshotButton control={props.snapshot} offer={props.snapshotOffer} />;
  // The feedback has a line of its own under the bar's controls, whatever the path's length.
  const feedback = <SnapshotFeedback control={props.snapshot} offer={props.snapshotOffer} />;
  if (single) {
    return (
      <footer className="sticky bottom-0 flex min-h-bottom-bar flex-wrap items-center gap-sm border-t border-border bg-card px-lg py-sm">
        {warning === undefined ? null : <Warning warning={warning} />}
        <span className="ml-auto flex min-w-0 items-center gap-sm">{snapshot}</span>
        {feedback}
      </footer>
    );
  }
  // The press of Submit against the held work as it is now.
  const pressNow = () =>
    submitPress(
      document,
      context.board.get(),
      context.draft.record(),
      new Date(),
      context.derived.reported,
      {
        results: context.results?.record(),
        entries: entriesWithCells(context.entries?.record(), context.cellEntries?.record()),
        state,
        ...(readOnlyOf === undefined ? {} : { readOnlyOf }),
        ...(shownOf === undefined ? {} : { shownOf }),
        ...(load === undefined ? {} : { load }),
      },
    );
  // Submit's one command: every held act, in the order the user produced them (AD-20), after a
  // last check that every held answer has the reason its held result requires: one that lacks it
  // sends nothing, keeps every act held and takes the board to that question's prompt. Then, when
  // the command would replace a verdict the agent has received, the dialog asks; Cancel or Escape
  // sends nothing and keeps every act held. `then` runs once the command has gone, as the switch to
  // immediate delivery does.
  const sendActsOf = (acts: readonly ViewAct[], then?: () => void, dialog = false): void => {
    sendSubmit(context, acts);
    if (then !== undefined) {
      if (dialog) sent.current = "switched";
      then();
    } else if (dialog) sent.current = "submitted";
    else props.onSubmitted?.();
  };
  const send = (then?: () => void): void => {
    const pressed = pressNow();
    if (pressed.kind === "needs-reason") {
      props.onNeedsReason(pressed.questionId);
      return;
    }
    // A held answer's question holds a blocking field, or a held act's question is loading or failed:
    // nothing is sent, the board goes to it.
    if (pressed.kind === "field-block" || pressed.kind === "unusable") {
      props.onJump(pressed.questionId);
      return;
    }
    if (pressed.kind === "send") sendActsOf(pressed.acts, then);
    else setReplacing({ questions: pressed.questions, then });
  };
  // The dialog's Submit presses again against the held work as it is now, and sends only what that
  // press sends: it goes nowhere while Submit waits, and it asks again when the questions changed.
  const confirmReplacing = () => {
    const outcome = confirmedPress(replacing?.questions ?? [], submit.disabled, pressNow());
    const then = replacing?.then;
    if (outcome.kind === "ask") {
      setReplacing({ questions: outcome.questions, then });
      return;
    }
    setReplacing(undefined);
    if (outcome.kind === "needs-reason") props.onNeedsReason(outcome.questionId);
    else if (outcome.kind === "field-block" || outcome.kind === "unusable") {
      props.onJump(outcome.questionId);
    } else if (outcome.kind === "send") sendActsOf(outcome.acts, then, true);
  };
  // Leaving submitted delivery with held work asks first, and waits whenever Submit waits.
  const blockedSwitch = immediateBlocked(submit, delivery);
  const toImmediate = () => {
    if (delivery === "immediate") return;
    if (submit.held > 0) setConfirming(true);
    else context.board.setDelivery("immediate");
  };
  const [blocked] = submit.blocked;
  return (
    <footer className="sticky bottom-0 flex min-h-bottom-bar flex-wrap items-center gap-md border-t border-border bg-card px-lg py-sm">
      <span id="askboard-delivery" className={SECTION_LABEL}>
        {text("bar.delivery")}
      </span>
      <fieldset aria-labelledby="askboard-delivery" className={SEGMENTS}>
        <button
          ref={immediateButton}
          type="button"
          className={SEGMENT}
          data-askboard-delivery="immediate"
          aria-pressed={delivery === "immediate"}
          disabled={locked || blockedSwitch}
          onClick={toImmediate}
        >
          {text("bar.immediate")}
        </button>
        <button
          type="button"
          className={SEGMENT}
          data-askboard-delivery="submitted"
          aria-pressed={delivery === "submitted"}
          disabled={locked}
          onClick={() => context.board.setDelivery("submitted")}
        >
          {text("bar.submitted")}
        </button>
      </fieldset>
      <span className="text-body text-muted-foreground">
        {delivery === "immediate"
          ? text("bar.immediateHelp")
          : text("bar.submittedHelp", { submit: text("bar.submitName") })}
      </span>
      {warning === undefined ? null : <Warning warning={warning} />}
      <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-sm">
        {recommendations ? (
          <button
            type="button"
            className={BUTTON_SECONDARY}
            data-askboard-prefill=""
            disabled={locked}
            onClick={props.onSelectRecommended}
          >
            {text("bar.selectRecommended")}
          </button>
        ) : null}
        {snapshot}
        {blocked === undefined ? null : (
          <button type="button" className={BUTTON_LINK} onClick={() => props.onJump(blocked)}>
            {updatesLabel(submit.blocked.length, language)}
          </button>
        )}
        {delivery === "immediate" || props.allReady !== true ? null : (
          <span data-askboard-all-ready="" className="text-body text-foreground-secondary">
            {text("bar.allReady")}
          </span>
        )}
        {delivery === "immediate" ? null : (
          <button
            ref={submitButton}
            type="button"
            data-askboard-submit=""
            className={BUTTON_PRIMARY}
            disabled={submit.disabled}
            onClick={() => send()}
          >
            {submit.answers > 0
              ? text("bar.submit", { count: submit.answers })
              : text("bar.submitPlain")}
          </button>
        )}
      </span>
      {feedback}
      <AlertDialog.Root open={confirming} onOpenChange={setConfirming}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-30 bg-foreground/30" />
          <AlertDialog.Content
            className={DIALOG}
            onCloseAutoFocus={(event) => {
              // The dialog has no trigger, so Radix restores no focus: it goes back to the switch
              // that asked, which stays enabled once the held work has been sent. Focus a card moved
              // meanwhile (the prompt Submit's check asks for) stays where it is.
              event.preventDefault();
              const page = globalThis.document;
              const active = page.activeElement;
              const inDialog = event.target instanceof Node && event.target.contains(active);
              if (active === null || active === page.body || inDialog) {
                immediateButton.current?.focus();
              }
            }}
          >
            <AlertDialog.Title className="text-body-lg font-semibold">
              {text("bar.switchTitle")}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-body text-foreground-secondary">
              {text("bar.switchBody")}
            </AlertDialog.Description>
            <div className="mt-sm flex justify-end gap-sm">
              <AlertDialog.Cancel className={BUTTON_SECONDARY}>
                {text("bar.cancel")}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className={BUTTON_PRIMARY}
                disabled={submit.disabled}
                onClick={() => send(() => context.board.setDelivery("immediate"))}
              >
                {text("bar.sendAndSwitch")}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      <AlertDialog.Root
        open={replacing !== undefined}
        onOpenChange={(open) => {
          if (!open) setReplacing(undefined);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-30 bg-foreground/30" />
          <AlertDialog.Content
            className={DIALOG}
            onCloseAutoFocus={(event) => {
              // The dialog has no trigger, so Radix restores no focus: the heading after a send, the
              // switch after Send and switch, Send when nothing was sent (D1). The dialog opens
              // only from Send, in "All together", and the mode changes only through the "switched"
              // path above, so Send is always there when nothing was sent.
              event.preventDefault();
              const did = sent.current;
              sent.current = undefined;
              if (did === "submitted") props.onSubmitted?.();
              else if (did === "switched") immediateButton.current?.focus();
              else submitButton.current?.focus();
            }}
          >
            <AlertDialog.Title className="text-body-lg font-semibold">
              {text("revision.submitTitle")}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-body text-foreground-secondary">
              {text("revision.submitBody")}
            </AlertDialog.Description>
            <ReplacedQuestions questions={replacing?.questions ?? []} />
            <div className="mt-sm flex justify-end gap-sm">
              <AlertDialog.Cancel className={BUTTON_SECONDARY}>
                {text("bar.cancel")}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                data-askboard-confirm=""
                className={BUTTON_PRIMARY}
                disabled={submit.disabled}
                onClick={(event) => {
                  // The dialog stays open when it must ask again: it closes by its own state.
                  event.preventDefault();
                  confirmReplacing();
                }}
              >
                {text("revision.confirmSend")}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </footer>
  );
};
