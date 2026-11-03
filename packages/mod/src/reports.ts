// Delivery reports (AD-3, FR-22; mod spec, "Delivery reports"; design decision 7, Pushed once): a
// push call that succeeded is reported, which raises the ask's `received` watermark and the board's
// receipt. A report is a step of its own: one that gets no answer is kept, one per ask, and retried
// alone at the next poll, and never causes another push (finding O7); a report made in a hook waits
// for the next poll the same way. A refusal (4xx, such as 409: no poll could have given that
// cursor) is final; a server error (5xx) is retried like no answer (review fix, 2026-11-01).

import { LOCAL_API_ROUTES, LOCAL_API_VERSION } from "@askboard/contract";
import { debugOnce } from "./diagnostics.ts";
import type { DeliveryReport, Memory } from "./memory.ts";
import type { ModApi } from "./mod-api.ts";
import { lastCursor, type PushedAsk, seqOf } from "./push-message.ts";
import { isFinalRefusal, send } from "./transport.ts";
import { checks } from "./validators.ts";

const ROUTE = LOCAL_API_ROUTES.delivered.path;

// Keeps a report to retry, unless one of the same ask up to a later cursor waits already.
const keep = (memory: Memory, report: DeliveryReport): void => {
  const waiting = memory.unreported.get(report.askId);
  if (waiting !== undefined && seqOf(waiting.cursor) >= seqOf(report.cursor)) return;
  memory.unreported.set(report.askId, report);
};

// Settles the ask's waiting report once a report up to the same cursor or a later one is done.
const settled = (memory: Memory, report: DeliveryReport): void => {
  const waiting = memory.unreported.get(report.askId);
  if (waiting !== undefined && seqOf(waiting.cursor) <= seqOf(report.cursor)) {
    memory.unreported.delete(report.askId);
  }
};

const sendReport = async (
  memory: Memory,
  $: ModApi,
  epoch: string,
  report: DeliveryReport,
): Promise<void> => {
  const session = memory.session;
  // A report of an old epoch has no ask left to raise.
  if (session === undefined || session.epoch !== epoch) return;
  const answer = await send(memory, $, session, {
    method: "POST",
    path: ROUTE,
    body: { version: LOCAL_API_VERSION, ...report },
  });
  if (answer.kind === "refused") {
    debugOnce(memory, $, `POST ${ROUTE} was refused with ${answer.status}`);
  }
  const done =
    answer.kind === "refused"
      ? isFinalRefusal(answer.status)
      : answer.kind === "answered" && checks.ack(answer.body);
  if (done) settled(memory, report);
  else if (memory.session?.epoch === epoch) keep(memory, report);
};

/** Reports each ask of a push that succeeded, up to its last event pushed. */
export const reportDelivered = async (
  memory: Memory,
  $: ModApi,
  epoch: string,
  asks: readonly PushedAsk[],
  via: DeliveryReport["via"],
): Promise<void> => {
  for (const ask of asks) {
    await sendReport(memory, $, epoch, { askId: ask.askId, cursor: lastCursor(ask), via });
  }
};

/**
 * Keeps a report of each ask of a push for the next poll to send: for a hook, which never waits for
 * a report.
 */
export const queueReports = (
  memory: Memory,
  asks: readonly PushedAsk[],
  via: DeliveryReport["via"],
): void => {
  for (const ask of asks) keep(memory, { askId: ask.askId, cursor: lastCursor(ask), via });
};

/** Sends, alone, the reports that got no answer and the ones a hook kept. */
export const retryReports = async (memory: Memory, $: ModApi, epoch: string): Promise<void> => {
  for (const report of [...memory.unreported.values()]) {
    await sendReport(memory, $, epoch, report);
  }
};
