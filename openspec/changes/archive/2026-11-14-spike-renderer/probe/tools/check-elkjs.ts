// S-1 (task 3.1): elkjs, an excluded trap (SOLUTION-DESIGN §9), must not reach the Mermaid chunk.
// Reads dist/manifest.json (`bun run build` first) and checks that no input of any chunk is an
// elkjs file, that the Mermaid chunk lists elkjs as replaced by an empty module, and that the
// chunk holds none of the identifiers only elkjs's code carries. As a control it builds the same
// entry without the replacement, in memory, and shows the identifiers there, so the search has
// teeth. Exit 1 on a failed check.
//
// Usage, from probe/: bun tools/check-elkjs.ts

import { join } from "node:path";
import type { Manifest } from "../build.ts";

const PROBE = join(import.meta.dir, "..");
// Each occurs in elkjs 0.9.3's `lib/elk.bundled.js`, survives minification, and occurs nowhere in
// Mermaid's own code (Mermaid's ELK glue carries option keys such as `elk.layered…` and the type
// name `ElkNode`, so those are not used).
const IDENTIFIERS = ["org.eclipse.elk", "Eclipse Layout Kernel", "workerUrl", "knownLayoutAlgorithms"];

const count = (text: string, needle: string): number => text.split(needle).length - 1;

const manifest = (await Bun.file(join(PROBE, "dist/manifest.json")).json()) as Manifest;
const problems: string[] = [];
for (const chunk of manifest.chunks) {
  const elk = [...chunk.inputs.local, ...chunk.inputs.packages.map((p) => p.name)].filter((i) => /(^|\/)elkjs(\/|$)/.test(i));
  if (elk.length) problems.push(`${chunk.name}: elkjs inputs ${elk.join(", ")}`);
}
const mermaid = manifest.chunks.find((chunk) => chunk.name === "mermaid");
if (!mermaid) throw new Error("no mermaid chunk in the manifest");
if (!mermaid.inputs.stubbed.some((s) => s.startsWith("elkjs"))) problems.push("mermaid: elkjs not listed as stubbed");

const code = await Bun.file(join(PROBE, "dist", mermaid.script.file)).text();
const found = IDENTIFIERS.map((id) => [id, count(code, id)] as const);

// Control: the same entry built without the replacement.
const control = await Bun.build({
  entrypoints: [join(PROBE, "node_modules/mermaid/dist/mermaid.core.mjs")],
  format: "iife",
  target: "browser",
  minify: true,
});
if (!control.success) throw new AggregateError(control.logs, "control build failed");
const controlCode = await (control.outputs.find((o) => o.kind === "entry-point")?.text() ?? "");
const inControl = IDENTIFIERS.map((id) => [id, count(controlCode, id)] as const);

console.log(`mermaid chunk: ${mermaid.script.bytes} bytes; stubbed ${mermaid.inputs.stubbed.join(", ")}`);
console.log(`control build, elkjs bundled: ${controlCode.length} bytes`);
for (const [index, [id, n]] of found.entries()) {
  console.log(`  ${id.padEnd(24)} chunk ${String(n).padStart(4)}  control ${String(inControl[index]?.[1]).padStart(4)}`);
  if (n > 0) problems.push(`mermaid chunk contains ${id} (${n})`);
}
if (inControl.every(([, n]) => n === 0)) problems.push("control: no identifier found, the search proves nothing");
for (const problem of problems) console.error(problem);
console.log(`elkjs check: ${problems.length} problem(s)`);
if (problems.length > 0) process.exit(1);
