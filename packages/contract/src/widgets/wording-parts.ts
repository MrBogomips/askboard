// What the widgets' wording tables share (widget-registry, design decision 5): the ID shape and
// the text phrase of the input format's wording, and a path segment's test. A leaf module: the
// entries' wording imports it, and `ask-items.ts` re-exports the two phrases, so that no entry
// module imports `ask-items.ts`, which builds its lists from the registry.

export const ID_SHAPE = "an ID of 1 to 64 characters from A-Z, a-z, 0-9, _ and -";
export const text = (max: number) => `text of 1 to ${max} characters`;

/** Whether a path segment is an array index. */
export const isIndex = (segment: string | undefined): boolean =>
  segment !== undefined && /^(0|[1-9][0-9]*)$/.test(segment);
