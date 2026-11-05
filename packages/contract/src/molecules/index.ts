// The molecule formats (AD-9, design decision 2): a molecule reference's props and the molecule
// definition format, with the rule that names an expanded item. Their schemas are
// `molecule-props.json` and `molecule-definition.json`, standalone until the input format reaches
// 1.1; their checks are in `checks.ts` and their validators in `validate.ts`. Plain ECMAScript
// with no JSON import.

/** The definition format this contract writes. */
export const MOLECULE_FORMAT_VERSION = "1.0.0";

/** The majors of the definition format this contract reads. */
export const MOLECULE_FORMATS_SUPPORTED: readonly number[] = /* @__PURE__ */ Object.freeze([1]);

/** A molecule's name, as both schemas state it. */
export const MOLECULE_NAME_PATTERN = "^[a-z][a-z0-9-]{0,63}$";

/**
 * A semantic version MAJOR.MINOR.PATCH, as both schemas state it: no leading zero, so that two
 * spellings never name one version, and at most nine digits a part, so that each compares as a
 * number.
 */
export const MOLECULE_VERSION_PATTERN =
  "^(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})$";

/** Between a reference's ID and its item's ID in an expanded item's ID (AD-9). */
export const EXPANDED_ID_SEPARATOR = "__";

/** The ID of the item a reference expands to: `wbs` and `tree` give `wbs__tree`. */
export const expandedItemId = (reference: string, item: string): string =>
  `${reference}${EXPANDED_ID_SEPARATOR}${item}`;

/** A molecule reference's props (AD-9, F2). */
export type MoleculeProps = {
  readonly molecule: string;
  /** Absent: the highest shipped version of the molecule's current major. */
  readonly version?: string;
  readonly data: Readonly<Record<string, unknown>>;
};

/**
 * How a fill puts its parameter's value at its pointer (design decision 3): absent, a deep copy;
 * `item`, the expanded item's ID when the value names a molecule reference of the ask;
 * `entries`, each value `v` of an object as `{[entries]: v}`; `omit`, a copy without those keys.
 */
export type MoleculeFillForm =
  | "item"
  | { readonly entries: string }
  | { readonly omit: readonly string[] };

export type MoleculeFill = {
  /** An RFC 6901 JSON Pointer into the definition's `items`. */
  readonly pointer: string;
  readonly as?: MoleculeFillForm;
};

/** The widget item a definition composes. */
export type MoleculeItem = {
  readonly type: string;
  readonly id: string;
  readonly props: Readonly<Record<string, unknown>>;
};

export type MoleculeDefinition = {
  readonly format: string;
  readonly molecule: string;
  readonly version: string;
  /** A JSON Schema 2020-12 whose `$id` is `urn:askboard:molecule:<molecule>:<major>`. */
  readonly parameters: Readonly<Record<string, unknown>>;
  /** Format 1.0.0 composes exactly one item. */
  readonly items: readonly [MoleculeItem];
  /** Per top-level parameter, the places it fills. */
  readonly fills: Readonly<Record<string, readonly MoleculeFill[]>>;
};
