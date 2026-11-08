// The shared annotation card (document-review, design decisions 7 and 9; DESIGN.md: Comment card):
// the card a pin opens, on `change-subtle` with a `change` border. A header label from the caller
// ("Comment 2" in a Document review, "Pin 2" or "Box 3" on an image) with, on the user's own
// annotation, "Edit" and "Delete" and a close control; then the comment, and for a caller that
// takes suggestions the replacement above the note. While the user writes, the fields write through
// the caller's callbacks as the user types (AD-9) and "Done" closes the card; a read-only card
// shows the text alone, with neither "Edit" nor "Delete". The card is a non-modal Radix Popover
// anchored to the pin the caller gives, as the DateField's calendar is; Escape and the close
// control close it, and focus returns to the target the caller names. Nothing here names a widget
// type. Text is rendered by React as text, never as markup.

import { useStrings } from "@askboard/view/catalog";
import { Popover } from "radix-ui";
import { type ReactElement, useEffect, useId, useRef, useState } from "react";
import {
  closeFocus,
  editPress,
  fieldInput,
  focusAfterEdit,
  openFocus,
  recordNode,
} from "./card-handlers.ts";
import {
  ACTIONS,
  BUTTON_LINK,
  CARD,
  CLOSE,
  DONE,
  FIELD,
  FIELD_LABEL,
  HEADER,
  HEADER_LABEL,
  TEXT,
  TEXTAREA,
} from "./classes.ts";

/** A field the card writes through: its text now, the way back, and the longest text it takes. */
export type CardField = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** The textarea's `maxLength`, in UTF-16 units, which a bound in code points never exceeds. */
  readonly max?: number;
};

export type CardBodyProps = {
  /** The header: "Comment 2", "Pin 2", "Box 3". */
  readonly label: string;
  /** The comment: the whole text of a comment-only card, the note of a suggested edit's. */
  readonly comment: CardField;
  /** The replacement; given only by a caller that takes suggestions. */
  readonly suggestion?: CardField;
  /** Whether the card opens with its fields, as a new annotation's does, or reading. */
  readonly startEditing: boolean;
  /** The user's own annotation can be deleted; absent, there is no "Delete". */
  readonly onDelete?: () => void;
  /** Whether "Edit" is offered while reading; true unless the caller says otherwise. */
  readonly editable?: boolean;
  /** Read-only (answered, locked, a Snapshot): the text alone, no "Edit", "Delete" or fields. */
  readonly readOnly?: boolean;
  readonly onClose: () => void;
};

const Written = ({ field, label }: { readonly field: CardField; readonly label?: string }) =>
  field.value === "" && label === undefined ? null : (
    <div className={FIELD}>
      {label === undefined ? null : <span className={FIELD_LABEL}>{label}</span>}
      {field.value === "" ? null : <p className={`m-0 ${TEXT}`}>{field.value}</p>}
    </div>
  );

const Editable = ({
  field,
  label,
  focus,
  fieldRef,
}: {
  readonly field: CardField;
  readonly label: string;
  readonly focus: boolean;
  readonly fieldRef?: (node: HTMLTextAreaElement | null) => void;
}) => {
  const id = useId();
  return (
    <div className={FIELD}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <textarea
        id={id}
        ref={fieldRef}
        data-annotation-focus={focus ? "" : undefined}
        className={TEXTAREA}
        value={field.value}
        maxLength={field.max}
        onChange={fieldInput(field)}
      />
    </div>
  );
};

/** What is inside the card: the header, then the text read or its fields, then "Done". */
export const CardBody = ({
  label,
  comment,
  suggestion,
  startEditing,
  onDelete,
  editable = true,
  readOnly = false,
  onClose,
}: CardBodyProps) => {
  const text = useStrings();
  const [writing, setWriting] = useState(startEditing);
  const switched = useRef(false);
  const first = useRef<HTMLTextAreaElement | null>(null);
  const editing = writing && !readOnly;
  // Pressing "Edit" puts focus in the first field, since the button that held it is gone.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the effect runs when `editing` turns true; the refs are read at that time.
  useEffect(focusAfterEdit(editing, switched, first), [editing]);
  return (
    <>
      <div className={HEADER}>
        <span className={HEADER_LABEL}>{label}</span>
        <div className={ACTIONS}>
          {!readOnly && !editing && editable ? (
            <button type="button" className={BUTTON_LINK} onClick={editPress(switched, setWriting)}>
              {text("annotations.edit")}
            </button>
          ) : null}
          {!readOnly && onDelete !== undefined ? (
            <button type="button" className={BUTTON_LINK} onClick={onDelete}>
              {text("annotations.delete")}
            </button>
          ) : null}
          <button
            type="button"
            className={CLOSE}
            aria-label={text("annotations.close")}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
      {editing ? (
        <>
          {suggestion === undefined ? null : (
            <Editable
              field={suggestion}
              label={text("annotations.replaceWith")}
              focus={true}
              fieldRef={recordNode(first)}
            />
          )}
          <Editable
            field={comment}
            label={text(suggestion === undefined ? "annotations.comment" : "annotations.note")}
            focus={suggestion === undefined}
            fieldRef={suggestion === undefined ? recordNode(first) : undefined}
          />
          <button type="button" className={DONE} onClick={onClose}>
            {text("annotations.done")}
          </button>
        </>
      ) : (
        <>
          {suggestion === undefined ? null : (
            <Written field={suggestion} label={text("annotations.replaceWith")} />
          )}
          <Written field={comment} />
        </>
      )}
    </>
  );
};

export type CardProps = CardBodyProps & {
  /** The pin the card anchors to, an element that takes a ref (the shared `Pin` does). */
  readonly anchor: ReactElement;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Where focus returns when the card closes: the pin, or the document when the pin is gone. */
  readonly returnFocus: () => HTMLElement | null | undefined;
};

/**
 * The card as a popover on its pin: non-modal, so it locks no scroll and adds no style element.
 * Opening puts focus in the first field, or on the card while reading; closing, by Escape, "Done"
 * or the close control, returns it to `returnFocus()`.
 */
export const Card = ({ anchor, open, onOpenChange, returnFocus, onClose, ...body }: CardProps) => {
  const content = useRef<HTMLDivElement | null>(null);
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Anchor asChild>{anchor}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          ref={content}
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          aria-label={body.label}
          className={CARD}
          onOpenAutoFocus={openFocus(content)}
          onCloseAutoFocus={closeFocus(returnFocus)}
        >
          <CardBody {...body} onClose={onClose} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
