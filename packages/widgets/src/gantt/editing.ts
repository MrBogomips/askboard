// The grid's cell editing (view spec, "Gantt editing in the grid"; proposal, open question 18):
// Enter or F2 opens an editor on a start or a duration, holding what the grid shows; Enter, or
// leaving the field, commits it through `model/entries.ts`; a refusal keeps the editor, its text
// and the focus, with the reason under the row, and leaves the draft; Escape restores. A commit
// that leaves the editor gives the focus back to its cell, but leaving the field does not take it
// back. The text and the refusal are view state: only a committed value reaches the draft.

import type { GanttProps } from "@askboard/contract";
import { useLanguage, useLocale, useStrings } from "@askboard/view/catalog";
import { useCallback, useRef, useState } from "react";
import type { DateFormat } from "./model/date.ts";
import {
  durationEntry,
  type EditedColumn,
  type Entry,
  entryText,
  startEntry,
} from "./model/entries.ts";
import type { TaskSchedule } from "./model/schedule.ts";
import type { GanttColumn, GanttRow } from "./model/tasks.ts";

export type Editing = {
  readonly taskId: string;
  readonly column: EditedColumn;
  readonly text: string;
  /** Why the last commit was refused, until the next commit or the editor closes. */
  readonly refusal?: string;
};

export type CellEditing = {
  readonly editing: Editing | undefined;
  readonly begin: (row: GanttRow, column: EditedColumn) => void;
  readonly change: (text: string) => void;
  /** Commits the text; `refocus` gives the focus back to the cell once the editor closes. */
  readonly commit: (refocus: boolean) => void;
  readonly cancel: () => void;
};

type EditingArgs = {
  readonly current: GanttProps;
  readonly sent: GanttProps;
  readonly rows: readonly GanttRow[];
  readonly schedules: readonly TaskSchedule[];
  /** Puts the Gantt's next value into the draft. */
  readonly onCommit: (value: GanttProps) => void;
  /** Focuses a cell of the grid. */
  readonly focusCell: (taskId: string, column: GanttColumn) => void;
};

const entryOf = (args: EditingArgs, format: DateFormat, editing: Editing): Entry => {
  const index = args.rows.findIndex((row) => row.id === editing.taskId);
  const { current, sent } = args;
  return editing.column === "start"
    ? startEntry(current, sent, editing.taskId, args.schedules[index], editing.text, format)
    : durationEntry(current, sent, editing.taskId, args.schedules[index], editing.text, format);
};

export const useCellEditing = (args: EditingArgs): CellEditing => {
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  // What is open now, read by a blur that follows a close in the same task.
  const open = useRef<Editing | undefined>(undefined);
  const show = useCallback((next: Editing | undefined) => {
    open.current = next;
    setEditing(next);
  }, []);
  const latest = useRef(args);
  latest.current = args;
  // Dates and numbers are read and shown in the ask's locale, and refused in its language.
  const locale = useLocale();
  const language = useLanguage();
  const text = useStrings();
  const format = useRef<DateFormat>({ locale, language, text });
  format.current = { locale, language, text };
  const begin = useCallback(
    (row: GanttRow, column: EditedColumn) => {
      const index = latest.current.rows.indexOf(row);
      show({
        taskId: row.id,
        column,
        text: entryText(column, row, latest.current.schedules[index], format.current.locale),
      });
    },
    [show],
  );
  const change = useCallback(
    (text: string) => {
      if (open.current !== undefined) show({ ...open.current, text });
    },
    [show],
  );
  const close = useCallback(
    (refocus: boolean) => {
      const closing = open.current;
      show(undefined);
      if (refocus && closing !== undefined)
        latest.current.focusCell(closing.taskId, closing.column);
    },
    [show],
  );
  const commit = useCallback(
    (refocus: boolean) => {
      const editingNow = open.current;
      if (editingNow === undefined) return;
      const entry = entryOf(latest.current, format.current, editingNow);
      if (entry.kind === "refused") {
        show({ ...editingNow, refusal: entry.reason });
        return;
      }
      latest.current.onCommit(entry.value);
      close(refocus);
    },
    [show, close],
  );
  const cancel = useCallback(() => close(true), [close]);
  return { editing, begin, change, commit, cancel };
};
