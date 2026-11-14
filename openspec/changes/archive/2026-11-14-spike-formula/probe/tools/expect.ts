// Writes the expected values of the molecule fixtures (fixtures/boards/*.json with
// `molecule: true`) from src/reference.ts, after the board and after each cumulative edit.
// `bun tools/expect.ts` rewrites them; `bun run.ts <run> --only reference` checks they agree.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BoardDocument } from "../src/graph.ts";
import { applySet, referenceValues } from "../src/reference.ts";

const dir = join(import.meta.dirname, "..", "fixtures", "boards");
const files = ["uj2-wbs-gantt.json", "uj3-sales-review.json", "decision-matrix.json"];

for (const file of files) {
  const path = join(dir, file);
  const fixture = JSON.parse(readFileSync(path, "utf8"));
  if (!fixture.molecule) continue;
  let board: BoardDocument = fixture.board;
  fixture.expected = Object.fromEntries(referenceValues(board));
  for (const edit of fixture.edits) {
    for (const [address, value] of Object.entries(edit.set)) board = applySet(board, address, value as never);
    edit.expected = Object.fromEntries(referenceValues(board));
  }
  writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`${file}: ${Object.keys(fixture.expected).length} expected values, ${fixture.edits.length} edits`);
}
