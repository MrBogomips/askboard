// Hostile error fixtures too large to keep as JSON: built by pure functions, the same on
// every run. Expected results follow Excel's limits (8,192 characters, nesting modelled on
// its 64 levels), which refs.ts applies before any engine parses.

import type { GraphNode } from "../src/port.ts";

export interface ErrorFixture {
  readonly id: string;
  readonly note?: string;
  readonly nodes?: readonly GraphNode[];
  readonly board?: unknown;
  readonly expected: Readonly<Record<string, unknown>>;
  readonly warnings: readonly { readonly error: string; readonly address: string }[];
}

const MB = 1024 * 1024;

export function hostileFixtures(): ErrorFixture[] {
  const deepParens = `${"(".repeat(10000)}1${")".repeat(10000)}`;
  const deepCalls = `${"SUM(".repeat(100)}1${")".repeat(100)}`;
  // Under the length limit, so it reaches the engine's own parser.
  const deepUnary = `${"-".repeat(5000)}1`;
  const flat = `1${"+1".repeat(4000)}`;
  const megabyte = `1${"+1".repeat(Math.floor((MB - 1) / 2))}`;
  const longText = `"${"a".repeat(MB)}"`;
  const atLimit = `${"(".repeat(64)}1${")".repeat(64)}`;
  const chain: GraphNode[] = [{ address: "c.n0.v", type: "number", value: 1 }];
  for (let i = 1; i < 10000; i++) chain.push({ address: `c.n${i}.v`, type: "number", formula: `[c.n${i - 1}.v]+1` });
  return [
    {
      id: "hostile-size",
      note: "10,000-deep parentheses, 100 nested calls, 5,000 unary minus signs, a 1 MB formula and a 1 MB text literal; 64 levels is the limit and passes, and so does a flat 4,001-term sum under 8,192 characters",
      nodes: [
        { address: "z.parens", type: "number", formula: deepParens },
        { address: "z.calls", type: "number", formula: deepCalls },
        { address: "z.unary", type: "number", formula: deepUnary },
        { address: "z.megabyte", type: "number", formula: megabyte },
        { address: "z.text", type: "text", formula: longText },
        { address: "z.limit", type: "number", formula: atLimit },
        { address: "z.flat", type: "number", formula: flat },
        { address: "z.range", type: "number", formula: "SUM([z.A1:XFD1048576])" },
        { address: "z.A1", type: "number", value: 1 },
      ],
      expected: {
        "z.parens": { error: "syntax" },
        "z.calls": { error: "syntax" },
        "z.unary": { error: "syntax" },
        "z.megabyte": { error: "syntax" },
        "z.text": { error: "syntax" },
        "z.limit": 1,
        "z.flat": 4001,
        "z.range": { error: "syntax" },
      },
      warnings: [
        { error: "syntax", address: "z.parens" },
        { error: "syntax", address: "z.calls" },
        { error: "syntax", address: "z.unary" },
        { error: "syntax", address: "z.megabyte" },
        { error: "syntax", address: "z.text" },
        { error: "syntax", address: "z.range" },
      ],
    },
    {
      id: "hostile-chain",
      note: "10,000 nodes, each reading the previous one: ordering and evaluation must not recurse per node",
      nodes: chain,
      expected: { "c.n9999.v": 10000, "c.n5000.v": 5001 },
      warnings: [],
    },
  ];
}
