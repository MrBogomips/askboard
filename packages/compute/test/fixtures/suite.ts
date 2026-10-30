// Every compute fixture through `buildGraph` and the adapter, as the formula spike's probe ran them
// (probe/src/suite.ts): each check passes when equal, or within 1e-9 relative for a number, which
// counts apart as an exact mismatch. Errors compare by kind only. Plain ECMAScript, so the
// determinism check can run it in any runtime.

import { evaluateGraph } from "../../src/evaluate.ts";
import { buildGraph } from "../../src/graph/build.ts";
import type { Fields, GraphChild, GraphSource } from "../../src/source.ts";
import { type Address, isFormulaError, type NodeResult } from "../../src/types.ts";
import { ERROR_FIXTURES, type Expected } from "./index.ts";
import whitelist from "./whitelist.json" with { type: "json" };

export const TOLERANCE = 1e-9;

/** The functions the formula spike dropped from the whitelist (findings, row 2). */
export const DROPPED: ReadonlySet<string> = new Set([
  "OR",
  "NOT",
  "ABS",
  "CEILING",
  "AVERAGE",
  "COUNT",
  "NETWORKDAYS",
]);

export type WhitelistCase = {
  readonly id: string;
  readonly op: string;
  readonly formula: string;
  readonly expected: Expected;
  readonly type?: "number" | "money" | "date" | "boolean" | "text";
  readonly use?: readonly string[];
  readonly inputs?: Fields;
  readonly warnings?: readonly { readonly error: string; readonly address: string }[];
};

type InputSet = { readonly fields?: Fields; readonly children?: readonly GraphChild[] };

export const WHITELIST_CASES = whitelist.cases as unknown as readonly WhitelistCase[];
const INPUT_SETS = whitelist.inputSets as unknown as Readonly<Record<string, InputSet>>;

/** A case's source: item x from the input sets it uses and its own inputs, then t.r. */
export const whitelistSource = (c: WhitelistCase): GraphSource => {
  const sets = (c.use ?? []).map((name) => INPUT_SETS[name] as InputSet);
  const fields = Object.assign({}, ...sets.map((set) => set.fields ?? {}), c.inputs ?? {});
  const children = sets.flatMap((set) => set.children ?? []);
  return {
    items: [
      { kind: "fields", id: "x", fields, children },
      { kind: "fields", id: "t", fields: { r: { type: c.type ?? "number", formula: c.formula } } },
    ],
  };
};

export type Verdict = "pass" | "exact-mismatch" | "fail";

export const compareValue = (expected: Expected, actual: NodeResult): Verdict => {
  if (typeof expected === "number" && typeof actual === "number") {
    if (actual === expected) return "pass";
    const close = Math.abs(actual - expected) <= TOLERANCE * Math.max(1, Math.abs(expected));
    return close ? "exact-mismatch" : "fail";
  }
  if (expected !== null && typeof expected === "object") {
    return isFormulaError(actual) && actual.error === expected.error ? "pass" : "fail";
  }
  return expected === actual ? "pass" : "fail";
};

/** A result as the hash records it: errors by kind only. */
export const normalise = (result: NodeResult): Expected =>
  isFormulaError(result) ? { error: result.error } : result;

export type Failure = {
  readonly fixture: string;
  readonly check: string;
  readonly expected: unknown;
  readonly actual: unknown;
};

export class Tally {
  passed = 0;
  failed = 0;
  readonly exactMismatches: string[] = [];
  readonly failures: Failure[] = [];
  readonly results: Record<string, Record<string, unknown>> = {};

  check(
    fixture: string,
    check: string,
    verdict: Verdict,
    expected: unknown,
    actual: unknown,
  ): void {
    const results = this.results[fixture] ?? {};
    results[check] = actual;
    this.results[fixture] = results;
    if (verdict === "fail") {
      this.failed++;
      this.failures.push({ fixture, check, expected, actual });
      return;
    }
    this.passed++;
    if (verdict === "exact-mismatch") this.exactMismatches.push(`${fixture}@${check}`);
  }

  warnings(
    fixture: string,
    expected: readonly { error: string; address: string }[],
    actual: readonly { error: string; address: string }[],
  ): void {
    const kindAt = (w: { error: string; address: string }): string => `${w.error}@${w.address}`;
    const want = expected.map(kindAt).sort();
    const got = actual.map(kindAt).sort();
    this.check(fixture, "warnings", want.join() === got.join() ? "pass" : "fail", want, got);
  }

  values(
    fixture: string,
    expected: Readonly<Record<Address, Expected>>,
    read: (address: Address) => NodeResult,
  ): void {
    for (const [address, value] of Object.entries(expected)) {
      const actual = read(address);
      this.check(fixture, address, compareValue(value, actual), value, normalise(actual));
    }
  }
}

export const runWhitelist = (tally: Tally): void => {
  for (const c of WHITELIST_CASES) {
    const graph = buildGraph(whitelistSource(c));
    const actual = evaluateGraph(graph).read("t.r");
    const fixture = `whitelist:${c.id}`;
    if (DROPPED.has(c.op)) {
      const refused =
        isFormulaError(actual) && actual.detail === `function ${c.op} is not whitelisted`;
      tally.check(
        fixture,
        "t.r",
        refused ? compareValue({ error: "not-whitelisted" }, actual) : "fail",
        "not-whitelisted",
        normalise(actual),
      );
      tally.warnings(fixture, [{ error: "not-whitelisted", address: "t.r" }], graph.warnings);
      continue;
    }
    tally.check(fixture, "t.r", compareValue(c.expected, actual), c.expected, normalise(actual));
    tally.warnings(fixture, c.warnings ?? [], graph.warnings);
  }
};

export const runErrors = (tally: Tally): void => {
  for (const fixture of ERROR_FIXTURES) {
    const graph = buildGraph({ items: fixture.items });
    const values = evaluateGraph(graph);
    tally.values(`errors:${fixture.id}`, fixture.expected, (address) => values.read(address));
    tally.warnings(`errors:${fixture.id}`, fixture.warnings, graph.warnings);
  }
};

export const runAll = (): Tally => {
  const tally = new Tally();
  runWhitelist(tally);
  runErrors(tally);
  return tally;
};
