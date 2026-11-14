// The Kanban's order fixtures (kanban-order, design decisions 1, 3 and 4): a Kanban of three columns
// whose cards interleave, the props the board sends after the user reordered a column, placed a
// card in another column and did both, each in the normal form its changes rebuild (the order the
// board holds, which `ask-core` takes back exactly), and the changes of each. Tests only; no
// shipped unit imports them.

import type { KanbanItem } from "../widgets/kanban/index.ts";

const COLUMNS = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
] as const;

const card = (id: string, label: string, column: string) => ({ id, label, column });

/** The cards as sent: `todo`, `doing` and `done` cards interleaved in the list. */
const SENT = [
  card("fix-login", "Fix the login redirect", "todo"),
  card("write-docs", "Write the guide", "doing"),
  card("add-sso", "Add single sign-on", "todo"),
  card("review", "Review the release", "doing"),
  card("release-notes", "Release notes", "done"),
  card("audit", "Audit the access log", "todo"),
] as const;

/** A Kanban whose three columns hold cards that interleave in `cards`, as an agent sends them. */
export const KANBAN_ORDER_ITEM: KanbanItem = {
  type: "kanban",
  id: "board",
  props: { columns: COLUMNS, cards: SENT },
};

const byId = (id: string) => SENT.find((one) => one.id === id) as (typeof SENT)[number];

/** The props after `add-sso` went first in `todo`: it moved to the top of the list, the rest as sent. */
export const KANBAN_REORDERED_PROPS = {
  columns: COLUMNS,
  cards: [
    byId("add-sso"),
    byId("fix-login"),
    byId("write-docs"),
    byId("review"),
    byId("release-notes"),
    byId("audit"),
  ],
} as const;

/** The changes of that reorder: one `move` with no `after`, nothing for `doing` or `done`. */
export const KANBAN_REORDER_CHANGES = [{ op: "move", target: "board.add-sso" }] as const;

/** The props after `audit` went to `doing`, right after `write-docs` and above `review`. */
export const KANBAN_PLACED_PROPS = {
  columns: COLUMNS,
  cards: [
    byId("fix-login"),
    byId("write-docs"),
    { ...byId("audit"), column: "doing" },
    byId("add-sso"),
    byId("review"),
    byId("release-notes"),
  ],
} as const;

/** The changes of that placement: the `set` of the column, then the `move` after `write-docs`. */
export const KANBAN_PLACED_CHANGES = [
  { op: "set", target: "board.audit.column", value: "doing" },
  { op: "move", target: "board.audit", after: "write-docs" },
] as const;

/** The props after both: `audit` placed in `doing` and `add-sso` first in `todo`. */
export const KANBAN_BOTH_PROPS = {
  columns: COLUMNS,
  cards: [
    byId("add-sso"),
    byId("fix-login"),
    byId("write-docs"),
    { ...byId("audit"), column: "doing" },
    byId("review"),
    byId("release-notes"),
  ],
} as const;

/** The changes of both, by column in the order of the columns' IDs: `doing`, then `todo`. */
export const KANBAN_BOTH_CHANGES = [
  { op: "set", target: "board.audit.column", value: "doing" },
  { op: "move", target: "board.audit", after: "write-docs" },
  { op: "move", target: "board.add-sso" },
] as const;
