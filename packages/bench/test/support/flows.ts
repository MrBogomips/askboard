// Transcripts and answerer records of whole benchmark runs, with known figures, for the
// measurement and report tests. Times are offsets from T0 in milliseconds.

import { QUESTIONS } from "../../src/scenarios.ts";
import { type Block, TranscriptBuilder } from "./transcript-builder.ts";

export const T0 = Date.parse("2026-10-30T10:00:00.000Z");
export const ASK = "mcp__plugin_askboard_askboard__ask";
export const COLLECT = "mcp__plugin_askboard_askboard__collect";
const EPOCH = "k3x9abcd";

const question = (index: number) => {
  const found = QUESTIONS[index];
  if (found === undefined) throw new Error("no question");
  return found;
};

export const askInput = (askId: string, index: number, labels?: readonly string[]) => {
  const { text, header, options } = question(index);
  const chosen =
    labels === undefined ? options : labels.map((label) => ({ label, description: "d" }));
  return {
    askId,
    items: [{ type: "question", id: `q${index}`, props: { text, header, options: chosen } }],
  };
};

export const askResult = (askId: string) =>
  JSON.stringify({
    versions: { result: "1.0", output: "1.0" },
    epoch: EPOCH,
    askId,
    state: "waiting",
    cursor: `${EPOCH}.0`,
    board: `http://127.0.0.1:47213/b/${askId}?t=pV3xK9qLmT2wR7nB4cYh8A`,
  });

export const collectResult = (askId: string, index: number, choice?: string) =>
  JSON.stringify({
    versions: { result: "1.0", output: "1.0" },
    epoch: EPOCH,
    asks: [
      {
        askId,
        state: choice === undefined ? "waiting" : "answered",
        cursor: `${EPOCH}.${choice === undefined ? 0 : 1}`,
        unchecked: true,
        events:
          choice === undefined
            ? []
            : [
                {
                  cursor: `${EPOCH}.1`,
                  type: "answer",
                  itemId: `q${index}`,
                  rev: 1,
                  who: "u",
                  when: "2026-10-30T10:00:08Z",
                  choice: [choice],
                },
              ],
      },
    ],
  });

const collectInput = (askId: string, index: number) => ({
  asks: [{ askId, after: `${EPOCH}.0` }],
  wait: { askId, itemId: `q${index}` },
});

export type FlowOptions = {
  /** Labels the warm ask is asked with instead of the scenario's. */
  readonly warmLabels?: readonly string[];
  /** The cold ask's collect returns no answer. */
  readonly coldUnanswered?: boolean;
  /** A failed ask call before the cold ask. */
  readonly failedAttempt?: boolean;
  /** A text-only response between the tool search and the cold ask. */
  readonly textBetween?: boolean;
  readonly withoutThinking?: boolean;
  readonly agentId?: string;
  /** The cold ask is sent again, identical, before its collect. */
  readonly repeatCold?: boolean;
  /** A tool search, for collect, between the cold ask and its collect. */
  readonly searchBeforeCollect?: boolean;
};

/**
 * S1 in the AskBoard arm: a tool search, the cold ask, its waiting collect, the warm ask, its
 * collect and the final reply. Figures: see measure.test.ts.
 */
export const askboardS1 = (options: FlowOptions = {}) => {
  const b = new TranscriptBuilder({
    start: T0,
    effort: "medium",
    ...(options.withoutThinking ? { withoutThinking: true } : {}),
    ...(options.agentId === undefined ? {} : { agentId: options.agentId }),
  });
  b.prompt("prompt", T0);
  const [search] = b.request(
    { input: 10, cacheCreation: 20_000, output: 200, thinking: 80 },
    [
      { type: "thinking" },
      { type: "tool_use", name: "ToolSearch", input: { query: "askboard ask" } },
    ],
    T0 + 1_900,
  );
  b.toolResult(search ?? "", "tool definitions", { at: T0 + 2_500 });
  if (options.textBetween) {
    b.request(
      { input: 5, cacheRead: 21_705, output: 10, thinking: 0 },
      [{ type: "text", text: "Let me ask." }],
      T0 + 2_600,
    );
  }
  if (options.failedAttempt) {
    const [bad] = b.request(
      { input: 5, cacheRead: 21_705, output: 150, thinking: 40 },
      [{ type: "tool_use", name: ASK, input: { askId: "x", items: [] } }],
      T0 + 2_550,
    );
    b.toolResult(bad ?? "", "items: expected one question", { isError: true, at: T0 + 2_700 });
  }
  const blocks = (input: unknown, name = ASK): Block[] => [
    { type: "thinking" },
    { type: "tool_use", name, input },
  ];
  const [ask1] = b.request(
    { input: 5, cacheRead: 21_705, output: 400, thinking: 100 },
    blocks(askInput("db-a1", 0)),
    T0 + 3_000,
  );
  b.toolResult(ask1 ?? "", askResult("db-a1"), { at: T0 + 3_400 });
  if (options.repeatCold) {
    const [again] = b.request(
      { input: 5, cacheRead: 22_225, output: 200, thinking: 50 },
      blocks(askInput("db-a1", 0)),
      T0 + 3_420,
    );
    b.toolResult(again ?? "", askResult("db-a1"), { at: T0 + 3_450 });
  }
  if (options.searchBeforeCollect) {
    const [search2] = b.request(
      { input: 5, cacheRead: 22_225, output: 60, thinking: 20 },
      [{ type: "tool_use", name: "ToolSearch", input: { query: "select:collect" } }],
      T0 + 3_420,
    );
    b.toolResult(search2 ?? "", "collect definition", { at: T0 + 3_450 });
  }
  const [collect1] = b.request(
    {
      input: 5,
      cacheRead: options.searchBeforeCollect ? 22_585 : 22_225,
      output: 90,
      thinking: 10,
    },
    blocks(collectInput("db-a1", 0), COLLECT),
    T0 + 3_500,
  );
  b.toolResult(
    collect1 ?? "",
    collectResult("db-a1", 0, options.coldUnanswered ? undefined : "PostgreSQL"),
    { at: T0 + 9_000 },
  );
  const [ask2] = b.request(
    { input: 5, cacheRead: 22_410, output: 380, thinking: 60 },
    blocks(askInput("mig-b2", 1, options.warmLabels)),
    T0 + 9_400,
  );
  b.toolResult(ask2 ?? "", askResult("mig-b2"), { at: T0 + 9_800 });
  const [collect2] = b.request(
    { input: 5, cacheRead: 22_908, output: 85, thinking: 5 },
    blocks(collectInput("mig-b2", 1), COLLECT),
    T0 + 9_900,
  );
  b.toolResult(collect2 ?? "", collectResult("mig-b2", 1, "Flyway"), { at: T0 + 15_000 });
  b.request(
    { input: 5, cacheRead: 23_089, output: 20, thinking: 0 },
    [{ type: "text", text: "PostgreSQL, Flyway" }],
    T0 + 15_100,
  );
  return b.text();
};

export const boardRecords = () => [
  {
    kind: "board",
    askId: "db-a1",
    started: T0 + 3_300,
    pageLoaded: T0 + 3_450,
    shown: T0 + 3_600,
    answered: T0 + 8_000,
    acknowledged: T0 + 8_010,
    itemId: "q0",
    rev: 1,
    choice: ["PostgreSQL"],
    matched: true,
    outcome: "answered",
  },
  {
    kind: "board",
    askId: "mig-b2",
    started: T0 + 9_700,
    pageLoaded: T0 + 9_800,
    shown: T0 + 9_900,
    answered: T0 + 14_000,
    acknowledged: T0 + 14_010,
    itemId: "q1",
    rev: 1,
    choice: ["Flyway"],
    matched: true,
    outcome: "answered",
  },
];

const auqInput = (index: number) => {
  const { text, header, options } = question(index);
  return { questions: [{ question: text, header, multiSelect: false, options }] };
};

export const auqResult = (index: number) =>
  `User has answered your questions: "${question(index).text}"="${question(index).answer}". You can now continue with the user's answers in mind.`;

/** S1 in the AskUserQuestion arm: two AskUserQuestion calls and the final reply. */
export const auqS1 = (options: { readonly batched?: boolean } = {}) => {
  const b = new TranscriptBuilder({ start: T0, effort: "medium" });
  b.prompt("prompt", T0);
  const blocks = (index: number): Block[] => [
    { type: "thinking" },
    { type: "tool_use", name: "AskUserQuestion", input: auqInput(index) },
  ];
  if (options.batched) {
    const [one, two] = b.request(
      { input: 10, cacheCreation: 18_990, output: 600, thinking: 120 },
      [blocks(0)[1] as Block, blocks(1)[1] as Block],
      T0 + 1_000,
    );
    b.toolResult(one ?? "", auqResult(0), { at: T0 + 1_500 });
    b.toolResult(two ?? "", auqResult(1), { at: T0 + 1_510 });
    b.request(
      { input: 5, cacheRead: 19_700, output: 15, thinking: 0 },
      [{ type: "text", text: "done" }],
      T0 + 1_600,
    );
    return b.text();
  }
  const [first] = b.request(
    { input: 10, cacheCreation: 18_990, output: 350, thinking: 90 },
    blocks(0),
    T0 + 1_000,
  );
  b.toolResult(first ?? "", auqResult(0), { at: T0 + 1_500 });
  const [second] = b.request(
    { input: 5, cacheRead: 19_405, output: 300, thinking: 50 },
    blocks(1),
    T0 + 2_000,
  );
  b.toolResult(second ?? "", auqResult(1), { at: T0 + 2_600 });
  b.request(
    { input: 5, cacheRead: 19_763, output: 15, thinking: 0 },
    [{ type: "text", text: "PostgreSQL, Flyway" }],
    T0 + 2_700,
  );
  return b.text();
};

/** S6's main conversation: one Agent call and the final reply. */
export const s6Main = () => {
  const b = new TranscriptBuilder({ start: T0 });
  b.prompt("prompt", T0);
  const [agent] = b.request(
    { input: 10, cacheCreation: 15_000, output: 250, thinking: 50 },
    [
      {
        type: "tool_use",
        name: "Agent",
        input: { subagent_type: "general-purpose", prompt: "task" },
      },
    ],
    T0 + 1_000,
  );
  b.toolResult(agent ?? "", "PostgreSQL", { at: T0 + 20_000 });
  b.request(
    { input: 5, cacheRead: 15_300, output: 10, thinking: 0 },
    [{ type: "text", text: "PostgreSQL" }],
    T0 + 20_100,
  );
  return b.text();
};

/** The baseline: the AskBoard arm's first request, without AskBoard, and nothing after it. */
export const baselineS1 = () => {
  const b = new TranscriptBuilder({ start: T0 });
  b.prompt("prompt", T0);
  b.request(
    { input: 10, cacheCreation: 19_200, output: 120, thinking: 40 },
    [{ type: "tool_use", name: "ToolSearch", input: { query: "askboard ask" } }],
    T0 + 1_000,
  );
  return b.text();
};
