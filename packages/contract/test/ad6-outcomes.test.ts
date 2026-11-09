import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

// AD-6 lists, in the spine, the typed results that are not errors. Every outcome value the tool
// envelopes' schemas allow must be named there (agent-facing-gaps added `deleted`). The set is
// derived from the schemas, never listed by hand.
const schemaDir = join(import.meta.dir, "../src/schemas/tool-envelopes");
const spinePath = join(
  import.meta.dir,
  "../../../docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md",
);

const outcomeValues = (node: unknown, found: Set<string>): void => {
  if (Array.isArray(node)) {
    for (const item of node) outcomeValues(item, found);
    return;
  }
  if (node === null || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const properties = record.properties as Record<string, unknown> | undefined;
  const outcome = properties?.outcome as { const?: unknown; enum?: unknown } | undefined;
  if (outcome !== undefined) {
    if (typeof outcome.const === "string") found.add(outcome.const);
    if (Array.isArray(outcome.enum)) {
      for (const value of outcome.enum) if (typeof value === "string") found.add(value);
    }
  }
  for (const value of Object.values(record)) outcomeValues(value, found);
};

describe("AD-6's typed results that are not errors", () => {
  test("name every outcome value the tool envelopes allow", async () => {
    const found = new Set<string>();
    for (const file of readdirSync(schemaDir).filter((name) => name.endsWith(".json"))) {
      outcomeValues(await Bun.file(join(schemaDir, file)).json(), found);
    }
    expect(found.size).toBeGreaterThan(0);
    const spine = await Bun.file(spinePath).text();
    const line = spine
      .split("\n")
      .find((text) => text.includes("Typed results that are not errors:"));
    if (line === undefined) {
      throw new Error('AD-6\'s line "Typed results that are not errors: ..." is not in the spine');
    }
    const missing = [...found].filter((value) => !line.includes(`\`${value}\``));
    expect(missing).toEqual([]);
  });
});
