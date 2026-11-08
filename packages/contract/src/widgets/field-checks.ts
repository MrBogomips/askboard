// The field checks of the input fields (form-widget, design decision 2; contract spec: Required
// fields, A TextField's length and pattern): what a field's props say its value must be, decided by
// one plain function per field type that the view runs as the user types and `ask-core` runs on the
// answer, never through the compute graph. A failure is a value's own and apart from fit: a result
// that fails only its check still fits its item (`widgetResultFits`), so the draft keeps it.
//
// Plain ECMAScript with no JSON, no Ajv and no registry import: the field chunks bundle it.

import type { Problem } from "../validate.ts";

/** Why a field's value fails its check; the view words it, `fieldCheckMessage` words it in English. */
export type FieldCheckFailure =
  | { readonly code: "required" }
  | { readonly code: "min-length"; readonly min: number }
  | { readonly code: "pattern" }
  | { readonly code: "min-items"; readonly min: number }
  | { readonly code: "max-items"; readonly max: number };

/**
 * `required` for a field with no result: only a boolean `true` in the props asks for one, and any
 * result satisfies it, `false` and `0` included (AD-10). Props that are no object ask for nothing.
 */
export const requiredFailure = (props: unknown, result: unknown): FieldCheckFailure | undefined =>
  typeof props === "object" &&
  props !== null &&
  !Array.isArray(props) &&
  Object.hasOwn(props, "required") &&
  (props as { readonly required?: unknown }).required === true &&
  result === undefined
    ? { code: "required" }
    : undefined;

/** The English wording of a failure, as a phrase that follows the field: what `ask-core` refuses with. */
export const fieldCheckMessage = (failure: FieldCheckFailure): string => {
  switch (failure.code) {
    case "required":
      return "is required and has no value";
    case "min-length":
      return `holds fewer than ${failure.min} characters`;
    case "pattern":
      return "does not match its pattern";
    case "min-items":
      return `needs at least ${failure.min} picks`;
    case "max-items":
      return `allows at most ${failure.max} picks`;
  }
};

/**
 * The prop a failure is a check of, as the schemas name it: what `ask-core`'s refusal names beside
 * the item, and what the board's wording of a failed field names. One table, exhaustive over the
 * codes, so a code added to `FieldCheckFailure` without its prop does not compile. The pattern
 * is a prop too, though `ask-core` never runs it.
 */
export const fieldCheckProp = (failure: FieldCheckFailure): string => {
  switch (failure.code) {
    case "required":
      return "required";
    case "min-length":
      return "minLength";
    case "pattern":
      return "pattern";
    case "min-items":
      return "minItems";
    case "max-items":
      return "maxItems";
  }
};

/**
 * What is wrong with the `required` prop of an input field: anything but a boolean. Each atom's
 * props check calls it, so that the five say the same.
 */
export const requiredPropProblems = (
  props: Readonly<Record<string, unknown>>,
): readonly Problem[] =>
  props.required !== undefined && typeof props.required !== "boolean"
    ? [{ path: "/required", message: "required is true or false" }]
    : [];
