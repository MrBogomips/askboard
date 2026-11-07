// The LaTeX, Kanban and Timeline fixtures (latex-kanban-timeline, design decisions 3 to 5): each
// type's item as sent and as the user edited it, the act that sends the edit and the event that
// logs it, and what `fetch` returns for the item. Each takes its version from its constant. Tests
// only; no shipped unit imports them.

import { type ActCommand, BOARD_PROTOCOL_VERSION } from "../schemas/board-protocol/index.ts";
import type { AnswerEvent } from "../schemas/output/index.ts";
import { RESULT_VERSIONS } from "../schemas/tool-envelopes/index.ts";
import type { KanbanItem } from "../widgets/kanban/index.ts";
import type { LatexItem } from "../widgets/latex/index.ts";

const SESSION = {
  epoch: "k3x9",
  askId: "edit-widgets-m4t8",
  question: "check",
} as const;
const WHEN = "2026-11-07T11:20:00Z";
const WHO = "Sara Conti";

/** The session of the answer fixtures: its epoch, ask and the question that holds the items. */
export const EDIT_WIDGETS_SESSION = SESSION;

/** A LaTeX as the agent sent it. */
export const LATEX_FIXTURE_ITEM: LatexItem = {
  type: "latex",
  id: "formula",
  props: { expression: "a^2+b^2" },
};

/** The LaTeX's props as the user corrected them. */
export const LATEX_EDITED_PROPS = { expression: "a^2+b^2=c^2" } as const;

/** The changes of that correction: one `set` of the whole expression. */
export const LATEX_CHANGES = [
  { op: "set", target: "formula.expression", value: LATEX_EDITED_PROPS.expression },
] as const;

/** The act that sends the corrected LaTeX: its value, with no change (`ask-core` computes them). */
export const latexAct: ActCommand = {
  version: BOARD_PROTOCOL_VERSION,
  type: "act",
  actionId: "tN6pU1oZy5WvO9xAb4fCsH",
  acts: [
    {
      type: "answer",
      itemId: SESSION.question,
      rev: 1,
      values: { [LATEX_FIXTURE_ITEM.id]: LATEX_EDITED_PROPS },
      when: WHEN,
    },
  ],
};

/** The event that logs the correction. */
export const latexAnswerEvent: AnswerEvent = {
  cursor: `${SESSION.epoch}.1`,
  type: "answer",
  itemId: SESSION.question,
  rev: 1,
  who: WHO,
  when: WHEN,
  changes: LATEX_CHANGES,
};

/** What `fetch` returns for the LaTeX alone: its props as the user left them. */
export const latexFetchItemResult: Readonly<Record<string, unknown>> = {
  versions: RESULT_VERSIONS,
  epoch: SESSION.epoch,
  askId: SESSION.askId,
  state: "answered",
  item: {
    type: LATEX_FIXTURE_ITEM.type,
    id: LATEX_FIXTURE_ITEM.id,
    questionId: SESSION.question,
    props: LATEX_EDITED_PROPS,
    state: "answered",
  },
  unchecked: true,
};

/** A Kanban of three columns and three cards, each in one of them. */
export const KANBAN_FIXTURE_ITEM: KanbanItem = {
  type: "kanban",
  id: "board",
  props: {
    columns: [
      { id: "todo", label: "To do" },
      { id: "doing", label: "Doing" },
      { id: "done", label: "Done" },
    ],
    cards: [
      { id: "fix-login", label: "Fix the login redirect", column: "todo" },
      { id: "write-docs", label: "Write the guide", description: "Two pages", column: "doing" },
      { id: "release-notes", label: "Release notes", column: "done" },
    ],
  },
};

/** The Kanban's props after the user moved `fix-login` to Doing: the cards keep their order. */
export const KANBAN_EDITED_PROPS = {
  ...KANBAN_FIXTURE_ITEM.props,
  cards: KANBAN_FIXTURE_ITEM.props.cards.map((card) =>
    card.id === "fix-login" ? { ...card, column: "doing" } : card,
  ),
} as const;

/** The changes of that move: one `set` of the card's column. */
export const KANBAN_CHANGES = [
  { op: "set", target: "board.fix-login.column", value: "doing" },
] as const;

/** The act that sends the moved card: the Kanban's value, with no change. */
export const kanbanAct: ActCommand = {
  version: BOARD_PROTOCOL_VERSION,
  type: "act",
  actionId: "uO7qV2pAz6XwP0yBc5gDtI",
  acts: [
    {
      type: "answer",
      itemId: SESSION.question,
      rev: 1,
      values: { [KANBAN_FIXTURE_ITEM.id]: KANBAN_EDITED_PROPS },
      when: WHEN,
    },
  ],
};

/** The event that logs the move. */
export const kanbanAnswerEvent: AnswerEvent = {
  cursor: `${SESSION.epoch}.1`,
  type: "answer",
  itemId: SESSION.question,
  rev: 1,
  who: WHO,
  when: WHEN,
  changes: KANBAN_CHANGES,
};

/** What `fetch` returns for the Kanban alone: its props as the user left them. */
export const kanbanFetchItemResult: Readonly<Record<string, unknown>> = {
  versions: RESULT_VERSIONS,
  epoch: SESSION.epoch,
  askId: SESSION.askId,
  state: "answered",
  item: {
    type: KANBAN_FIXTURE_ITEM.type,
    id: KANBAN_FIXTURE_ITEM.id,
    questionId: SESSION.question,
    props: KANBAN_EDITED_PROPS,
    state: "answered",
  },
  unchecked: true,
};
