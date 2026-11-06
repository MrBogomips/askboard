// Where a grid's field error sits under its row (DESIGN Field error; review F-10): indented to the
// edited cell when at least two columns remain for it, and across the whole row otherwise. Plain
// ECMAScript.

/** How many columns the error leaves empty before it, and how many it spans. */
export type ErrorSpan = { readonly skip: number; readonly span: number };

/** The columns an edited cell's error spans: from the cell on when there is room, else all. */
export const errorSpan = (cell: number, cells: number): ErrorSpan =>
  cells - cell >= 2 ? { skip: cell, span: cells - cell } : { skip: 0, span: cells };
