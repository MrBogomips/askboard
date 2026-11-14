// Checks of the own evaluator's internals that the port cannot show: the parser's own
// nesting guard and the iterative ordering hold even when the shared limits are bypassed,
// and the function table resolves no prototype member.

import { generateBoard } from "../fixtures/generate.ts";
import { buildGraph } from "./graph.ts";
import { createOwnEngine } from "./own/engine.ts";
import { lookup, tableNames } from "./own/functions.ts";
import { type Ast, ParseError, parse } from "./own/parser.ts";
import { orderSlots } from "./own/topo.ts";
import { lex } from "./refs.ts";
import { FUNCTIONS } from "./whitelist.ts";

export function checkOwnInternals(): { passed: number; failed: number; failures: Array<{ check: string; expected: unknown; actual: unknown }> } {
  let passed = 0;
  const failures: Array<{ check: string; expected: unknown; actual: unknown }> = [];
  const ok = (check: string, expected: unknown, actual: unknown): void => {
    if (JSON.stringify(expected) === JSON.stringify(actual)) passed++;
    else failures.push({ check, expected, actual });
  };
  const noRef = (): Ast => ({ k: "num", v: 0 });
  const parseRaw = (formula: string): string => {
    const l = lex(formula);
    if (!l.ok) return `lex: ${l.detail}`;
    try {
      parse(l.tokens, noRef);
      return "parsed";
    } catch (e) {
      return e instanceof ParseError ? "ParseError" : `other: ${e instanceof Error ? e.name : String(e)}`;
    }
  };
  ok("10,000-deep parentheses, shared limits bypassed", "ParseError", parseRaw(`${"(".repeat(10000)}1${")".repeat(10000)}`));
  ok("10,000 unary minus signs, shared limits bypassed", "ParseError", parseRaw(`${"-".repeat(10000)}1`));
  ok("1,000 nested SUM calls, shared limits bypassed", "ParseError", parseRaw(`${"SUM(".repeat(1000)}1${")".repeat(1000)}`));
  ok("a 1 MB flat sum parses into one chain", "parsed", parseRaw(`1${"+1".repeat(524287)}`));
  const chain = Array.from({ length: 200000 }, (_, i) => (i === 0 ? [] : [i - 1]));
  const t = orderSlots(chain);
  ok("200,000-node chain orders without recursion", [0, 199999], [t.order[0], t.order[199999]]);
  for (const name of ["CONSTRUCTOR", "__PROTO__", "TOSTRING", "VALUEOF", "HASOWNPROPERTY", "constructor", "__proto__", "toString"]) {
    ok(`no function ${name}`, undefined, lookup(name));
  }
  ok("table holds exactly the whitelisted functions", [...FUNCTIONS].sort(), tableNames().sort());
  ok("incremental recalculation equals a fresh load after 40 edits", 0, incrementalMismatches());
  return { passed, failed: failures.length, failures };
}

/** Edits inputs of the generated board through set + recalc, then compares every node with a fresh load. */
function incrementalMismatches(): number {
  const nodes = buildGraph(generateBoard());
  const inputs = nodes.filter((n) => n.formula === undefined && typeof n.value === "number");
  const live = createOwnEngine();
  live.load(nodes);
  const values = new Map(nodes.map((n) => [n.address, n.value ?? null]));
  let seed = 7;
  for (let i = 0; i < 40; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const node = inputs[seed % inputs.length];
    if (!node) continue;
    const value = 1 + (seed % 17);
    live.set(node.address, value);
    values.set(node.address, value);
    if (i % 3 === 0) live.recalc();
  }
  live.recalc();
  const fresh = createOwnEngine();
  fresh.load(nodes.map((n) => (n.formula === undefined ? { ...n, value: values.get(n.address) ?? null } : n)));
  let mismatches = 0;
  for (const n of nodes) if (JSON.stringify(live.read(n.address)) !== JSON.stringify(fresh.read(n.address))) mismatches++;
  return mismatches;
}
