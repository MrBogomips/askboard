// The wording of a failed field check under its field (form-widget, design decision 6; DESIGN.md,
// Field error): the string a failure shows, or none. The prop a failure is a check of comes from the
// contract's one table (`fieldCheckProp`), so the view restates no code-to-prop map. An empty
// required field has no error (the label's "(required)" and "Answer"'s description ask for it),
// and a failure of a field's own bounds is the entry's, not a check's.

import { type FieldCheckFailure, fieldCheckProp } from "@askboard/contract";
import type { Say } from "../port.ts";

/** The field error of a failure, in the ask's language; none for `required`. */
export const fieldErrorOf = (
  failure: FieldCheckFailure | undefined,
  say: Say,
): string | undefined => {
  if (failure === undefined) return undefined;
  switch (fieldCheckProp(failure)) {
    case "minLength":
      return failure.code === "min-length"
        ? say("field.minLength", { min: failure.min })
        : undefined;
    case "pattern":
      return say("field.pattern");
    case "minItems":
      return failure.code === "min-items" ? say("field.minItems", { min: failure.min }) : undefined;
    case "maxItems":
      return failure.code === "max-items" ? say("field.maxItems", { max: failure.max }) : undefined;
    default:
      return undefined;
  }
};
