// The widgets' LaTeX modules and KaTeX's stylesheet, where the browser frame's script and its
// styles are read from (latex-kanban-timeline, task 4.15; latex-public-api, task 3.1). The view
// package does not depend on the widgets, so the frame bundles their sources, as the build bundles
// the `latex` chunk. Nothing here reads KaTeX's script.

import { join } from "node:path";

const WIDGETS = join(import.meta.dir, "../../../../widgets");

/** The widgets' LaTeX modules, where the frame's script reads them. */
export const LATEX_SOURCES = {
  render: join(WIDGETS, "src/latex/render.ts"),
  widgets: WIDGETS,
};
