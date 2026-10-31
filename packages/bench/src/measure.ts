// Measuring one run (early-benchmark design decision 9), with the addendum's counting rules: K1
// and K2 over the emitting response and the responses that only prepare it, K3 from the start of
// the emitting request, X and A for the cost model, and the run's validity, failing closed.

import type { BoardRecord } from "./answerer/board.ts";
import { type Arm, CASES, type CaseId, type RowId } from "./scenarios.ts";
import type { Init, Observed, Request, ToolCall, Transcript } from "./transcript.ts";

export const ASKBOARD_ASK = /^mcp__(plugin_askboard_)?askboard__ask$/;
export const ASKBOARD_COLLECT = /^mcp__(plugin_askboard_)?askboard__collect$/;
export const AUQ = /^AskUserQuestion$/;
/** Tools whose calls only prepare an ask (addendum: tool search, skill load). */
export const PREPARING_TOOLS: ReadonlySet<string> = new Set(["ToolSearch", "Skill"]);

export type AskMeasure = {
  readonly row: RowId;
  readonly askId?: string;
  readonly questions: number;
  readonly prepRequests: number;
  /** Per question, thinking included: always observed. */
  readonly output: number;
  /** Per question; undefined when the usage reports no thinking. */
  readonly k1?: number;
  readonly k2?: number;
  readonly t0?: number;
  readonly t1: number;
  /** AskBoard: the answerer started (t2′) and the board reached it (t3′). */
  readonly t2?: number;
  readonly t3?: number;
  /** Milliseconds: to t3′ for AskBoard, to t1 for AskUserQuestion. */
  readonly k3?: number;
  readonly splits?: { readonly emit: number; readonly dispatch?: number; readonly show?: number };
  /** The time spent in the preparing responses before t0. */
  readonly prepMs: number;
  /** Per question: output of the requests that call `collect` for the ask. */
  readonly x?: number;
  /** Per question: input growth over the asking flow's tool results. */
  readonly a?: number;
  readonly answerToAgentMs?: number;
};

export type RunMeasure = {
  readonly caseId: CaseId;
  readonly arm: Arm;
  readonly run: number;
  readonly valid: boolean;
  readonly reason?: string;
  readonly asks: readonly AskMeasure[];
  /** Total input of the session's first request. */
  readonly firstInput?: number;
  /** Input growth over the tool searches before the first ask. */
  readonly toolSearchGrowth?: number;
  readonly observed: Observed;
  readonly init?: Init;
  readonly timedOut: boolean;
  readonly exitCode: number | null;
};

export type RunInput = {
  readonly caseId: CaseId;
  readonly arm: Arm;
  readonly run: number;
  readonly main: Transcript | undefined;
  readonly subagents: readonly Transcript[];
  /** The answerers' record lines. */
  readonly records: readonly unknown[];
  readonly init: Init | undefined;
  readonly timedOut: boolean;
  /** The user stopped the benchmark during this run. */
  readonly interrupted?: boolean;
  readonly exitCode: number | null;
};

type Found = {
  readonly request: Request;
  readonly call: ToolCall;
  readonly askId: string | undefined;
  readonly labels: readonly (readonly string[])[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const labelsOf = (options: unknown): string[] =>
  Array.isArray(options) ? options.filter(isRecord).map((option) => String(option.label)) : [];

// The questions an ask call carries, as lists of option labels.
const questionsOf = (arm: Arm, input: unknown): string[][] => {
  if (!isRecord(input)) return [];
  if (arm === "askboard") {
    const items = Array.isArray(input.items) ? input.items.filter(isRecord) : [];
    return items.map((item) => labelsOf(isRecord(item.props) ? item.props.options : undefined));
  }
  const questions = Array.isArray(input.questions) ? input.questions.filter(isRecord) : [];
  return questions.map((question) => labelsOf(question.options));
};

const askToolOf = (arm: Arm): RegExp => (arm === "askboard" ? ASKBOARD_ASK : AUQ);

const succeeded = (transcript: Transcript, arm: Arm, call: ToolCall): boolean => {
  const result = transcript.results.get(call.id);
  if (result === undefined || result.isError) return false;
  if (arm === "auq") return true;
  const value = parsed(result.text);
  return isRecord(value) && typeof value.board === "string";
};

const asksIn = (transcript: Transcript, arm: Arm): Found[] =>
  transcript.requests.flatMap((request) =>
    request.calls
      .filter((call) => askToolOf(arm).test(call.name) && succeeded(transcript, arm, call))
      .map((call) => ({
        request,
        call,
        askId:
          isRecord(call.input) && typeof call.input.askId === "string"
            ? call.input.askId
            : undefined,
        labels: questionsOf(arm, call.input),
      })),
  );

/** One ask of the scenario: its first successful call and any identical ones sent again. */
type LogicalAsk = { readonly first: Found; readonly repeats: readonly Found[] };

const sortedLabels = (found: Found): string =>
  JSON.stringify(found.labels.map((labels) => [...labels].sort()));

// The addendum counts repeated attempts with the ask they repeat: a successful call of the same ask
// ID or the same question right after it is a retry, not the next ask.
const groupAsks = (found: readonly Found[]): LogicalAsk[] => {
  const asks: { first: Found; repeats: Found[] }[] = [];
  for (const call of found) {
    const last = asks.at(-1);
    const same =
      last !== undefined &&
      ((call.askId !== undefined && call.askId === last.first.askId) ||
        sortedLabels(call) === sortedLabels(last.first));
    if (last !== undefined && same) last.repeats.push(call);
    else asks.push({ first: call, repeats: [] });
  }
  return asks;
};

const callsOf = (ask: LogicalAsk): Found[] => [ask.first, ...ask.repeats];
const lastIndexOf = (ask: LogicalAsk): number =>
  Math.max(...callsOf(ask).map((call) => call.request.index));

const isToolSearchOnly = (request: Request): boolean =>
  request.calls.length > 0 && request.calls.every((call) => call.name === "ToolSearch");

const isPreparing = (transcript: Transcript, arm: Arm, request: Request): boolean =>
  request.calls.length > 0 &&
  request.calls.every(
    (call) =>
      PREPARING_TOOLS.has(call.name) ||
      (askToolOf(arm).test(call.name) && !succeeded(transcript, arm, call)),
  );

// Walking back from the emitting request to the previous ask's, while each request only prepares.
const preparingOf = (transcript: Transcript, arm: Arm, emit: number, floor: number): Request[] => {
  const found: Request[] = [];
  for (let index = emit - 1; index > floor; index -= 1) {
    const request = transcript.requests[index];
    if (request === undefined || !isPreparing(transcript, arm, request)) break;
    found.unshift(request);
  }
  return found;
};

// growth(r): the next request's total input minus r's input and output, which r's response adds.
const growthOf = (transcript: Transcript, index: number): number | undefined => {
  const request = transcript.requests[index];
  const next = transcript.requests[index + 1];
  if (request === undefined || next === undefined) return undefined;
  return next.totalInput - request.totalInput - request.output;
};

const sumOrUndefined = (values: readonly (number | undefined)[]): number | undefined =>
  values.some((value) => value === undefined)
    ? undefined
    : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);

const collectsFor = (
  transcript: Transcript,
  askIds: readonly string[],
  from: number,
  to: number,
): Request[] =>
  transcript.requests
    .slice(from + 1, to)
    .filter((request) =>
      request.calls.some(
        (call) =>
          ASKBOARD_COLLECT.test(call.name) &&
          isRecord(call.input) &&
          Array.isArray(call.input.asks) &&
          call.input.asks.some((entry) => isRecord(entry) && askIds.includes(String(entry.askId))),
      ),
    );

const boardRecordOf = (records: readonly unknown[], askIds: readonly string[]) =>
  records.find(
    (record): record is BoardRecord =>
      isRecord(record) &&
      record.kind === "board" &&
      askIds.includes(String(record.askId)) &&
      typeof record.shown === "number",
  );

// When the collect result carrying the scripted choice reached the transcript.
const deliveredAt = (
  transcript: Transcript,
  collects: readonly Request[],
  askIds: readonly string[],
  choice: readonly string[],
): number | undefined => {
  for (const request of collects) {
    for (const call of request.calls) {
      const result = transcript.results.get(call.id);
      const value = result === undefined ? undefined : parsed(result.text);
      const entries =
        isRecord(value) && Array.isArray(value.asks) ? value.asks.filter(isRecord) : [];
      const carries = entries.some(
        (entry) =>
          askIds.includes(String(entry.askId)) &&
          Array.isArray(entry.events) &&
          entry.events.some(
            (event) =>
              isRecord(event) &&
              event.type === "answer" &&
              JSON.stringify(event.choice) === JSON.stringify(choice),
          ),
      );
      if (carries && result !== undefined) return result.at;
    }
  }
  return undefined;
};

type Measured = {
  readonly measure: AskMeasure;
  readonly deviated: boolean;
  readonly delivered: boolean;
  readonly shown: boolean;
};

const measureAsk = (
  input: RunInput,
  transcript: Transcript,
  asks: readonly LogicalAsk[],
  index: number,
): Measured => {
  const { arm } = input;
  const logical = asks[index] as LogicalAsk;
  const ask = logical.first;
  const scenario = CASES[input.caseId].asks[index];
  const emit = ask.request.index;
  const previous = asks[index - 1];
  const floor = previous === undefined ? -1 : lastIndexOf(previous);
  const ceiling = asks[index + 1]?.first.request.index ?? transcript.requests.length;
  const prep = preparingOf(transcript, arm, emit, floor);
  const repeated = [
    ...new Set(
      logical.repeats.map((call) => call.request).filter((request) => request !== ask.request),
    ),
  ];
  const counted = [...prep, ask.request, ...repeated];
  const askIds = [
    ...new Set(callsOf(logical).flatMap((call) => (call.askId === undefined ? [] : [call.askId]))),
  ];
  const questions = Math.max(ask.labels.length, 1);
  const thinking = sumOrUndefined(counted.map((request) => request.thinking));
  const output = counted.reduce((sum, request) => sum + request.output, 0);
  const expected = scenario?.question.options.map((option) => option.label) ?? [];
  const [labels = []] = ask.labels;
  const deviated =
    ask.labels.length !== 1 ||
    labels.length !== expected.length ||
    !labels.every((label) => expected.includes(label));
  const t0 = ask.request.start;
  const t1 = ask.call.at;
  const prepStart = prep[0]?.start;
  const prepMs = t0 !== undefined && prepStart !== undefined ? t0 - prepStart : 0;
  const base = {
    row: scenario?.row ?? "S1-cold",
    ...(ask.askId === undefined ? {} : { askId: ask.askId }),
    questions,
    prepRequests: prep.length,
    output: output / questions,
    ...(thinking === undefined
      ? {}
      : { k1: (output - thinking) / questions, k2: thinking / questions }),
    ...(t0 === undefined ? {} : { t0 }),
    t1,
    prepMs,
  };
  const resultGrowth = [ask.request, ...repeated].map((request) =>
    growthOf(transcript, request.index),
  );
  if (arm === "auq") {
    const last = callsOf(logical).at(-1) ?? ask;
    const result = transcript.results.get(last.call.id);
    const answer = scenario?.question.answer ?? "";
    const delivered = result !== undefined && !result.isError && result.text.includes(answer);
    const a = sumOrUndefined(resultGrowth);
    const measure: AskMeasure = {
      ...base,
      ...(t0 === undefined ? {} : { k3: t1 - t0, splits: { emit: t1 - t0 } }),
      x: 0,
      ...(a === undefined ? {} : { a: a / questions }),
    };
    return { measure, deviated, delivered, shown: true };
  }
  const record = boardRecordOf(input.records, askIds);
  const collects = collectsFor(transcript, askIds, lastIndexOf(logical), ceiling);
  const choice = record?.choice ?? [scenario?.question.answer ?? ""];
  const at = deliveredAt(transcript, collects, askIds, choice);
  const a = sumOrUndefined([
    ...resultGrowth,
    ...collects.map((request) => growthOf(transcript, request.index)),
  ]);
  // A tool search between the ask and its last collect loads collect: it is part of collecting.
  const lastCollect = collects.at(-1)?.index ?? emit;
  const searches = transcript.requests
    .slice(lastIndexOf(logical) + 1, lastCollect)
    .filter(isToolSearchOnly);
  const x = [...collects, ...searches].reduce((sum, request) => sum + request.output, 0);
  const t2 = record?.started;
  const t3 = record?.shown;
  const measure: AskMeasure = {
    ...base,
    ...(t2 === undefined ? {} : { t2 }),
    ...(t3 === undefined ? {} : { t3 }),
    ...(t0 !== undefined && t3 !== undefined ? { k3: t3 - t0 } : {}),
    ...(t0 === undefined
      ? {}
      : {
          splits: {
            emit: t1 - t0,
            ...(t2 === undefined ? {} : { dispatch: t2 - t1 }),
            ...(t2 === undefined || t3 === undefined ? {} : { show: t3 - t2 }),
          },
        }),
    ...(collects.length === 0 ? {} : { x: x / questions }),
    ...(a === undefined ? {} : { a: a / questions }),
    ...(at === undefined || record?.answered === undefined
      ? {}
      : { answerToAgentMs: at - record.answered }),
  };
  return { measure, deviated, delivered: at !== undefined, shown: record !== undefined };
};

const mergeObserved = (transcripts: readonly Transcript[]): Observed => {
  const all = (pick: (observed: Observed) => readonly string[]) =>
    [...new Set(transcripts.flatMap((transcript) => pick(transcript.observed)))].sort();
  return {
    versions: all((observed) => observed.versions),
    models: all((observed) => observed.models),
    efforts: all((observed) => observed.efforts),
    cacheWrites: transcripts.reduce(
      (sum, transcript) => ({
        "5m": sum["5m"] + transcript.observed.cacheWrites["5m"],
        "1h": sum["1h"] + transcript.observed.cacheWrites["1h"],
      }),
      { "5m": 0, "1h": 0 },
    ),
  };
};

// The transcript the case's asks are in: the main one, or the subagent's that asked most.
const targetOf = (input: RunInput): Transcript | undefined => {
  if (!CASES[input.caseId].fromSubagent) return input.main;
  return [...input.subagents].sort(
    (a, b) => asksIn(b, input.arm).length - asksIn(a, input.arm).length,
  )[0];
};

// The first request's input, and what every tool search of the session loads: definitions loaded
// on first use stay in context like those loaded upfront (design decision 9).
const contextOf = (transcript: Transcript | undefined) => {
  if (transcript === undefined) return {};
  const firstInput = transcript.requests[0]?.totalInput;
  const searches = transcript.requests.filter((request) =>
    request.calls.some((call) => call.name === "ToolSearch"),
  );
  const toolSearchGrowth = sumOrUndefined(
    searches.map((request) => growthOf(transcript, request.index)),
  );
  return {
    ...(firstInput === undefined ? {} : { firstInput }),
    ...(toolSearchGrowth === undefined ? {} : { toolSearchGrowth }),
  };
};

const reasonOf = (
  input: RunInput,
  expected: number,
  found: number,
  batched: boolean,
  measured: readonly Measured[],
) => {
  if (input.interrupted) return "interrupted";
  if (input.timedOut) return "timed out";
  if (input.main === undefined) return "the transcript is missing";
  if (input.arm === "baseline") {
    return input.main.requests.length === 0 ? "the transcript holds no request" : undefined;
  }
  if (found < expected) return `an expected ask is missing (found ${found} of ${expected})`;
  if (measured.some((ask) => ask.deviated)) return "a question deviated from the scenario";
  if (batched) return "two asks were sent in one response";
  if (measured.some((ask) => !ask.delivered)) return "the answer never reached the agent";
  const unshown = measured.find((ask) => !ask.shown);
  if (unshown !== undefined)
    return `no answerer record shows the board of ${unshown.measure.askId}`;
  return undefined;
};

export const measureRun = (input: RunInput): RunMeasure => {
  const expected = input.arm === "baseline" ? 0 : CASES[input.caseId].asks.length;
  const target = input.arm === "baseline" ? undefined : targetOf(input);
  const found = target === undefined ? [] : asksIn(target, input.arm);
  // The scenario asks one question at a time: two asks in one response break it.
  const batched = new Set(found.map((call) => call.request.index)).size < found.length;
  const asks = groupAsks(found);
  const measured =
    target === undefined
      ? []
      : asks.slice(0, expected).map((_, index) => measureAsk(input, target, asks, index));
  const reason = reasonOf(input, expected, asks.length, batched, measured);
  const transcripts = [input.main, ...input.subagents].filter(
    (transcript): transcript is Transcript => transcript !== undefined,
  );
  return {
    caseId: input.caseId,
    arm: input.arm,
    run: input.run,
    valid: reason === undefined,
    ...(reason === undefined ? {} : { reason }),
    asks: measured.map((ask) => ask.measure),
    ...contextOf(input.main),
    observed: mergeObserved(transcripts),
    ...(input.init === undefined ? {} : { init: input.init }),
    timedOut: input.timedOut,
    exitCode: input.exitCode,
  };
};
