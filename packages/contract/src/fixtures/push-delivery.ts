// Push delivery fixtures (contract spec, Push delivery fixtures): one session of the plain-choice
// epoch under one Claude Code process on macOS. The main conversation owns the plain-choice ask; a
// `code-reviewer` subagent named "Retry review", in a linked worktree, owns two asks of its own and
// has an answer it has not received. Tests only, like every fixture.

import type {
  AgentRecord,
  PendingAsk,
  PollResponse,
  StopDecision,
} from "../push/local-api/index.ts";
import { LOCAL_API_VERSION } from "../push/local-api/index.ts";
import type {
  AgentStatusMessage,
  ClosedEvent,
  OriginMessage,
  PresenceMessage,
  PushMessage,
} from "../push/messages.ts";
import { SESSION_FILE_FORMAT, type SessionFile } from "../push/session-file/index.ts";
import { sessionFolder, socketPathFor } from "../push/session-folder.ts";
import { boardLink } from "../routes.ts";
import { BOARD_PROTOCOL_VERSION } from "../schemas/board-protocol/index.ts";
import type { AnswerEvent } from "../schemas/output/index.ts";
import { OUTPUT_FORMAT_VERSION } from "../schemas/output/index.ts";
import { plainChoiceBoardDocument } from "./board-document.ts";
import { PLAIN_CHOICE } from "./transcript.ts";

const version = LOCAL_API_VERSION;
const { epoch } = PLAIN_CHOICE;
const PROJECT = "/Users/paola/src/order-service";
const CLAUDE_CODE_PID = 48213;
const SUBAGENT = { agent_id: "a3f9c1d27b8e4f60", agent_type: "code-reviewer" } as const;
const RETRY_POLICY = {
  askId: "retry-policy-q3m8",
  title: "How should the order service retry a failed payment?",
  token: "Q7wZr2LmT9xK4pV8nB3cYh",
} as const;
const RETRY_LIMIT = { askId: "retry-limit-w2n5" } as const;

/** The main conversation's `ask` of the plain-choice question: no `agent_id`, no `agent_type`. */
export const mainAgentRecord: AgentRecord = {
  version,
  cwd: PROJECT,
  tool_use_id: "toolu_01HqVb7cXz9KpL3mN5rT8wYe",
  tool_name: "mcp__plugin_askboard_askboard__ask",
  askIds: [PLAIN_CHOICE.askId],
  timestamp: "2026-10-29T09:40:31Z",
};

/** The subagent's `collect` of its two asks, from its worktree. */
export const subagentRecord: AgentRecord = {
  version,
  ...SUBAGENT,
  cwd: `${PROJECT}-fix-retry`,
  tool_use_id: "toolu_01Mc2RtW8yQx4ZnV6bJ3kLpD",
  tool_name: "mcp__plugin_askboard_askboard__collect",
  askIds: [RETRY_POLICY.askId, RETRY_LIMIT.askId],
  timestamp: "2026-10-29T09:42:05.418Z",
};

/** The session file, in the session folder macOS's usual `TMPDIR` gives user 501. */
export const fixtureSessionFile: SessionFile = {
  format: SESSION_FILE_FORMAT,
  key: CLAUDE_CODE_PID,
  pid: 48250,
  epoch,
  apiAddress: socketPathFor(
    sessionFolder({
      env: { TMPDIR: "/var/folders/7x/k4b2m9qz1h3d8w6f0c5n2j7r0000gn/T/" },
      uid: 501,
    }),
    CLAUDE_CODE_PID,
  ),
  sessionToken: "Hc4nQ8vLw2Zr7TxB5mKp9A",
  projectDir: PROJECT,
  startedAt: "2026-10-29T09:40:02.117Z",
};

const plainChoiceAnswer: AnswerEvent = {
  cursor: `${epoch}.1`,
  type: "answer",
  itemId: plainChoiceBoardDocument.items[0].id,
  rev: 1,
  who: "Paola Greco",
  when: "2026-10-29T09:41:27Z",
  choice: ["PostgreSQL"],
};

/** The plain-choice answer pushed to the main conversation, its entry as `collect` returns it. */
export const plainChoicePushMessage: PushMessage = {
  versions: { output: OUTPUT_FORMAT_VERSION },
  epoch,
  asks: [
    {
      askId: PLAIN_CHOICE.askId,
      state: "answered",
      cursor: plainChoiceAnswer.cursor,
      events: [plainChoiceAnswer],
    },
  ],
};

const retryAnswer: AnswerEvent = {
  cursor: `${epoch}.1`,
  type: "answer",
  itemId: "retry",
  rev: 1,
  who: "Paola Greco",
  when: "2026-10-29T09:43:12Z",
  choice: ["Exponential backoff"],
};

const retryPolicyEntry = {
  askId: RETRY_POLICY.askId,
  state: "answered",
  cursor: retryAnswer.cursor,
} as const;

/** The subagent stops with its answer unread: blocked once, with both its open asks listed. */
export const subagentStopBlock: StopDecision = {
  version,
  decision: "block",
  message: {
    versions: { output: OUTPUT_FORMAT_VERSION },
    epoch,
    asks: [{ ...retryPolicyEntry, events: [retryAnswer] }],
    openAsks: [
      retryPolicyEntry,
      { askId: RETRY_LIMIT.askId, state: "waiting", cursor: `${epoch}.0` },
    ],
  },
};

/**
 * The pending asks while the main conversation waits on the plain-choice question and the
 * subagent has not received its answer: each still has one question the agent has not received.
 */
export const fixturePendingAsks: readonly PendingAsk[] = [
  {
    askId: PLAIN_CHOICE.askId,
    title: plainChoiceBoardDocument.title,
    label: "Main agent",
    openQuestions: 1,
    link: PLAIN_CHOICE.link,
  },
  {
    askId: RETRY_POLICY.askId,
    title: RETRY_POLICY.title,
    label: `Subagent ${SUBAGENT.agent_type}`,
    agentName: "Retry review",
    openQuestions: 1,
    link: boardLink({ port: PLAIN_CHOICE.port, ...RETRY_POLICY }),
    agent_id: SUBAGENT.agent_id,
  },
];

/** One poll at that moment: the subagent's answer to push to it, and the pending asks. */
export const fixturePollResponse: PollResponse = {
  version,
  epoch,
  asks: [{ ...retryPolicyEntry, agent_id: SUBAGENT.agent_id, events: [retryAnswer] }],
  pending: fixturePendingAsks,
};

/** The subagent's other ask, closed when the subagent finished without answering it. */
export const agentFinishedEvent: ClosedEvent = {
  cursor: `${epoch}.1`,
  type: "closed",
  reason: "agent-finished",
};

/** The board page while the user works on it. */
export const workingPresence: PresenceMessage = {
  version: BOARD_PROTOCOL_VERSION,
  type: "presence",
  working: true,
};

/** Who asked the retry policy, and where: the subagent's worktree, at its top level. */
export const subagentOrigin: OriginMessage = {
  version: BOARD_PROTOCOL_VERSION,
  type: "origin",
  who: { label: `Subagent ${SUBAGENT.agent_type}`, name: "Retry review" },
  project: "order-service",
  directory: ".",
  branch: "fix/retry",
  worktree: "order-service-fix-retry",
};

/** An ask with no agent record: who is only "Agent", and the place only the project. */
export const uncheckedOrigin: OriginMessage = {
  version: BOARD_PROTOCOL_VERSION,
  type: "origin",
  who: { label: "Agent" },
  project: "order-service",
};

/** The agent waits on a `collect` of the board's ask. */
export const waitingAgentStatus: AgentStatusMessage = {
  version: BOARD_PROTOCOL_VERSION,
  type: "agent",
  status: "waiting",
};
