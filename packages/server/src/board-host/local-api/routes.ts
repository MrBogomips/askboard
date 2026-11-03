// The local API's routes (design decision 2): what each one does with ask-core and the record
// table. Every handler answers at once; none waits on the user or on a later event (AD-5).

import {
  type AskingRule,
  CLAUDE_CODE_CLIENT_NAME,
  ID_PATTERN,
  LOCAL_API_QUERY,
  LOCAL_API_VERSION,
  type PollContinuation,
  type StopDecision,
} from "@askboard/contract";
import type { AskCore } from "@askboard/core";
import { type Handlers, ok, refused } from "./http.ts";
import { pollResponse } from "./poll.ts";
import type { RecordTable } from "./records.ts";
import { blockDecision, fitStop } from "./stop-block.ts";
import { stopEndOf } from "./teammate.ts";

export type RoutesCore = Pick<
  AskCore,
  "epoch" | "overview" | "delivered" | "stop" | "setClientVersion" | "turnReported" | "relabel"
>;

export type RoutesDeps = {
  readonly core: RoutesCore;
  readonly records: Pick<
    RecordTable,
    "add" | "agentIdOf" | "ownerKeyOf" | "keyOfAgent" | "reported" | "teammateOf"
  >;
  /** Whether a board can be shown, by AD-18's rule: the notifier's check. */
  readonly showable: () => Promise<boolean>;
  /**
   * The asking rule in effect, read at each request: E8's configuration; `none` without it (AD-16).
   */
  readonly rule?: () => AskingRule;
};

const ACK = { version: LOCAL_API_VERSION } as const;
const ID = new RegExp(ID_PATTERN);
const SEQ = /^(0|[1-9][0-9]{0,14})$/;

const ASK_ID_EXPECTED = `${LOCAL_API_QUERY.askId}: the ID of an ask of this session`;

// A poll's continuation: none, or both its parts well formed.
const continuationOf = (
  query: URLSearchParams,
): { readonly ok: true; readonly value?: PollContinuation } | { readonly ok: false } => {
  const askId = query.get(LOCAL_API_QUERY.askId);
  const seq = query.get(LOCAL_API_QUERY.seq);
  if (askId === null && seq === null) return { ok: true };
  if (askId === null || seq === null || !ID.test(askId) || !SEQ.test(seq)) return { ok: false };
  return { ok: true, value: { askId, seq: Number(seq) } };
};

export const createHandlers = ({
  core,
  records,
  showable,
  rule = () => "none",
}: RoutesDeps): Handlers => ({
  records: (record) => {
    records.add(record);
    return ok(ACK);
  },

  // The stop guard (AD-10): a block carries what one response holds and raises `received` for that
  // alone before it answers. A stop from an agent with no record, such as Claude Code's side agents,
  // is let through.
  stop: ({ agent_id, agent_type, stop_hook_active }) => {
    const allow: StopDecision = { ...ACK, decision: "allow" };
    const ownerKey = records.ownerKeyOf(agent_id);
    if (ownerKey === undefined) return ok(allow);
    // An allow closes the subagent's open asks in ask-core, with agent-finished (task 3.6). An
    // in-process teammate stops at every turn end and then waits for a message: its allow closes
    // none (G1, tasks 17.2 and 18.2): one the mod's report named, or, without that, one whose agent
    // ID has a named agent's form.
    const end = stopEndOf(records.teammateOf(agent_id), agent_id, agent_type);
    const outcome = core.stop(ownerKey, stop_hook_active, fitStop(core.epoch), end);
    if (outcome.decision === "allow") return ok(allow);
    return ok(blockDecision(core.epoch, outcome));
  },

  // The rule is `none` until the session process reads configuration (E8; AD-14, AD-16).
  rule: async () => ok({ ...ACK, rule: rule(), showable: await showable() }),

  notice: (query) => {
    const askId = query.get(LOCAL_API_QUERY.askId);
    if (askId === null || !ID.test(askId)) return refused(400, ASK_ID_EXPECTED);
    const ask = core.overview().find((candidate) => candidate.askId === askId);
    if (ask === undefined) return refused(404, "this session holds no ask of that ID");
    return ok({ ...ACK, title: ask.title, link: ask.link });
  },

  modHello: ({ client }) => {
    if (client.name === CLAUDE_CODE_CLIENT_NAME) core.setClientVersion("mod", client.version);
    return ok(ACK);
  },

  // The agent status (AD-4, design decision 12): an agent with no record yet owns no ask, and its
  // report changes nothing of it. A subagent's report may name it an in-process teammate (design
  // decision 4, Origin, plan B), which the record table keeps; one that names it anew relabels the
  // asks it owns, and their open boards hear who asked again. The main conversation's report names
  // nobody.
  modTurn: ({ agent_id, running, teammate }) => {
    const label = agent_id === undefined ? undefined : records.reported(agent_id, teammate);
    const ownerKey = records.keyOfAgent(agent_id);
    if (ownerKey === undefined) return ok(ACK);
    if (label !== undefined) core.relabel(ownerKey, label);
    core.turnReported(ownerKey, running);
    return ok(ACK);
  },

  poll: (query) => {
    const continuation = continuationOf(query);
    if (!continuation.ok) {
      return refused(
        400,
        `a continuation is ${LOCAL_API_QUERY.askId} and ${LOCAL_API_QUERY.seq}, both`,
      );
    }
    return ok(pollResponse(core, (ownerKey) => records.agentIdOf(ownerKey), continuation.value));
  },

  delivered: ({ askId, cursor }) => {
    if (core.delivered(askId, cursor) !== "refused") return ok(ACK);
    return refused(409, "the report names no owned ask of this session, or a cursor no poll gave");
  },
});
