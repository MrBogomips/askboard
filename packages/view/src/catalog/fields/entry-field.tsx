// The control of a NumberField and a MoneyField (atoms, design decisions 3 and 7; DESIGN.md, Input
// atoms, Field error): a text input, never `type="number"`, with the unit or currency as an affix, and
// under it the echo of the value the text reads as and the field error, which the input is described
// by and marked invalid for. Read-only, as when answered, it shows the value formatted and neither.

import type { ReactNode } from "react";
import { AFFIX, ECHO, FIELD_ERROR, GROUP, GROUP_INPUT, NOTES } from "./classes.ts";
import { fieldIds } from "./field.tsx";
import { typed } from "./text.ts";

type EntryFieldProps = {
  readonly itemId: string;
  readonly text: string;
  readonly onText: (text: string) => void;
  readonly readOnly: boolean;
  /** The unit, or the currency code once there is one. */
  readonly affix: string | undefined;
  readonly echo: string | undefined;
  readonly error: string | undefined;
  readonly hasDescription: boolean;
  /** The field is required and may still be filled: the input is marked required. */
  readonly required?: boolean;
  /** What sits after the input: the currency control, the calendar button. */
  readonly after?: ReactNode;
  /** The keyboard the input asks for on a touch device: `decimal` for amounts, `numeric` for dates. */
  readonly inputMode?: "decimal" | "numeric";
};

export const EntryField = ({
  itemId,
  text,
  onText,
  readOnly,
  affix,
  echo,
  error,
  hasDescription,
  required = false,
  after,
  inputMode = "decimal",
}: EntryFieldProps) => {
  const ids = fieldIds(itemId);
  const noteId = `${itemId}:note`;
  const describedBy = [
    ...(hasDescription ? [ids.description] : []),
    ...(error !== undefined ? [ids.error] : []),
    ...(echo !== undefined ? [noteId] : []),
  ].join(" ");
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-sm">
        <div className={GROUP}>
          <input
            type="text"
            inputMode={inputMode}
            id={ids.control}
            value={text}
            readOnly={readOnly}
            autoComplete="off"
            aria-required={required ? true : undefined}
            aria-invalid={error === undefined ? undefined : true}
            aria-describedby={describedBy === "" ? undefined : describedBy}
            className={GROUP_INPUT}
            onChange={typed(onText)}
          />
          {affix === undefined ? null : <span className={AFFIX}>{affix}</span>}
        </div>
        {after}
      </div>
      {echo === undefined && error === undefined ? null : (
        <div className={NOTES}>
          {echo === undefined ? null : (
            <span id={noteId} className={ECHO}>
              {echo}
            </span>
          )}
          {error === undefined ? null : (
            <p id={ids.error} className={FIELD_ERROR}>
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
};
