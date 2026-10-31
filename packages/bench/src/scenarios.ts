// The early benchmark's cases, the questions they ask, the scripted user's answers and the
// agent's prompts (early-benchmark design decision 15; SOLUTION-DESIGN §7, seed set). E1 runs one
// plain question per ask by pull, so the cases are S1 and S6.

/**
 * The baseline is the AskBoard arm's command without AskBoard, ended after its first request: the
 * difference between the two first requests is what AskBoard adds before the first ask (NFR-1).
 */
export type Arm = "askboard" | "auq" | "baseline";
export const ARMS: readonly Arm[] = ["askboard", "auq", "baseline"];
/** The arms that ask, and so have report rows. */
export const ASKING_ARMS: readonly Arm[] = ["askboard", "auq"];

export type CaseId = "S1" | "S6";
export const CASE_IDS: readonly CaseId[] = ["S1", "S6"];

/** A report row: S1's first ask is cold, its second warm; S6 is one ask from a subagent. */
export type RowId = "S1-cold" | "S1-warm" | "S6";

export type Option = { readonly label: string; readonly description: string };

export type Question = {
  readonly header: string;
  readonly text: string;
  readonly options: readonly Option[];
  /** The label the scripted user chooses. */
  readonly answer: string;
};

export type CaseAsk = { readonly question: Question; readonly row: RowId };

export type Case = {
  readonly id: CaseId;
  readonly arms: readonly Arm[];
  readonly asks: readonly CaseAsk[];
  /** The asks come from a subagent the main conversation starts. */
  readonly fromSubagent: boolean;
};

/** One entry per question: the labels it is asked with and the labels the scripted user picks. */
export type PlanEntry = { readonly labels: readonly string[]; readonly choice: readonly string[] };

// The approved plain-choice example (contract fixtures, asks/plain-choice.json).
const DATABASE: Question = {
  header: "Database",
  text: "Which database should the order service use?",
  options: [
    {
      label: "PostgreSQL",
      description: "Relational, already run by the platform team; needs a managed instance.",
    },
    { label: "SQLite", description: "Embedded file, no server to run; one writer at a time." },
    {
      label: "DynamoDB",
      description: "Managed key-value store that scales without tuning; no joins.",
    },
  ],
  answer: "PostgreSQL",
};

// S1's warm ask: a second plain choice of the same size (proposal, open question 1).
const MIGRATIONS: Question = {
  header: "Migrations",
  text: "How should the order service run its schema migrations?",
  options: [
    {
      label: "Flyway",
      description: "Versioned SQL files applied at deploy; the team already knows it.",
    },
    { label: "Liquibase", description: "Changelogs in XML or YAML with rollbacks; more to learn." },
    {
      label: "By hand",
      description: "A runbook the on-call engineer follows; no tool to install.",
    },
  ],
  answer: "Flyway",
};

export const QUESTIONS: readonly Question[] = [DATABASE, MIGRATIONS];

export const CASES: Readonly<Record<CaseId, Case>> = {
  S1: {
    id: "S1",
    arms: ["askboard", "auq", "baseline"],
    asks: [
      { question: DATABASE, row: "S1-cold" },
      { question: MIGRATIONS, row: "S1-warm" },
    ],
    fromSubagent: false,
  },
  S6: {
    id: "S6",
    arms: ["askboard"],
    asks: [{ question: DATABASE, row: "S6" }],
    fromSubagent: true,
  },
};

/** The report rows of the given cases, in report order. */
export const rowsOf = (cases: readonly CaseId[]): RowId[] =>
  CASE_IDS.filter((id) => cases.includes(id)).flatMap((id) => CASES[id].asks.map((ask) => ask.row));

export const answerPlan = (benchCase: Case): PlanEntry[] =>
  benchCase.asks.map(({ question }) => ({
    labels: question.options.map((option) => option.label),
    choice: [question.answer],
  }));

const sameLabels = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((label) => b.includes(label));

/**
 * The labels to answer a question asked with these option labels. A question the plan does not
 * hold gets its first option, so that the run ends quickly; measurement then rejects it as
 * deviated (early-benchmark design decision 5).
 */
export const chooseFor = (
  plan: readonly PlanEntry[],
  labels: readonly string[],
): { choice: string[]; matched: boolean } => {
  const entry = plan.find((candidate) => sameLabels(candidate.labels, labels));
  if (entry !== undefined) return { choice: [...entry.choice], matched: true };
  return { choice: labels.slice(0, 1), matched: false };
};

const questionBlock = (question: Question, index: number): string =>
  [
    `Question ${index + 1} (single choice)`,
    `Header: ${question.header}`,
    `Text: ${question.text}`,
    ...question.options.map((option) => `- ${option.label}: ${option.description}`),
  ].join("\n");

// The sentences that name the tool are the only ones that differ between the arms, each on a line
// of its own, so that the prompts can be compared line by line.
const toolSentences = (arm: "askboard" | "auq", many: boolean): string[] =>
  arm === "askboard"
    ? [
        `Ask me ${many ? "the questions below, one at a time," : "the question below"} with AskBoard's ask tool: one question per ask.`,
        "After each ask, call AskBoard's collect tool with wait set to that question, so that you wait for my answer.",
      ]
    : [
        `Ask me ${many ? "the questions below, one at a time," : "the question below"} with the AskUserQuestion tool: one question per call.`,
        "Wait for my answer before you go on.",
      ];

const askingPrompt = (questions: readonly Question[], arm: "askboard" | "auq"): string => {
  const many = questions.length > 1;
  return [
    ...toolSentences(arm, many),
    ...(many ? ["Ask a question only once you have the answer to the one before it."] : []),
    "Write each question's text, header and options exactly as given, as a single-choice question.",
    `When you have ${many ? "every answer" : "the answer"}, reply with one line: the chosen ${many ? "labels, separated by commas" : "label"}. Do nothing else.`,
    "",
    questions.map(questionBlock).join("\n\n"),
  ].join("\n");
};

/** The prompt `claude -p` receives for a case in an arm. */
export const promptFor = (benchCase: Case, arm: Arm): string => {
  if (!benchCase.arms.includes(arm)) {
    throw new Error(`${benchCase.id} does not run in the ${arm} arm`);
  }
  const questions = benchCase.asks.map((ask) => ask.question);
  const asking = arm === "baseline" ? "askboard" : arm;
  if (!benchCase.fromSubagent) return askingPrompt(questions, asking);
  return [
    "Start one subagent with the Agent tool (subagent type general-purpose) and give it the task below, word for word. Do not ask the question yourself. When the subagent returns, reply with one line: the label it reports.",
    "",
    "Task for the subagent:",
    "",
    askingPrompt(questions, asking),
  ].join("\n");
};
