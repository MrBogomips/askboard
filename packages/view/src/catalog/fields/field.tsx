// The frame every input atom's control sits in (atoms, design decision 7; DESIGN.md, Input atoms):
// its label, visible, and its description under it, which the control is described by. The IDs are
// built from the item's, which holds no `:`, so no two fields clash. Agent text is text (AD-8).

import type { ReactNode } from "react";
import { DESCRIPTION, FIELD, LABEL } from "./classes.ts";

/** The DOM IDs of an item's control, its label, its description and its state text. */
export const fieldIds = (itemId: string) => ({
  control: `${itemId}:field`,
  label: `${itemId}:label`,
  description: `${itemId}:description`,
  state: `${itemId}:state`,
});

type FieldProps = {
  readonly itemId: string;
  readonly label: string;
  readonly description: string | undefined;
  readonly children: ReactNode;
};

export const Field = ({ itemId, label, description, children }: FieldProps) => {
  const ids = fieldIds(itemId);
  return (
    <div data-askboard-field={itemId} className={FIELD}>
      <label id={ids.label} htmlFor={ids.control} className={LABEL}>
        {label}
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
