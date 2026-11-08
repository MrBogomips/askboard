// The Table's state and frame (design decisions 9 to 12; view-and-widgets spec: the Table
// requirements): the grid, then a toolbar row. The value is the draft, or the sent answer, else the
// agent's props; the current cell, the open editor, the refusal and the announcement are the
// component's own and never go in the draft, so moving about changes nothing an answer carries. Every
// change of the value goes in the draft, or `undefined` once the rows are the agent's again. The
// text a cell cannot read stays in the cell as a cell entry, held by the shell (design decision 8):
// Enter keeps the editor open on it, leaving keeps it in the cell, correcting or clearing it removes
// it, and a deleted row takes its entries with it. The grid has one Tab stop, the current cell; its
// keys go through the model (`tableKey`), and the DOM focus follows the current cell after a key,
// a click, and the editor closing by key, and is never lost. A read-only Table navigates and edits
// nothing and has no tools. Values and errors of computed cells and totals come from the board's
// live graph, which the edit of a cell recalculates in place, and the derived mark from the sent
// one.

import {
  TABLE_MAX_ROWS,
  type TableCellValue,
  type TableColumn,
  type TableProps,
} from "@askboard/contract";
import { useLanguage, useLocale, useStrings } from "@askboard/view/catalog";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BoardGraph } from "../board-graph/index.ts";
import { CellEditor, type CommitBy } from "./cell-editor.tsx";
import { FRAME } from "./classes.ts";
import { type GridRow, TableGrid } from "./grid.tsx";
import { editText, isInputColumn, nextToggle } from "./model/columns.ts";
import { columnProblems, derivedMarks, formulaErrors, problemText } from "./model/derived.ts";
import { addRow, deleteRow, fixedRows, setCell } from "./model/edits.ts";
import {
  type EditingCell,
  editingStands,
  focusAfterAdd,
  openFocus,
  settleFocus,
  type TableFocus,
  type TableKey,
  tableKey,
} from "./model/focus.ts";
import { cellKey, changeCounter, marksOf } from "./model/marks.ts";
import { readCell } from "./model/read.ts";
import type { RowLine } from "./row.tsx";
import { TableToolbar } from "./toolbar.tsx";

type Editing = EditingCell & { readonly error?: string };

type Entries = ReadonlyMap<string, string>;

const NO_LINES: readonly RowLine[] = Object.freeze([]);
const NO_FIELDS: ReadonlySet<string> = new Set();

const held = (value: TableProps, rowId: string, field: string): unknown => {
  const row = value.rows.find((candidate) => candidate.id === rowId);
  return row !== undefined && Object.hasOwn(row, field) ? row[field] : undefined;
};

// A cell entry's key splits at its first dot: a row's ID and a field hold none.
const splitKey = (key: string): readonly [string, string] => {
  const at = key.indexOf(".");
  return [key.slice(0, at), key.slice(at + 1)];
};

const entriesByRow = (entries: Entries): ReadonlyMap<string, ReadonlyMap<string, string>> => {
  const rows = new Map<string, Map<string, string>>();
  for (const [key, text] of entries) {
    const [rowId, field] = splitKey(key);
    const row = rows.get(rowId) ?? new Map<string, string>();
    row.set(field, text);
    rows.set(rowId, row);
  }
  return rows;
};

const keyOf = (event: KeyboardEvent<HTMLElement>): TableKey => ({
  key: event.key,
  altKey: event.altKey,
  ctrlKey: event.ctrlKey,
  metaKey: event.metaKey,
  shiftKey: event.shiftKey,
  isComposing: event.nativeEvent.isComposing || event.keyCode === 229,
});

const NAVIGATION: ReadonlySet<string> = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);

// The cell a DOM target is in, by the attributes its `td` carries.
const cellOf = (target: EventTarget | null): TableFocus | undefined => {
  if (!(target instanceof Element)) return undefined;
  const cell = target.closest<HTMLElement>("td[data-table-cell]");
  const rowId = cell?.dataset.row;
  const field = cell?.dataset.field;
  return rowId === undefined || field === undefined ? undefined : { rowId, field };
};

const columnOf = (value: TableProps, field: string): TableColumn | undefined =>
  value.columns.find((column) => column.field === field);

export const TableWidget = ({
  itemId,
  labelledBy,
  sent,
  value,
  disabled,
  graph,
  sentGraph,
  cellEntries,
  onValueChange,
  onCellEntriesChange,
}: {
  readonly itemId: string;
  /** The ID of the question's text, which names a grid that has no caption of its own. */
  readonly labelledBy: string;
  /** The agent's props, checked. */
  readonly sent: TableProps;
  /** The value the Table shows. */
  readonly value: TableProps;
  /** The question is answered, being sent or locked: the Table edits nothing. */
  readonly disabled: boolean;
  /** The board's live graph and the graph of the board as sent; none when nothing computes. */
  readonly graph: BoardGraph | undefined;
  readonly sentGraph: BoardGraph | undefined;
  /** The text each cell holds that gives no value, by `row.field`. */
  readonly cellEntries: Entries;
  readonly onValueChange: (value: TableProps | undefined) => void;
  readonly onCellEntriesChange: (entries: Entries) => void;
}) => {
  const text = useStrings();
  const locale = useLocale();
  const language = useLanguage();
  const [stored, setStored] = useState<TableFocus>();
  const [editingState, setEditing] = useState<Editing>();
  const [refusal, setRefusal] = useState<string>();
  const [announced, setAnnounced] = useState("");
  const grid = useRef<HTMLTableElement>(null);
  const moveTo = useRef<TableFocus>(undefined);
  const parity = useRef(false);

  // Dropped during this render, so the Table never shows an edit once read-only.
  if (disabled && editingState !== undefined) setEditing(undefined);
  const focus = settleFocus(value, stored);
  // The current row, which the row tools act on, is one the user has been in: none at open.
  const current = stored === undefined ? undefined : focus;
  // An editor outlives the agent's change only while its column is the one it opened on and is
  // still an input column (review X-1 of review-table-g6); its removal commits nothing.
  const editing =
    disabled || editingState === undefined || !editingStands(value, editingState)
      ? undefined
      : editingState;

  // The DOM focus follows the current cell when a key, a click or a closed editor asks for it.
  useLayoutEffect(() => {
    const to = moveTo.current;
    if (to === undefined) return;
    moveTo.current = undefined;
    const cells = grid.current?.querySelectorAll<HTMLElement>("td[data-table-cell]") ?? [];
    for (const cell of cells) {
      if (cell.dataset.row === to.rowId && cell.dataset.field === to.field) {
        cell.focus();
        return;
      }
    }
  });

  const marks = useMemo(() => marksOf(sent, value), [sent, value]);
  const columns = value.columns;
  const refused = useMemo(() => columnProblems(graph, itemId, columns), [graph, itemId, columns]);
  const errors = useMemo(() => formulaErrors(graph, itemId, value), [graph, itemId, value]);
  const derived = useMemo(
    () => derivedMarks({ itemId, props: value, sentProps: sent, live: graph, sent: sentGraph }),
    [itemId, value, sent, graph, sentGraph],
  );
  const derivedByRow = useMemo(() => {
    const rows = new Map<string, Set<string>>();
    for (const key of derived.cells) {
      const [rowId, field] = splitKey(key);
      rows.set(rowId, (rows.get(rowId) ?? new Set<string>()).add(field));
    }
    return rows;
  }, [derived]);
  const entryRows = useMemo(() => entriesByRow(cellEntries), [cellEntries]);
  const refusedFields = useMemo(() => new Set(refused.keys()), [refused]);

  const write = (next: TableProps): void => {
    onValueChange(marksOf(sent, next).count === 0 ? undefined : next);
  };
  // Only the entries of input cells the Table shows are reported: a computed or on/off cell holds none.
  const setEntries = (entries: Entries): void => {
    const input = new Map<string, string>();
    for (const [key, entry] of entries) {
      const [rowId, field] = splitKey(key);
      const column = columnOf(value, field);
      if (
        column !== undefined &&
        isInputColumn(column) &&
        column.type !== "toggle" &&
        value.rows.some((row) => row.id === rowId)
      ) {
        input.set(key, entry);
      }
    }
    onCellEntriesChange(input);
  };
  const show = (to: TableFocus | undefined, moveDom: boolean): void => {
    setStored(to);
    if (moveDom) moveTo.current = to;
  };
  const refuse = (words: string | undefined): void => {
    setRefusal(words);
    if (words === undefined) return;
    parity.current = !parity.current;
    setAnnounced(parity.current ? words : `${words} `);
  };

  const close = (moveFocus: boolean): void => {
    if (moveFocus && editing !== undefined) moveTo.current = editing;
    setEditing(undefined);
  };
  const commit = (typed: string, by: CommitBy): boolean => {
    if (editing === undefined) return true;
    const column = columnOf(value, editing.field);
    if (column === undefined) return true;
    const reading = readCell(typed, column, locale, language);
    const key = cellKey(editing.rowId, editing.field);
    refuse(undefined);
    if (reading.kind === "entry") {
      setEntries(new Map(cellEntries).set(key, reading.text));
      if (by === "enter") {
        setEditing({ ...editing, error: reading.error });
        return false;
      }
      close(false);
      return true;
    }
    if (cellEntries.has(key)) {
      const rest = new Map(cellEntries);
      rest.delete(key);
      setEntries(rest);
    }
    const cell: TableCellValue | undefined = reading.kind === "value" ? reading.value : undefined;
    const next = setCell(value, editing.rowId, editing.field, cell);
    if (next !== value) write(next);
    close(by === "enter");
    return true;
  };

  const toggleCell = (at: TableFocus): void => {
    refuse(undefined);
    const next = setCell(value, at.rowId, at.field, nextToggle(held(value, at.rowId, at.field)));
    if (next !== value) write(next);
  };
  const clearCell = (at: TableFocus): void => {
    refuse(undefined);
    const next = setCell(value, at.rowId, at.field, undefined);
    if (next !== value) write(next);
  };
  // An on/off cell has no editor: it is switched (a click, Space, Enter, F2) or cleared, never typed in.
  const isToggle = (at: TableFocus): boolean => {
    const column = columnOf(value, at.field);
    return column !== undefined && isInputColumn(column) && column.type === "toggle";
  };
  const startEdit = (at: TableFocus): void => {
    const column = columnOf(value, at.field);
    if (disabled || column === undefined || !isInputColumn(column) || column.type === "toggle") {
      return;
    }
    setEditing({ rowId: at.rowId, field: at.field, column });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>): void => {
    if (editing !== undefined) return;
    const key = keyOf(event);
    const action = tableKey(key, { props: value, focus, editing: false, readOnly: disabled });
    const navigation =
      NAVIGATION.has(event.key) && !key.altKey && !key.ctrlKey && !key.metaKey && !key.shiftKey;
    if (action.kind === "none") {
      if (navigation && key.isComposing !== true) event.preventDefault();
      return;
    }
    event.preventDefault();
    if (action.kind === "focus") show(action.focus, true);
    else if (action.kind === "edit" && focus !== undefined) startEdit(focus);
    else if (action.kind === "toggle" && focus !== undefined) toggleCell(focus);
    else if (action.kind === "clear" && focus !== undefined) clearCell(focus);
  };
  const onClick = (event: MouseEvent<HTMLTableElement>): void => {
    const at = cellOf(event.target);
    if (disabled || editing !== undefined || at === undefined || !isToggle(at)) return;
    toggleCell(at);
  };
  const onFocus = (event: React.FocusEvent<HTMLTableElement>): void => {
    const at = cellOf(event.target);
    // The grid's first focus makes its current cell current even when it is the cell it opens on.
    if (
      at !== undefined &&
      (stored === undefined || at.rowId !== focus?.rowId || at.field !== focus.field)
    ) {
      show(settleFocus(value, at), false);
    }
  };
  const onMouseDown = (event: MouseEvent<HTMLTableElement>): void => {
    const at = cellOf(event.target);
    if (at !== undefined && editing !== undefined) return;
    if (at !== undefined) show(at, false);
  };
  const onDoubleClick = (event: MouseEvent<HTMLTableElement>): void => {
    const at = cellOf(event.target);
    if (editing !== undefined || at === undefined) return;
    show(at, false);
    startEdit(at);
  };

  const tools = !disabled && !fixedRows(value);
  const onAdd = (): void => {
    const added = addRow(value, current === undefined ? "last" : { after: current.rowId });
    if (added.kind === "refused") {
      if (added.code === "maxRows") refuse(text("table.maxRows", { max: TABLE_MAX_ROWS }));
      return;
    }
    refuse(undefined);
    write(added.value);
    show(focusAfterAdd(added.value, added.rowId), false);
  };
  const onDelete = (): void => {
    if (current === undefined) return;
    const deleted = deleteRow(value, current.rowId);
    if (deleted.kind === "refused") return;
    refuse(undefined);
    const rest = new Map(cellEntries);
    for (const key of cellEntries.keys()) if (splitKey(key)[0] === current.rowId) rest.delete(key);
    if (rest.size !== cellEntries.size) setEntries(rest);
    write(deleted.value);
    const field = columnOf(deleted.value, current.field)?.field;
    const first = openFocus(deleted.value);
    show(
      deleted.current === undefined || field === undefined
        ? first
        : { rowId: deleted.current, field },
      false,
    );
  };

  const lineText = useCallback(
    (line: RowLine): ReactNode => (
      <span id={line.id}>
        {line.column === undefined ? null : (
          <>
            <span className="font-medium">
              {text("widget.fieldError", { column: line.column })}
            </span>{" "}
          </>
        )}
        <span>{line.text}</span>
      </span>
    ),
    [text],
  );

  const errorId = `${itemId}:field-error`;
  const linesOf = (rowId: string, entries: ReadonlyMap<string, string> | undefined) => {
    const lines: RowLine[] = [];
    for (const column of columns) {
      const entry = entries?.get(column.field);
      const open = editing?.rowId === rowId && editing.field === column.field;
      if (open && editing?.error !== undefined) {
        lines.push({
          key: `${column.field}:edit`,
          id: errorId,
          column: column.label,
          text: editing.error,
        });
      } else if (!open && entry !== undefined) {
        const reading = readCell(entry, column, locale, language);
        if (reading.kind === "entry") {
          lines.push({ key: `${column.field}:entry`, column: column.label, text: reading.error });
        }
      }
    }
    for (const failed of errors.rows) {
      const column = columnOf(value, failed.field);
      if (failed.rowId === rowId && column !== undefined) {
        lines.push({
          key: `${failed.field}:formula`,
          column: undefined,
          text: problemText(language, failed.error, column.label),
        });
      }
    }
    return lines.length === 0 ? NO_LINES : lines;
  };

  const editorFor = (position: number): ReactNode => {
    if (editing === undefined) return undefined;
    const column = columnOf(value, editing.field);
    if (column === undefined) return undefined;
    const key = cellKey(editing.rowId, editing.field);
    return (
      <CellEditor
        key={key}
        numeric={column.type === "number" || column.type === "money"}
        initial={
          cellEntries.get(key) ??
          editText(column, held(value, editing.rowId, editing.field), locale)
        }
        label={text("table.cellName", { column: column.label, row: position })}
        error={editing.error}
        errorId={errorId}
        echoOf={(typed) => {
          const reading = readCell(typed, column, locale, language);
          return reading.kind === "empty" ? undefined : reading.echo;
        }}
        onCommit={commit}
        onCancel={() => close(true)}
        onEdit={() => {
          if (editing.error !== undefined)
            setEditing({ rowId: editing.rowId, field: editing.field, column: editing.column });
        }}
      />
    );
  };

  const rows: GridRow[] = value.rows.map((row, index) => {
    const entries = entryRows.get(row.id);
    const isEditing = editing?.rowId === row.id;
    return {
      row,
      position: index + 1,
      stop: focus?.rowId === row.id ? focus.field : undefined,
      current: current?.rowId === row.id,
      editable: !disabled,
      added: marks.added.has(row.id),
      changed: marks.changed.get(row.id),
      derived: derivedByRow.get(row.id) ?? NO_FIELDS,
      entries,
      editing:
        isEditing && editing !== undefined
          ? { field: editing.field, editor: editorFor(index + 1) }
          : undefined,
      lines: linesOf(row.id, entries),
    };
  });
  const problems = columns.flatMap((column) => {
    const failed = refused.get(column.field);
    return failed === undefined
      ? []
      : [{ key: column.field, text: problemText(language, failed, column.label) }];
  });
  const totalled = columns.some((column) => column.total === "sum");
  const totals = totalled
    ? {
        derived: derived.totals,
        errors: errors.totals.flatMap((failed) => {
          const column = columnOf(value, failed.field);
          return column === undefined
            ? []
            : [
                {
                  key: failed.field,
                  node: <span>{problemText(language, failed.error, column.label)}</span>,
                },
              ];
        }),
      }
    : undefined;

  return (
    <div className={FRAME}>
      <TableGrid
        ref={grid}
        itemId={itemId}
        captionId={`${itemId}:caption`}
        labelledBy={labelledBy}
        value={value}
        rows={rows}
        graph={graph}
        refused={refusedFields}
        problems={problems}
        totals={totals}
        lineText={lineText}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />
      <TableToolbar
        tools={tools}
        editing={editing !== undefined}
        canDelete={current !== undefined}
        changes={marks.count}
        counter={changeCounter(marks, language)}
        refusal={refusal}
        onAdd={onAdd}
        onDelete={onDelete}
      />
      <p role="status" aria-live="polite" className="sr-only">
        {announced}
      </p>
    </div>
  );
};
