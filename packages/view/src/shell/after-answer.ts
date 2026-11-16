// What the board does after an act (answering-flow-guidance, design decision 3; EXPERIENCE.md,
// After an answer): pure, from the act and its result, the setting, the delivery mode and what the
// next-to-do jump and the ladder found. The card runs the output at the act, never at the reply,
// so a focus the user moved during a flight is never taken (NFR-10 holds: nothing here sends).

import type { Delivery } from "./board-draft.ts";
import type { AnswerResult } from "./revision-confirm.ts";

/** The setting `afterAnswer` (AD-14): go to the next question to do, or stay on this one. */
export type AfterAnswerSetting = "next" | "stay";

/** The result of an act: an answer's, or `took-effect` for a postpone or a decline that did. */
export type ActResult = AnswerResult | "took-effect" | undefined;

export type AfterAnswerInputs = {
  readonly act: "answer" | "postpone" | "decline";
  /** Undefined: a field blocked, the confirmation was cancelled, or nothing took effect. */
  readonly result: ActResult;
  /** The answer is a revision of an answered or declined question. */
  readonly revision?: boolean;
  /** The act took back a postpone or a decline. */
  readonly undo?: boolean;
  /** The board holds one question. */
  readonly single: boolean;
  readonly setting: AfterAnswerSetting;
  readonly delivery: Delivery;
  /**
   * The next question to do after the acted one (`nextOpenFrom`: to do and draft questions, an
   * unseen one the agent added first); none when only postponed questions, or none, remain.
   */
  readonly next?: { readonly id: string; readonly newFromAgent: boolean } | undefined;
  /** The acts held for Submit once the act is taken in: answers, declines and postpones alike. */
  readonly held: number;
  /** Where the acted question and the target sit, for the area that has just been finished. */
  readonly area?: {
    readonly acted?: { readonly id: string; readonly title?: string };
    /** The questions to do the acted question's area still has. */
    readonly left: number;
    readonly targetId?: string;
  };
};

type Moving = {
  readonly target: string;
  readonly newFromAgent: boolean;
  /** The title of the acted question's area, when that area has been finished. */
  readonly areaDone?: string;
};

export type AfterAnswer =
  | { readonly kind: "stay" }
  | ({ readonly kind: "move" } & Moving)
  | ({ readonly kind: "footer" } & Moving)
  | { readonly kind: "complete" }
  | { readonly kind: "send-all" };

const STAY: AfterAnswer = { kind: "stay" };

// An answer's results that finish the question; the others (a note, Edit, a missing reason)
// leave it where it was.
const FINISHING: readonly ActResult[] = ["sent", "held", "took-effect"];

const areaDoneOf = (input: AfterAnswerInputs): string | undefined => {
  const { area, next } = input;
  const title = area?.acted?.title;
  if (area === undefined || next === undefined || title === undefined) return undefined;
  return area.left === 0 && area.targetId !== area.acted?.id ? title : undefined;
};

/** What the board does after the act: stay, move, show the footer, complete, or send all. */
export const afterAnswerOf = (input: AfterAnswerInputs): AfterAnswer => {
  const { result, revision = false, undo = false, single, setting, delivery, next, held } = input;
  if (single || revision || undo || !FINISHING.includes(result)) return STAY;
  if (next === undefined) {
    return delivery === "submitted" && held > 0 ? { kind: "send-all" } : { kind: "complete" };
  }
  const areaDone = areaDoneOf(input);
  const moving: Moving = {
    target: next.id,
    newFromAgent: next.newFromAgent,
    ...(areaDone === undefined ? {} : { areaDone }),
  };
  return setting === "next" ? { kind: "move", ...moving } : { kind: "footer", ...moving };
};
