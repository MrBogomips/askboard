// Test-only asks for the answering flow's browser tests (answering-flow-fixes, task 2.1): a board of
// nine questions in three areas, tall enough at 1280x800 that the second open question's heading
// sits under the bottom bar while the page is at its top, offered as sections, tabs and one question
// per view, in en-US and it-IT; four questions carry a recommendation; one holds two text fields
// (one required, one with a pattern); one holds a Tabs layout with a required field in its second
// tab; and a single-question ask. Neutral content only: the repository is public.

type Ask = { readonly askId: string } & Readonly<Record<string, unknown>>;
export type Presentation = "sections" | "tabs" | "one-per-view";
export type Language = "en-US" | "it-IT";

const WORDS: Record<Language, { yes: string; no: string; more: string }> = {
  "en-US": { yes: "Yes", no: "No", more: "Maybe later" },
  "it-IT": { yes: "Sì", no: "No", more: "Forse dopo" },
};

const SPAN = "A reason that fills the line so that each option takes more than one line of text.";

/** A choice question: four options with descriptions, so the card is tall. */
const choice = (id: string, text: string, language: Language, recommended = false) => {
  const words = WORDS[language];
  const options = [words.yes, words.no, words.more, `${words.no} ${id}`].map((label, at) => ({
    label,
    description: `${SPAN} ${SPAN}`,
    ...(recommended && at === 0 ? { recommended: true } : {}),
  }));
  return { type: "question", id, props: { text, header: id.toUpperCase(), options } };
};

const field = (id: string, label: string, props: Record<string, unknown> = {}) => ({
  type: "text-field",
  id,
  props: { label, ...props },
});

/** The question with "Service name" (required) and "Ticket" (a pattern). */
const fields = (language: Language) => {
  const italian = language === "it-IT";
  return {
    type: "question",
    id: "q4",
    props: {
      text: italian ? "Quale servizio e quale ticket?" : "Which service and which ticket?",
      header: "Q4",
      items: [
        field("service", italian ? "Nome del servizio" : "Service name", { required: true }),
        field("ticket", "Ticket", { pattern: "^[A-Z]{2}-\\d{4}$" }),
      ],
    },
  };
};

/** The question whose second tab holds a required field. */
const tabbed = (language: Language) => ({
  type: "question",
  id: "q6",
  props: {
    text: language === "it-IT" ? "Quali dettagli servono?" : "Which details are needed?",
    header: "Q6",
    items: [
      {
        type: "tabs",
        id: "details",
        props: {
          tabs: [
            { id: "first", title: "First", items: [field("who", "Who")] },
            {
              id: "second",
              title: "Second",
              items: [field("owner", "Owner", { required: true })],
            },
          ],
        },
      },
    ],
  },
});

const area = (id: string, title: string, items: readonly unknown[]) => ({
  type: "area",
  id,
  props: { title, items },
});

/** The nine questions' IDs, in board order. */
export const QUESTIONS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"] as const;

/** The board of nine questions in three areas. */
export const answeringAsk = (
  presentation: Presentation,
  language: Language = "en-US",
  delivery: "immediate" | "submitted" = "immediate",
): Ask => {
  const q = (id: string, recommended = false) =>
    choice(id, `Is step ${id} needed for the release?`, language, recommended);
  return {
    askId: `answering-${presentation}-${language.slice(0, 2)}-${delivery}-a1`,
    title: "Release steps",
    language,
    delivery,
    presentation,
    items: [
      area("scope", "Scope", [q("q1", true), q("q2", true), q("q3")]),
      area("data", "Data", [fields(language), q("q5", true), tabbed(language)]),
      area("release", "Release", [q("q7", true), q("q8"), q("q9")]),
    ],
  };
};

/** A single-question ask. */
export const singleAnsweringAsk: Ask = {
  askId: "answering-single-b2",
  title: "One step",
  items: [choice("only", "Is this step needed?", "en-US", true)],
};
