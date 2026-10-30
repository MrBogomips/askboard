// Hostile error fixtures too large to keep as JSON, adapted from the formula spike's probe
// (probe/fixtures/hostile.ts): built by pure functions, the same on every run. The size cases read
// `over-limit` where the probe read `syntax` (proposal, open question 4).

import type { FieldInput, GraphItem } from "../../src/source.ts";
import type { ErrorFixture } from "./index.ts";

const MB = 1024 * 1024;
const OVER_LIMIT =
  "over-limit replaces the probe's syntax for a formula over a limit (open question 4)";

const formula = (text: string, type: FieldInput["type"] = "number"): FieldInput => ({
  type,
  formula: text,
});

const sizeItem = (): GraphItem => ({
  kind: "fields",
  id: "z",
  fields: {
    parens: formula(`${"(".repeat(10_000)}1${")".repeat(10_000)}`),
    calls: formula(`${"SUM(".repeat(100)}1${")".repeat(100)}`),
    // Under the length limit, so only the nesting limit refuses it.
    unary: formula(`${"-".repeat(5000)}1`),
    megabyte: formula(`1${"+1".repeat(Math.floor((MB - 1) / 2))}`),
    text: formula(`"${"a".repeat(MB)}"`, "text"),
    limit: formula(`${"(".repeat(64)}1${")".repeat(64)}`),
    flat: formula(`1${"+1".repeat(4000)}`),
    range: formula("SUM([z.A1:XFD1048576])"),
  },
  cells: { A1: { type: "number", value: 1 } },
});

const chainItem = (): GraphItem => ({
  kind: "fields",
  id: "c",
  children: Array.from({ length: 10_000 }, (_, i) => ({
    id: `n${i}`,
    fields: { v: i === 0 ? { type: "number", value: 1 } : formula(`[c.n${i - 1}.v]+1`) },
  })),
});

export const hostileFixtures = (): ErrorFixture[] => {
  const refused = ["parens", "calls", "unary", "megabyte", "text", "range"];
  return [
    {
      id: "hostile-size",
      note: "10,000-deep parentheses, 100 nested calls, 5,000 unary minus signs, a 1 MB formula, a 1 MB text literal and a whole-sheet range; 64 levels pass, and so does a flat 4,001-term sum under 8,192 characters",
      changed: OVER_LIMIT,
      items: [sizeItem()],
      expected: {
        ...Object.fromEntries(refused.map((field) => [`z.${field}`, { error: "over-limit" }])),
        "z.limit": 1,
        "z.flat": 4001,
      },
      warnings: refused.map((field) => ({ error: "over-limit", address: `z.${field}` })),
    },
    {
      id: "hostile-chain",
      note: "10,000 nodes, each reading the previous one: ordering and evaluation must not recurse per node",
      items: [chainItem()],
      expected: { "c.n9999.v": 10_000, "c.n5000.v": 5001 },
      warnings: [],
    },
  ];
};
