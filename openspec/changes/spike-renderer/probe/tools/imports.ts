// AD-1's rule for `widgets`, applied to the probe's components/: a component imports only React,
// the port, files of components/ itself, and its own library. No component imports a renderer
// library, a renderer or the shell (AD-9).
//
// Usage, from probe/: bun tools/imports.ts   (exit 1 on a violation; --self-test checks the checker)

import { readdir } from "node:fs/promises";
import { join, normalize } from "node:path";

const COMPONENTS = join(import.meta.dir, "..", "components");
const RUNTIME = new Set(["react", "react/jsx-runtime", "react/jsx-dev-runtime"]);
const PORT = "../port/index.ts";

// Each component file's own library; later groups add theirs.
export const OWN_LIBRARIES: Record<string, string[]> = {
  "_dnd.tsx": ["@atlaskit/pragmatic-drag-and-drop/combine", "@atlaskit/pragmatic-drag-and-drop/element/adapter"],
  "_form.tsx": ["@rjsf/core", "@rjsf/utils", "radix-ui"],
  "_plantuml.tsx": ["@plantuml/core"],
  "_app-channel.tsx": ["@modelcontextprotocol/ext-apps"],
  "_zod-jitless.ts": ["zod"],
  "chart.tsx": ["echarts/charts", "echarts/components", "echarts/core", "echarts/renderers"],
  "choice.tsx": ["radix-ui"],
  "date-picker.tsx": ["radix-ui", "react-day-picker", "react-day-picker/style.css"],
  "dialog.tsx": ["radix-ui"],
  "diff-review.tsx": ["@pierre/diffs", "@pierre/diffs/react"],
  "form-ajv.tsx": ["@rjsf/validator-ajv8"],
  "graph.tsx": ["@dagrejs/dagre", "@xyflow/react", "@xyflow/react/dist/style.css"],
  "kanban.tsx": ["@atlaskit/pragmatic-drag-and-drop/element/adapter"],
  "markdown.tsx": ["dompurify", "markdown-it"],
  "math.tsx": ["katex", "katex/dist/katex.min.css"],
  "mathlive.tsx": ["mathlive", "mathlive/fonts.css"],
  "mermaid.tsx": ["mermaid", "dompurify"],
  // The safe pattern subset is AskBoard's own check, shared with ask-core (S-8).
  "pattern.tsx": ["../pattern-check.ts"],
  "plantuml.tsx": ["@plantuml/core/viz-global.js"],
  "popover.tsx": ["radix-ui"],
  "ranking.tsx": ["@atlaskit/pragmatic-drag-and-drop/element/adapter", "@atlaskit/pragmatic-drag-and-drop/reorder"],
  "scroll-lock.tsx": ["../styles/scroll-lock.css"],
  "select.tsx": ["radix-ui"],
  "slider.tsx": ["radix-ui"],
  "table.tsx": ["@tanstack/react-table"],
  "tabs.tsx": ["radix-ui"],
  "toggle-group.tsx": ["radix-ui"],
  "toggle.tsx": ["radix-ui"],
};

const transpiler = new Bun.Transpiler({ loader: "tsx" });

export const violationsIn = (file: string, source: string): string[] => {
  const own = new Set(OWN_LIBRARIES[file] ?? []);
  return transpiler
    .scanImports(source)
    .map((entry) => entry.path)
    .filter((path) => {
      if (RUNTIME.has(path) || path === PORT || own.has(path)) return false;
      // A relative import that stays inside components/.
      return !(path.startsWith("./") && !normalize(path).startsWith(".."));
    })
    .map((path) => `${file}: imports ${path}`);
};

const selfTest = (): void => {
  const bad = 'import { Renderer } from "@json-render/react";\nimport "../shell/shell.tsx";\n';
  const good = 'import { register } from "../port/index.ts";\nimport { Field } from "./_field.tsx";\n';
  const found = violationsIn("example.tsx", bad);
  if (found.length !== 2 || violationsIn("example.tsx", good).length !== 0) {
    throw new Error(`self-test failed: ${JSON.stringify(found)}`);
  }
  console.log("imports self-test: a renderer import and a shell import are flagged, the port is not");
};

const main = async (): Promise<void> => {
  if (process.argv.includes("--self-test")) selfTest();
  const files = (await readdir(COMPONENTS)).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
  const problems = (
    await Promise.all(files.map(async (f) => violationsIn(f, await Bun.file(join(COMPONENTS, f)).text())))
  ).flat();
  for (const problem of problems) console.error(problem);
  console.log(`imports: ${files.length} files in components/, ${problems.length} violation(s)`);
  if (problems.length > 0) process.exit(1);
};

if (import.meta.main) await main();
