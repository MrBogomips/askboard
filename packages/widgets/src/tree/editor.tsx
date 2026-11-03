// The Tree's cell editor (design decision 6; DESIGN.md and EXPERIENCE, Input atoms): a text input
// in place of the cell's text, opening with the name or the field selected. Enter commits and
// Escape cancels (`keys.ts`); leaving the input commits too, but the window or the view's frame
// losing the focus is no leaving: the input stays its document's focus; every other key stays
// with the input.
// A number field is a text input read by AskBoard's own en-US parser, never `type="number"`, its
// parsed value echoed under the input in the code face ("= 1234.5"), since a field's column is too
// narrow to hold both side by side.

import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { numberEcho, parseNumber } from "../shared/number.ts";
import { AFFIX, AFFIX_GROUP, ECHO, EDITOR, EDITOR_BOX, NUMBER_EDITOR } from "./classes.ts";
import type { EntryKind } from "./entry.ts";
import { treeKeyOf } from "./key-event.ts";
import { keyAction } from "./model/keys.ts";

/** How an entry is committed: Enter, which keeps a refused entry open, or leaving the input. */
export type CommitBy = "enter" | "leave";

export type CellEditorProps = {
  readonly kind: EntryKind;
  readonly initial: string;
  /** The input's name: the column and the node it edits. */
  readonly label: string;
  /** The field error under the row, which describes the input while it shows. */
  readonly error: string | undefined;
  readonly errorId: string;
  /** Commits the text; returns whether the editor closes. */
  readonly onCommit: (text: string, by: CommitBy) => boolean;
  readonly onCancel: () => void;
  /** The text changed, so a field error no longer applies. */
  readonly onEdit: () => void;
  /** The unit kept beside the input, as a work breakdown's estimate keeps `d`; none elsewhere. */
  readonly affix?: string | undefined;
};

export const CellEditor = ({
  kind,
  initial,
  label,
  error,
  errorId,
  onCommit,
  onCancel,
  onEdit,
  affix,
}: CellEditorProps) => {
  const [text, setText] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  // Set once the editor has committed or cancelled, or is being taken out, as when the Tree turns
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
    const action = keyAction(treeKeyOf(event), "edit");
    if (action === undefined) return;
    event.preventDefault();
    if (action.kind === "cancel") {
      closed.current = true;
      onCancel();
    } else if (action.kind === "commit") {
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

  const parsed = kind === "number" ? parseNumber(text) : undefined;
  const field = (
    <input
      ref={input}
      type="text"
      value={text}
      aria-label={label}
      aria-invalid={error !== undefined}
      aria-describedby={error === undefined ? undefined : errorId}
      autoComplete="off"
      spellCheck={false}
      className={kind === "number" ? NUMBER_EDITOR : EDITOR}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onChange={onChange}
    />
  );
  return (
    <span className={EDITOR_BOX}>
      {affix === undefined ? (
        field
      ) : (
        <span className={AFFIX_GROUP}>
          {field}
          <span aria-hidden="true" className={AFFIX}>
            {affix}
          </span>
        </span>
      )}
      {parsed?.kind === "number" ? <span className={ECHO}>{numberEcho(parsed.value)}</span> : null}
    </span>
  );
};
