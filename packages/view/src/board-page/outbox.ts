// The act commands the board page holds (ask-lifecycle, design decision 6; AD-20, FR-22): each
// command from the view, with the action ID the board page drew for it, in the order given, until
// `board-host` acknowledges it with `done` (kept until the state that follows) or refuses it. One
// given while the board is not live waits unsent ("not sent yet"); one sent on a socket that drops
// before its acknowledgement is held too. On each new socket, once its state has come, the board
// page sends every held command again with the same action ID, so ask-core applies each once:
// a command that was sent goes whatever the state shows, since `board-host` knows whether it
// landed, and a queued one only if each of its questions still stands as when the user acted
// (AD-10: never one the board no longer shows). How the latest commands ended stays for the view,
// which keeps the user's work until its command is done.

import type { ActCommand, LifecycleBoardState } from "@askboard/contract";
import type { PendingAct, SettledAct } from "../view-protocol.ts";
import type { ActBasis } from "./model.ts";

export type HeldCommand = {
  readonly command: ActCommand;
  /** Each act's question as it stood when the user acted. */
  readonly basis: readonly ActBasis[];
  /** Sent on a socket at least once. */
  readonly sent: boolean;
  /** Acknowledged; dropped once the state that follows has come. */
  readonly done: boolean;
};

export type Outbox = {
  readonly held: readonly HeldCommand[];
  /** How the latest commands ended, oldest first. */
  readonly settled: readonly SettledAct[];
};

export const EMPTY_OUTBOX: Outbox = { held: [], settled: [] };

/** How many settled commands the view hears of: far more than one update can settle. */
export const SETTLED_KEPT = 32;

const ACTION_ID_BYTES = 16;

/** A fresh action ID: 22 base64url characters from 16 random bytes (AD-20). */
export const newActionId = (
  fill: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (bytes) => crypto.getRandomValues(bytes),
): string => {
  const bytes = fill(new Uint8Array(ACTION_ID_BYTES));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

const withSettled = (outbox: Outbox, settled: readonly SettledAct[]): readonly SettledAct[] =>
  [...outbox.settled, ...settled].slice(-SETTLED_KEPT);

/** The outbox with this command last. */
export const hold = (
  outbox: Outbox,
  command: ActCommand,
  basis: readonly ActBasis[],
  sent: boolean,
): Outbox => ({ ...outbox, held: [...outbox.held, { command, basis, sent, done: false }] });

/** `done` came for the command: it stays until the state that follows it. */
export const acknowledged = (outbox: Outbox, actionId: string): Outbox => {
  if (!outbox.held.some((held) => held.command.actionId === actionId && !held.done)) return outbox;
  return {
    ...outbox,
    held: outbox.held.map((held) =>
      held.command.actionId === actionId ? { ...held, done: true } : held,
    ),
  };
};

/** A state came: every acknowledged command is settled as done. */
export const settleDone = (outbox: Outbox): Outbox => {
  const done = outbox.held.filter((held) => held.done);
  if (done.length === 0) return outbox;
  return {
    held: outbox.held.filter((held) => !held.done),
    settled: withSettled(
      outbox,
      done.map((held) => ({ actionId: held.command.actionId, outcome: "done" as const })),
    ),
  };
};

/** `board-host` refused the command: it is dropped and settled as refused. */
export const refusedCommand = (outbox: Outbox, actionId: string): Outbox => {
  if (!outbox.held.some((held) => held.command.actionId === actionId)) return outbox;
  return {
    held: outbox.held.filter((held) => held.command.actionId !== actionId),
    settled: withSettled(outbox, [{ actionId, outcome: "refused" }]),
  };
};

/** The ask ended: every held command is dropped. */
export const withoutAll = (outbox: Outbox): Outbox =>
  outbox.held.length === 0
    ? outbox
    : {
        held: [],
        settled: withSettled(
          outbox,
          outbox.held.map((held) => ({
            actionId: held.command.actionId,
            outcome: "dropped" as const,
          })),
        ),
      };

/** Whether a command was never sent: work the user gave that `board-host` has not seen. */
export const hasUnsent = (outbox: Outbox): boolean => outbox.held.some((held) => !held.sent);

/** The held commands as the view hears of them. */
export const pendingOf = (outbox: Outbox): PendingAct[] =>
  outbox.held.map(({ command, sent }) => ({
    actionId: command.actionId,
    outcome: sent ? "sent" : "queued",
  }));

const stands = (basis: readonly ActBasis[], state: LifecycleBoardState): boolean =>
  basis.every(({ itemId, rev, state: was }) =>
    state.questions.some(
      (question) => question.itemId === itemId && question.rev === rev && question.state === was,
    ),
  );

export type Flushed = {
  readonly outbox: Outbox;
  /** The queued commands dropped because the board changed under them, and why. */
  readonly dropped: readonly { readonly actionId: string; readonly detail: string }[];
};

/**
 * Sends each held command again through `send`, in order, as a new socket's state allows; a queued
 * one also only if `problemOf` finds nothing against it now, such as an item that failed meanwhile.
 */
export const flush = (
  outbox: Outbox,
  state: LifecycleBoardState,
  send: (command: ActCommand) => boolean,
  problemOf: (command: ActCommand) => string | undefined = () => undefined,
): Flushed => {
  const kept: HeldCommand[] = [];
  const dropped: { actionId: string; detail: string }[] = [];
  for (const held of outbox.held) {
    const problem = held.sent
      ? undefined
      : stands(held.basis, state)
        ? problemOf(held.command)
        : "the board changed while it was not live";
    if (held.done) {
      kept.push(held);
    } else if (problem !== undefined) {
      dropped.push({ actionId: held.command.actionId, detail: problem });
    } else {
      kept.push({ ...held, sent: send(held.command) || held.sent });
    }
  }
  return {
    outbox: {
      held: kept,
      settled: withSettled(
        outbox,
        dropped.map(({ actionId }) => ({ actionId, outcome: "dropped" as const })),
      ),
    },
    dropped,
  };
};
