// Who asks a scenario's ask, and from where (push delivery, task 8.5; design decision 12), in the
// terms of a session: the project and its git user, the agent and its worktree and directory, the
// ask's agent name and expected user. Both session sides take it. The session process is given the
// project, the worktree and the agent records that make it (`asker-project.ts`); the test server
// replays the origin and agent messages `board-host` sends for it, which `originFor` gives as
// board-host's rules say (design decision 12), after Track 0's steps.

import {
  type AgentStatus,
  type AgentStatusMessage,
  BOARD_PROTOCOL_VERSION,
  type OriginMessage,
} from "@askboard/contract";
import { type ReplayStep, type ReplayTranscript, replayTranscripts } from "./transcripts.ts";

/** The branch of the project's main checkout. */
export const MAIN_BRANCH = "main";

export type Asker = {
  /** The session project's folder name. */
  readonly project: string;
  /** The project's git user name. */
  readonly gitUser: string;
  /** The agent whose record the ask binds; absent for an ask with no agent record (unchecked). */
  readonly agent?: {
    /** A subagent; the main conversation when absent. */
    readonly subagent?: {
      readonly type: string;
      /** How many subagents of the type recorded before this one: 1 makes it "#2". */
      readonly before?: number;
    };
    /** A linked worktree of the project, on its own branch; the main checkout when absent. */
    readonly worktree?: { readonly folder: string; readonly branch: string };
    /** The agent's working folder under the worktree's top level; the top level when absent. */
    readonly directory?: string;
  };
  readonly agentName?: string;
  readonly expectedUser?: string;
};

const version = BOARD_PROTOCOL_VERSION;

const comparable = (name: string): string => name.trim().toLowerCase();

// "For:" shows only an expected user other than the git user (view spec, "The expected answerer in
// the header").
const forUserOf = ({ expectedUser, gitUser }: Asker): string | undefined =>
  expectedUser === undefined || comparable(expectedUser) === comparable(gitUser)
    ? undefined
    : expectedUser.trim();

/** The origin message `board-host` sends for the asker's ask. */
export const originFor = (asker: Asker): OriginMessage => {
  const { agent, agentName, project } = asker;
  const forUser = forUserOf(asker);
  const subagent = agent?.subagent;
  const label =
    agent === undefined ? "Agent" : subagent ? `Subagent ${subagent.type}` : "Main agent";
  const ordinal = subagent?.before ? subagent.before + 1 : undefined;
  return {
    version,
    type: "origin",
    who: {
      label,
      ...(agentName === undefined ? {} : { name: agentName }),
      ...(ordinal === undefined ? {} : { ordinal }),
    },
    ...(forUser === undefined ? {} : { forUser }),
    project,
    ...(agent === undefined
      ? {}
      : {
          directory: agent.directory ?? ".",
          branch: agent.worktree?.branch ?? MAIN_BRANCH,
          worktree: agent.worktree?.folder ?? project,
        }),
  };
};

export const agentMessage = (status: AgentStatus): AgentStatusMessage => ({
  version,
  type: "agent",
  status,
});

const isOpeningState = (step: ReplayStep, opened: ReadonlySet<number>): boolean =>
  step.from === "host" &&
  "message" in step &&
  step.message.type === "state" &&
  !opened.has(step.socket);

/**
 * The transcript with who asked and where, then the agent status "working", after each socket's
 * first state, where `board-host` sends them (board-host spec, "Who asked and the agent status on
 * the board").
 */
export const withHeader = (
  transcript: ReplayTranscript,
  asker: Asker,
  name = `${transcript.name} with its header`,
): ReplayTranscript => {
  const opened = new Set<number>();
  const steps = transcript.steps.flatMap((step): ReplayStep[] => {
    if (!isOpeningState(step, opened) || step.socket === undefined) return [step];
    opened.add(step.socket);
    const { socket } = step;
    return [
      step,
      { socket, from: "host", message: originFor(asker) },
      { socket, from: "host", message: agentMessage("working") },
    ];
  });
  return { ...transcript, name, steps };
};

/**
 * The board opens with its header; the agent starts a waiting `collect`, and the pill says it
 * waits; the user answers, and once the answer's state is sent, the wait ends and the pill says the
 * agent works (view spec, "The agent pill").
 */
export const agentWaitsTranscript = (asker: Asker): ReplayTranscript => {
  const { opening, answered } = replayTranscripts;
  const answering = answered.steps.slice(opening.steps.length);
  const opened = withHeader(opening, asker);
  return {
    ...opened,
    name: "agentWaits",
    steps: [
      ...opened.steps,
      { from: "session", event: "waiting" },
      { socket: 1, from: "host", message: agentMessage("waiting") },
      ...answering,
      { socket: 1, from: "host", message: agentMessage("working") },
    ],
  };
};
