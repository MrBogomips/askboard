// Test-only asks of the guided flow's browser tests (answering-flow-guidance, task 6.1): short boards
// of plain two-option questions with no areas, where the order of the next question to do, the
// header's count and an agent's title in the footer matter and the page height does not. Neutral
// content only: the repository is public.

type Ask = { readonly askId: string } & Readonly<Record<string, unknown>>;
export type Language = "en-US" | "it-IT";
export type Delivery = "immediate" | "submitted";

const WORDS: Record<Language, { yes: string; no: string }> = {
  "en-US": { yes: "Yes", no: "No" },
  "it-IT": { yes: "Sì", no: "No" },
};

/** The header an agent wrote with markup and a right-to-left override and an isolate close that reopens it: shown as text only. */
export const MARKUP_TITLE = "<b>Bold</b> \u202edcba\u2069\u202e";

/** A plain question: its header chip is the title the footer and the status message name. */
const plain = (id: string, language: Language, header = id.toUpperCase()) => ({
  type: "question",
  id,
  props: {
    text: `Is step ${id} needed for the release?`,
    header,
    options: [{ label: WORDS[language].yes }, { label: WORDS[language].no }],
  },
});

/** A board of `count` plain questions, p1 to p<count>, in board order. */
export const guidanceAsk = (
  count: number,
  options: {
    readonly language?: Language;
    readonly delivery?: Delivery;
    /** Question IDs given the markup title as their header. */
    readonly marked?: readonly string[];
    readonly suffix?: string;
  } = {},
): Ask => {
  const { language = "en-US", delivery = "immediate", marked = [], suffix = "a1" } = options;
  const ids = Array.from({ length: count }, (_, at) => `p${at + 1}`);
  return {
    askId: `guidance-${count}-${language.slice(0, 2)}-${delivery}-${marked.length}-${suffix}`,
    title: "Guided steps",
    language,
    delivery,
    items: ids.map((id) => plain(id, language, marked.includes(id) ? MARKUP_TITLE : undefined)),
  };
};
