// The Tree's cell editing (design decision 6; spec, "Tree editing"): Enter or F2 opens the editor
// on the focused name or field, a row's name when the row has the focus. A commit goes through
// `entry.ts`: a value that changes goes in the draft, or `undefined` once the nodes are the
// agent's again (`sameNodes`), so that "Answer" turns off; nothing leaves the view (AD-9). A
// refused entry on Enter keeps the editor, its focus and the draft, and shows its reason under the
// row; leaving a refused entry closes the editor and changes nothing. A read-only Tree edits
// nothing.

import type { TreeProps } from "@askboard/contract";
import { useState } from "react";
import { NAME_COLUMN } from "./cells.ts";
import { CellEditor, type CommitBy } from "./editor.tsx";
import { type EntryKind, enterCell, entryKindOf, startTextOf } from "./entry.ts";
import type { TreeFocus } from "./model/focus.ts";
import { sameNodes } from "./model/marks.ts";
import type { TreeRow } from "./model/rows.ts";
import type { RowEditing } from "./row.tsx";

type Editing = {
  readonly nodeId: string;
  readonly cell: number;
  readonly kind: EntryKind;
  readonly error?: string | undefined;
};

/** The edited cell as the grid hands it to its row. */
export type GridEditing = RowEditing & { readonly nodeId: string };

// The editor's name: the column, then the node's name, as in "Optimistic of Customer portal".
const labelOf = (value: TreeProps, row: TreeRow, cell: number): string =>
  `${cell === 0 ? NAME_COLUMN : (value.columns?.[cell - 1]?.label ?? "")} of ${row.node.label}`;

export const useCellEditing = ({
  itemId,
  sent,
  value,
  rows,
  disabled,
  onValueChange,
  onClosed,
}: {
  readonly itemId: string;
  /** The agent's props, against which an edited value is the agent's again. */
  readonly sent: TreeProps;
  readonly value: TreeProps;
  readonly rows: readonly TreeRow[];
  readonly disabled: boolean;
  readonly onValueChange: (value: TreeProps | undefined) => void;
  /** The editor closed: the focus goes back to the Tab stop after Enter or Escape. */
  readonly onClosed: (moveFocus: boolean) => void;
}) => {
  const [state, setState] = useState<Editing | undefined>(undefined);
  const row = state === undefined ? undefined : rows.find((one) => one.node.id === state.nodeId);
  const editing = disabled || row === undefined ? undefined : state;

  const start = (at: TreeFocus): void => {
    const cell = at.cell ?? 0;
    const kind = entryKindOf(value.columns, cell);
    if (!disabled && kind !== undefined) setState({ nodeId: at.nodeId, cell, kind });
  };
  const close = (moveFocus: boolean): void => {
    setState(undefined);
    onClosed(moveFocus);
  };
  const commit = (text: string, by: CommitBy): boolean => {
    if (editing === undefined) return true;
    const entry = enterCell(value, editing.nodeId, editing.cell, text);
    if (entry.kind === "refused" && by === "enter") {
      setState({ ...editing, error: entry.reason });
      return false;
    }
    if (entry.kind === "value" && entry.value !== value) {
      onValueChange(sameNodes(sent, entry.value) ? undefined : entry.value);
    }
    close(by === "enter");
    return true;
  };
  const onEdit = (): void => {
    if (editing?.error !== undefined) setState({ ...editing, error: undefined });
  };

  const errorId = `${itemId}:field-error`;
  const grid: GridEditing | undefined =
    editing === undefined || row === undefined
      ? undefined
      : {
          nodeId: editing.nodeId,
          cell: editing.cell,
          error: editing.error,
          errorId,
          editor: (
            <CellEditor
              key={`${editing.nodeId}:${editing.cell}`}
              kind={editing.kind}
              initial={startTextOf(value.columns, row.node, editing.cell)}
              label={labelOf(value, row, editing.cell)}
              error={editing.error}
              errorId={errorId}
              onCommit={commit}
              onCancel={() => close(true)}
              onEdit={onEdit}
            />
          ),
        };
  return { editing: grid, start };
};
