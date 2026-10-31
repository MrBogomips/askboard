// Every compute fixture through `buildGraph` and the adapter, as the formula spike's probe ran them
// (probe/src/suite.ts): each check passes when equal, or within 1e-9 relative for a number, which
// counts apart as an exact mismatch. Errors compare by kind only. Plain ECMAScript, so the
// determinism check can run it in any runtime.

import { evaluateGraph } from "../../src/evaluate.ts";
import { buildGraph } from "../../src/graph/build.ts";
import type { Fields, GraphChild, GraphItem, GraphSource, WbsNode } from "../../src/source.ts";
import { type Address, isFormulaError, type NodeResult, type Scalar } from "../../src/types.ts";
import { GANTT_FIXTURES } from "./gantt.ts";
import { ERROR_FIXTURES, type Expected } from "./index.ts";
import spreadsheet from "./spreadsheet.json" with { type: "json" };
import uj2 from "./uj2-wbs-gantt.json" with { type: "json" };
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

export type BoardFixture = {
  readonly name: string;
  readonly source: string;
  readonly items: readonly GraphItem[];
  readonly expected: Readonly<Record<Address, Expected>>;
  readonly warnings: readonly { readonly error: string; readonly address: string }[];
  readonly edits: readonly {
    readonly set: Readonly<Record<Address, Scalar>>;
    readonly expected: Readonly<Record<Address, Expected>>;
  }[];
};

export const BOARD_FIXTURES = [uj2, spreadsheet] as unknown as readonly BoardFixture[];

type Mutable = Record<string, unknown>;

const findById = (nodes: readonly Mutable[], id: string): Mutable | undefined => {
  const stack = [...nodes];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    if (node.id === id) return node;
    stack.push(...((node.children ?? []) as Mutable[]));
  }
  return undefined;
};

/** The source with one input changed, as the view's edit would change the board document. */
export const editSource = (
  items: readonly GraphItem[],
  address: Address,
  value: Scalar,
): GraphItem[] => {
  const copy = structuredClone(items) as unknown as Mutable[];
  const [itemId, middle, last] = address.split(".");
  const item = copy.find((candidate) => candidate.id === itemId) as Mutable;
  if (item.kind === "gantt-plan" && middle === "start") item.start = value;
  else if (item.kind === "wbs-pert")
    (findById(item.nodes as WbsNode[] as Mutable[], middle as string) as Mutable)[last as string] =
      value;
  else if (last === undefined) {
    const where = ((item.fields as Mutable | undefined)?.[middle as string] ??
      (item.cells as Mutable)[middle as string]) as Mutable;
    where.value = value;
  } else {
    const child = findById(item.children as Mutable[], middle as string) as Mutable;
    ((child.fields as Mutable)[last] as Mutable).value = value;
  }
  return copy as unknown as GraphItem[];
};

export const runBoards = (tally: Tally): void => {
  for (const board of BOARD_FIXTURES) {
    const fixture = `boards:${board.name}`;
    const graph = buildGraph({ items: board.items });
    const values = evaluateGraph(graph);
    tally.values(fixture, board.expected, (address) => values.read(address));
    tally.warnings(fixture, board.warnings, graph.warnings);
    let items = board.items;
    board.edits.forEach((edit, i) => {
      for (const [address, value] of Object.entries(edit.set)) {
        values.set(address, value);
        items = editSource(items, address, value);
      }
      values.recalc();
      tally.values(`${fixture}#edit${i + 1}`, edit.expected, (address) => values.read(address));
      // Incremental recalculation equals a fresh build of the edited source, node by node.
      const fresh = evaluateGraph(buildGraph({ items }));
      const differ = graph.nodes.filter((node) => {
        const [a, b] = [values.read(node.address), fresh.read(node.address)];
        return JSON.stringify(a) !== JSON.stringify(b);
      });
      tally.check(
        `${fixture}#edit${i + 1}`,
        "fresh",
        differ.length === 0 ? "pass" : "fail",
        [],
        differ,
      );
    });
  }
};

export const runGantt = (tally: Tally): void => {
  for (const fixture of GANTT_FIXTURES) {
    const graph = buildGraph({ items: fixture.items });
    const values = evaluateGraph(graph);
    tally.values(`gantt:${fixture.name}`, fixture.expected, (address) => values.read(address));
    tally.warnings(`gantt:${fixture.name}`, [], graph.warnings);
  }
};

export const runAll = (): Tally => {
  const tally = new Tally();
  runWhitelist(tally);
  runErrors(tally);
  runBoards(tally);
  runGantt(tally);
  return tally;
};
