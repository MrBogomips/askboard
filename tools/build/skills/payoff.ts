// What the user has to do, and a complete ask (skill-engagement, design decisions 6 and 7): two
// parts of `references/items.md`, read after the agent has chosen the board and is choosing items.
// Data, so a widget change in flight adds its type to an entry at its rebase and touches no template.

import type { MoleculeDefinition, WidgetType } from "@askboard/contract";
import type { ExampleBody } from "./blocks.ts";
import { contextTypes } from "./references.ts";

/** One thing the user has to do, the types that help, and the line to write when none is registered. */
export type PayoffEntry = {
  readonly goal: string;
  readonly types: readonly string[];
  readonly fallback?: string;
};

/** The entries, on types of `main` only; a type is written only when it is known (see `renderPayoff`). */
export const PAYOFF: readonly PayoffEntry[] = [
  {
    goal: "Choose among options that cite documents, one beside the question for each",
    types: ["excerpt", "reference"],
  },
  { goal: "Review or re-estimate a plan", types: ["wbs-pert", "gantt-plan", "tree", "gantt"] },
  { goal: "Prioritise or triage", types: ["ranking", "kanban"] },
  { goal: "Check figures or dates", types: ["table", "chart", "timeline"] },
  { goal: "Review a document", types: ["document-review"] },
  { goal: "Check a formula", types: ["latex"] },
  { goal: "Approve or rate a proposal", types: ["approval", "scale"] },
  {
    goal: "Judge a UML diagram or a state machine",
    types: [],
    fallback: "an `image` of the rendered file, or an `excerpt` of its source",
  },
];

/** The section: each entry with the types the inputs know, else its fallback, else nothing. */
export const renderPayoff = (
  widgets: readonly WidgetType[],
  molecules: readonly MoleculeDefinition[],
  entries: readonly PayoffEntry[] = PAYOFF,
): string => {
  const known = new Set<string>([
    ...contextTypes(),
    ...widgets.map(({ type }) => type),
    ...molecules.map(({ molecule }) => molecule),
  ]);
  const lines = entries.flatMap(({ goal, types, fallback }) => {
    const held = types.filter((type) => known.has(type));
    if (held.length > 0) return [`- ${goal}: ${held.map((type) => `\`${type}\``).join(", ")}`];
    return fallback === undefined ? [] : [`- ${goal}: ${fallback}`];
  });
  return [
    "## By what the user has to do",
    "Examples, not a list: any item that helps the user grasp the question fits.",
    lines.join("\n"),
  ].join("\n\n");
};

/** One question that cites a decision by ID, with the decision beside it. */
export const COMPLETE_ASK_EXAMPLE: ExampleBody = {
  kind: "ask",
  value: {
    askId: "order-store-q7v4",
    language: "en-US",
    items: [
      {
        type: "question",
        id: "store",
        props: {
          header: "Storage",
          text: "Which store should the order service use under D-03?",
          options: [
            {
              label: "PostgreSQL",
              description: "Meets D-03's retention with partitions",
              recommended: true,
            },
            { label: "SQLite", description: "One file; retention by a nightly job" },
          ],
          items: [
            {
              type: "excerpt",
              id: "d-03",
              props: { pointer: "docs/decisions.md#D-03", title: "D-03: data retention" },
            },
          ],
        },
      },
    ],
  },
};
