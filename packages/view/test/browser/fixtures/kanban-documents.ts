// Test-only board documents holding a Kanban (latex-kanban-timeline, task 5.2): the fixture Tree's
// question `plan` with the Kanban `board` as its only item, or after the Tree `wbs`, as the agent
// sends them; and the ask for the session process. The spec's scenario: `a` and `c` in `todo`, `b`
// in `done`, `doing` empty. The drafts' values are read from the host's mirror.

import type { Locale } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";
import type { WidgetHostRun } from "../harness/widget-host-test.ts";
import { plan, wbs } from "./tree-documents.ts";

/** The item's ID, and the labels the agent gives the columns in each language. */
export const KANBAN_ID = "board";
const LABELS = {
  "en-US": { todo: "To do", doing: "Doing", done: "Done" },
  "it-IT": { todo: "Da fare", doing: "In corso", done: "Fatto" },
} as const;

/** The Kanban `board` as the agent sends it, its columns labelled in `language`. */
export const kanbanItem = (language: Locale = "en-US") => ({
  type: "kanban" as const,
  id: KANBAN_ID,
  props: {
    columns: [
      { id: "todo", label: LABELS[language].todo },
      { id: "doing", label: LABELS[language].doing },
      { id: "done", label: LABELS[language].done },
    ],
    cards: [
      { id: "a", label: "Fix login", description: "The redirect loops", column: "todo" },
      { id: "b", label: "Ship docs", column: "done" },
      { id: "c", label: "Write tests", column: "todo" },
    ],
  },
});

/** The props the Kanban sends once `a` is in `doing`: every card at its index. */
export const MOVED_A = {
  ...kanbanItem().props,
  cards: kanbanItem().props.cards.map((card) =>
    card.id === "a" ? { ...card, column: "doing" } : card,
  ),
};

const documentOf = (items: readonly unknown[], language?: Locale): ViewDocument =>
  ({
    ...treeBoardDocument,
    ...(language === undefined ? {} : { language }),
    items: [{ ...plan, props: { ...plan.props, items } }],
  }) as unknown as ViewDocument;

/** The question `plan` holding the Kanban alone, in `language` (en-US by default). */
export const kanbanDocument = (language?: Locale): ViewDocument =>
  documentOf([kanbanItem(language)], language);

/**
 * A Kanban of three cards in `todo` (`a`, `c`, `d`) and one in `done` (`b`), for the order
 * (kanban-order): the flat list interleaves them as an agent sends it, `a b c d`.
 */
export const orderItem = () => ({
  ...kanbanItem(),
  props: {
    ...kanbanItem().props,
    cards: [...kanbanItem().props.cards, { id: "d", label: "Review PR", column: "todo" }],
  },
});

/** The question `plan` holding the Kanban of `orderItem`. */
export const orderDocument = (language?: Locale): ViewDocument =>
  documentOf([orderItem()], language);

/** The question `plan` holding the Tree `wbs`, then the Kanban. */
export const treeAndKanbanDocument: ViewDocument = documentOf([wbs, kanbanItem()]);

/** The ask for the session process: the question `plan` with the Kanban. */
export const kanbanAsk = {
  askId: "portal-sow-plan-t2v6",
  title: "Customer portal SOW plan",
  items: [
    {
      type: "question",
      id: "plan",
      props: { ...plan.props, items: [kanbanItem()] },
    },
  ],
} as const;

type Mirrored = {
  readonly record: {
    readonly questions: Readonly<
      Record<string, { readonly values?: Readonly<Record<string, unknown>> } | undefined>
    >;
  };
};

/** The value the latest draft mirror holds for the item `id`; undefined when it holds none. */
export const draftProps = (run: WidgetHostRun, id = KANBAN_ID): unknown => {
  const last = run.drafts.at(-1) as unknown as Mirrored | undefined;
  return last?.record.questions[plan.id]?.values?.[id];
};
