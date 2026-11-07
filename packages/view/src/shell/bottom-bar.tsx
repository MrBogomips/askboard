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

import { AlertDialog } from "radix-ui";
import { useState } from "react";
import { useLanguage, useStrings } from "../catalog/port.ts";
import type { ViewDocument } from "../view-document.ts";
import type { ViewAct } from "../view-protocol.ts";
import type { BoardDraft, Delivery } from "./board-draft.ts";
import { type Senders, sendActs } from "./card-acts.ts";
import type { DerivedStore } from "./derived-store.ts";
import type { DraftStore } from "./draft-store.ts";
import { QuestionMarker } from "./markers.tsx";
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
import { heldWorkOf, type SubmitState, submitActsOf, updatesLabel } from "./submit.ts";

const Warning = ({ warning }: { readonly warning: string }) => (
  <span className="flex items-center gap-1.5">
    <QuestionMarker mark="postponed" />
    <span className="text-body text-foreground">{warning}</span>
  </span>
);

export type BottomBarProps = {
  readonly single: boolean;
  readonly document: ViewDocument;
  readonly delivery: Delivery;
  readonly warning: string | undefined;
  readonly submit: SubmitState;
  readonly recommendations: boolean;
  /** Nothing on the board acts: it moved, or the ask ended. */
  readonly locked: boolean;
  readonly context: Senders & {
    readonly draft: DraftStore;
    readonly results?: DraftStore;
    readonly board: BoardDraft;
    readonly derived: DerivedStore;
  };
  readonly onSelectRecommended: () => void;
  readonly onJump: (questionId: string) => void;
  /** The bar's Snapshot, and whether the board offers it now. */
  readonly snapshot: SnapshotControl;
  readonly snapshotOffer: SnapshotOffer;
};

export const BottomBar = (props: BottomBarProps) => {
  const { single, document, delivery, warning, submit, recommendations, locked, context } = props;
  const [confirming, setConfirming] = useState(false);
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
  // Submit's one command: every held act, in the order the user produced them (AD-20).
  const send = () => {
    const acts = submitActsOf(
      heldWorkOf(document, context.board.get()),
      context.draft.record(),
      new Date(),
      context.derived.reported,
      context.results?.record(),
    );
    const [first, ...rest] = acts;
    if (first !== undefined) sendActs(context, [first, ...rest] as [ViewAct, ...ViewAct[]]);
  };
  // Leaving submitted delivery with held work asks first, and waits whenever Submit waits.
  const blockedSwitch = submit.held > 0 && delivery === "submitted" && submit.disabled;
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
          type="button"
          className={SEGMENT}
          aria-pressed={delivery === "immediate"}
          disabled={locked || blockedSwitch}
          onClick={toImmediate}
        >
          {text("bar.immediate")}
        </button>
        <button
          type="button"
          className={SEGMENT}
          aria-pressed={delivery === "submitted"}
          disabled={locked}
          onClick={() => context.board.setDelivery("submitted")}
        >
          {text("bar.submitted")}
        </button>
      </fieldset>
      {delivery === "immediate" ? (
        <span className="text-body text-muted-foreground">{text("bar.immediateHelp")}</span>
      ) : null}
      {warning === undefined ? null : <Warning warning={warning} />}
      <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-sm">
        {recommendations ? (
          <button
            type="button"
            className={BUTTON_SECONDARY}
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
        <button type="button" className={BUTTON_PRIMARY} disabled={submit.disabled} onClick={send}>
          {text("bar.submit")}
        </button>
      </span>
      {feedback}
      <AlertDialog.Root open={confirming} onOpenChange={setConfirming}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-30 bg-foreground/30" />
          <AlertDialog.Content className={DIALOG}>
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
                onClick={() => {
                  send();
                  context.board.setDelivery("immediate");
                }}
              >
                {text("bar.sendAndSwitch")}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </footer>
  );
};
