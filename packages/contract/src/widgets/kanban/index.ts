// The Kanban (FR-11, latex-kanban-timeline): cards the user moves between 2 to 12 columns. Its
// schemas are standalone: they belong to no schema set until the entry is registered (design
// decision 12), and nothing compiles them when this module loads.

export { kanbanPropsProblems } from "./checks.ts";
export {
  KANBAN_CARD_DESCRIPTION_MAX_CHARS,
  KANBAN_CARD_LABEL_MAX_CHARS,
  KANBAN_COLUMN_LABEL_MAX_CHARS,
  KANBAN_MAX_CARDS,
  KANBAN_MAX_COLUMNS,
  KANBAN_MIN_CARDS,
  KANBAN_MIN_COLUMNS,
  KANBAN_SCHEMA_IDS,
  KANBAN_SHAPE,
  type KanbanCard,
  type KanbanChange,
  type KanbanColumn,
  type KanbanItem,
  type KanbanProps,
} from "./constants.ts";
export { KANBAN_WIDGET } from "./widget.ts";
