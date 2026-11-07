import { afterAll, describe, expect, test } from "bun:test";
import { type ActCommand, BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { RANKING_FIXTURE_ITEM, UJ2_SESSION } from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import { freeRange, openSocket, removeViews, startHost } from "./helpers.ts";

// Core spec, A result's requirements on its answer, and Results of the shipped result widgets
// (approval-scale-ranking, task 6.5): over the board protocol an act whose Approval answers
// "Approve with changes" with no reason, and one whose Ranking order misses an element, are each
// refused like any act ask-core refuses, with the reason `act`, the action ID and the index, and
// followed by the state with the question open and the log empty; and nothing of a refused
// answer is kept, which `keptAnswerValues` and `keptAnswerResults` show by holding no entry. The
// same acts, given a reason and a whole order, are logged and kept.

const version = BOARD_PROTOCOL_VERSION;
const { token } = UJ2_SESSION;
const WHEN = "2026-11-07T10:15:00Z";
const ASK_ID = "result-widgets-protocol-q4r5";

const ask = {
  askId: ASK_ID,
  title: "Review the plan",
  items: [
    {
      type: "question",
      id: "review",
      props: {
        text: "Does the plan fit the SOW?",
        items: [{ type: "approval", id: "verdict", props: {} }],
      },
    },
    {
      type: "question",
      id: "ranked",
      props: { text: "Which comes first?", items: [RANKING_FIXTURE_ITEM] },
    },
  ],
};

const act = (actionId: string, itemId: string, fields: Record<string, unknown>): ActCommand =>
  ({
    version,
    type: "act",
    actionId,
    acts: [{ type: "answer", itemId, rev: 1, when: WHEN, ...fields }],
  }) as ActCommand;

afterAll(removeViews);

const started = async () => {
  const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
  const { port, askId } = await fixture.ask(undefined, ask);
  const tab = await openSocket(port, askId);
  tab.send({ version, type: "connect", token });
  await tab.next();
  const waiting: unknown = await tab.next();
  return { fixture, tab, waiting, askId };
};

const logged = (fixture: Awaited<ReturnType<typeof started>>["fixture"], askId: string) => {
  const read = fixture.core.read(askId, `${fixture.core.epoch}.0`);
  return read.kind === "events" ? read.events : undefined;
};

// Sends a refused act and checks what follows: the refusal, then the state as it was.
const expectRefused = async (
  context: Awaited<ReturnType<typeof started>>,
  command: ActCommand,
  detail: RegExp,
) => {
  const { fixture, tab, waiting, askId } = context;
  tab.send(command);
  const refused = (await tab.next()) as Record<string, unknown>;
  expect(validateBoardMessage("toPage", refused).ok).toBe(true);
  expect(refused).toMatchObject({
    type: "refused",
    reason: "act",
    actionId: command.actionId,
    index: 0,
  });
  expect(String(refused.detail)).toMatch(detail);
  const state = (await tab.next()) as {
    type: string;
    state: { questions: { itemId: string; state: string }[] };
  };
  expect(state as unknown).toEqual(waiting);
  expect(state.state.questions.map(({ itemId, state: each }) => [itemId, each])).toEqual([
    ["review", "open"],
    ["ranked", "open"],
  ]);
  expect(logged(fixture, askId)).toEqual([]);
  // Nothing of the refused answer was kept: no entry, not even one whose values are empty.
  expect(fixture.core.keptAnswerValues(askId)?.size).toBe(0);
  expect(fixture.core.keptAnswerResults(askId)?.size).toBe(0);
  expect(fixture.reported).toEqual([]);
};

describe("result widgets over the board protocol", () => {
  test("an Approval's approve-with-changes with no note is refused, the question stays open and nothing is kept", async () => {
    const context = await started();
    try {
      const actionId = "rA1kQ2mPz9XtLw4nB8cY01";
      await expectRefused(
        context,
        act(actionId, "review", { results: { verdict: { decision: "approve-with-changes" } } }),
        /verdict.*reason/s,
      );
      // A note of white space only, U+0085 included, is no reason either.
      await expectRefused(
        context,
        act("rA1kQ2mPz9XtLw4nB8cY02", "review", {
          note: " \t\u0085 ",
          results: { verdict: { decision: "approve-with-changes" } },
        }),
        /verdict.*reason/s,
      );
      context.tab.socket.terminate();
    } finally {
      await context.fixture.host.close();
    }
  });

  test("a Ranking order missing an element is refused, the question stays open and nothing is kept", async () => {
    const context = await started();
    try {
      await expectRefused(
        context,
        act("rA1kQ2mPz9XtLw4nB8cY03", "ranked", {
          results: { priorities: { order: ["speed", "cost"] } },
        }),
        /priorities.*comfort/s,
      );
      context.tab.socket.terminate();
    } finally {
      await context.fixture.host.close();
    }
  });

  test("the same acts with a reason and with a whole order are logged, and their results are kept", async () => {
    const context = await started();
    const { fixture, tab, askId } = context;
    try {
      tab.send(
        act("rA1kQ2mPz9XtLw4nB8cY04", "review", {
          note: "Show the training line as an extra.",
          results: { verdict: { decision: "approve-with-changes" } },
        }),
      );
      tab.send(
        act("rA1kQ2mPz9XtLw4nB8cY05", "ranked", {
          results: { priorities: { order: ["cost", "speed", "comfort"] } },
        }),
      );
      const deadline = Date.now() + 5_000;
      while ((logged(fixture, askId)?.length ?? 0) < 2) {
        if (Date.now() > deadline) throw new Error("waited for the two answers to be logged");
        await Bun.sleep(25);
      }
      expect(logged(fixture, askId)).toMatchObject([
        {
          type: "answer",
          itemId: "review",
          results: { verdict: { decision: "approve-with-changes" } },
        },
        {
          type: "answer",
          itemId: "ranked",
          results: { priorities: { order: ["cost", "speed", "comfort"] } },
        },
      ]);
      expect(fixture.core.keptAnswerResults(askId)?.size).toBe(2);
      tab.socket.terminate();
      expect(fixture.reported).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });
});
