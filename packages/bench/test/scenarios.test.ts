import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { answerPlan, CASES, chooseFor, promptFor, QUESTIONS, rowsOf } from "../src/scenarios.ts";

const TOOL_SENTENCES = /^(Ask me|After each ask|Wait for my answer|Start one subagent).*$/gm;

describe("questions", () => {
  test("the first question is the approved plain-choice example", () => {
    const [first] = QUESTIONS;
    const { props } = plainChoiceBoardDocument.items[0];
    expect(first?.text).toBe(props.text);
    expect(first?.header).toBe(props.header);
    expect<unknown>(first?.options).toEqual(props.options);
  });

  test("every question is a single choice with its answer among its options", () => {
    for (const question of QUESTIONS) {
      expect(question.options.map((option) => option.label)).toContain(question.answer);
      expect(new Set(question.options.map((option) => option.label)).size).toBe(
        question.options.length,
      );
    }
  });
});

describe("cases", () => {
  test("S1 runs in both arms and the baseline with a cold and a warm ask; S6 in AskBoard from a subagent", () => {
    expect(CASES.S1.arms).toEqual(["askboard", "auq", "baseline"]);
    expect(CASES.S1.asks.map((ask) => ask.row)).toEqual(["S1-cold", "S1-warm"]);
    expect(CASES.S1.fromSubagent).toBe(false);
    expect(CASES.S6.arms).toEqual(["askboard"]);
    expect(CASES.S6.asks.map((ask) => ask.row)).toEqual(["S6"]);
    expect(CASES.S6.fromSubagent).toBe(true);
    expect(rowsOf(["S1", "S6"])).toEqual(["S1-cold", "S1-warm", "S6"]);
  });

  test("the answer plan lists each question's labels and the label to choose", () => {
    expect(answerPlan(CASES.S1)).toEqual([
      { labels: ["PostgreSQL", "SQLite", "DynamoDB"], choice: ["PostgreSQL"] },
      { labels: ["Flyway", "Liquibase", "By hand"], choice: ["Flyway"] },
    ]);
  });

  test("a plan matches a question by its labels in any order", () => {
    const plan = answerPlan(CASES.S1);
    expect(chooseFor(plan, ["Liquibase", "By hand", "Flyway"])).toEqual({
      choice: ["Flyway"],
      matched: true,
    });
    expect(chooseFor(plan, ["Redis", "Memcached"])).toEqual({ choice: ["Redis"], matched: false });
    expect(chooseFor(plan, [])).toEqual({ choice: [], matched: false });
  });
});

describe("prompts", () => {
  test("both arms' S1 prompts hold the same questions and differ only in the tool sentences", () => {
    const askboard = promptFor(CASES.S1, "askboard");
    const auq = promptFor(CASES.S1, "auq");
    expect(askboard).not.toBe(auq);
    expect(askboard.replace(TOOL_SENTENCES, "")).toBe(auq.replace(TOOL_SENTENCES, ""));
    for (const question of QUESTIONS) {
      for (const prompt of [askboard, auq]) {
        expect(prompt).toContain(`Header: ${question.header}`);
        expect(prompt).toContain(`Text: ${question.text}`);
        for (const option of question.options) {
          expect(prompt).toContain(`- ${option.label}: ${option.description}`);
        }
      }
    }
    expect(askboard).toContain("AskBoard's ask tool");
    expect(askboard).toContain("collect");
    expect(auq).toContain("AskUserQuestion");
  });

  test("the baseline gets the AskBoard arm's prompt, so their first requests differ only by AskBoard", () => {
    expect(promptFor(CASES.S1, "baseline")).toBe(promptFor(CASES.S1, "askboard"));
  });

  test("S6 hands the first question to a subagent", () => {
    const prompt = promptFor(CASES.S6, "askboard");
    expect(prompt).toContain("Agent tool");
    expect(prompt).toContain(`Text: ${QUESTIONS[0]?.text}`);
    expect(prompt).not.toContain(`Text: ${QUESTIONS[1]?.text}`);
  });

  test("no prompt names an ask ID or a full tool name", () => {
    for (const [arm, prompt] of [
      ["askboard", promptFor(CASES.S1, "askboard")],
      ["auq", promptFor(CASES.S1, "auq")],
      ["askboard", promptFor(CASES.S6, "askboard")],
    ] as const) {
      expect({ arm, fullName: /mcp__/.test(prompt), askId: /askId/.test(prompt) }).toEqual({
        arm,
        fullName: false,
        askId: false,
      });
    }
  });

  test("a case refuses an arm it does not run", () => {
    expect(() => promptFor(CASES.S6, "auq")).toThrow("S6 does not run in the auq arm");
  });
});
