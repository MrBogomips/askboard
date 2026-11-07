// What the board's scan and KaTeX's output tree say of an expression, measured in Bun (latex-kanban-
// timeline, task 4.15): the scan's depth, whether KaTeX parses it, and the output tree's depth, node
// count and nested fractions through `renderTree` and `treeSizeOf`. The view package does not depend on the widgets,
// so the module is bundled from the widgets' sources and loaded from a temporary file, as the
// frame's script is bundled for the browser. No DOM: the tree is measured, never drawn.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WIDGETS = join(import.meta.dir, "../../../../widgets");

/** The widgets' LaTeX modules, where the frame's script and the Bun bundle read them. */
export const LATEX_SOURCES = {
  render: join(WIDGETS, "src/latex/render.ts"),
  tree: join(WIDGETS, "src/latex/tree.ts"),
  contract: Bun.resolveSync("@askboard/contract", WIDGETS),
  katex: Bun.resolveSync("katex", WIDGETS),
  widgets: WIDGETS,
};

/** What Bun says of one expression. */
export type Measure = {
  readonly scanDepth: number;
  readonly refused?: string;
  /** Whether KaTeX builds an output tree for it with the render options. */
  readonly parses: boolean;
  readonly error?: string;
  readonly treeDepth?: number;
  readonly nodes?: number;
  /** The most MathML fractions nested on one path of the tree. */
  readonly fractions?: number;
  /** The time of the scan, `renderTree` and `treeSizeOf` in Bun, in milliseconds. */
  readonly beforeMs: number;
};

export type Measurer = (expression: string) => Measure;

/** Bundles the scan, the render options and the tree's functions for Bun and returns the measurer. */
export const loadMeasurer = async (): Promise<Measurer> => {
  const folder = await mkdtemp(join(tmpdir(), "askboard-latex-measure-"));
  try {
    const entry = join(folder, "entry.ts");
    await writeFile(
      entry,
      `import { scanLatex } from ${JSON.stringify(LATEX_SOURCES.contract)};
import { renderOptions } from ${JSON.stringify(LATEX_SOURCES.render)};
import { renderTree, treeSizeOf } from ${JSON.stringify(LATEX_SOURCES.tree)};
const quiet = () => undefined;
const measured = (expression: string) => {
  const started = performance.now();
  const { refused, depth: scanDepth } = scanLatex(expression);
  try {
    const size = treeSizeOf(renderTree(expression, renderOptions()));
    return { scanDepth, refused, parses: true, treeDepth: size.depth, nodes: size.nodes, fractions: size.fractions, beforeMs: performance.now() - started };
  } catch (error) {
    return { scanDepth, refused, parses: false, error: String(error instanceof Error ? error.message : error).slice(0, 120), beforeMs: performance.now() - started };
  }
};
export const measure = (expression: string) => {
  // KaTeX's \\message, \\errmessage and \\show print to the console.
  const log = console.log;
  console.log = quiet;
  try {
    return measured(expression);
  } finally {
    console.log = log;
  }
};
`,
    );
    const built = await Bun.build({
      entrypoints: [entry],
      target: "bun",
      format: "esm",
      outdir: folder,
      naming: "measure.mjs",
    });
    if (!built.success) throw new Error(built.logs.map(String).join("\n"));
    // Imported from a temporary folder that bunfig.toml keeps out of the coverage tables.
    const loaded = (await import(join(folder, "measure.mjs"))) as { measure: Measurer };
    return loaded.measure;
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
};
