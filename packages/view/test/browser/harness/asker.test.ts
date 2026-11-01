import { describe, expect, test } from "bun:test";
import type { OriginMessage } from "@askboard/contract";
import { BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { validateAgentStatus, validateOrigin } from "@askboard/contract/validate";
import { type Asker, agentWaitsTranscript, originFor, withHeader } from "./asker.ts";
import { replayTranscripts } from "./transcripts.ts";

// Who asks a scenario's ask (task 8.5): the origin message board-host sends for it, by design
// decision 12's rules, and the transcripts the test server replays with it.

const base = { project: "order-service", gitUser: "Paola Greco" } as const;

describe("the origin board-host sends for an asker", () => {
  const cases: [string, Asker, Omit<OriginMessage, "version" | "type">][] = [
    ["an unchecked ask", base, { who: { label: "Agent" }, project: "order-service" }],
    [
      "the main conversation in the main checkout",
      { ...base, agent: {} },
      {
        who: { label: "Main agent" },
        project: "order-service",
        directory: ".",
        branch: "main",
        worktree: "order-service",
      },
    ],
    [
      "the second named subagent of a type, in a worktree's folder, for another user",
      {
        ...base,
        agent: {
          subagent: { type: "code-reviewer", before: 1 },
          worktree: { folder: "order-service-fix-retry", branch: "fix/retry" },
          directory: "services/orders",
        },
        agentName: "Retry review",
        expectedUser: " Marco Rossi ",
      },
      {
        who: { label: "Subagent code-reviewer", name: "Retry review", ordinal: 2 },
        forUser: "Marco Rossi",
        project: "order-service",
        directory: "services/orders",
        branch: "fix/retry",
        worktree: "order-service-fix-retry",
      },
    ],
    [
      "the first subagent of a type, for the git user in another case",
      { ...base, agent: { subagent: { type: "Explore" } }, expectedUser: "PAOLA GRECO" },
      {
        who: { label: "Subagent Explore" },
        project: "order-service",
        directory: ".",
        branch: "main",
        worktree: "order-service",
      },
    ],
  ];

  test.each(cases)("%s", (_, asker, expected) => {
    const origin = originFor(asker);
    expect(origin).toEqual({ version: BOARD_PROTOCOL_VERSION, type: "origin", ...expected });
    expect(validateOrigin(origin).ok).toBe(true);
  });
});

describe("the transcripts with the header", () => {
  test("put who asked, then the agent working, after each socket's first state", () => {
    const { steps } = withHeader(replayTranscripts.plainChoice, base);
    const header = steps.flatMap((step, at) =>
      step.from === "host" && "message" in step && ["origin", "agent"].includes(step.message.type)
        ? [`${at} socket ${step.socket} ${step.message.type}`]
        : [],
    );
    // Socket 1's opening state is step 2, socket 2's is the plain transcript's step 12.
    expect(header).toEqual([
      "3 socket 1 origin",
      "4 socket 1 agent",
      "15 socket 2 origin",
      "16 socket 2 agent",
    ]);
  });

  test("the agent's wait: waiting at its gate, then working after the answer's state", () => {
    const transcript = agentWaitsTranscript(base);
    const tail = transcript.steps
      .slice(3)
      .map((step) =>
        step.from === "host" && "message" in step
          ? `host ${step.message.type}${step.message.type === "agent" ? ` ${step.message.status}` : ""}`
          : `${step.from}${"event" in step ? ` ${step.event}` : ""}`,
      );
    expect(tail).toEqual([
      "host origin",
      "host agent working",
      "session waiting",
      "host agent waiting",
      "user answer",
      "page",
      "host state",
      "host agent working",
    ]);
    for (const step of transcript.steps) {
      if (step.from === "host" && "message" in step && step.message.type === "agent") {
        expect(validateAgentStatus(step.message).ok).toBe(true);
      }
    }
  });
});
