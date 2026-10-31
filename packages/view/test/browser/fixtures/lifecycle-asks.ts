// Test-only asks for the ask lifecycle's browser tests (ask-lifecycle, tasks 6.1 to 6.8), sent to
// the session process as they are: one question with FR-3's fields, boards of several questions
// with and without areas in each presentation and delivery mode, and markup in every agent
// string (AD-8). The approved examples are the contract's; these only exercise the board.

import { lifecycleAsk } from "@askboard/contract/fixtures";

type Ask = { readonly askId: string } & Readonly<Record<string, unknown>>;

/** The plain-choice question with FR-3's fields: a recommendation with the agent's note, previews, "Other…". */
export const database = (id = "database") => ({
  type: "question",
  id,
  props: {
    text: "Which database should the order service use?",
    header: "Database",
    allowOther: true,
    options: [
      {
        label: "PostgreSQL",
        description: "Relational, with the team's existing tooling.",
        recommended: true,
        annotation: "The team runs it already for billing.",
      },
      {
        label: "SQLite",
        description: "Embedded, one file.",
        preview: "Single writer; fine below 100 writes a second.",
      },
      {
        label: "DynamoDB",
        description: "Managed key-value store.",
        preview: "Pay per request; no joins.",
      },
    ],
  },
});

/** A plain question with two options, no recommendation. */
export const plain = (id: string, text: string, header?: string) => ({
  type: "question",
  id,
  props: {
    text,
    ...(header === undefined ? {} : { header }),
    options: [
      { label: "Yes", description: `Yes to ${id}.` },
      { label: "No", description: `No to ${id}.` },
    ],
  },
});

const area = (id: string, title: string, items: readonly unknown[]) => ({
  type: "area",
  id,
  props: { title, items },
});

/** One question: the single-question board. */
export const singleAsk: Ask = {
  askId: "single-db-a1b2",
  title: "Order service database",
  items: [database()],
};

/** One question asking for one question per view and submitted delivery: still the single board. */
export const singleRequestingMoreAsk: Ask = {
  ...singleAsk,
  askId: "single-more-c3d4",
  presentation: "one-per-view",
  delivery: "submitted",
};

/** Two questions without areas, in immediate delivery. */
export const twoAsk: Ask = {
  askId: "two-questions-e5f6",
  title: "Order service storage",
  items: [database(), plain("cache", "Should the order service cache reads?", "Cache")],
};

/** Three questions without areas, in submitted delivery. */
export const submittedAsk: Ask = {
  askId: "submitted-g7h8",
  title: "Release checklist",
  delivery: "submitted",
  items: [
    database(),
    plain("cache", "Should the order service cache reads?", "Cache"),
    plain("audit", "Should every order change be audited?", "Audit"),
  ],
};

/** Three areas, no presentation: sections. */
export const sectionsAsk: Ask = {
  askId: "sections-j9k1",
  title: "Checkout plan",
  items: [
    area("scope", "Scope", [
      plain("region", "Does the first release cover the EU?", "Regions"),
      plain("mobile", "Does it cover the mobile app?", "Mobile"),
    ]),
    area("data", "Data", [plain("export", "Should orders go to the ERP every night?", "ERP")]),
    area("release", "Release", [plain("flag", "Should it go out behind a flag?", "Rollout")]),
  ],
};

/** The contract's lifecycle ask, two areas as tabs, answered at once. */
export const tabsAsk: Ask = { ...lifecycleAsk, askId: "tabs-m2n3", delivery: "immediate" };

/** Four questions without areas asking for tabs: one group, no tab strip. */
export const flatTabsAsk: Ask = {
  askId: "flat-tabs-p4q5",
  title: "Four questions",
  presentation: "tabs",
  items: ["one", "two", "three", "four"].map((id) => plain(id, `Question ${id}?`)),
};

/** Five questions, one per view, answered at once; the first two in an area each. */
export const onePerViewAsk: Ask = {
  askId: "one-per-view-r6s7",
  title: "Five questions",
  presentation: "one-per-view",
  items: [
    area(
      "first",
      "First area",
      ["q1", "q2", "q3"].map((id) => plain(id, `Question ${id}?`)),
    ),
    area(
      "second",
      "Second area",
      ["q4", "q5"].map((id) => plain(id, `Question ${id}?`)),
    ),
  ],
};

/** Two areas, the second holding one question, which the agent deletes. */
export const emptiedAsk: Ask = {
  askId: "emptied-t8u9",
  title: "Two areas",
  items: [
    area("kept", "Kept", [plain("stays", "Does this stay?"), plain("also", "And this?")]),
    area("emptied", "Emptied", [plain("goes", "Does this go?")]),
  ],
};

/** Markup in the agent strings E3 adds: a preview and an annotation, and the label (AD-8). */
export const MARKUP = "<img src=x onerror=alert(1)>";
export const markupAsk: Ask = {
  askId: "markup-v1w2",
  title: "<b>Markup</b>",
  items: [
    {
      type: "question",
      id: "markup",
      props: {
        text: "<script>document.title='owned'</script>Which one?",
        options: [
          { label: MARKUP, preview: "<b>preview</b>", annotation: "<i>annotation</i>" },
          { label: "plain", recommended: true },
        ],
      },
    },
  ],
};

/** Six questions without areas, in immediate delivery: a board taller than the view (task 6.5). */
export const longAsk: Ask = {
  askId: "long-x3y4",
  title: "Six questions",
  items: ["first", "second", "third", "fourth", "fifth", "sixth"].map((id) =>
    plain(id, `Is the ${id} step needed?`, id),
  ),
};

/** A plain question whose "Yes" the agent recommends. */
export const recommendedPlain = (id: string, text: string, header?: string) => {
  const question = plain(id, text, header);
  const [yes, no] = question.props.options;
  return {
    ...question,
    props: { ...question.props, options: [{ ...yes, recommended: true }, no] },
  };
};

/** Three questions in submitted delivery, two with a recommendation (task 6.6). */
export const recommendedAsk: Ask = {
  askId: "recommended-z5a6",
  title: "Release defaults",
  delivery: "submitted",
  items: [
    database(),
    recommendedPlain("flag", "Should it go out behind a flag?", "Rollout"),
    plain("cache", "Should the order service cache reads?", "Cache"),
  ],
};
