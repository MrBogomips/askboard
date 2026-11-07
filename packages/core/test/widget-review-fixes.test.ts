import { describe, expect, test } from "bun:test";
import {
  type LifecycleBoardDocument,
  type QuestionProps,
  WIDGET_TYPES,
  type WidgetType,
} from "@askboard/contract";
import { PROBE_TYPES } from "@askboard/contract/fixtures";
import { contentProblem } from "../src/lifecycle/answers.ts";
import type { LifecycleBoardView } from "../src/lifecycle/views.ts";
import { keptResultsInReferenceAddressing } from "../src/molecules/addressing.ts";
import type { ExpansionMap } from "../src/molecules/map.ts";
import { boardStateOf } from "../src/snapshot/state.ts";

// Review fixes of widget-registry group 3 (tasks 3.7 to 3.9).

const TREE_AND_GANTT = WIDGET_TYPES.filter(({ type }) => type === "tree" || type === "gantt");

// The registry's nouns as a refusal lists them: `Tree, Gantt or Probe` (each noun less `a`).
const nounsOf = (types: readonly WidgetType[]): string => {
  const names = types.map(({ noun }) => noun.replace(/^an? /, ""));
  return `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
};

const MAP: ExpansionMap = new Map([
  ["ref__item", { reference: "ref", molecule: "m", version: "1.0.0" }],
]);

describe("kept results in reference addressing (S-6)", () => {
  test("an expanded item ID never reaches the Snapshot's map: the key is the reference's", () => {
    const kept = new Map([["c1", { results: { ref__item: { pick: "a" }, free: { x: 1 } } }]]);
    const out = keptResultsInReferenceAddressing(MAP, kept);
    expect([...out.keys()]).toEqual(["c1"]);
    expect(out.get("c1")).toEqual({ ref: { pick: "a" }, free: { x: 1 } });
    expect(JSON.stringify([...out])).not.toContain("ref__item");
  });

  test("an event that kept no result is left out, and the copy shares nothing with the kept one", () => {
    const result = { pick: { deep: 1 } };
    const kept = new Map([
      ["c1", { results: {} }],
      ["c2", { results: { ref__item: result } }],
    ]);
    const out = keptResultsInReferenceAddressing(MAP, kept);
    expect([...out.keys()]).toEqual(["c2"]);
    expect(out.get("c2")?.ref).not.toBe(result);
  });
});

describe("a Snapshot's board state holds the answer's values and results (S-7)", () => {
  const answer = {
    who: "user",
    when: "2026-11-06T10:00:00Z",
    delivered: true,
    values: { ref__tree: { nodes: [{ id: "n", label: "Edited" }] } },
    results: { ref__item: { pick: "a" } },
  };
  const board = {
    askId: "a1",
    state: "answered",
    document: { items: [] } as unknown as LifecycleBoardDocument,
    questions: [{ itemId: "q", rev: 1, state: "answered", answer, previous: answer, thread: [] }],
  } as unknown as Exclude<LifecycleBoardView, { state: "discarded" }>;

  test("current and previous answers carry values and results as the live state sends them", () => {
    const expected = {
      values: answer.values,
      results: answer.results,
      when: answer.when,
      receipt: "delivered",
    };
    const [question] = boardStateOf(board).questions as unknown as Record<string, unknown>[];
    expect(question?.answer).toEqual(expected);
    expect(question?.previous).toEqual(expected);
  });
});

describe("the empty-answer refusal names the registry's nouns (S-8)", () => {
  const props = { options: [{ id: "a", label: "A" }] } as unknown as QuestionProps;

  test("with the shipped types it names each, in the registry's order", () => {
    expect(contentProblem({}, props, false)?.detail).toContain(
      `changes no ${nounsOf(WIDGET_TYPES)} and`,
    );
  });

  test("with an explicit Tree and Gantt registry it reads Tree or Gantt", () => {
    expect(contentProblem({}, props, false, false, TREE_AND_GANTT)?.detail).toContain(
      "changes no Tree or Gantt and",
    );
  });

  test("with the probe registry it names Probe too, from its noun", () => {
    const detail = contentProblem({}, props, false, false, PROBE_TYPES)?.detail;
    expect(detail).toContain(`changes no ${nounsOf(PROBE_TYPES)} and`);
    expect(detail).toContain(" or Probe and");
    expect(
      contentProblem({}, props, false, false, [PROBE_TYPES.at(-1) as never])?.detail,
    ).toContain("changes no Probe and");
    expect(
      contentProblem({}, props, false, false, [...TREE_AND_GANTT, PROBE_TYPES.at(-1) as never])
        ?.detail,
    ).toContain("changes no Tree, Gantt or Probe and");
  });
});
