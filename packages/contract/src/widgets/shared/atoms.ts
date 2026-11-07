// What the atoms share (atoms, design decision 1): the bounds of an atom's label, description,
// unit and numbers, and the length of a text in code points, which is how the schemas and the
// board count it. Plain ECMAScript with no JSON and no Ajv: a view chunk may import it.

/** An input atom's `label`, 1 to this many code points. */
export const ATOM_LABEL_MAX_CHARS = 200;
/** An input atom's optional `description`, 1 to this many code points. */
export const ATOM_DESCRIPTION_MAX_CHARS = 1_000;
/** A number an atom holds, a bound or a value, lies within this many either way. */
export const ATOM_NUMBER_BOUND = 1_000_000_000_000_000;
/** A unit, 1 to this many code points. */
export const ATOM_UNIT_MAX_CHARS = 20;

/** The length of `text` in code points, as the schemas' `maxLength` counts it. */
export const codePointCount = (text: string): number => [...text].length;
