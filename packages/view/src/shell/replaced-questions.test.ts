import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ViewQuestion } from "../view-document.ts";
import { ReplacedQuestions } from "./replaced-questions.tsx";

// Submit's confirmation lists the questions it would replace the verdict of (approval-scale-
// ranking, task 4b.16; EXPERIENCE.md, Agent-written labels, F-64; NFR-12).

const question = (id: string, props: { text: string; header?: string }) =>
  ({ id, type: "question", rev: 1, props }) as unknown as ViewQuestion;

const render = (questions: readonly ViewQuestion[]) =>
  renderToStaticMarkup(createElement(ReplacedQuestions, { questions }));

describe("the questions Submit's confirmation lists", () => {
  test("each by the label the outline shows: the header chip, else the text", () => {
    const html = render([
      question("a", { text: "Which database should we use?", header: "Database" }),
      question("b", { text: "Which region?" }),
    ]);
    expect(html).toContain(">Database<");
    expect(html).not.toContain("Which database should we use?");
    expect(html).toContain(">Which region?<");
  });

  test("on one line, cut with an ellipsis, the label whole as the title", () => {
    const long = "x".repeat(5000);
    const html = render([question("a", { text: long })]);
    expect(html).toContain(`title="${long}"`);
    expect(html).toMatch(/<span class="[^"]*\btruncate\b[^"]*"/);
    expect(html).toMatch(/<span class="[^"]*\bblock\b/);
  });

  test("the list has a height of its own and scrolls", () => {
    const html = render([question("a", { text: "Which region?" })]);
    expect(html).toMatch(/<ul class="[^"]*\bmax-h-[^" ]+/);
    expect(html).toMatch(/<ul class="[^"]*\boverflow-y-auto\b/);
  });

  test("agent text is shown as data, never as markup", () => {
    const html = render([question("a", { text: '<img src=x onerror="alert(1)">' })]);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
