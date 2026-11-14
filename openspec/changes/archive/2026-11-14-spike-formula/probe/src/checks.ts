// Engine-free checks. `checkRefs` (task 2.1): every fixture formula's references are found
// and resolved, wildcards and ranges resolve to the expected lists, and functions outside
// the whitelist are refused by refs.ts before any engine exists. `checkReference` (task
// 2.2): molecule fixtures' expected values equal src/reference.ts's output, and the
// whitelist's additions each name a field that a molecule formula really uses.

import { generateBoard } from "../fixtures/generate.ts";
import { BOARD_FIXTURES, errorFixtures, WHITELIST_CASES, whitelistNodes } from "./fixtures.ts";
import { type BoardDocument, buildGraph } from "./graph.ts";
import type { GraphNode, Scalar } from "./port.ts";
import { precheck } from "./precheck.ts";
import { applySet, referenceValues } from "./reference.ts";
import { AddressIndex, isCell, lex, parseRefBody, type RefSyntax } from "./refs.ts";
import { CANDIDATES } from "./whitelist.ts";

export interface CheckReport {
  passed: number;
  failed: number;
  failures: Array<{ check: string; expected: unknown; actual: unknown }>;
  stats: Record<string, unknown>;
}

function report(): CheckReport & { ok(check: string, expected: unknown, actual: unknown): void } {
  const r = {
    passed: 0,
    failed: 0,
    failures: [] as CheckReport["failures"],
    stats: {} as Record<string, unknown>,
    ok(check: string, expected: unknown, actual: unknown): void {
      if (JSON.stringify(expected) === JSON.stringify(actual)) r.passed++;
      else {
        r.failed++;
        r.failures.push({ check, expected, actual });
      }
    },
  };
  return r;
}

function boardOf(name: string): BoardDocument {
  const f = BOARD_FIXTURES.find((b) => b.name === name);
  if (!f) throw new Error(`no board ${name}`);
  return f.board;
}

const WILDCARDS: ReadonlyArray<{ board: string; ref: string; addresses: string[] | { single: string; present: boolean } }> = [
  { board: "uj2-wbs-gantt", ref: "wbs.design.*.expected", addresses: ["wbs.design.ux.expected", "wbs.design.architecture.expected", "wbs.design.prototype.expected"] },
  { board: "uj2-wbs-gantt", ref: "wbs.*.expected", addresses: ["wbs.design.expected", "wbs.build.expected"] },
  {
    board: "uj2-wbs-gantt",
    ref: "wbs.*.*.expected",
    addresses: ["ux", "architecture", "prototype"].map((id) => `wbs.design.${id}.expected`).concat(["portal", "billing", "reporting"].map((id) => `wbs.build.${id}.expected`)),
  },
  { board: "uj2-wbs-gantt", ref: "schedule.*.ef", addresses: ["ux", "architecture", "prototype", "portal", "billing", "reporting"].map((id) => `schedule.${id}.ef`) },
  { board: "uj2-wbs-gantt", ref: "wbs.design.ux.*.expected", addresses: [] },
  { board: "uj2-wbs-gantt", ref: "wbs.ux.optimistic", addresses: { single: "wbs.ux.optimistic", present: false } },
  { board: "uj2-wbs-gantt", ref: "wbs.design.ux.optimistic", addresses: { single: "wbs.design.ux.optimistic", present: true } },
  { board: "uj3-sales-review", ref: "estimate.*.cost", addresses: ["pm", "dev", "qa", "training"].map((id) => `estimate.${id}.cost`) },
  { board: "decision-matrix", ref: "dm.criteria.*.weight", addresses: ["cost", "risk", "fit"].map((id) => `dm.criteria.${id}.weight`) },
  { board: "decision-matrix", ref: "dm.options.partner.*.rating", addresses: ["cost", "risk", "fit"].map((id) => `dm.options.partner.${id}.rating`) },
  { board: "decision-matrix", ref: "dm.options.*.score", addresses: ["build", "buy", "partner"].map((id) => `dm.options.${id}.score`) },
  { board: "spreadsheet", ref: "sheet.A1:A3", addresses: ["sheet.A1", "sheet.A2", "sheet.A3"] },
  { board: "spreadsheet", ref: "sheet.A1:B2", addresses: ["sheet.A1", "sheet.B1", "sheet.A2", "sheet.B2"] },
  { board: "spreadsheet", ref: "sheet.B2:A1", addresses: ["sheet.A1", "sheet.B1", "sheet.A2", "sheet.B2"] },
  { board: "spreadsheet", ref: "sheet.A5:A6", addresses: ["sheet.A5", "sheet.A6"] },
];

/** Every formula of every fixture: (fixture, node) pairs. */
function allFormulas(): Array<{ fixture: string; nodes: readonly GraphNode[]; expectFailures: boolean }> {
  const out: Array<{ fixture: string; nodes: readonly GraphNode[]; expectFailures: boolean }> = [];
  for (const f of BOARD_FIXTURES) out.push({ fixture: `board:${f.name}`, nodes: buildGraph(f.board), expectFailures: false });
  out.push({ fixture: "board:generated", nodes: buildGraph(generateBoard()), expectFailures: false });
  for (const c of WHITELIST_CASES) out.push({ fixture: `whitelist:${c.id}`, nodes: whitelistNodes(c), expectFailures: (c.warnings ?? []).length > 0 });
  for (const e of errorFixtures()) {
    out.push({ fixture: `error:${e.id}`, nodes: e.nodes ?? buildGraph(e.board as BoardDocument), expectFailures: true });
  }
  return out;
}

export function checkRefs(): CheckReport {
  const r = report();
  let formulas = 0;
  let references = 0;
  let wildcards = 0;
  let ranges = 0;
  for (const { fixture, nodes, expectFailures } of allFormulas()) {
    const pre = precheck(nodes);
    for (const node of nodes) {
      if (node.formula === undefined || node.formula.length > 10000) continue;
      formulas++;
      const lexed = lex(node.formula);
      if (!lexed.ok) continue;
      const checked = pre.formulas.get(node.address);
      if (checked) {
        references += checked.references.length;
        wildcards += checked.references.filter((x) => x.text.includes("*")).length;
        ranges += checked.references.filter((x) => x.text.includes(":")).length;
        // Every bracket in the source is one reference, found with its exact span.
        const brackets = (node.formula.match(/\[/g) ?? []).length;
        r.ok(`${fixture} ${node.address}: references found`, brackets, checked.references.length);
        for (const ref of checked.references) {
          r.ok(`${fixture} ${node.address}: span of [${ref.text}]`, `[${ref.text}]`, node.formula.slice(ref.start, ref.end));
        }
      } else if (!expectFailures) {
        r.ok(`${fixture} ${node.address}: resolves`, "resolved", pre.errors.get(node.address) ?? "not checked");
      }
    }
    if (!expectFailures) r.ok(`${fixture}: no load warnings`, [], pre.warnings);
  }
  r.stats = { formulas, references, wildcards, ranges };

  for (const w of WILDCARDS) {
    const index = new AddressIndex(buildGraph(boardOf(w.board)).map((n) => n.address));
    const syntax = parseRefBody(w.ref) as RefSyntax;
    const got = index.resolve(syntax);
    const actual = got.kind === "single" ? { single: got.address, present: got.present } : got.kind === "list" ? got.addresses : got;
    r.ok(`resolve [${w.ref}] on ${w.board}`, w.addresses, actual);
  }

  // Refused before any engine: only refs.ts and precheck run here, no engine is created.
  const refused = errorFixtures().find((e) => e.id === "not-whitelisted");
  const pre = precheck(refused?.nodes ?? []);
  for (const node of refused?.nodes ?? []) {
    if (node.formula === undefined || node.address === "x.dep") continue;
    const w = pre.warnings.find((x) => x.address === node.address);
    r.ok(`refused ${node.formula}`, { error: "not-whitelisted", item: "x" }, { error: w?.error, item: w?.address.split(".")[0] });
  }

  // Grammar corners: IDs that look like cells, booleans or functions are plain IDs inside brackets.
  const lexOne = (formula: string): unknown => {
    const l = lex(formula);
    return l.ok ? l.tokens.map((t) => (t.ref ? { segments: t.ref.segments, wildcard: t.ref.wildcard, range: t.ref.range ?? null } : t.kind)) : l.detail;
  };
  r.ok("cell-like IDs", [{ segments: ["ab12", "r1c1", "value"], wildcard: false, range: null }], lexOne("[ab12.r1c1.value]"));
  r.ok("boolean and function IDs", [{ segments: ["TRUE", "SUM", "x"], wildcard: false, range: null }], lexOne("[TRUE.SUM.x]"));
  r.ok("range", [{ segments: ["sheet", "A1:B3"], wildcard: false, range: { from: "A1", to: "B3" } }], lexOne("[sheet.A1:B3]"));
  r.ok("range only on item.cell", "reference [wbs.x.A1:B3]: a range is item.A1:B3", lexOne("[wbs.x.A1:B3]"));
  r.ok("upper-case A1 is a cell", true, isCell("A1"));
  r.ok("lower-case a1 is a field, not a cell", false, isCell("a1"));
  r.ok("XFD1048576 is the last cell", true, isCell("XFD1048576"));
  r.ok("XFE1 is past the last column", false, isCell("XFE1"));
  const kinds = (formula: string): unknown => {
    const l = lex(formula);
    return l.ok ? l.tokens.map((t) => t.kind) : l.detail;
  };
  r.ok("hyphens are ID characters inside brackets, minus outside", ["ref", "op", "ref"], kinds("[a-b.c-d.v]-[e.f]"));
  return { passed: r.passed, failed: r.failed, failures: r.failures, stats: r.stats };
}

function functionsUsed(nodes: readonly GraphNode[]): Set<string> {
  const used = new Set<string>();
  for (const n of nodes) {
    if (!n.formula) continue;
    const l = lex(n.formula);
    if (!l.ok) continue;
    for (const t of l.tokens) if (t.kind === "ident" || t.kind === "op") used.add(t.text);
  }
  return used;
}

export function checkReference(): CheckReport {
  const r = report();
  let values = 0;
  for (const f of BOARD_FIXTURES) {
    if (!f.molecule) continue;
    const ref = Object.fromEntries(referenceValues(f.board));
    values += Object.keys(ref).length;
    r.ok(`${f.name}: expected equals reference`, f.expected, ref);
    let board = f.board;
    f.edits.forEach((edit, i) => {
      for (const [address, value] of Object.entries(edit.set)) board = applySet(board, address, value as Scalar);
      const after = Object.fromEntries(referenceValues(board));
      values += Object.keys(after).length;
      r.ok(`${f.name} edit ${i + 1}: expected equals reference`, edit.expected, after);
    });
  }
  const moleculeNodes = BOARD_FIXTURES.filter((f) => f.molecule).flatMap((f) => buildGraph(f.board));
  const used = functionsUsed([...moleculeNodes, ...buildGraph(generateBoard())]);
  const listed = new Set(CANDIDATES.map((c) => c.name));
  for (const name of used) r.ok(`molecule formulas use only listed names: ${name}`, true, listed.has(name));
  const fixtured = new Set(WHITELIST_CASES.map((c) => c.op));
  for (const c of CANDIDATES) {
    r.ok(`${c.name} has a whitelist fixture`, true, fixtured.has(c.name));
    if (c.neededBy !== null && !c.interim) r.ok(`${c.name} is used by a molecule formula (${c.neededBy})`, true, used.has(c.name));
  }
  r.stats = {
    referenceValuesCompared: values,
    usedByMolecules: [...used].sort(),
    notNeeded: CANDIDATES.filter((c) => c.neededBy === null).map((c) => c.name),
    interimNotUsed: CANDIDATES.filter((c) => c.interim && !used.has(c.name)).map((c) => c.name),
  };
  return { passed: r.passed, failed: r.failed, failures: r.failures, stats: r.stats };
}
