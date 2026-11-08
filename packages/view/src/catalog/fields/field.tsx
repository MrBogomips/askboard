// The frame every input atom's control sits in (atoms, design decision 7; DESIGN.md, Input atoms):
// its label, visible, and its description under it, which the control is described by. The IDs are
// built from the item's, which holds no `:`, so no two fields clash. Agent text is text (AD-8).

import type { ReactNode } from "react";
import { useStrings } from "../port.ts";
import { DESCRIPTION, FIELD, LABEL, REQUIRED_MARK } from "./classes.ts";

/** The DOM IDs of an item's control, its label, its description, its state text and its field error. */
export const fieldIds = (itemId: string) => ({
  control: `${itemId}:field`,
  label: `${itemId}:label`,
  description: `${itemId}:description`,
  state: `${itemId}:state`,
  error: `${itemId}:error`,
});

type FieldProps = {
  readonly itemId: string;
  readonly label: string;
  readonly description: string | undefined;
  /**
   * The field is required and may still be filled (form-widget, design decision 6): the label ends
   * with "(required)" in its own span, as text. The control carries `aria-required` itself. Read-only
   * fields ask for nothing and pass none.
   */
  readonly required?: boolean;
  readonly children: ReactNode;
};

/** The "(required)" mark after a label; the text comes from the string tables. */
export const RequiredMark = () => {
  const text = useStrings();
  return <span className={REQUIRED_MARK}>{text("field.required")}</span>;
};

export const Field = ({ itemId, label, description, required = false, children }: FieldProps) => {
  const ids = fieldIds(itemId);
  return (
    <div data-askboard-field={itemId} className={FIELD}>
      <label id={ids.label} htmlFor={ids.control} className={LABEL}>
        {label}
        {required ? (
          <>
            {" "}
            <RequiredMark />
          </>
        ) : null}
      </label>
      {description === undefined ? null : (
        <p id={ids.description} className={DESCRIPTION}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
};
