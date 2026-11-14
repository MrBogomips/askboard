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
  /** The tool definitions, the server instructions, and both skills' names and descriptions: PRD R5's line. */
  alwaysLoaded: 8400,
} as const;

/** The help skill's budgets (keyboard-shortcuts-help, question 9): smaller, read only on a usage question. */
export const HELP_BUDGETS = {
  description: 400,
  skill: 6000,
  skillLines: 150,
  reference: 4000,
} as const;

/** One skill the generator writes: its name (also its directory's), budgets, frontmatter keys and label. */
export type SkillSpec = {
  readonly name: string;
  readonly budgets: {
    readonly description: number;
    readonly skill: number;
    readonly skillLines: number;
    readonly reference: number;
  };
  /** The frontmatter keys the skill may hold; no key grants a tool. */
  readonly frontmatter: readonly string[];
  /** Written before each figure and problem: empty for `askboard`, so its lines stay as they were. */
  readonly prefix: string;
};

/** The asking skill's name, which is also its directory's. */
export const SKILL_NAME = "askboard";
export const HELP_SKILL_NAME = "askboard-help";

export const ASKBOARD_SKILL: SkillSpec = {
  name: SKILL_NAME,
  budgets: BUDGETS,
  frontmatter: ["name", "description"],
  prefix: "",
};

/** `disallowed-tools` keeps the help skill from calling AskBoard's tools (design decision 10, probe 0.4). */
export const HELP_SKILL: SkillSpec = {
  name: HELP_SKILL_NAME,
  budgets: HELP_BUDGETS,
  frontmatter: ["name", "description", "disallowed-tools"],
  prefix: `${HELP_SKILL_NAME}: `,
};

// The Agent Skills specification (AD-18): lowercase, digits and single hyphens, 64 characters at most.
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX = 64;

/** What every session loads besides the skill: the tool definitions as compact JSON, the instructions. */
export type AlwaysLoaded = {
  readonly tools: string;
  readonly instructions: string;
  /** The names and descriptions of the other skills, counted in the total. */
  readonly others?: string;
};

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

const nameProblems = (name: string, directory: string, expected: string): string[] => {
  const problems: string[] = [];
  if (name !== expected) problems.push(`the skill's name "${name}" must be "${expected}"`);
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

/** The name and the description of a skill's `SKILL.md`, as the always-loaded total counts them. */
export const headOf = (files: ReadonlyMap<string, string>): string => {
  const head = parseFrontmatter(files.get("SKILL.md") ?? "");
  const value = (key: string) => head?.find(([name]) => name === key)?.[1] ?? "";
  return `${value("name")}${value("description")}`;
};

/**
 * Measures the generated files of one skill against its budgets. `directory` is the skill folder's
 * name; `withTotal` is false for the skill whose figures leave the always-loaded total to the other.
 */
export const budgetReport = (
  files: ReadonlyMap<string, string>,
  always: AlwaysLoaded = defaultAlwaysLoaded(),
  directory: string = SKILL_NAME,
  spec: SkillSpec = ASKBOARD_SKILL,
  withTotal = true,
): BudgetReport => {
  const figures: string[] = [];
  const problems: string[] = [];
  const { prefix, budgets } = spec;
  const skill = files.get("SKILL.md");
  if (skill === undefined)
    return { figures, problems: [`skills/${spec.name}/SKILL.md is missing`] };

  const head = parseFrontmatter(skill);
  if (head === undefined) {
    problems.push(`skills/${spec.name}/SKILL.md has no frontmatter`);
  } else {
    for (const [key] of head) {
      if (!spec.frontmatter.includes(key)) {
        problems.push(
          `${prefix}SKILL.md's frontmatter holds "${key}", and only ${spec.frontmatter.join(", ")} are allowed`,
        );
      }
    }
  }
  const name = head?.find(([key]) => key === "name")?.[1] ?? "";
  const description = head?.find(([key]) => key === "description")?.[1] ?? "";
  problems.push(...nameProblems(name, directory, spec.name));

  const check = (what: string, size: number, budget: number, unit: string) => {
    figures.push(`${prefix}${what}: ${count(size)} of ${count(budget)} ${unit}`);
    if (size > budget) {
      problems.push(
        `${prefix}${what} has ${count(size)} ${unit}, over its budget of ${count(budget)}`,
      );
    }
  };
  check("description", description.length, budgets.description, "characters");
  if (description.length < 1) problems.push(`${prefix}the skill's description is empty`);
  check("SKILL.md", skill.length, budgets.skill, "characters");
  check("SKILL.md", linesOf(skill), budgets.skillLines, "lines");
  for (const [path, text] of files) {
    if (path !== "SKILL.md") check(path, text.length, budgets.reference, "characters");
  }
  if (withTotal) {
    const total =
      always.tools.length +
      always.instructions.length +
      (always.others ?? "").length +
      name.length +
      description.length;
    check("always-loaded total", total, BUDGETS.alwaysLoaded, "characters");
  }
  return { figures, problems };
};
