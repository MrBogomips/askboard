// Task 5.2: mathjs 15.2.0's `parse()` as a possible parser for the own evaluator. Runs it
// over every fixture formula after replacing each `[reference]` with a plain name, records
// what parses, why the rest fails, the AST node types, and whether a walk over the AST could
// enforce the whitelist that refs.ts enforces on tokens. It never evaluates anything.
//
//   bun src/mathjs-parse.ts [--bundle-dir <dir>]
//     -> runs/mathjs-parse/result.json, ../evidence/mathjs-parse.json, bundles in <dir>
//        (default runs/mathjs-parse/bundle)

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse } from "mathjs";
import { generateBoard } from "../fixtures/generate.ts";
import { BOARD_FIXTURES, errorFixtures, WHITELIST_CASES, whitelistNodes } from "./fixtures.ts";
import { type BoardDocument, buildGraph } from "./graph.ts";
import { type AstReport, GRAMMAR_EXTRAS, inspect, rewrite } from "./mathjs-check.ts";
import { measureBundles } from "./mathjs-size.ts";
import type { GraphNode } from "./port.ts";
import { checkFormula, lex } from "./refs.ts";

const PROBE = join(import.meta.dir, "..");
const RUN_FILE = join(PROBE, "runs", "mathjs-parse", "result.json");
const EVIDENCE_FILE = join(PROBE, "..", "evidence", "mathjs-parse.json");

function bundleDir(): string {
  const at = process.argv.indexOf("--bundle-dir");
  const dir = at >= 0 ? process.argv[at + 1] : undefined;
  if (at >= 0 && !dir) throw new Error("--bundle-dir needs a directory");
  return dir ?? join(PROBE, "runs", "mathjs-parse", "bundle");
}

interface Occurrence {
  readonly source: string;
  readonly address: string;
  readonly formula: string;
  /** The fixture expects a syntax error here (grammar, arity or literal). */
  readonly expectsSyntax: boolean;
}

type ParseOutcome = { readonly ok: true; readonly ast: AstReport } | { readonly ok: false; readonly error: string };

interface Shape {
  /** The formula with references renamed r0, r1…; the deduplication key. */
  readonly plain: string;
  readonly translated: string | null;
  readonly example: Occurrence;
  count: number;
  readonly sources: Set<string>;
  /** refs.ts's verdict: "ok" or the error kind it gives before any engine runs. */
  readonly precheck: string;
  readonly precheckDetail?: string;
  readonly lexed: boolean;
  readonly expectsSyntax: boolean;
  readonly raw: ParseOutcome;
  readonly rewritten: ParseOutcome | null;
  readonly reason: string | null;
}

function collect(): Occurrence[] {
  const out: Occurrence[] = [];
  const add = (source: string, nodes: readonly GraphNode[], expected: Readonly<Record<string, unknown>> = {}): void => {
    for (const n of nodes) {
      if (n.formula === undefined) continue;
      const expectsSyntax = (expected[n.address] as { error?: string } | undefined)?.error === "syntax";
      out.push({ source, address: n.address, formula: n.formula, expectsSyntax });
    }
  };
  for (const c of WHITELIST_CASES) add(`whitelist:${c.id}`, whitelistNodes(c), { "t.r": c.expected });
  for (const b of BOARD_FIXTURES) add(`board:${b.name}`, buildGraph(b.board), b.expected);
  for (const e of errorFixtures()) {
    add(`errors:${e.id}`, e.nodes ?? buildGraph(e.board as BoardDocument), e.expected);
  }
  add("generated:default", buildGraph(generateBoard()));
  return out;
}

function tryParse(text: string, names: ReadonlySet<string>): ParseOutcome {
  try {
    return { ok: true, ast: inspect(parse(text), names) };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { ok: false, error: message };
  }
}

/** Why the formula, references renamed, does not parse in mathjs. */
function failureReason(error: string, occ: Occurrence, tokens: readonly { kind: string; text: string; start: number; end: number }[]): string {
  const formula = occ.formula;
  if (occ.expectsSyntax) return "a syntax error the fixture expects; mathjs refuses it too";
  if (error.startsWith("RangeError")) return "stack overflow in mathjs's recursive parser (no nesting guard)";
  if (error.includes("Invalid left hand side of assignment")) return "Excel = comparison is mathjs assignment";
  const ops = new Set(tokens.filter((t) => t.kind === "op").map((t) => t.text));
  if (ops.has("<>") && error.includes("Value expected")) return "Excel <> has no mathjs equivalent (!=)";
  const escaped = tokens.some((t) => t.kind === "string" && formula.slice(t.start + 1, t.end - 1).includes('""'));
  if (escaped || error.includes('Unexpected operator "')) return 'Excel "" text escape (mathjs uses \\")';
  return `other: ${error}`;
}

function analyse(occurrences: readonly Occurrence[]): Map<string, Shape> {
  const shapes = new Map<string, Shape>();
  for (const occ of occurrences) {
    const lexed = lex(occ.formula);
    const plain = lexed.ok ? rewrite(occ.formula, lexed.tokens).plain : occ.formula;
    const known = shapes.get(plain);
    if (known) {
      known.count++;
      known.sources.add(occ.source);
      continue;
    }
    const checked = checkFormula(occ.formula, occ.address);
    const precheck = "error" in checked ? checked.error : "ok";
    const precheckDetail = "error" in checked ? checked.detail : undefined;
    let shape: Shape;
    if (lexed.ok) {
      const rw = rewrite(occ.formula, lexed.tokens);
      const raw = tryParse(rw.plain, rw.names);
      const rewritten = tryParse(rw.translated, rw.names);
      const reason = raw.ok ? null : failureReason(raw.error, occ, lexed.tokens);
      shape = { plain, translated: rw.translated, example: occ, count: 1, sources: new Set([occ.source]), precheck, precheckDetail, lexed: true, expectsSyntax: occ.expectsSyntax, raw, rewritten, reason };
    } else {
      // Outside AskBoard's grammar: no reference spans to rename; mathjs sees the raw text.
      const raw = tryParse(occ.formula, new Set());
      const reason = raw.ok ? "parses in mathjs although outside the grammar" : `outside the grammar; mathjs: ${raw.error}`;
      shape = { plain, translated: null, example: occ, count: 1, sources: new Set([occ.source]), precheck, precheckDetail, lexed: false, expectsSyntax: occ.expectsSyntax, raw, rewritten: null, reason };
    }
    shapes.set(plain, shape);
  }
  return shapes;
}

const clip = (text: string, max = 160): string => (text.length > max ? `${text.slice(0, max)}… (${text.length} characters)` : text);

function tally<T>(items: readonly T[], key: (item: T) => string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    if (k !== null) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function summarise(occurrences: readonly Occurrence[], shapes: readonly Shape[]) {
  const accepted = shapes.filter((s) => s.precheck === "ok");
  const refused = shapes.filter((s) => s.precheck !== "ok");
  const nodeTypes: Record<string, number> = {};
  for (const s of shapes) {
    if (!s.raw.ok) continue;
    for (const [type, n] of Object.entries(s.raw.ast.nodeTypes)) nodeTypes[type] = (nodeTypes[type] ?? 0) + n;
  }
  const failures = accepted.filter((s) => !s.raw.ok);
  const examples: Record<string, string> = {};
  for (const s of failures) if (s.reason && !(s.reason in examples)) examples[s.reason] = s.example.formula;
  const mismatchOf = (s: Shape): readonly string[] => (s.raw.ok ? s.raw.ast.mismatches : []);
  const mismatchExamples: Record<string, string> = {};
  for (const s of accepted) for (const m of mismatchOf(s)) mismatchExamples[m] ??= s.example.formula;
  // Agreement between refs.ts's token check and a whitelist walk over mathjs's AST.
  const verdicts = shapes.filter((s) => s.raw.ok && s.lexed).map((s) => {
    const astOk = s.raw.ok && s.raw.ast.refused === null;
    return { s, token: s.precheck, astOk };
  });
  const disagreements = verdicts
    .filter((v) => (v.token === "ok") !== v.astOk && (v.token === "ok" || v.token === "not-whitelisted"))
    .map((v) => ({ formula: clip(v.s.example.formula), precheck: v.token, ast: v.s.raw.ok ? v.s.raw.ast.refused : null }));
  const notWhitelisted = refused.filter((s) => s.precheck === "not-whitelisted");
  // The formulas buildGraph writes for the molecules: what a real board would hand the parser.
  const molecule = accepted.filter((s) => [...s.sources].some((src) => src.startsWith("board:") || src.startsWith("generated:")));
  return {
    occurrences: occurrences.length,
    distinctFormulas: new Set(occurrences.map((o) => o.formula)).size,
    shapes: shapes.length,
    bySource: tally(occurrences, (o) => o.source.split(":")[0] ?? null),
    precheckAccepted: {
      shapes: accepted.length,
      parse: accepted.filter((s) => s.raw.ok).length,
      fail: failures.length,
      failureReasons: tally(failures, (s) => s.reason),
      failureExamples: examples,
      parseAfterTokenRewrite: accepted.filter((s) => s.rewritten?.ok).length,
      rewriteFailures: accepted.filter((s) => s.rewritten && !s.rewritten.ok).map((s) => ({ formula: clip(s.example.formula), error: s.rewritten && !s.rewritten.ok ? s.rewritten.error : "" })),
      mismatchesAmongParsed: tally(accepted.flatMap(mismatchOf), (m) => m),
      mismatchExamples,
      mismatchesAfterTokenRewrite: tally(accepted.flatMap((s) => (s.rewritten?.ok ? s.rewritten.ast.mismatches : [])), (m) => m),
      expectedSyntaxButParses: accepted.filter((s) => s.expectsSyntax && s.raw.ok).map((s) => ({ formula: s.example.formula, ast: s.raw.ok ? s.raw.ast.refused ?? "accepted by the AST walk" : "" })),
      failuresBySource: tally(failures, (s) => [...s.sources][0]?.split(":")[0] ?? null),
      astWhitelistRefusals: tally(accepted.filter((s) => s.raw.ok && s.raw.ast.refused !== null), (s) => (s.raw.ok ? s.raw.ast.refused : null)),
      astWhitelistRefusalsAfterRewrite: tally(accepted.filter((s) => s.rewritten?.ok && s.rewritten.ast.refused !== null), (s) => (s.rewritten?.ok ? s.rewritten.ast.refused : null)),
    },
    moleculeFormulas: {
      shapes: molecule.length,
      parse: molecule.filter((s) => s.raw.ok).length,
      parseWithoutMismatch: molecule.filter((s) => s.raw.ok && s.raw.ast.mismatches.length === 0 && s.raw.ast.refused === null).length,
      failing: molecule.filter((s) => !s.raw.ok).map((s) => ({ formula: s.example.formula, reason: s.reason })),
      functions: [...new Set(molecule.flatMap((s) => (s.raw.ok ? s.raw.ast.functions : [])))].sort(),
    },
    precheckRefused: {
      shapes: refused.length,
      byKind: tally(refused, (s) => s.precheck),
      mathjsParses: refused.filter((s) => s.raw.ok).length,
      // What only the token-level checks catch: mathjs parses it and an AST walk would accept it.
      acceptedByAstWalk: refused.filter((s) => s.raw.ok && s.raw.ast.refused === null).map((s) => ({ formula: clip(s.example.formula, 80), precheck: s.precheckDetail ?? s.precheck })),
      notWhitelistedCaughtByAstWalk: notWhitelisted.filter((s) => s.raw.ok && s.raw.ast.refused !== null).length,
      notWhitelistedParsing: notWhitelisted.filter((s) => s.raw.ok).length,
      notWhitelisted: notWhitelisted.map((s) => ({ formula: clip(s.example.formula), mathjs: s.raw.ok ? `parses; AST walk: ${s.raw.ast.refused ?? "accepted"}` : s.raw.error })),
      others: refused.filter((s) => s.precheck !== "not-whitelisted").map((s) => ({ formula: clip(s.example.formula, 80), precheck: s.precheck, mathjs: s.raw.ok ? `parses (depth ${s.raw.ast.maxDepth})` : clip(s.raw.error, 120) })),
    },
    nodeTypes,
    tokenVersusAstDisagreements: disagreements,
  };
}

async function main(): Promise<void> {
  const started = performance.now();
  const occurrences = collect();
  const shapes = [...analyse(occurrences).values()];
  const summary = summarise(occurrences, shapes);
  const extras = GRAMMAR_EXTRAS.map((text) => {
    const out = tryParse(text, new Set(["r0", "r1"]));
    return out.ok ? { text, parses: true, nodeTypes: Object.keys(out.ast.nodeTypes), walk: out.ast.refused ?? "accepted" } : { text, parses: false, error: out.error };
  });
  const parseMs = Math.round(performance.now() - started);
  const bundles = await measureBundles(bundleDir());
  const meta = {
    run: "mathjs-parse",
    date: new Date().toISOString(),
    command: "bun src/mathjs-parse.ts",
    runtime: `bun ${Bun.version}`,
    mathjs: "15.2.0",
    import: 'import { parse } from "mathjs"',
    parseMs,
    bundleDir: process.argv.includes("--bundle-dir") ? "<dir> given with --bundle-dir" : "runs/mathjs-parse/bundle",
    bundles,
  };
  const detail = shapes.map((s) => ({
    formula: clip(s.example.formula, 400),
    plain: clip(s.plain, 400),
    translated: s.translated === null ? null : clip(s.translated, 400),
    count: s.count,
    sources: [...s.sources].slice(0, 5),
    precheck: s.precheck,
    precheckDetail: s.precheckDetail,
    raw: s.raw.ok ? { ok: true, ...s.raw.ast } : { ok: false, error: clip(s.raw.error, 300), reason: s.reason },
    rewritten: s.rewritten === null ? null : s.rewritten.ok ? { ok: true, refused: s.rewritten.ast.refused, mismatches: s.rewritten.ast.mismatches } : { ok: false, error: clip(s.rewritten.error, 300) },
  }));
  for (const [file, body] of [
    [RUN_FILE, { ...meta, summary, grammarExtras: extras, shapes: detail }],
    [EVIDENCE_FILE, { ...meta, summary, grammarExtras: extras }],
  ] as const) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
  }
  const a = summary.precheckAccepted;
  console.log(`occurrences ${summary.occurrences}, distinct ${summary.distinctFormulas}, shapes ${summary.shapes}`);
  console.log(`precheck-accepted shapes ${a.shapes}: parse ${a.parse}, fail ${a.fail}; after token rewrite ${a.parseAfterTokenRewrite}`);
  console.log(`failure reasons ${JSON.stringify(a.failureReasons)}`);
  console.log(`mismatches among parsed ${JSON.stringify(a.mismatchesAmongParsed)}`);
  console.log(`precheck-refused shapes ${summary.precheckRefused.shapes} ${JSON.stringify(summary.precheckRefused.byKind)}`);
  console.log(`wrote ${RUN_FILE} and ${EVIDENCE_FILE} (parse pass ${parseMs} ms)`);
  for (const b of bundles) console.log(`${b.name}: ${b.rawBytes} raw, ${b.gzipBytes} gzip -9`);
}

await main();
