// The names of AskBoard's tools, from the contract's tool definitions, written for the release's
// smoke (plugin-release, design decision 6): the smoke compares the tree's `tools/list` with this
// list, so that a tool added later is checked with no literal in the smoke.
//
// Usage: bun tools/release/tool-names.ts --out <file>

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { TOOL_DEFINITIONS } from "@askboard/contract";

export const toolNames = (): string[] => TOOL_DEFINITIONS.map((tool) => tool.name);

/** Writes the names as a JSON array to `--out <file>`; the exit code. */
export const main = (argv: readonly string[]): number => {
  const at = argv.indexOf("--out");
  const file = at < 0 ? undefined : argv[at + 1];
  if (file === undefined || file === "") {
    process.stderr.write("tool-names: usage: bun tools/release/tool-names.ts --out <file>\n");
    return 2;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(toolNames())}\n`);
  return 0;
};

if (import.meta.main) process.exit(main(process.argv.slice(2)));
