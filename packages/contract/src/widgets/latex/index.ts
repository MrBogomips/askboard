// The LaTeX (FR-11, latex-kanban-timeline): one mathematical expression the user reads and
// corrects, with a live preview the board draws. Its schemas are standalone: they belong to no
// schema set until the entry is registered (design decision 12), and nothing compiles them when
// this module loads.

export { cutLatexExpression, latexPropsProblems } from "./checks.ts";
export {
  LATEX_DEFINING_COMMANDS,
  LATEX_EXPRESSION_MAX_CHARS,
  LATEX_LEVEL_CLOSERS,
  LATEX_LEVEL_OPENERS,
  LATEX_NESTING_MAX_DEPTH,
  LATEX_RAW_TOKEN_COMMANDS,
  LATEX_SCHEMA_IDS,
  LATEX_SHAPE,
  type LatexChange,
  type LatexItem,
  type LatexProps,
} from "./constants.ts";
export { type LatexScan, scanLatex } from "./scan.ts";
export { LATEX_WIDGET } from "./widget.ts";
