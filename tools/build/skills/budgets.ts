// The skill's budgets (askboard-skills, task 2.5; design decision 7; skills spec: the skill's token
// budget): what `check:skills` holds the generated skill to, each figure printed with its budget.
// The characters are a proxy for tokens, at about four to a token: the benchmark reports tokens per
// model (AD-17). A budget moves only through a design decision.

import { SERVER_INSTRUCTIONS, TOOL_DEFINITIONS } from "@askboard/contract";

export const BUDGETS = {
  /** Loaded in every session and every subagent's listing. */
  description: 600,
  /** Loaded once per invocation, under Claude Code's 500 lines. */
  skill: 9000,
  skillLines: 250,
  /** Read on demand, one or two per ask. */
  reference: 6000,
  /** The tool definitions, the server instructions, and the skill's name and description: PRD R5's line. */
  alwaysLoaded: 8400,
} as const;

/** The skill's name, which is also its directory's. */
export const SKILL_NAME = "askboard";

// The Agent Skills specification (AD-18): lowercase, digits and single hyphens, 64 characters at most.
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX = 64;
const FRONTMATTER_KEYS = ["name", "description"];

/** What every session loads besides the skill: the tool definitions as compact JSON, the instructions. */
export type AlwaysLoaded = { readonly tools: string; readonly instructions: string };

export const defaultAlwaysLoaded = (): AlwaysLoaded => ({
  tools: JSON.stringify(TOOL_DEFINITIONS),
  instructions: SERVER_INSTRUCTIONS,
});

/** The `key: value` lines of a leading `---` block, in order, or undefined when there is none. */
export const parseFrontmatter = (text: string): [string, string][] | undefined => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (match === null) return undefined;
  return (match[1] ?? "").split("\n").map((line) => {
    const at = line.indexOf(": ");
    return at < 0 ? [line, ""] : [line.slice(0, at), line.slice(at + 2)];
  });
};

export type BudgetReport = {
  /** Each measured figure with its budget, in order. */
  readonly figures: readonly string[];
  /** Each rule the skill breaks, naming the file or the total, its size and the budget. */
  readonly problems: readonly string[];
};

const count = (n: number): string => n.toLocaleString("en-US");

const linesOf = (text: string): number => text.split("\n").length - 1;

const nameProblems = (name: string, directory: string): string[] => {
  const problems: string[] = [];
  if (name !== SKILL_NAME) problems.push(`the skill's name "${name}" must be "${SKILL_NAME}"`);
  else if (directory !== name) {
    problems.push(`the skill's name "${name}" must match its directory "${directory}"`);
  }
  if (!NAME_PATTERN.test(name) || name.length > NAME_MAX) {
    problems.push(
      `the skill's name "${name}" does not conform to the Agent Skills specification (lowercase letters, digits and single hyphens, ${NAME_MAX} characters at most)`,
    );
  }
  return problems;
};

/** Measures the generated files against the budgets. `directory` is the skill folder's name. */
export const budgetReport = (
  files: ReadonlyMap<string, string>,
  always: AlwaysLoaded = defaultAlwaysLoaded(),
  directory: string = SKILL_NAME,
): BudgetReport => {
  const figures: string[] = [];
  const problems: string[] = [];
  const skill = files.get("SKILL.md");
  if (skill === undefined) return { figures, problems: ["skills/askboard/SKILL.md is missing"] };

  const head = parseFrontmatter(skill);
  if (head === undefined) {
    problems.push("skills/askboard/SKILL.md has no frontmatter");
  } else {
    for (const [key] of head) {
      if (!FRONTMATTER_KEYS.includes(key)) {
        problems.push(
          `SKILL.md's frontmatter holds "${key}", and only name and description are allowed`,
        );
      }
    }
  }
  const name = head?.find(([key]) => key === "name")?.[1] ?? "";
  const description = head?.find(([key]) => key === "description")?.[1] ?? "";
  problems.push(...nameProblems(name, directory));

  const check = (what: string, size: number, budget: number, unit: string) => {
    figures.push(`${what}: ${count(size)} of ${count(budget)} ${unit}`);
    if (size > budget) {
      problems.push(`${what} has ${count(size)} ${unit}, over its budget of ${count(budget)}`);
    }
  };
  check("description", description.length, BUDGETS.description, "characters");
  if (description.length < 1) problems.push("the skill's description is empty");
  check("SKILL.md", skill.length, BUDGETS.skill, "characters");
  check("SKILL.md", linesOf(skill), BUDGETS.skillLines, "lines");
  for (const [path, text] of files) {
    if (path !== "SKILL.md") check(path, text.length, BUDGETS.reference, "characters");
  }
  const total = always.tools.length + always.instructions.length + name.length + description.length;
  check("always-loaded total", total, BUDGETS.alwaysLoaded, "characters");
  return { figures, problems };
};
