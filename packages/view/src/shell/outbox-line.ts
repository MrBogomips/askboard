// The line under the outbox's Send (answering-flow-visual, design decision 3; requirement "The
// outbox"): pure. Agent-change notices that block held work come first and replace the others,
// then "all ready" when the completion panel says send-all, then the held answers, else nothing.

import type { Completion } from "./completion.ts";

export type OutboxLine =
  | { readonly kind: "updates"; readonly count: number; readonly first: string }
  | { readonly kind: "all-ready" }
  | { readonly kind: "held"; readonly count: number };

export type OutboxLineInputs = {
  /** The questions whose held work an agent-change notice blocks, in board order. */
  readonly blocked: readonly string[];
  readonly completion: Completion;
  /** The answers held for Send. */
  readonly held: number;
};

export const outboxLineOf = ({
  blocked,
  completion,
  held,
}: OutboxLineInputs): OutboxLine | undefined => {
  const [first] = blocked;
  if (first !== undefined) return { kind: "updates", count: blocked.length, first };
  if (completion.kind === "send-all") return { kind: "all-ready" };
  if (held > 0) return { kind: "held", count: held };
  return undefined;
};
