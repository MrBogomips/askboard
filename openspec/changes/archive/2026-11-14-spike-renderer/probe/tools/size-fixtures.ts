// Writes the fixtures of task group 5 into fixtures/: the JSON files are the record, and this
// script says how they were made. Design decision 7's three boards are `golden` (group 3), and
// `size-uj1` and `size-all` below, built from the items of the group 2 to 4 fixtures in the
// configuration each passed with. `c-diff-plain-vars-shim` is Diff review with highlighting off.
//
// Usage, from probe/: bun tools/size-fixtures.ts   (after tools/diagram-fixtures.ts and
// tools/component-fixtures.ts, whose fixtures it reads)

import { join } from "node:path";
import type { Fixture } from "../board.ts";

type Item = Fixture["board"]["items"][number];

const dir = join(import.meta.dir, "..", "fixtures");
const written: string[] = [];
const write = async (name: string, fixture: Fixture) => {
  await Bun.write(`${dir}/${name}.json`, `${JSON.stringify(fixture, null, 2)}\n`);
  written.push(name);
};

const find = (items: readonly Item[], id: string): Item | undefined => {
  for (const item of items) {
    if (item.id === id) return item;
    const inner = find(item.children ?? [], id);
    if (inner) return inner;
  }
  return undefined;
};

// An item of another fixture, by its ID; `as` gives it a new ID where two fixtures share one.
const take = async (fixture: string, id: string, as?: string): Promise<Item> => {
  const { board } = (await Bun.file(join(dir, `${fixture}.json`)).json()) as Fixture;
  const item = find(board.items, id);
  if (!item) throw new Error(`no item ${id} in fixture ${fixture}`);
  return as ? { ...item, id: as } : item;
};

const unique = (items: readonly Item[]): void => {
  const seen = new Set<string>();
  const visit = (list: readonly Item[]) => {
    for (const item of list) {
      if (seen.has(item.id)) throw new Error(`item ID ${item.id} twice`);
      seen.add(item.id);
      visit(item.children ?? []);
    }
  };
  visit(items);
};

// Diff review with highlighting off: the CSS-variables theme, files named `.txt` (task 4.2).
const diff = await take("c-diff-vars-shim", "df1");
await write("c-diff-plain-vars-shim", {
  description: "@pierre/diffs, no highlighting, the CSS-variables theme and the markup shim",
  board: {
    id: "c-diff-plain-vars-shim",
    title: "@pierre/diffs, no highlighting, the CSS-variables theme and the markup shim",
    items: [{ ...diff, props: { ...diff.props, config: "plain-variables" } }],
  },
  check: { selector: "[data-item-id=df1]", text: "" },
});

// UJ-1 (PRD): which of two fixes to keep, as a Diff review beside the decision record's excerpt,
// and whether to change the retry state machine, as a Graph.
const DECISION_RECORD = [
  "#### ADR-0007 · Retry policy (docs/adr/0007-retry.md · lines 12–24)",
  "",
  "Payment retries back off **exponentially** and stop after 30 s, so a slow gateway is not",
  "flooded. A fixed delay is kept only for the queue's own reconnects.",
  "",
  "| Attempt | Delay |",
  "| :--- | ---: |",
  "| 1 | 0.2 s |",
  "| 2 | 0.4 s |",
  "| 5 | 3.2 s |",
].join("\n");
const uj1Items: Item[] = [
  {
    id: "q1",
    type: "Group",
    props: { title: "Which fix should we keep?" },
    children: [
      {
        id: "r1",
        type: "Row",
        props: { widths: [3, 2] },
        children: [diff, { id: "md1", type: "Markdown", props: { source: DECISION_RECORD, alignClasses: true } }],
      },
      {
        id: "c1",
        type: "Choice",
        props: {
          label: "Which fix should we keep?",
          options: [
            { value: "a", label: "Fix A: exponential backoff in retry.ts" },
            { value: "b", label: "Fix B: backoff in the queue" },
          ],
        },
      },
    ],
  },
  {
    id: "q2",
    type: "Group",
    props: { title: "Change the retry state machine?" },
    children: [
      {
        id: "gr1",
        type: "Graph",
        props: {
          label: "Payment retry",
          nodes: [
            { id: "idle", label: "idle" },
            { id: "attempt", label: "attempt" },
            { id: "wait", label: "wait" },
            { id: "done", label: "done" },
            { id: "failed", label: "failed" },
          ],
          edges: [
            { from: "idle", to: "attempt" },
            { from: "attempt", to: "wait" },
            { from: "wait", to: "attempt" },
            { from: "attempt", to: "done" },
            { from: "attempt", to: "failed" },
          ],
        },
      },
      { id: "n1", type: "TextField", props: { label: "Note for the agent (optional)" } },
    ],
  },
];
unique(uj1Items);
await write("size-uj1", {
  description: "A UJ-1-like board: Diff review beside a Markdown excerpt, and a Graph (design decision 7)",
  board: { id: "size-uj1", title: "Payment retry fix", items: uj1Items },
  check: { selector: "[data-item-id=md1] table", text: "Delay" },
});

// Every component of EXPERIENCE.md, Composition and Components, that the spike built: the atoms
// and layouts (fixture `atoms`), then one item per widget, each in its passing configuration
// (§ Criterion 1, § Form, § S-6). Not built by the spike: Image, MoneyField, Approval, Gantt,
// Timeline and Image annotation (own code with no library of their own).
const allItems: Item[] = [
  await take("atoms", "s1"),
  await take("c-slider", "sl1"),
  await take("c-toggle-group", "tg1", "tgg1"),
  await take("c-date-picker", "dp1"),
  await take("c-ranking", "rk1"),
  await take("form-shim", "f1"),
  await take("c-markdown-classes", "md1"),
  diff,
  await take("c-katex", "mx1"),
  await take("c-mathlive-shim", "ml1"),
  await take("c-table", "ta1"),
  await take("c-spreadsheet", "ss1"),
  await take("c-tree", "tr1"),
  await take("c-chart-rich", "ch1"),
  await take("c-graph", "gr1"),
  await take("mermaid-flowchart-shim", "m1"),
  await take("plantuml-sequence-shim", "p1"),
  await take("c-kanban", "kb1"),
  // The delivery-mode switch's confirmation, modal with the style-element shim (S-6).
  await take("s6-dialog-shim", "dl1"),
];
unique(allItems);
await write("size-all", {
  description: "Every component the spike built, each in its passing configuration (design decision 7)",
  board: { id: "size-all", title: "Every component", items: allItems },
  check: { selector: "[data-item-id=t1]", text: "retry policy" },
  expectDiagrams: ["m1", "p1"],
});

// The same board with the Form's single pick from a list shown as radios, not a Radix Select,
// whose hidden native `<select>` WebKit reports under a hash-only `style-src` (§ Criterion 1).
const radios = allItems.map((item) => {
  if (item.id !== "f1") return item;
  const ui = item.props?.uiSchema as Record<string, Record<string, unknown>>;
  return { ...item, props: { ...item.props, uiSchema: { ...ui, size: { ...ui.size, "ui:widget": "radio" } } } };
});
await write("size-all-radios", {
  description: "Every component, the Form's single pick from a list as radios rather than a Select",
  board: { id: "size-all-radios", title: "Every component, no Select", items: radios },
  check: { selector: "[data-item-id=t1]", text: "retry policy" },
  expectDiagrams: ["m1", "p1"],
});

console.log(`wrote ${written.length} fixtures: ${written.join(", ")}`);
