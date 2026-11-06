// One node's row of the treegrid (design decision 6; DESIGN.md, Tree): a table row, whose cells a
// treegrid exposes as `gridcell`s, with its level, place and expansion as ARIA attributes; the
// name's cell first, indented by a class per level, with a chevron on a parent, then one cell per
// field. The row and each cell can take the focus, and the one that is the treegrid's Tab stop is
// in the Tab order. An edited cell holds the cell editor, and a refused entry's `field-error`
// shows on a line under the row. What the user changed against the agent's value takes the change
// highlight (`marks.ts`; DESIGN.md, Change highlight): a renamed name and a changed field the
// change fill, text and border, an added row the change bar, a moved row the change dot after its
// name; each mark carries `data-change`, its kind. Agent strings are text children, which React
// escapes: none becomes markup (AD-8). In a work breakdown (molecules design decision 14) a leaf's
// estimates show with the `d` affix and a parent's not at all, two value cells follow the fields,
// right-aligned and never edited, and values in error show a field error under the row.

import type { TreeColumn } from "@askboard/contract";
import { useLocale, useStrings } from "@askboard/view/catalog";
import { memo, type ReactNode } from "react";
import { errorSpan } from "../shared/field-error.ts";
import { fieldText, PERT_HEADERS, pertFieldText } from "./cells.ts";
import {
  ADDED_BAR,
  CHANGE_DOT,
  CHANGED_FIELD,
  CHEVRON,
  CHEVRON_OPEN,
  CURRENT_ADDED_BAR,
  CURRENT_BAR,
  CURRENT_ROW,
  EDITED_FIELD_CELL,
  FIELD_CELL,
  FIELD_ERROR,
  FOCUS_RING,
  indentOf,
  NAME,
  NAME_CELL,
  NEUTRAL_NOTE,
  NOT_SELECTABLE,
  PARENT_NAME,
  RENAMED,
  ROW,
  SELECT_COLUMN,
  SELECTED_ROW,
} from "./classes.ts";
import type { NodeMark } from "./model/marks.ts";
import { type PertRow, type PertValues, rollupNote, rollupText } from "./model/pert.ts";
import { SELECT_CELLS, type TreeRow } from "./model/rows.ts";
import type { CheckState } from "./model/selection.ts";
import { SelectBox } from "./select-box.tsx";

// The chevron points right when closed and down when open. It has no role: the row's
// aria-expanded says what it shows.
const Chevron = ({ open }: { readonly open: boolean }) => (
  <span
    data-chevron=""
    aria-hidden="true"
    className={open ? `${CHEVRON} ${CHEVRON_OPEN}` : CHEVRON}
  >
    <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
      <path
        d="M4.5 2.5 8 6l-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

// A leaf keeps the chevron's room, so that names of one level line up.
const NoChevron = () => <span aria-hidden="true" className="size-4 shrink-0" />;

/** The row itself as the Tab stop, rather than one of its cells. */
export const ROW_STOP = "row";

/** Where a row holds the treegrid's Tab stop: itself, one of its cells, or nowhere. */
export type RowStop = typeof ROW_STOP | number | undefined;

const tabIndexOf = (stop: RowStop, at: RowStop): number => (stop === at ? 0 : -1);

/** The cell of a row being edited: its editor and the field error of a refused entry. */
export type RowEditing = {
  readonly cell: number;
  /** The edited column's name, which begins the field error (review F-10). */
  readonly column: string;
  readonly editor: ReactNode;
  readonly error: string | undefined;
  /** The error line's ID, which describes the editor while it shows. */
  readonly errorId: string;
};

// The line under the row with a refused entry's reason; it is no row of the treegrid.
const FieldError = ({
  editing,
  cells,
}: {
  readonly editing: RowEditing;
  readonly cells: number;
}) => {
  const text = useStrings();
  const { skip, span } = errorSpan(editing.cell, cells);
  return (
    // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: the field error's line is no row of the treegrid; the editor's aria-describedby reads it.
    <tr role="presentation">
      <td colSpan={skip + 1} />
      <td colSpan={span} className={FIELD_ERROR}>
        <span id={editing.errorId}>
          <span className="font-medium">
            {text("widget.fieldError", { column: editing.column })}
          </span>{" "}
          <span>{editing.error}</span>
        </span>
      </td>
    </tr>
  );
};

// The line under a row whose values are in error (DESIGN.md, Derived value); no row of the grid.
export const ValueError = ({
  values,
  cells,
  added = false,
  current = false,
}: {
  readonly values: PertValues;
  readonly cells: number;
  /** The row was just added: its note is neutral, and shows once the user leaves it. */
  readonly added?: boolean;
  readonly current?: boolean;
}) => {
  const text = useStrings();
  const note = rollupNote(values, { added, current });
  return note === undefined ? null : (
    // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: the field error's line is no row of the treegrid.
    <tr role="presentation">
      <td colSpan={cells} className={note.neutral ? NEUTRAL_NOTE : FIELD_ERROR}>
        {text(note.text)}
      </td>
    </tr>
  );
};

/** A work breakdown's two value cells, from cell `first` on: read-only, right-aligned. */
export const ValueCells = ({
  values,
  first,
  stop,
  added = false,
}: {
  readonly values: PertValues;
  readonly first: number;
  readonly stop?: RowStop;
  /** An added row's missing values read as a muted dash (review F-11). */
  readonly added?: boolean;
}) =>
  [values.expected, values.spread].map((value, at) => {
    const { text, muted } = rollupText(value, added);
    return (
      <td
        key={PERT_HEADERS[at]?.label}
        data-cell={first + at}
        tabIndex={stop === undefined ? undefined : tabIndexOf(stop, first + at)}
        className={`${FIELD_CELL.number} ${NOT_SELECTABLE} ${FOCUS_RING}${muted ? " text-muted-foreground" : ""}`}
      >
        {text}
      </td>
    );
  });

// The name, on the change fill when renamed, then the change dot when the row moved.
const Name = ({ row, mark }: { readonly row: TreeRow; readonly mark: NodeMark | undefined }) => {
  const name = row.hasChildren ? PARENT_NAME : NAME;
  return (
    <>
      {mark?.renamed === true ? (
        <span data-change="renamed" className={`${name} ${RENAMED}`}>
          {row.node.label}
        </span>
      ) : (
        <span className={name}>{row.node.label}</span>
      )}
      {mark?.moved === true ? (
        <span data-change="moved" aria-hidden="true" className={CHANGE_DOT} />
      ) : null}
    </>
  );
};

// The name cell's left-edge bar: the current row's, the added row's, both, or none.
const barOf = (added: boolean, current: boolean): string =>
  current ? (added ? CURRENT_ADDED_BAR : CURRENT_BAR) : added ? ADDED_BAR : "";

// A field's cell by its column's type: as edited, as changed, or plain.
const fieldClass = (column: TreeColumn, edited: boolean, changed: boolean): string =>
  edited
    ? EDITED_FIELD_CELL[column.type]
    : changed
      ? `${FIELD_CELL[column.type]} ${CHANGED_FIELD}`
      : FIELD_CELL[column.type];

// A cell takes a text selection only while its editor is open (review F-05).
const selectable = (edited: boolean): string => (edited ? "" : NOT_SELECTABLE);

// Each row re-renders only when its node, its place, its Tab stop, its editing or its mark changes.
export const NodeRow = memo(function NodeRow({
  row,
  columns,
  stop,
  editing,
  mark,
  pert,
  editable,
  current,
  selected,
}: {
  readonly row: TreeRow;
  readonly columns: readonly TreeColumn[];
  readonly stop: RowStop;
  readonly editing: RowEditing | undefined;
  /** What the user changed in this node against the agent's value; none for an unchanged node. */
  readonly mark: NodeMark | undefined;
  /** A work breakdown's values for the row; none in a Tree without `pert`. */
  readonly pert: PertRow | undefined;
  /** The cells that take an edit, as a comma-separated list of their numbers (`editableCells`). */
  readonly editable: string;
  /** The row is the Tree's current row, the one its row tools act on (`model/current.ts`). */
  readonly current: boolean;
  /** The row's check box: checked, partial for a parent with only part of its branch, or none. */
  readonly selected: CheckState;
}) {
  const locale = useLocale();
  const edits = (cell: number): boolean => editing?.cell === cell;
  const takesEdit = (cell: number): true | undefined =>
    !edits(cell) && editable.split(",").includes(String(cell)) ? true : undefined;
  const added = mark?.added === true;
  const text = useStrings();
  const cells = SELECT_CELLS + 1 + columns.length + (pert === undefined ? 0 : PERT_HEADERS.length);
  const textOf = (column: TreeColumn): string =>
    pert === undefined
      ? fieldText(row.node, column, locale)
      : pertFieldText(row.node, column, pert.estimates, locale);
  return (
    <>
      <tr
        data-node-id={row.node.id}
        data-change={added ? "added" : undefined}
        aria-level={row.level}
        aria-posinset={row.position}
        aria-setsize={row.setSize}
        aria-expanded={row.hasChildren ? row.expanded : undefined}
        aria-current={current ? "true" : undefined}
        aria-selected={selected === "checked"}
        tabIndex={tabIndexOf(stop, ROW_STOP)}
        className={`${ROW} ${SELECTED_ROW} ${current ? `${CURRENT_ROW} ` : ""}${FOCUS_RING}`}
      >
        <td data-select-column="" className={SELECT_COLUMN}>
          <SelectBox
            state={selected}
            node={row.node.id}
            label={text("tree.select.row", { name: row.node.label })}
          />
        </td>
        <td
          data-cell={0}
          data-editable={takesEdit(0)}
          tabIndex={tabIndexOf(stop, 0)}
          className={`${NAME_CELL} ${selectable(edits(0))} ${barOf(added, current)} ${FOCUS_RING}`}
        >
          <span className={`flex min-w-0 items-center gap-1.5 ${indentOf(row.level)}`}>
            {row.hasChildren ? <Chevron open={row.expanded} /> : <NoChevron />}
            {edits(0) ? editing?.editor : <Name row={row} mark={mark} />}
          </span>
        </td>
        {columns.map((column, at) => {
          const edited = edits(at + 1);
          const changed = !edited && mark?.fields.includes(column.field) === true;
          return (
            <td
              key={column.field}
              data-cell={at + 1}
              data-editable={takesEdit(at + 1)}
              data-change={changed ? "field" : undefined}
              tabIndex={tabIndexOf(stop, at + 1)}
              className={`${fieldClass(column, edited, changed)} ${selectable(edited)} ${FOCUS_RING}`}
            >
              {edited ? editing?.editor : textOf(column)}
            </td>
          );
        })}
        {pert === undefined ? null : (
          <ValueCells values={pert} first={1 + columns.length} stop={stop} added={added} />
        )}
      </tr>
      {editing?.error === undefined ? null : <FieldError editing={editing} cells={cells} />}
      {pert === undefined ? null : (
        <ValueError values={pert} cells={cells} added={added} current={current} />
      )}
    </>
  );
});
