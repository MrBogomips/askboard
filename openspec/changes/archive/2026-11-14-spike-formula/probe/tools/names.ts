// Criterion 6, run `names`: `bun tools/names.ts [run]` (default run name "names").
// 1. A generated ID list through the defined-name encoding: round trip, injectivity under
//    Excel's case-insensitivity, and IronCalc's own isValidDefinedName/newDefinedName, with a
//    formula reading each name back. The raw IDs are tried as names too, to show why.
// 2. Every fixture graph: each reference text encodes within 255 characters and round-trips;
//    the cell layout gives each address its own cell.
// 3. The whole suite through IronCalc in both forms: same results and hash.
// Writes runs/<run>/names.json.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initSync, Model } from "@ironcalc/wasm";
import { generateBoard } from "../fixtures/generate.ts";
import { BOARD_FIXTURES, errorFixtures, WHITELIST_CASES, whitelistNodes } from "../src/fixtures.ts";
import { buildGraph } from "../src/graph.ts";
import { createIronCalcEngine } from "../src/ironcalc/engine.ts";
import { layoutNodes } from "../src/ironcalc/layout.ts";
import { decodeName, encodeName, MAX_NAME_LENGTH } from "../src/ironcalc/names.ts";
import type { GraphNode } from "../src/port.ts";
import { precheck } from "../src/precheck.ts";
import { runSuite } from "../src/suite.ts";
import { compareResults } from "./compare.ts";

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const run = process.argv[2] ?? "names";
const bytes = new Uint8Array(readFileSync(join(here, "node_modules/@ironcalc/wasm/wasm_bg.wasm")));
initSync({ module: bytes });

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

const FIXED_IDS: string[] = [];

function generatedIds(): string[] {
  const fixed = [
    "-x", "--", "a-b", "-", "_", "__", "_xlfn", "_xlnm", "123", "1a", "0", "123.456".split(".")[0] as string,
    "ab12", "AB12", "A1", "a1", "xfd1048576", "XFD1048576", "XFE1", "r1c1", "R1C1", "rc", "RC", "R", "C", "r", "c", "R1", "C1", "r2c", "R[1]C"
      .replace(/[[\]]/g, ""),
    "TRUE", "FALSE", "true", "false", "True",
    "SUM", "sum", "IF", "N", "T", "ROUND", "WORKDAY", "NA", "INDIRECT",
    "constructor", "__proto__", "toString", "hasOwnProperty", "prototype",
    "A".repeat(64), "a".repeat(64), "_".repeat(64), "-".repeat(64), "Z9-_".repeat(16),
    "Ab", "aB", "AB", "ab", "Wp-1", "wp-1", "WP-1",
  ];
  let a = 20261030;
  const rnd = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const random: string[] = [];
  for (let i = 0; i < 2000; i++) {
    const len = 1 + Math.floor(rnd() * 64);
    let id = "";
    for (let j = 0; j < len; j++) id += ID_CHARS[Math.floor(rnd() * ID_CHARS.length)];
    random.push(id);
  }
  FIXED_IDS.push(...new Set(fixed));
  return [...new Set([...fixed, ...random])];
}

/**
 * Defines `name` -> B<row>. Formulas are written only after every name exists: IronCalc
 * re-parses every formula on each newDefinedName, so interleaving them is quadratic.
 */
function defineName(model: Model, name: string, row: number): "ok" | string {
  try {
    model.isValidDefinedName(name, null, `Sheet1!$B$${row}`);
  } catch (e) {
    return `isValidDefinedName refused: ${String(e).slice(0, 80)}`;
  }
  try {
    model.newDefinedName(name, null, `Sheet1!$B$${row}`);
  } catch (e) {
    return `newDefinedName refused: ${String(e).slice(0, 80)}`;
  }
  return "ok";
}

function checkIds(ids: readonly string[], encode: (id: string) => string) {
  const model = new Model("names", "en", "UTC", "en");
  model.pauseEvaluation();
  // A Map, not an object: IDs such as "constructor" must not hit Object.prototype.
  const failures = new Map<string, string>();
  const byLower = new Map<string, string>();
  const defined: Array<[string, string, number]> = [];
  let collisions = 0;
  const t0 = performance.now();
  ids.forEach((id, i) => {
    const name = encode(id);
    const lower = name.toLowerCase();
    const other = byLower.get(lower);
    if (other !== undefined) {
      collisions++;
      failures.set(id, `same name as ${other} under case-insensitivity`);
      return;
    }
    byLower.set(lower, id);
    const r = defineName(model, name, i + 1);
    if (r === "ok") defined.push([id, name, i + 1]);
    else failures.set(id, r);
  });
  const defineMs = performance.now() - t0;
  for (const [, name, row] of defined) {
    model.setUserInput(0, row, 2, String(row));
    model.setUserInput(0, row, 3, `=${name}`);
  }
  model.evaluate();
  for (const [id, name, row] of defined) {
    const got = model.getFormattedCellValue(0, row, 3);
    if (got !== String(row)) failures.set(id, `=${name} reads ${got || "(empty)"}, not the named cell`);
  }
  model.free();
  return { ids: ids.length, accepted: ids.length - failures.size, collisions, msPerName: Math.round((defineMs / Math.max(1, defined.length)) * 1000) / 1000, failures };
}

function fixtureGraphs(): Array<{ name: string; nodes: readonly GraphNode[] }> {
  const out: Array<{ name: string; nodes: readonly GraphNode[] }> = [];
  for (const c of WHITELIST_CASES) out.push({ name: `whitelist:${c.id}`, nodes: whitelistNodes(c) });
  for (const f of BOARD_FIXTURES) out.push({ name: `board:${f.name}`, nodes: buildGraph(f.board) });
  out.push({ name: "board:generated", nodes: buildGraph(generateBoard()) });
  for (const f of errorFixtures()) out.push({ name: `error:${f.id}`, nodes: f.nodes ?? buildGraph(f.board as Parameters<typeof buildGraph>[0]) });
  return out;
}

function checkFixtures() {
  let references = 0;
  let addresses = 0;
  let longest = 0;
  const problems: string[] = [];
  for (const g of fixtureGraphs()) {
    const pre = precheck(g.nodes);
    for (const checked of pre.formulas.values()) {
      for (const t of checked.tokens) {
        if (t.kind !== "ref") continue;
        references++;
        const name = encodeName(t.text);
        longest = Math.max(longest, name.length);
        if (name.length > MAX_NAME_LENGTH) problems.push(`${g.name}: [${t.text}] encodes to ${name.length} characters`);
        if (decodeName(name) !== t.text) problems.push(`${g.name}: [${t.text}] does not round-trip`);
      }
    }
    const layout = layoutNodes(pre.nodes, []);
    const back = new Map<string, string>();
    for (const [address, c] of layout.cells) {
      addresses++;
      const key = `${c.sheet}!${c.col},${c.row}`;
      const other = back.get(key);
      if (other !== undefined) problems.push(`${g.name}: ${address} and ${other} share a cell`);
      back.set(key, address);
    }
    for (const [key, address] of back) if (layout.cells.get(address) && `${layout.cells.get(address)?.sheet}!${layout.cells.get(address)?.col},${layout.cells.get(address)?.row}` !== key) problems.push(`${g.name}: ${address} does not round-trip`);
  }
  return { graphs: fixtureGraphs().length, references, longestName: longest, addresses, problems };
}

function tally(reasons: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of reasons) {
    const key = r.startsWith("same name") ? "collides with another ID (case)" : r.replace(/=\S+ reads/, "=ID reads").slice(0, 60);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

const ids = generatedIds();
const encoded = checkIds(ids, encodeName);
const raw = checkIds(ids, (id) => id);
const roundTrip = ids.filter((id) => decodeName(encodeName(id)) !== id);
const fixtures = checkFixtures();
const cells = runSuite(createIronCalcEngine(bytes, { form: "cells" }));
const named = runSuite(createIronCalcEngine(bytes, { form: "names" }));
const diff = compareResults(cells.results, named.results);

const versions = process.versions as Record<string, string | undefined>;
const summary = {
  env: { runtime: versions.bun ? `bun ${versions.bun}` : `node ${versions.node}`, date: new Date().toISOString(), command: `bun tools/names.ts ${run}` },
  encoding: "n_ + per character: a-z 0-9 . kept; A-Z -> _ + lower case; _ -> _0; - -> _1; * -> _2; : -> _3",
  generatedIds: {
    count: ids.length,
    roundTripFailures: roundTrip,
    encoded: { ...encoded, failures: Object.fromEntries(encoded.failures) },
    raw: {
      ...raw,
      failures: undefined,
      failureCount: raw.failures.size,
      byReason: tally([...raw.failures.values()]),
      fixedIds: FIXED_IDS.map((id) => [id, raw.failures.get(id) ?? "accepted; =ID reads the named cell"]),
    },
  },
  fixtures,
  suite: {
    cells: { passed: cells.passed, failed: cells.failed, exactMismatches: cells.exactMismatches, hash: cells.hash },
    names: { passed: named.passed, failed: named.failed, exactMismatches: named.exactMismatches, hash: named.hash },
    sameResults: diff.differ.length === 0 && diff.exact.length === 0 && diff.missing.length === 0,
    differences: [...diff.differ, ...diff.exact, ...diff.missing],
  },
};
const dir = join(here, "runs", run);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "names.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`ids ${ids.length}: encoded ${encoded.accepted} accepted, ${encoded.collisions} collisions, ${roundTrip.length} round-trip failures; raw IDs as names: ${raw.accepted} accepted, ${raw.collisions} collisions`);
console.log(`fixtures: ${fixtures.graphs} graphs, ${fixtures.references} references (longest name ${fixtures.longestName}), ${fixtures.addresses} addresses, ${fixtures.problems.length} problems`);
console.log(`suite cells ${cells.passed}/${cells.failed} ${cells.hash.slice(0, 16)}; names ${named.passed}/${named.failed} ${named.hash.slice(0, 16)}; same results ${summary.suite.sameResults}`);
