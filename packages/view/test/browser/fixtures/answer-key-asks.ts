// Test-only asks of the answer key's browser tests (board-keys, task 4.2): a board of choice
// questions, one multiple choice, one with an Email pattern field beside its options and one with only a
// Ranking, in immediate or submitted delivery. Neutral content only: the repository is public.

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

/** Options and a pattern field, so that a typed value can block the answer while an option has the focus. */
const emailChoice = {
  type: "question",
  id: "email",
  props: {
    text: "Which contact?",
    header: "EMAIL",
    options: ["Team", "Owner"].map((label) => ({ label })),
    items: [
      {
        type: "text-field",
        id: "contact",
        props: { label: "Email", pattern: "^[a-z]+@[a-z]+\\.[a-z]+$" },
      },
    ],
  },
};

/** A question holding only a Ranking: Enter on a row makes it answerable. */
const rankOnly = {
  type: "question",
  id: "order",
  props: {
    text: "Put the steps in order.",
    header: "ORDER",
    items: [
      {
        type: "ranking",
        id: "steps",
        props: {
          items: ["Alpha", "Bravo", "Charlie"].map((label) => ({
            id: label.charAt(0).toLowerCase(),
            label,
          })),
        },
      },
    ],
  },
};

/** The question IDs, in board order. */
export const ANSWER_KEY_QUESTIONS = ["db", "regions", "cache", "email", "order"] as const;

export const answerKeyAsk = (delivery: "immediate" | "submitted", suffix = "a1"): Ask => ({
  askId: `answer-key-${delivery}-${suffix}`,
  title: "Platform choices",
  delivery,
  items: [
    choice("db", "Which database?", ["PostgreSQL", "SQLite"]),
    choice("regions", "Which regions?", ["Frankfurt", "Oslo"], true),
    choice("cache", "Is a cache needed?", ["Yes", "No"]),
    emailChoice,
    rankOnly,
  ],
});
