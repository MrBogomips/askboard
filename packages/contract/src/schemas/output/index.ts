// The output format (owner `contract`, AD-7): what AskBoard returns to agents inside the tool
// results. E1 defines the answer event of finding F4 with AD-20's generic diff, the discarded event,
// the no-hooks warning and the outcomes `unavailable` and `open`. It holds no AXFX term (FR-18).

import type { SchemaSet } from "../../versions.ts";
import answerEvent from "./answer-event.json" with { type: "json" };
import askState from "./ask-state.json" with { type: "json" };
import cursor from "./cursor.json" with { type: "json" };
import discardedEvent from "./discarded-event.json" with { type: "json" };
import epoch from "./epoch.json" with { type: "json" };
import outcome from "./outcome.json" with { type: "json" };
import time from "./time.json" with { type: "json" };
import unavailableReason from "./unavailable-reason.json" with { type: "json" };
import warning from "./warning.json" with { type: "json" };

export const OUTPUT_FORMAT_VERSION = "1.0";

export const outputFormat: SchemaSet = {
  name: "output",
  title: "output format",
  owner: "contract",
  version: OUTPUT_FORMAT_VERSION,
  schemas: [
    epoch,
    cursor,
    time,
    askState,
    answerEvent,
    discardedEvent,
    warning,
    outcome,
    unavailableReason,
  ],
};

export type AskState = "waiting" | "answered" | "discarded";

/**
 * One operation of AD-20's generic diff; a target is a reference without brackets (AD-13). `add`
 * and `move` omit `parent` at the top level and `after` in the first position.
 */
export type Change =
  | {
      readonly op: "add";
      readonly target: string;
      readonly parent?: string;
      readonly after?: string;
      readonly value: unknown;
    }
  | { readonly op: "remove"; readonly target: string }
  | {
      readonly op: "move";
      readonly target: string;
      readonly parent?: string;
      readonly after?: string;
    }
  | { readonly op: "set"; readonly target: string; readonly value: unknown };

export type AnswerEvent = {
  readonly cursor: string;
  readonly type: "answer";
  readonly itemId: string;
  readonly rev: number;
  readonly who: string;
  /** RFC 3339 UTC: when the user acted, as the board stamped it (FR-19). */
  readonly when: string;
  /** The chosen options, by label (finding F5). */
  readonly choice?: readonly string[];
  readonly note?: string;
  readonly changes?: readonly Change[];
  readonly results?: Readonly<Record<string, unknown>>;
  readonly derived?: Readonly<Record<string, unknown>>;
};

export type DiscardReason = "session-exit";

export type DiscardedEvent = {
  readonly cursor: string;
  readonly type: "discarded";
  readonly reason: DiscardReason;
};

export type OutputEvent = AnswerEvent | DiscardedEvent;

export type Warning = { readonly code: "no-hooks"; readonly message: string };

export type Outcome = "unavailable" | "open";

/** AD-18's detection rule, in its order. */
export type UnavailableReason = "remote-host" | "container" | "ci" | "no-browser";
