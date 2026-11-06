// The Tree's cell editing (design decision 6; spec, "Tree editing" and "Tree adding nodes"): Enter
// or F2 opens the editor on the focused name or field, a row's name when the row has the focus, and
// a double click on a cell opens it on that cell, and an add opens it on the new node's empty name
// (`adding.ts`), the node showing only until its name is committed. A commit goes through
// `entry.ts`: a value that changes goes in the draft, or `undefined` once the nodes are the agent's
// again (`sameNodes`), so that "Answer" turns off; nothing leaves the view (AD-9). A refused entry
// on Enter keeps the editor, its focus and the draft, and shows its reason under the row; leaving a
// refused entry closes the editor and changes nothing, which takes a new node away. A read-only Tree
// edits nothing: when the Tree turns read-only (answered, being sent or locked), the edit under way
// is dropped, a new node with it, and nothing it held goes in the draft, so it does not come back if
// the Tree turns editable again.

import type { TreeProps } from "@askboard/contract";
import { useLanguage, useLocale } from "@askboard/view/catalog";
import { useMemo, useState } from "react";
import { enterNewName, type PendingAdd, withPending } from "./adding.ts";
import { affixOf, nameColumnOf } from "./cells.ts";
import { CellEditor, type CommitBy } from "./editor.tsx";
import { type EntryKind, enterCell, entryKindAt, startTextOf } from "./entry.ts";
import { nextNodeId } from "./model/edits.ts";
import type { TreeFocus } from "./model/focus.ts";
import { sameNodes } from "./model/marks.ts";
import { type TreeRow, visibleRows } from "./model/rows.ts";
import type { RowEditing } from "./row.tsx";

type Editing = {
  readonly nodeId: string;
  readonly cell: number;
  readonly kind: EntryKind;
  readonly error?: string | undefined;
  /** The add whose new node, `nodeId`, has its name entered. */
  readonly add?: PendingAdd | undefined;
};

/** The edited cell as the grid hands it to its row. */
export type GridEditing = RowEditing & { readonly nodeId: string };

// The editor's name: the column, then the node's name, as in "Optimistic of Customer portal".
const labelOf = (value: TreeProps, row: TreeRow, cell: number): string =>
  `${columnOf(value, cell)} of ${row.node.label}`;

// The edited column's name, which a field error begins with.
const columnOf = (value: TreeProps, cell: number): string =>
  cell === 0 ? nameColumnOf(value) : (value.columns?.[cell - 1]?.label ?? "");

export const useCellEditing = ({
  itemId,
  sent,
  value,
  collapsed,
  disabled,
  onValueChange,
  onCommitAdd,
  onClosed,
}: {
  readonly itemId: string;
  /** The agent's props, against which an edited value is the agent's again. */
  readonly sent: TreeProps;
  readonly value: TreeProps;
  /** The collapsed nodes, from the view. */
  readonly collapsed: ReadonlySet<string>;
  readonly disabled: boolean;
  readonly onValueChange: (value: TreeProps | undefined) => void;
  /**
   * Writes the value `next` once the add's new node `added` is named, with its linked edits, or
   * returns the field error that refuses it, writing nothing (`linked.ts`).
   */
  readonly onCommitAdd: (next: TreeProps, added: string, add: PendingAdd) => string | undefined;
  /**
   * The editor closed: the focus goes back to the Tab stop after Enter or Escape. `takenAway` is
   * the add whose new node went with it.
   */
  readonly onClosed: (moveFocus: boolean, takenAway?: PendingAdd) => void;
}) => {
  const [state, setState] = useState<Editing | undefined>(undefined);
  // Numbers are read and shown in the ask's locale, and refused in its language.
  const locale = useLocale();
  const language = useLanguage();
  // Dropped during this render, so the Tree never shows the edit once read-only.
  if (disabled && state !== undefined) setState(undefined);
  const add = disabled ? undefined : state?.add;
  const shown = useMemo(() => withPending(value, add), [value, add]);
  const rows = useMemo(() => visibleRows(shown.nodes, collapsed), [shown.nodes, collapsed]);
  const row = state === undefined ? undefined : rows.find((one) => one.node.id === state.nodeId);
  const editing = disabled || row === undefined ? undefined : state;

  const start = (at: TreeFocus): void => {
    const cell = at.cell ?? 0;
    const kind = entryKindAt(value, at.nodeId, cell);
    if (!disabled && kind !== undefined) setState({ nodeId: at.nodeId, cell, kind });
  };
  const startAdd = (pending: PendingAdd): void => {
    if (!disabled) setState({ nodeId: nextNodeId(value), cell: 0, kind: "name", add: pending });
  };
  const close = (moveFocus: boolean, takenAway?: PendingAdd): void => {
    setState(undefined);
    onClosed(moveFocus, takenAway);
  };
  // A changed value goes in the draft, an added node's through its linked write, which may refuse.
  const write = (next: TreeProps, add: PendingAdd | undefined, nodeId: string) => {
    if (add !== undefined) return onCommitAdd(next, nodeId, add);
    onValueChange(sameNodes(sent, next) ? undefined : next);
    return undefined;
  };
  const commit = (text: string, by: CommitBy): boolean => {
    if (editing === undefined) return true;
    const entry =
      editing.add === undefined
        ? enterCell(value, editing.nodeId, editing.cell, text, locale, language)
        : enterNewName(value, editing.add, text);
    const changed = entry.kind === "value" && entry.value !== value;
    const reason =
      entry.kind === "refused"
        ? entry.reason
        : changed
          ? write(entry.value, editing.add, editing.nodeId)
          : undefined;
    if (reason !== undefined && by === "enter") {
      setState({ ...editing, error: reason });
      return false;
    }
    close(by === "enter", changed && reason === undefined ? undefined : editing.add);
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
          column: columnOf(value, editing.cell),
          error: editing.error,
          errorId,
          editor: (
            <CellEditor
              key={`${editing.nodeId}:${editing.cell}`}
              kind={editing.kind}
              initial={
                editing.add === undefined
                  ? startTextOf(value.columns, row.node, editing.cell, locale)
                  : ""
              }
              label={labelOf(value, row, editing.cell)}
              error={editing.error}
              errorId={errorId}
              onCommit={commit}
              onCancel={() => close(true, editing.add)}
              onEdit={onEdit}
              affix={affixOf(value, editing.cell)}
            />
          ),
        };
  return {
    rows,
    editing: grid,
    start,
    startAdd,
    /** The add whose new node the Tree, turned read-only, takes away in this render. */
    dropped: disabled ? state?.add : undefined,
  };
};
