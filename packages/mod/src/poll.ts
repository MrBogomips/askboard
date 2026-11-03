// The mod's start and its poll (AD-5; mod spec, "Finding the session process", "Trusting the
// session file", "Polling the local API"; design decision 7, Start and Per poll). One poll a period,
// skipped while the previous one runs: read the session file, check that it and its folder are
// private when it names a session process not yet checked and once a minute after, retry the
// delivery and turn reports that got no answer, say hello once per epoch, then one request serves
// push and the pending asks.

import {
  CLAUDE_CODE_CLIENT_NAME,
  LOCAL_API_ROUTES,
  LOCAL_API_VERSION,
  POLL_INTERVAL_MS,
  type PollResponse,
  pollPath,
  type SessionFile,
} from "@askboard/contract";
import { debug, debugOnce } from "./diagnostics.ts";
import { isPrivate, locate, readSession } from "./locate.ts";
import type { Location } from "./memory.ts";
import { adopt, type Memory } from "./memory.ts";
import type { ModApi } from "./mod-api.ts";
import { clearPending, showPending } from "./pending.ts";
import { pushPoll } from "./push.ts";
import { retryReports } from "./reports.ts";
import { send } from "./transport.ts";
import { retryTurnReports } from "./turn-reports.ts";
import { checks } from "./validators.ts";

/** Learns where the session file is and starts the poll, once per loaded module. */
export const start = async (memory: Memory, $: ModApi): Promise<void> => {
  if (memory.starting || memory.location !== undefined) return;
  memory.starting = true;
  const location = await locate($);
  memory.starting = false;
  if (location === undefined) {
    debug($, "the Claude Code process could not be identified; push is off for this session");
    return;
  }
  memory.location = location;
  // The poll survives /clear, which fires session.end and no new session.start (AD-5).
  $.clock.every(POLL_INTERVAL_MS, () => tick(memory, $));
};

// The version report, once per epoch (AD-18). A refusal is an answer too: only a request that got
// none is tried again at the next poll, as is a hello whose version could not be read, while the
// poll goes on (review fix, 2026-11-01).
const sayHello = async (memory: Memory, $: ModApi, session: SessionFile): Promise<void> => {
  if (memory.helloSaid) return;
  let version: string;
  try {
    ({ version } = await $.session.version());
  } catch {
    debugOnce(memory, $, "the Claude Code version could not be read; the hello waits a poll");
    return;
  }
  const answer = await send(memory, $, session, {
    method: "POST",
    path: LOCAL_API_ROUTES.modHello.path,
    body: { version: LOCAL_API_VERSION, client: { name: CLAUDE_CODE_CLIENT_NAME, version } },
  });
  if (answer.kind === "failed") return;
  memory.helloSaid = true;
  if (answer.kind === "refused") {
    debug($, `POST ${LOCAL_API_ROUTES.modHello.path} was refused with ${answer.status}`);
  }
};

/** The poll's answer, checked against the contract; undefined when there is none to act on. */
const polled = async (
  memory: Memory,
  $: ModApi,
  session: SessionFile,
): Promise<PollResponse | undefined> => {
  const route = LOCAL_API_ROUTES.poll.path;
  const answer = await send(memory, $, session, {
    method: "GET",
    path: pollPath(memory.continuation),
  });
  if (answer.kind === "refused") {
    debugOnce(memory, $, `GET ${route} was refused with ${answer.status}`);
  }
  if (answer.kind !== "answered") return undefined;
  if (!checks.poll(answer.body)) {
    debugOnce(memory, $, `GET ${route} answered outside the local API's contract`);
    return undefined;
  }
  const poll = answer.body as PollResponse;
  if (poll.epoch !== session.epoch) return undefined;
  memory.continuation = poll.continuation;
  return poll;
};

/** Polls between two checks of the folder and file of one session process: about a minute. */
const RECHECK_POLLS = 60_000 / POLL_INTERVAL_MS;

// Whether the mod may act on `session`. The folder and file are checked when the file names a
// `pid` or `epoch` the mod has not taken, and again every minute, counted in polls, never by the
// clock; a check that fails is tried again at the next poll, and nothing is pushed meanwhile (AD-5,
// AD-10).
const trusted = async (
  memory: Memory,
  $: ModApi,
  location: Location,
  session: SessionFile,
): Promise<boolean> => {
  const known = memory.session;
  const checked = memory.checkedAtPoll;
  const same = known?.pid === session.pid && known.epoch === session.epoch;
  if (same && checked !== undefined && memory.polls - checked < RECHECK_POLLS) return true;
  memory.checkedAtPoll = undefined;
  if (await isPrivate($, location)) {
    memory.checkedAtPoll = memory.polls;
    return true;
  }
  debugOnce(
    memory,
    $,
    "the session folder or file is not private to this user; push waits for one that is",
  );
  return false;
};

const pollOnce = async (memory: Memory, $: ModApi): Promise<void> => {
  const { location } = memory;
  if (location === undefined) return;
  const session = await readSession($, location);
  if (session === undefined || !(await trusted(memory, $, location, session))) {
    clearPending(memory, $);
    return;
  }
  adopt(memory, session);
  await retryReports(memory, $, session.epoch);
  await retryTurnReports(memory, $);
  await sayHello(memory, $, session);
  const poll = await polled(memory, $, session);
  if (poll === undefined) return;
  await pushPoll(memory, $, poll);
  await showPending(memory, $, poll.pending);
};

/** One period of the poll; skipped while the previous one runs. */
export const tick = async (memory: Memory, $: ModApi): Promise<void> => {
  if (memory.polling) return;
  memory.polling = true;
  memory.polls += 1;
  try {
    await pollOnce(memory, $);
  } catch {
    debugOnce(memory, $, "a poll failed");
  } finally {
    memory.polling = false;
  }
};
