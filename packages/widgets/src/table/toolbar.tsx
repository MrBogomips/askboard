// The Table's toolbar row (design decision 10; view-and-widgets spec: Adding and deleting rows, The
// Table at the keyboard): "Add row" and "Delete row" as `button-secondary`s, one Tab stop of its own
// with the arrow keys, Home and End among them (`toolbarFocus`, `toolbarStop`), then the counter of
// the user's changes at the row's right. A tool that cannot act is `aria-disabled` rather than
// `disabled`, so that one turning disabled under the focus keeps it. "Add row" at the row limit stays
// enabled and refuses, saying so beside the toolbar and in a polite live region. A Table with fixed
// rows has no tools, and a read-only Table shows its counter alone.

import { useStrings } from "@askboard/view/catalog";
import { type KeyboardEvent, useRef, useState } from "react";
import { toolbarFocus, toolbarMoveOf, toolbarStop } from "../shared/toolbar-focus.ts";
import { CHANGE_DOT, COUNTER, COUNTER_TEXT, REFUSAL, TOOL, TOOLBAR, TOOLS } from "./classes.ts";

export type ToolbarProps = {
  /** No tools: a read-only Table, or one with fixed rows. */
  readonly tools: boolean;
  /** An editor is open: both tools wait. */
  readonly editing: boolean;
  /** There is a current row to delete. */
  readonly canDelete: boolean;
  readonly changes: number;
  readonly counter: string;
  /** The refusal shown beside the toolbar, none while there is none. */
  readonly refusal: string | undefined;
  readonly onAdd: () => void;
  readonly onDelete: () => void;
};

export const TableToolbar = ({
  tools,
  editing,
  canDelete,
  changes,
  counter,
  refusal,
  onAdd,
  onDelete,
}: ToolbarProps) => {
  const text = useStrings();
  const [current, setCurrent] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = [!editing, !editing && canDelete];
  const stop = toolbarStop(enabled, current);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const move = toolbarMoveOf(event.key);
    const at = buttons.current.indexOf(event.target as HTMLButtonElement);
    if (move === undefined || at < 0) return;
    event.preventDefault();
    const next = toolbarFocus(enabled, at, move);
    setCurrent(next);
    buttons.current[next]?.focus();
  };
  const tool = (index: number, label: string, can: boolean, run: () => void) => (
    <button
      type="button"
      ref={(element) => {
        buttons.current[index] = element;
      }}
      aria-disabled={can ? undefined : true}
      tabIndex={stop === index ? 0 : -1}
      className={TOOL}
      onFocus={() => setCurrent(index)}
      onClick={() => {
        if (can) run();
      }}
    >
      {label}
    </button>
  );
  return (
    <div className={TOOLBAR}>
      {tools ? (
        <div
          role="toolbar"
          aria-label={text("table.toolbar")}
          data-table-tools=""
          className={TOOLS}
          onKeyDown={onKeyDown}
        >
          {tool(0, text("table.addRow"), enabled[0] === true, onAdd)}
          {tool(1, text("table.deleteRow"), enabled[1] === true, onDelete)}
        </div>
      ) : null}
      {refusal === undefined ? null : (
        <span data-refusal="" className={REFUSAL}>
          {refusal}
        </span>
      )}
      <p className={COUNTER} title={counter} data-counter="">
        {changes === 0 ? null : <span aria-hidden="true" className={CHANGE_DOT} />}
        <span className={COUNTER_TEXT}>{counter}</span>
      </p>
    </div>
  );
};
