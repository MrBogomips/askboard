// A widget chunk's facts agree with its registry entry (widget-registry, design decision 8): the
// chunks register their element shape and the name of the agent-change notice with their
// components, so a widget change cannot drift from the contract. The chunks' entries are imported
// in a process of their own: loaded here they would count, unrun, against the files' coverage.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { WIDGET_TYPES } from "@askboard/contract";

const SRC = join(import.meta.dir, "../src");

// What each chunk registered for the example props of its registry entry, as the child prints it.
// A chunk is `src/<type>/index.tsx`, built from the entry, so a type added to the registry is
// checked with no edit here.
const CHUNKS = WIDGET_TYPES.map((entry) => join(SRC, entry.type, "index.tsx"));
const SCRIPT = `
import { WIDGET_TYPES } from "@askboard/contract";
import { componentFacts } from "@askboard/view/catalog";
${CHUNKS.map((chunk) => `await import(${JSON.stringify(chunk)});`).join("\n")}
console.log(JSON.stringify(WIDGET_TYPES.map((entry) => {
  const facts = componentFacts(entry.type);
  return { type: entry.type, name: facts?.name, shape: facts?.shape?.(entry.example.item.props) };
})));
`;

const registered = async (): Promise<
  readonly { type: string; name?: string; shape?: unknown }[]
> => {
  const child = Bun.spawn([process.execPath, "-e", SCRIPT], {
    cwd: join(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(err);
  return JSON.parse(out);
};

describe("each registered widget type's chunk", () => {
  test("registers a notice name and the element shape its registry entry gives", async () => {
    const facts = await registered();
    expect(CHUNKS).toHaveLength(WIDGET_TYPES.length);
    expect(facts.map(({ type }) => type)).toEqual(WIDGET_TYPES.map(({ type }) => type));
    for (const [at, entry] of WIDGET_TYPES.entries()) {
      expect(facts[at]?.name).toMatch(/^change\./);
      // A result-only widget has no edits, so no element shape to compare.
      if (entry.edits !== undefined) {
        expect(facts[at]?.shape).toEqual(entry.edits.shape(entry.example.item.props));
      }
    }
  });
});
