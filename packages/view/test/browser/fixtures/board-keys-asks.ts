// Test-only asks for the board's keys browser tests (board-keys, task 3.4): a board of four
// questions in two areas, tall enough that a jump scrolls, with a five-row Ranking as the third
// question and "Other…" on the first. Neutral content only: the repository is public.

type Ask = { readonly askId: string } & Readonly<Record<string, unknown>>;
export type Presentation = "sections" | "tabs" | "one-per-view";

const SPAN = "A reason that fills the line so that each option takes more than one line of text.";

const choice = (id: string, text: string, allowOther = false) => ({
  type: "question",
  id,
  props: {
    text,
    header: id.toUpperCase(),
    ...(allowOther ? { allowOther: true } : {}),
    options: ["Yes", "No", "Maybe later"].map((label) => ({
      label,
      description: `${SPAN} ${SPAN}`,
    })),
  },
});

const ranking = {
  type: "question",
  id: "rank",
  props: {
    text: "Put the steps in order.",
    header: "RANK",
    items: [
      {
        type: "ranking",
        id: "priorities",
        props: {
          items: ["Alpha", "Bravo", "Charlie", "Delta", "Echo"].map((label) => ({
            id: label.charAt(0).toLowerCase(),
            label,
          })),
        },
      },
    ],
  },
};

const area = (id: string, title: string, items: readonly unknown[]) => ({
  type: "area",
  id,
  props: { title, items },
});

/** The question IDs, in board order. */
export const KEYS_QUESTIONS = ["q1", "q2", "rank", "q4"] as const;

/** Two areas, "Scope" (q1, q2) and "Data" (the Ranking, q4), in the presentation asked for. */
export const boardKeysAsk = (presentation: Presentation, suffix = "a1"): Ask => ({
  askId: `board-keys-${presentation}-${suffix}`,
  title: "Release steps",
  presentation,
  items: [
    area("scope", "Scope", [
      choice("q1", "Is step one needed?", true),
      choice("q2", "Is step two needed?"),
    ]),
    area("data", "Data", [ranking, choice("q4", "Is step four needed?")]),
  ],
});

/** Three plain questions with no areas: the board a test answers down to one open question. */
export const threeChoicesAsk = (suffix = "c1"): Ask => ({
  askId: `board-keys-three-${suffix}`,
  title: "Release steps",
  items: [
    choice("q1", "Is step one needed?"),
    choice("q2", "Is step two needed?"),
    choice("q3", "Is step three needed?"),
  ],
});
