// The Chart's fixtures (chart-widget, design decisions 1 and 10): a bar, a line and a pie item, a
// result of each, one answer holding two of them (the act that sends it and the event that logs it)
// and what `fetch` returns for the bar alone. Each takes its version from its constant. Tests only;
// no shipped unit imports them.

import { type ActCommand, BOARD_PROTOCOL_VERSION } from "../schemas/board-protocol/index.ts";
import type { AnswerEvent } from "../schemas/output/index.ts";
import { RESULT_VERSIONS } from "../schemas/tool-envelopes/index.ts";
import type { ChartItem, ChartResult } from "../widgets/chart/index.ts";
import { RESULT_WIDGETS_SESSION } from "./approval-scale-ranking.ts";

const BAR: ChartItem = {
  type: "chart",
  id: "failures",
  props: {
    kind: "bar",
    categories: [
      { id: "fix-a", label: "Fix A" },
      { id: "fix-b", label: "Fix B" },
      { id: "fix-c", label: "Fix C" },
    ],
    series: [
      { id: "fails", label: "Failures", values: [4, 9, 2] },
      { id: "reruns", label: "Reruns", values: [1, 3, null] },
    ],
    unit: "runs",
  },
};

const LINE: ChartItem = {
  type: "chart",
  id: "cost",
  props: {
    kind: "line",
    title: "Cost per quarter",
    categories: [
      { id: "q1", label: "Q1" },
      { id: "q2", label: "Q2" },
      { id: "q3", label: "Q3" },
      { id: "q4", label: "Q4" },
    ],
    series: [
      { id: "actual", label: "Actual", values: [10, null, 14, 13] },
      { id: "plan", label: "Plan", values: [12, 12, 12, 12] },
    ],
    valueLabel: "Cost",
    categoryLabel: "Quarter",
    unit: "k€",
  },
};

const PIE: ChartItem = {
  type: "chart",
  id: "share",
  props: {
    kind: "pie",
    categories: [
      { id: "ux", label: "UX" },
      { id: "api", label: "API" },
      { id: "ops", label: "Ops" },
    ],
    series: [{ id: "effort", label: "Effort", values: [60, 30, 10] }],
    highlights: "one",
  },
};

/** A bar chart of two series, a line chart with a gap and a pie that takes one slice. */
export const CHART_FIXTURE_ITEMS = [BAR, LINE, PIE] as const;

/** A result of each of the three, its points in the series' then the categories' order. */
export const CHART_RESULTS = {
  bar: {
    points: [
      { series: "fails", category: "fix-b" },
      { series: "reruns", category: "fix-a" },
    ],
  },
  line: { points: [{ series: "actual", category: "q3" }] },
  pie: { points: [{ series: "effort", category: "ux" }] },
} as const satisfies Record<string, ChartResult>;

const SESSION = RESULT_WIDGETS_SESSION;
const WHEN = "2026-11-07T11:20:00Z";

/** The results of the bar and the pie in one answer, by item ID. */
export const CHART_ANSWER_RESULTS = {
  [BAR.id]: CHART_RESULTS.bar,
  [PIE.id]: CHART_RESULTS.pie,
} as const;

/** The act that sends two Charts' highlighted points. */
export const chartAct: ActCommand = {
  version: BOARD_PROTOCOL_VERSION,
  type: "act",
  actionId: "sN6pU1oZy5WvO9xAb4fCsH",
  acts: [
    {
      type: "answer",
      itemId: SESSION.question,
      rev: 1,
      results: CHART_ANSWER_RESULTS,
      when: WHEN,
    },
  ],
};

/** The event that logs two Charts' highlighted points. */
export const chartAnswerEvent: AnswerEvent = {
  cursor: `${SESSION.epoch}.1`,
  type: "answer",
  itemId: SESSION.question,
  rev: 1,
  who: "Sara Conti",
  when: WHEN,
  results: CHART_ANSWER_RESULTS,
};

/** What `fetch` returns for the bar chart alone: its props and its latest answer's points. */
export const chartFetchItemResult: Readonly<Record<string, unknown>> = {
  versions: RESULT_VERSIONS,
  epoch: SESSION.epoch,
  askId: SESSION.askId,
  state: "answered",
  item: {
    ...BAR,
    questionId: SESSION.question,
    state: "answered",
    result: CHART_RESULTS.bar,
  },
  unchecked: true,
};
