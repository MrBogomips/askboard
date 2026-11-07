// The skill's budgets (askboard-skills, task 2.5; skills spec: the skill's token budget and the
// shipped skill; design decision 7): each rule pinned with a synthetic overrun, and the shipped
// skill held against them.

import { describe, expect, test } from "bun:test";
import { BUDGETS, budgetReport, parseFrontmatter } from "./budgets.ts";
import { generateSkill } from "./generate.ts";

const skillFile = (description: string, body = "Body.", name = "askboard") =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

const files = (entries: Record<string, string>) => new Map(Object.entries(entries));
const small = { tools: "t".repeat(100), instructions: "i".repeat(100) };

const problemsOf = (
  entries: Record<string, string>,
  always = small,
  directory = "askboard",
): readonly string[] => budgetReport(files(entries), always, directory).problems;

describe("the budgets", () => {
  test("are the design's", () => {
    expect(BUDGETS).toEqual({
      description: 600,
      skill: 9000,
      skillLines: 250,
      reference: 6000,
      alwaysLoaded: 8400,
    });
  });
});

describe("a skill within the budgets", () => {
  test("passes, and prints each figure with its budget", () => {
    const report = budgetReport(
      files({ "SKILL.md": skillFile("Use when asking."), "references/a.md": "x" }),
      small,
    );
    expect(report.problems).toEqual([]);
    const text = report.figures.join("\n");
    expect(text).toContain("description: 16 of 600 characters");
    expect(text).toMatch(/SKILL\.md: [\d,]+ of 9,000 characters/);
    expect(text).toMatch(/SKILL\.md: \d+ of 250 lines/);
    expect(text).toContain("references/a.md: 1 of 6,000 characters");
    expect(text).toMatch(/always-loaded total: [\d,]+ of 8,400 characters/);
  });
});

describe("a skill over a budget", () => {
  test("a description of 601 characters fails, naming it, its size and the budget", () => {
    const problems = problemsOf({ "SKILL.md": skillFile("d".repeat(601)) });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("description");
    expect(problems[0]).toContain("601");
    expect(problems[0]).toContain("600");
  });

  test("a description of 600 characters passes", () => {
    expect(problemsOf({ "SKILL.md": skillFile("d".repeat(600)) })).toEqual([]);
  });

  test("a SKILL.md of 9,001 characters fails, naming the file, its size and the budget", () => {
    const head = skillFile("Use.", "");
    const problems = problemsOf({ "SKILL.md": `${head}${"x".repeat(9001 - head.length)}` });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("SKILL.md");
    expect(problems[0]).toContain("9,001");
    expect(problems[0]).toContain("9,000");
  });

  test("a SKILL.md of 251 lines fails, and of 250 passes", () => {
    const head = skillFile("Use.", "");
    const lines = (count: number) => `${head}${"x\n".repeat(count - head.split("\n").length + 1)}`;
    expect(lines(250).split("\n").length - 1).toBe(250);
    expect(problemsOf({ "SKILL.md": lines(250) })).toEqual([]);
    const problems = problemsOf({ "SKILL.md": lines(251) });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("251 lines");
    expect(problems[0]).toContain("250");
  });

  test("a reference of 6,001 characters fails, naming the file, its size and the budget", () => {
    const problems = problemsOf({
      "SKILL.md": skillFile("Use."),
      "references/widgets/big.md": "x".repeat(6001),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("references/widgets/big.md");
    expect(problems[0]).toContain("6,001");
    expect(problems[0]).toContain("6,000");
  });

  test("an always-loaded total of 8,401 characters fails, and of 8,400 passes", () => {
    const entries = { "SKILL.md": skillFile("Use.") };
    const fixed = "askboard".length + "Use.".length + small.instructions.length;
    const total = (size: number) => ({ ...small, tools: "t".repeat(size - fixed) });
    expect(problemsOf(entries, total(8400))).toEqual([]);
    const problems = problemsOf(entries, total(8401));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("always-loaded");
    expect(problems[0]).toContain("8,401");
    expect(problems[0]).toContain("8,400");
  });
});

describe("the name", () => {
  test("must be askboard, match its directory and the Agent Skills pattern", () => {
    expect(problemsOf({ "SKILL.md": skillFile("Use.", "x", "other") })).toEqual([
      expect.stringContaining('name "other"'),
    ]);
    expect(problemsOf({ "SKILL.md": skillFile("Use.") }, small, "elsewhere")[0]).toContain(
      "directory",
    );
    expect(problemsOf({ "SKILL.md": skillFile("Use.", "x", "Bad_Name") }).join("\n")).toContain(
      "Agent Skills",
    );
  });

  test("a SKILL.md without frontmatter, or with another key, fails", () => {
    expect(problemsOf({ "SKILL.md": "# no frontmatter\n" })[0]).toContain("frontmatter");
    expect(
      problemsOf({
        "SKILL.md": `---\nname: askboard\ndescription: Use.\nallowed-tools: Bash\n---\n`,
      })[0],
    ).toContain("allowed-tools");
  });

  test("a folder without SKILL.md fails", () => {
    expect(problemsOf({ "references/a.md": "x" })[0]).toContain("SKILL.md");
  });
});

describe("parseFrontmatter", () => {
  test("reads the keys in order, and nothing when there is no block", () => {
    expect(parseFrontmatter("---\nname: a\ndescription: b: c\n---\nrest")).toEqual([
      ["name", "a"],
      ["description", "b: c"],
    ]);
    expect(parseFrontmatter("rest")).toBeUndefined();
  });
});

describe("the shipped skill", () => {
  test("passes every budget, and the figures stay below them", () => {
    const report = budgetReport(generateSkill().files);
    expect(report.problems).toEqual([]);
    expect(report.figures.length).toBeGreaterThan(5);
  });
});
