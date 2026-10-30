import { describe, expect, test } from "bun:test";
import { measureRun, type RunInput } from "../src/measure.ts";
import { parseTranscript } from "../src/transcript.ts";
import { askboardS1, auqS1, boardRecords, s6Main, T0 } from "./support/flows.ts";

const input = (overrides: Partial<RunInput>): RunInput => ({
  caseId: "S1",
  arm: "askboard",
  run: 1,
  main: parseTranscript(askboardS1()),
  subagents: [],
  records: boardRecords(),
  init: undefined,
  timedOut: false,
  exitCode: 0,
  ...overrides,
});

describe("an AskBoard S1 run", () => {
  const measured = measureRun(input({}));

  test("is valid with its two asks, cold and warm", () => {
    expect(measured.valid).toBe(true);
    expect(measured.reason).toBeUndefined();
    expect(measured.asks.map((ask) => [ask.row, ask.askId])).toEqual([
      ["S1-cold", "db-a1"],
      ["S1-warm", "mig-b2"],
    ]);
  });

  test("the cold ask counts the tool search as preparing", () => {
    expect(measured.asks[0]).toMatchObject({
      questions: 1,
      prepRequests: 1,
      output: 600,
      k1: 420,
      k2: 180,
      t0: T0 + 2_500,
      t1: T0 + 3_100,
      t2: T0 + 3_300,
      t3: T0 + 3_600,
      k3: 1_100,
      splits: { emit: 600, dispatch: 200, show: 300 },
      prepMs: 2_500,
      x: 90,
      a: 215,
      answerToAgentMs: 1_000,
    });
  });

  test("the warm ask stops at the cold ask's collect", () => {
    expect(measured.asks[1]).toMatchObject({
      prepRequests: 0,
      output: 380,
      k1: 320,
      k2: 60,
      t0: T0 + 9_000,
      t1: T0 + 9_500,
      k3: 900,
      splits: { emit: 500, dispatch: 200, show: 200 },
      prepMs: 0,
      x: 85,
      a: 214,
      answerToAgentMs: 1_000,
    });
  });

  test("the context before the first ask and what the tool search loads", () => {
    expect(measured.firstInput).toBe(20_010);
    expect(measured.toolSearchGrowth).toBe(1_500);
    expect(measured.observed).toMatchObject({
      versions: ["2.1.314"],
      efforts: ["medium"],
      cacheWrites: { "5m": 20_000, "1h": 0 },
    });
  });
});

describe("an AskUserQuestion S1 run", () => {
  const measured = measureRun(input({ arm: "auq", main: parseTranscript(auqS1()), records: [] }));

  test("ends K3 at the tool call and has no X", () => {
    expect(measured.valid).toBe(true);
    expect(measured.asks[0]).toMatchObject({
      row: "S1-cold",
      k1: 260,
      k2: 90,
      t0: T0,
      t1: T0 + 1_100,
      k3: 1_100,
      x: 0,
      a: 60,
      prepRequests: 0,
    });
    expect(measured.asks[0]?.t3).toBeUndefined();
    expect(measured.asks[1]).toMatchObject({
      row: "S1-warm",
      k1: 250,
      k2: 50,
      t0: T0 + 1_500,
      k3: 600,
      a: 58,
    });
    expect(measured.firstInput).toBe(19_000);
    expect(measured.toolSearchGrowth).toBe(0);
  });

  test("an AskUserQuestion result without the label never reached the agent", () => {
    const text = auqS1().replace('=\\"PostgreSQL\\"', '=\\"nothing\\"');
    const run = measureRun(input({ arm: "auq", main: parseTranscript(text), records: [] }));
    expect(run).toMatchObject({ valid: false, reason: "the answer never reached the agent" });
  });
});

describe("preparing responses", () => {
  test("a failed ask call before the ask is preparing", () => {
    const run = measureRun(input({ main: parseTranscript(askboardS1({ failedAttempt: true })) }));
    expect(run.asks[0]).toMatchObject({
      prepRequests: 2,
      k1: 530,
      k2: 220,
      t0: T0 + 2_700,
      prepMs: 2_700,
    });
  });

  test("a text-only response ends the walk", () => {
    const run = measureRun(input({ main: parseTranscript(askboardS1({ textBetween: true })) }));
    expect(run.asks[0]).toMatchObject({ prepRequests: 0, k1: 300, k2: 100, prepMs: 0 });
  });

  test("without thinking in the usage, K1 and K2 are not observed but output is", () => {
    const run = measureRun(input({ main: parseTranscript(askboardS1({ withoutThinking: true })) }));
    expect(run.asks[0]?.k1).toBeUndefined();
    expect(run.asks[0]?.k2).toBeUndefined();
    expect(run.asks[0]?.output).toBe(600);
  });
});

describe("validity, in order", () => {
  test.each([
    [{ timedOut: true }, "timed out"],
    [{ main: undefined }, "the transcript is missing"],
    [{ main: parseTranscript(auqS1()) }, "an expected ask is missing (found 0 of 2)"],
    [
      { main: parseTranscript(askboardS1({ warmLabels: ["A", "B"] })) },
      "a question deviated from the scenario",
    ],
    [
      { main: parseTranscript(askboardS1({ coldUnanswered: true })) },
      "the answer never reached the agent",
    ],
    [{ records: boardRecords().slice(1) }, "no answerer record shows the board of db-a1"],
  ] as [Partial<RunInput>, string][])("%#: %s", (overrides, reason) => {
    expect(measureRun(input(overrides))).toMatchObject({ valid: false, reason });
  });
});

describe("an S6 run", () => {
  test("measures the ask in the subagent's transcript and the context in the main one", () => {
    const sub = parseTranscript(askboardS1({ agentId: "a1" }));
    const run = measureRun(
      input({
        caseId: "S6",
        main: parseTranscript(s6Main()),
        subagents: [parseTranscript(s6Main()), sub],
      }),
    );
    expect(run.valid).toBe(true);
    expect(run.asks).toHaveLength(1);
    expect(run.asks[0]).toMatchObject({ row: "S6", askId: "db-a1", k1: 420, k3: 1_100 });
    expect(run.firstInput).toBe(15_010);
  });

  test("without a subagent transcript the ask is missing", () => {
    const run = measureRun(input({ caseId: "S6", main: parseTranscript(s6Main()) }));
    expect(run).toMatchObject({
      valid: false,
      reason: "an expected ask is missing (found 0 of 1)",
    });
  });
});
