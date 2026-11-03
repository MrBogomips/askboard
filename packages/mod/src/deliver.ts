// The three push calls (AD-4; design decision 7): an append, to a running subagent or to the main
// conversation while its turn runs; a submit, which starts a main turn; and a send, which wakes an
// idle in-process teammate (G2), the one use of `$.session.send`. All are attributed to the plugin:
// the mod never submits as the user. An event counts as pushed once its call is made (finding O7);
// a call that fails takes it back.

import { debug } from "./diagnostics.ts";
import type { Memory } from "./memory.ts";
import type { ModApi } from "./mod-api.ts";
import { keysOf, type PushedAsk, pushText } from "./push-message.ts";
import { reportDelivered } from "./reports.ts";

/** Counts the events of a push as pushed in this epoch. */
export const markPushed = (memory: Memory, asks: readonly PushedAsk[]): void => {
  for (const key of keysOf(asks)) memory.pushed.add(key);
};

/** Takes back the events of a push whose call failed, so that the next poll pushes them again. */
export const unmarkPushed = (memory: Memory, epoch: string, asks: readonly PushedAsk[]): void => {
  if (memory.session?.epoch !== epoch) return;
  for (const key of keysOf(asks)) memory.pushed.delete(key);
};

/** Appends one push as a user row the model reads at its next request; true once stored. */
export const appendPush = async (
  $: ModApi,
  epoch: string,
  asks: readonly PushedAsk[],
  agentId?: string,
): Promise<boolean> => {
  try {
    const stored = await $.session.append({
      message: { type: "user", content: [{ type: "text", text: pushText(epoch, asks) }] },
      ...(agentId === undefined ? {} : { agentId }),
    });
    return stored.deny === undefined;
  } catch {
    return false;
  }
};

/**
 * Sends one push as a message to an agent's inbox, which wakes an idle teammate; true once
 * delivered. A send not delivered, as auto mode answers a mod's (finding D13), or one that
 * rejects, is false: nothing reached the agent.
 */
export const sendPush = async (
  $: ModApi,
  epoch: string,
  asks: readonly PushedAsk[],
  agentId: string,
): Promise<boolean> => {
  try {
    const sent = await $.session.send({ to: { agentId }, text: pushText(epoch, asks) });
    return sent.isDelivered === true;
  } catch {
    return false;
  }
};

export type SubmitOutcomes = {
  /** Claude Code did not take the prompt: after a user interruption, until the user's input. */
  readonly dropped: (asks: readonly PushedAsk[]) => void;
  /** The call itself failed. */
  readonly failed: (asks: readonly PushedAsk[]) => void;
};

/**
 * Submits one push as a turn of the main conversation. The call resolves only when that turn
 * starts, so it is never awaited: a submit that was not dropped is reported then.
 */
export const submitPush = (
  memory: Memory,
  $: ModApi,
  epoch: string,
  asks: readonly PushedAsk[],
  outcomes: SubmitOutcomes,
): void => {
  const current = () => memory.session?.epoch === epoch;
  $.prompt
    .submit({ text: pushText(epoch, asks) })
    .then(
      async (result) => {
        if (!current()) return;
        if (result.drop !== undefined) {
          outcomes.dropped(asks);
          return;
        }
        await reportDelivered(memory, $, epoch, asks, "submit");
      },
      () => {
        if (current()) outcomes.failed(asks);
      },
    )
    .catch(() => debug($, "a submitted push could not be followed up"));
};
