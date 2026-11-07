import { afterAll, describe, expect, test } from "bun:test";
import { type ActCommand, BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { CHART_FIXTURE_ITEMS, UJ2_SESSION } from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import { freeRange, openSocket, removeViews, startHost } from "./helpers.ts";

// Core spec, Chart results through ask-core (chart-widget, task 6.5): over the board protocol an
// act holding a point the revision does not hold, and one holding two points on a Chart whose
// `highlights` is "one", are each refused like any act ask-core refuses, with the reason `act`,
// the action ID and the index, and followed by the state with the question open and the log empty;
// and nothing of a refused answer is kept, which `keptAnswerResults` shows by holding no entry.
// The same acts with points the revision holds are logged and kept.

const version = BOARD_PROTOCOL_VERSION;
const { token } = UJ2_SESSION;
const WHEN = "2026-11-07T10:15:00Z";
const ASK_ID = "chart-protocol-c6h7";

const [BAR, , PIE] = CHART_FIXTURE_ITEMS;
const ONE = { ...BAR, id: "one-point", props: { ...BAR.props, highlights: "one" } };

const ask = {
  askId: ASK_ID,
  title: "Review the failures",
  items: [
    {
      type: "question",
      id: "q-bar",
      props: { text: "Which fixes keep failing?", items: [BAR] },
    },
    {
      type: "question",
      id: "q-one",
      props: { text: "Which fix fails most?", items: [ONE] },
    },
    {
      type: "question",
      id: "q-pie",
      props: { text: "Where does the effort go?", items: [PIE] },
    },
  ],
};

const act = (actionId: string, itemId: string, results: Record<string, unknown>): ActCommand =>
  ({
    version,
    type: "act",
    actionId,
    acts: [{ type: "answer", itemId, rev: 1, when: WHEN, results }],
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
    ["q-bar", "open"],
    ["q-one", "open"],
    ["q-pie", "open"],
  ]);
  expect(logged(fixture, askId)).toEqual([]);
  // Nothing of the refused answer was kept: no entry, not even one whose values are empty.
  expect(fixture.core.keptAnswerResults(askId)?.size).toBe(0);
  expect(fixture.reported).toEqual([]);
};

describe("a Chart's result over the board protocol", () => {
  test("a point the revision does not hold is refused, the question stays open and nothing is kept", async () => {
    const context = await started();
    try {
      await expectRefused(
        context,
        act("cH1kQ2mPz9XtLw4nB8cY01", "q-bar", {
          [BAR.id]: { points: [{ series: "fails", category: "fix-z" }] },
        }),
        /fix-z/,
      );
      await expectRefused(
        context,
        act("cH1kQ2mPz9XtLw4nB8cY02", "q-bar", {
          [BAR.id]: { points: [{ series: "reruns", category: "fix-c" }] },
        }),
        /fix-c/,
      );
      context.tab.socket.terminate();
    } finally {
      await context.fixture.host.close();
    }
  });

  test("two points on highlights one are refused, the question stays open and nothing is kept", async () => {
    const context = await started();
    try {
      await expectRefused(
        context,
        act("cH1kQ2mPz9XtLw4nB8cY03", "q-one", {
          [ONE.id]: {
            points: [
              { series: "fails", category: "fix-a" },
              { series: "fails", category: "fix-b" },
            ],
          },
        }),
        /one-point.*(one|1)/s,
      );
      context.tab.socket.terminate();
    } finally {
      await context.fixture.host.close();
    }
  });

  test("the same acts with points the revision holds are logged, and their results are kept", async () => {
    const context = await started();
    const { fixture, tab, askId } = context;
    try {
      const two = [
        { series: "fails", category: "fix-a" },
        { series: "reruns", category: "fix-b" },
      ];
      tab.send(act("cH1kQ2mPz9XtLw4nB8cY04", "q-bar", { [BAR.id]: { points: two } }));
      tab.send(
        act("cH1kQ2mPz9XtLw4nB8cY05", "q-one", {
          [ONE.id]: { points: [{ series: "fails", category: "fix-b" }] },
        }),
      );
      const deadline = Date.now() + 5_000;
      while ((logged(fixture, askId)?.length ?? 0) < 2) {
        if (Date.now() > deadline) throw new Error("waited for the two answers to be logged");
        await Bun.sleep(25);
      }
      expect(logged(fixture, askId)).toMatchObject([
        { type: "answer", itemId: "q-bar", results: { [BAR.id]: { points: two } } },
        {
          type: "answer",
          itemId: "q-one",
          results: { [ONE.id]: { points: [{ series: "fails", category: "fix-b" }] } },
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
