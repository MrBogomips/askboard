// The bottom action bar (EXPERIENCE.md, Bottom action bar, Delivery mode switch, Select
// recommended, Submit and Mode-switch confirmation; DESIGN.md, the same; ask-lifecycle, task 6.6;
// FR-3, FR-22, AD-20): sticky, on a board of two or more questions it holds the "Delivery" label
// and the "Immediate | Submitted" switch with its helper text, the postponed warning line, then
// "Select recommended" (only while a question has a recommendation), the count of agent-change
// notices on held work, which jumps to the first, and "Submit". Switching from submitted to
// immediate with held work asks first, in a modal Radix Alert Dialog whose scroll lock runs
// through the view's style-element shim (S-6): confirming sends the held work as Submit does and
// switches, cancelling stays in submitted delivery; it is blocked as Submit is. On the
// single-question board the bar shows only the postponed warning line, while there is one.

import { AlertDialog } from "radix-ui";
import { useState } from "react";
import type { ViewDocument } from "../view-document.ts";
import type { ViewAct } from "../view-protocol.ts";
import type { BoardDraft, Delivery } from "./board-draft.ts";
import { type Senders, sendActs } from "./card-acts.ts";
import type { DraftStore } from "./draft-store.ts";
import { QuestionMarker } from "./markers.tsx";
import {
  BUTTON_LINK,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  FOCUS_RING,
  SECTION_LABEL,
} from "./styles.ts";
import { heldWorkOf, type SubmitState, submitActsOf, updatesLabel } from "./submit.ts";

const SEGMENT = `h-6 rounded-sm border-b-2 border-transparent px-2 text-control text-muted-foreground aria-pressed:border-primary aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground disabled:opacity-50 ${FOCUS_RING}`;

const DIALOG =
  "fixed top-24 left-1/2 z-30 flex w-96 max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-border bg-popover p-4 text-foreground shadow-lg";

/** The immediate mode's helper text (EXPERIENCE.md, Voice and Tone: Bottom action bar). */
const IMMEDIATE_HELP = "Answers go to the agent as you give them.";

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
  readonly context: Senders & { readonly draft: DraftStore; readonly board: BoardDraft };
  readonly onSelectRecommended: () => void;
  readonly onJump: (questionId: string) => void;
};

export const BottomBar = (props: BottomBarProps) => {
  const { single, document, delivery, warning, submit, recommendations, locked, context } = props;
  const [confirming, setConfirming] = useState(false);
  if (single) {
    return warning === undefined ? null : (
      <footer className="sticky bottom-0 flex min-h-12 items-center gap-2 border-t border-border bg-card px-4">
        <Warning warning={warning} />
      </footer>
    );
  }
  // Submit's one command: every held act, in the order the user produced them (AD-20).
  const send = () => {
    const acts = submitActsOf(
      heldWorkOf(document, context.board.get()),
      context.draft.record(),
      new Date(),
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
    <footer className="sticky bottom-0 flex min-h-12 flex-wrap items-center gap-3 border-t border-border bg-card px-4 py-2">
      <span id="askboard-delivery" className={SECTION_LABEL}>
        Delivery
      </span>
      <fieldset
        aria-labelledby="askboard-delivery"
        className="flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5"
      >
        <button
          type="button"
          className={SEGMENT}
          aria-pressed={delivery === "immediate"}
          disabled={locked || blockedSwitch}
          onClick={toImmediate}
        >
          Immediate
        </button>
        <button
          type="button"
          className={SEGMENT}
          aria-pressed={delivery === "submitted"}
          disabled={locked}
          onClick={() => context.board.setDelivery("submitted")}
        >
          Submitted
        </button>
      </fieldset>
      {delivery === "immediate" ? (
        <span className="text-body text-muted-foreground">{IMMEDIATE_HELP}</span>
      ) : null}
      {warning === undefined ? null : <Warning warning={warning} />}
      <span className="ml-auto flex items-center gap-2">
        {recommendations ? (
          <button
            type="button"
            className={BUTTON_SECONDARY}
            disabled={locked}
            onClick={props.onSelectRecommended}
          >
            Select recommended
          </button>
        ) : null}
        {blocked === undefined ? null : (
          <button type="button" className={BUTTON_LINK} onClick={() => props.onJump(blocked)}>
            {updatesLabel(submit.blocked.length)}
          </button>
        )}
        <button type="button" className={BUTTON_PRIMARY} disabled={submit.disabled} onClick={send}>
          Submit
        </button>
      </span>
      <AlertDialog.Root open={confirming} onOpenChange={setConfirming}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-30 bg-foreground/30" />
          <AlertDialog.Content className={DIALOG}>
            <AlertDialog.Title className="text-body-lg font-semibold">
              Switch to immediate delivery?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-body text-foreground-secondary">
              Your held work goes to the agent now, in the order you gave it.
            </AlertDialog.Description>
            <div className="mt-2 flex justify-end gap-2">
              <AlertDialog.Cancel className={BUTTON_SECONDARY}>Cancel</AlertDialog.Cancel>
              <AlertDialog.Action
                className={BUTTON_PRIMARY}
                disabled={submit.disabled}
                onClick={() => {
                  send();
                  context.board.setDelivery("immediate");
                }}
              >
                Send and switch
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </footer>
  );
};
