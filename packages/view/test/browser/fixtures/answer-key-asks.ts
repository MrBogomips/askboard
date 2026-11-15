// Test-only asks of the answer key's browser tests (board-keys, task 4.2): a board of choice
// questions, one multiple choice, one question with a required field and one with nothing to
// choose, in immediate or submitted delivery. Neutral content only: the repository is public.

type Ask = { readonly askId: string } & Readonly<Record<string, unknown>>;

const choice = (id: string, text: string, labels: readonly string[], multiSelect = false) => ({
  type: "question",
  id,
  props: {
    text,
    header: id.toUpperCase(),
    ...(multiSelect ? { multiSelect: true } : {}),
    options: labels.map((label) => ({ label })),
  },
});

const required = {
  type: "question",
  id: "fields",
  props: {
    text: "Which service?",
    header: "FIELDS",
    items: [
      { type: "text-field", id: "service", props: { label: "Service name", required: true } },
    ],
  },
};

/** The question IDs, in board order. */
export const ANSWER_KEY_QUESTIONS = ["db", "regions", "cache", "fields"] as const;

export const answerKeyAsk = (delivery: "immediate" | "submitted", suffix = "a1"): Ask => ({
  askId: `answer-key-${delivery}-${suffix}`,
  title: "Platform choices",
  delivery,
  items: [
    choice("db", "Which database?", ["PostgreSQL", "SQLite"]),
    choice("regions", "Which regions?", ["Frankfurt", "Oslo"], true),
    choice("cache", "Is a cache needed?", ["Yes", "No"]),
    required,
  ],
});
