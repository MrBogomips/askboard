// The LaTeX's registry entry (latex-kanban-timeline, design decision 3): its schemas, check, shape,
// wording, example and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a
// schema set module (the registry's import rule). A LaTeX gives no result and derives nothing: the
// user corrects its expression, which the answer reports as one `set` of the whole field.

import type { WidgetType } from "../registry.ts";
import { latexPropsProblems } from "./checks.ts";
import { LATEX_SHAPE } from "./constants.ts";
import latexChanges from "./latex-changes.json" with { type: "json" };
import latexProps from "./latex-props.json" with { type: "json" };
import { LATEX_EXPECTED, LATEX_FIELDS } from "./wording.ts";

export const LATEX_WIDGET: WidgetType = {
  type: "latex",
  noun: "a LaTeX",
  props: latexProps,
  propsProblems: latexPropsProblems,
  edits: { changes: latexChanges, shape: () => LATEX_SHAPE },
  wording: { expected: LATEX_EXPECTED, fields: LATEX_FIELDS },
  example: {
    item: {
      type: "latex",
      id: "formula",
      props: { expression: "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" },
    },
  },
  skill: {
    use: "one mathematical expression in LaTeX that the user reads and corrects, with a live preview",
    notes: [
      "The answer's change is one `set` of `<id>.expression`: the whole expression as the user wrote it, which may not parse.",
      "KaTeX renders it: `\\href`, `\\url` and `\\includegraphics` show no link or image, and no macro outlives the item.",
    ],
  },
};
