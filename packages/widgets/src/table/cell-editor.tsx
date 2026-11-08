// The Table's cell editor (design decision 9; view-and-widgets spec: Editing a cell): a text input
// in place of the cell's text, never `type="number"`, opening with the text selected and echoing
// what the typed text reads as. Enter commits, and a refused entry keeps the editor open with its
// reason; Escape cancels; leaving the input commits too, but the window or the view's frame losing
// the focus is no leaving. A key with a modifier, and Enter that confirms an input method's
// candidate (`isComposing`, WebKit's `keyCode` 229), is not a commit. The input is named by its
// column and row, and described by its field error while one shows.

import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ECHO, EDITOR, EDITOR_BOX, NUMBER_EDITOR } from "./classes.ts";

/** How a text is committed: Enter, which keeps a refused entry open, or leaving the input. */
export type CommitBy = "enter" | "leave";

export type CellEditorProps = {
  readonly numeric: boolean;
  readonly initial: string;
  readonly label: string;
  /** The field error under the row, which describes the input while it shows. */
  readonly error: string | undefined;
  readonly errorId: string;
  /** What the typed text reads as, for the echo. */
  readonly echoOf: (text: string) => string | undefined;
  /** Commits the text; returns whether the editor closes. */
  readonly onCommit: (text: string, by: CommitBy) => boolean;
  readonly onCancel: () => void;
  /** The text changed, so a field error no longer applies. */
  readonly onEdit: () => void;
};

const composing = (event: KeyboardEvent<HTMLInputElement>): boolean =>
  event.nativeEvent.isComposing || event.keyCode === 229;

export const CellEditor = ({
  numeric,
  initial,
  label,
  error,
  errorId,
  echoOf,
  onCommit,
  onCancel,
  onEdit,
}: CellEditorProps) => {
  const [text, setText] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  // Set once the editor has committed or cancelled, or is being taken out, as when the Table turns
  // read-only, so that the blur of its removal commits nothing (AD-10).
  const closed = useRef(false);
  useLayoutEffect(() => {
    closed.current = false;
    input.current?.focus();
    input.current?.select();
    return () => {
      closed.current = true;
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (composing(event) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closed.current = true;
      onCancel();
    } else if (event.key === "Enter") {
      event.preventDefault();
      closed.current = onCommit(text, "enter");
    }
  };
  const onBlur = (event: FocusEvent<HTMLInputElement>): void => {
    const field = event.currentTarget;
    if (closed.current || field.ownerDocument.activeElement === field) return;
    closed.current = true;
    onCommit(text, "leave");
  };
  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setText(event.target.value);
    onEdit();
  };
  const echo = echoOf(text);
  return (
    <span className={EDITOR_BOX}>
      <input
        ref={input}
        type="text"
        value={text}
        aria-label={label}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : errorId}
        autoComplete="off"
        spellCheck={false}
        className={numeric ? NUMBER_EDITOR : EDITOR}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onChange={onChange}
      />
      {echo === undefined ? null : (
        <span data-echo="" className={ECHO}>
          {echo}
        </span>
      )}
    </span>
  );
};
