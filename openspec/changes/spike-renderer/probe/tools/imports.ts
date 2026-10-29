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
  "choice.tsx": ["radix-ui"],
  "tabs.tsx": ["radix-ui"],
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
