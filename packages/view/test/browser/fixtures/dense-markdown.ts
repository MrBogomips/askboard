// The densest Markdown a Text may hold (atoms, task 5.12; pre-PR review X-1): markdown-it pads a
// table row with fewer cells than the header up to the header's width, so a header of `columns`
// cells and `rows` rows of a lone `|` gives `columns * rows` empty cells from a short source.

/** A table of `columns` header cells and `rows` short rows that markdown-it pads. */
export const paddedTable = (columns: number, rows: number): string => {
  const head = `|${"a|".repeat(columns)}`;
  const rule = `|${"-|".repeat(columns)}`;
  return [head, rule, ...Array.from({ length: rows }, () => "|")].join("\n");
};

/** 100 columns by 190 short rows: about 19,000 elements from under 1,000 code points. */
export const DENSE_TABLE = paddedTable(100, 190);

/** A list of empty items near the code-point limit. */
export const EMPTY_ITEMS = "-\n".repeat(4_999);
