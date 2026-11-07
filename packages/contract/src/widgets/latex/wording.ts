// How a request's wording reads a LaTeX's props (latex-kanban-timeline, design decision 3): the
// expected shape and the field list of its one object, keyed `latex.props` and
// `latex.props.expression`. Nothing here validates.

import { LATEX_EXPRESSION_MAX_CHARS } from "./constants.ts";

export const LATEX_EXPRESSION_SHAPE = `text of 0 to ${LATEX_EXPRESSION_MAX_CHARS} characters, LaTeX source that may be empty`;

export const LATEX_EXPECTED: Readonly<Record<string, string>> = {
  "latex.props": "a LaTeX's props {expression}",
  "latex.props.expression": LATEX_EXPRESSION_SHAPE,
};

export const LATEX_FIELDS: Readonly<Record<string, string>> = {
  "latex.props": "a LaTeX's props hold only expression",
};
