// Turn reports (AD-4; mod spec, "Turn reports"; design decisions 7 and 12): at `turn.start` and
// `turn.complete` of the main conversation and of any subagent, the local API hears whether the
// agent has a turn running, on a change only, through the path the polls take. A subagent's report
// names it a teammate when the agent list says it is one (design decision 4, Origin, plan B): the
// lookup starts at the change and the report goes once it resolves. Reports go in the order of the
// turns and never hold a turn up. One that gets no answer, or that came before the session file was
// read, is tried once more at the next poll, then dropped: the agent's next change replaces it. A
// refusal is final.

import { LOCAL_API_ROUTES, LOCAL_API_VERSION, type TurnReport } from "@askboard/contract";
import { debug } from "./diagnostics.ts";
import type { Memory } from "./memory.ts";
import type { ModApi } from "./mod-api.ts";
import { lookUpTeammate, teammateNameOf } from "./teammates.ts";
import { send } from "./transport.ts";
import { checks } from "./validators.ts";

const ROUTE = LOCAL_API_ROUTES.modTurn.path;

/** The main conversation's entry in the turn maps: an agent ID is never empty. */
const MAIN = "";

const bodyOf = (memory: Memory, agent: string, running: boolean): TurnReport => {
  const teammate = agent === MAIN ? undefined : teammateNameOf(memory, agent);
  return {
    version: LOCAL_API_VERSION,
    ...(agent === MAIN ? {} : { agent_id: agent }),
    running,
    ...(teammate === undefined ? {} : { teammate }),
  };
};

// One attempt; whether it got an answer, a refusal included.
const attempt = async (
  memory: Memory,
  $: ModApi,
  agent: string,
  running: boolean,
): Promise<boolean> => {
  const session = memory.session;
  if (session === undefined) return false;
  const answer = await send(memory, $, session, {
    method: "POST",
    path: ROUTE,
    body: bodyOf(memory, agent, running),
  });
  if (answer.kind === "refused") debug($, `POST ${ROUTE} was refused with ${answer.status}`);
  return answer.kind === "refused" || (answer.kind === "answered" && checks.ack(answer.body));
};

// Runs a report after every report before it.
const queued = (memory: Memory, run: () => Promise<void>): Promise<void> => {
  memory.turnReports = memory.turnReports.then(run, run);
  return memory.turnReports;
};

/**
 * An agent's turn started (`running`) or completed: reported when it changes what the mod last
 * saw of that agent. Returns at once; a subagent's lookup in the agent list starts now, and the
 * report goes once it resolves, in order behind the earlier ones.
 */
export const turnChanged = (
  memory: Memory,
  $: ModApi,
  agentId: string | undefined,
  running: boolean,
): void => {
  const agent = agentId ?? MAIN;
  if (memory.turns.get(agent) === running) return;
  memory.turns.set(agent, running);
  memory.unsentTurns.delete(agent);
  const lookedUp = agent === MAIN ? undefined : lookUpTeammate(memory, $, agent);
  void queued(memory, async () => {
    await lookedUp;
    if (memory.turns.get(agent) !== running) return;
    if (!(await attempt(memory, $, agent, running))) memory.unsentTurns.set(agent, running);
  });
};

/** Tries each report that got no answer once more, then forgets it. */
export const retryTurnReports = (memory: Memory, $: ModApi): Promise<void> =>
  queued(memory, async () => {
    const unsent = [...memory.unsentTurns];
    memory.unsentTurns.clear();
    for (const [agent, running] of unsent) {
      if (memory.turns.get(agent) === running) await attempt(memory, $, agent, running);
    }
  });
