// A start's or a duration's editor in its grid cell (EXPERIENCE Input atoms; DESIGN.md Input
// atoms, Field error): a text input, never the browser's date or number input, with the input
// colour's border and the focus ring, its text selected when it opens; no echo of the parsed value,
// which would cover the row's next cells (review F-09), the cell showing it once committed; and,
// once a commit was refused, the destructive border, the reason under the row naming it. Enter
// commits, Escape restores, and leaving the field commits; every other key is the field's.

import { type KeyboardEvent, useLayoutEffect, useRef } from "react";
import type { Editing } from "./editing.ts";
import { keyPressOf } from "./key-press.ts";
import { gridKeyAction } from "./model/keys.ts";

const INPUT =
  "h-[26px] w-full min-w-0 rounded-md border bg-card px-1 font-mono text-code text-foreground " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** The ID of the note under a task's row, which a refused editor is described by. */
export const noteId = (itemId: string, taskId: string): string => `${itemId}:${taskId}:note`;

type CellEditorProps = {
  readonly itemId: string;
  readonly editing: Editing;
  /** The editor's accessible name: the column and the task. */
  readonly label: string;
  readonly onChange: (text: string) => void;
  readonly onCommit: (refocus: boolean) => void;
  readonly onCancel: () => void;
};

export const CellEditor = ({
  itemId,
  editing,
  label,
  onChange,
  onCommit,
  onCancel,
}: CellEditorProps) => {
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const press = keyPressOf(event);
    if (press === undefined) return;
    const action = gridKeyAction(press, { mode: "edit", column: editing.column, editable: true });
    if (action === undefined) return;
    event.preventDefault();
    if (action.kind === "commit") onCommit(true);
    else if (action.kind === "cancel") onCancel();
  };
  const refused = editing.refusal !== undefined;
  return (
    <input
      ref={input}
      type="text"
      autoComplete="off"
      spellCheck={false}
      aria-label={label}
      aria-invalid={refused}
      aria-describedby={refused ? noteId(itemId, editing.taskId) : undefined}
      value={editing.text}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => onCommit(false)}
      className={`${INPUT} ${refused ? "border-destructive" : "border-input"}`}
    />
  );
};
