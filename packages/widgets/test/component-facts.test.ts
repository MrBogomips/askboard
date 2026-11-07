// A widget chunk's facts agree with its registry entry (widget-registry, design decision 8): the
// chunks register their element shape and the name of the agent-change notice with their
// components, so a widget change cannot drift from the contract. The chunks' entries are imported
// in a process of their own: loaded here they would count, unrun, against the files' coverage.

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  APPROVAL_DECISIONS,
  WIDGET_TYPES,
  type WidgetType,
  widgetAnswerProblems,
  widgetResultFits,
  widgetResultProblems,
} from "@askboard/contract";

const SRC = join(import.meta.dir, "../src");
// The atoms' chunks are catalog components of the view (atoms, design decision 4), not widgets'.
const CATALOG = join(import.meta.dir, "../../view/src/catalog");

// What each chunk registered for the example props of its registry entry, as the child prints it.
// A chunk is `src/<type>/index.tsx`, built from the entry, so a type added to the registry is
// checked with no edit here; an atom's is `view/src/catalog/<type>/index.tsx`.
const CHUNKS = WIDGET_TYPES.map((entry) => {
  const widget = join(SRC, entry.type, "index.tsx");
  return existsSync(widget) ? widget : join(CATALOG, entry.type, "index.tsx");
});

// Results to put to every type's `fits`, a type's own and others': each type's check must agree
// with the contract's whatever the shape, over the example props of its entry.
const probesOf = (entry: WidgetType): readonly unknown[] => {
  const ids = ((entry.example.item.props as { items?: { id: string }[] }).items ?? []).map(
    ({ id }) => id,
  );
  const chart = entry.example.item.props as {
    series?: { id: string }[];
    categories?: { id: string }[];
  };
  const series = chart.series?.[0]?.id ?? "series";
  const category = chart.categories?.[0]?.id ?? "category";
  return [
    ...APPROVAL_DECISIONS.map((decision) => ({ decision })),
    // The Chart's: a point it holds, two, none, a point it does not hold, and a point twice.
    { points: [{ series, category }] },
    {
      points: [
        { series, category },
        { series, category: chart.categories?.[1]?.id ?? category },
      ],
    },
    { points: [] },
    { points: [{ series: "other", category }] },
    { points: [{ series, category: "other" }] },
    {
      points: [
        { series, category },
        { series, category },
      ],
    },
    { points: [{ series }] },
    { value: 3 },
    { value: 9 },
    { value: 1e-200 },
    { low: 1, high: 2 },
    { order: [] },
    { order: ids },
    { order: [...ids].reverse() },
    { order: ids.slice(1) },
    { order: [...ids, "extra"] },
    // Shapes no type takes, and one of each type's own with a field it lacks or a value off its kind.
    { value: "5" },
    { low: 1 },
    { decision: "maybe" },
    { decision: "approve", extra: 1 },
    { order: "speed" },
    {},
    [],
    null,
  ];
};

const SCRIPT = `
import { WIDGET_TYPES } from "@askboard/contract";
import { componentFacts } from "@askboard/view/catalog";
${CHUNKS.map((chunk) => `await import(${JSON.stringify(chunk)});`).join("\n")}
const probes = ${JSON.stringify(WIDGET_TYPES.map(probesOf))};
console.log(JSON.stringify(WIDGET_TYPES.map((entry, at) => {
  const facts = componentFacts(entry.type);
  return {
    type: entry.type,
    name: facts?.name,
    shape: facts?.shape?.(entry.example.item.props),
    confirmsRevision: facts?.confirmsRevision,
    fits: facts?.fits === undefined ? undefined : probes[at].map(
      (result) => facts.fits(result, entry.example.item.props),
    ),
    probeReasons: facts?.reason === undefined ? undefined : probes[at].map(
      (result) => facts.reason(result) ?? null,
    ),
    reasons: facts?.reason === undefined ? undefined : ${JSON.stringify(APPROVAL_DECISIONS)}.map(
      (decision) => facts.reason({ decision }) ?? null,
    ),
  };
})));
`;

type Facts = {
  type: string;
  name?: string;
  shape?: unknown;
  confirmsRevision?: true;
  fits?: readonly boolean[];
  probeReasons?: readonly ({ label: string; missing: string } | null)[];
  reasons?: readonly ({ label: string; missing: string } | null)[];
};

const registered = async (): Promise<readonly Facts[]> => {
  const child = Bun.spawn([process.execPath, "-e", SCRIPT], {
    cwd: join(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(err);
  return JSON.parse(out);
};

describe("each registered widget type's chunk", () => {
  test("registers a notice name and the element shape its registry entry gives", async () => {
    const facts = await registered();
    expect(CHUNKS).toHaveLength(WIDGET_TYPES.length);
    expect(facts.map(({ type }) => type)).toEqual(WIDGET_TYPES.map(({ type }) => type));
    for (const [at, entry] of WIDGET_TYPES.entries()) {
      // A display atom gives no answer and edits nothing: it registers no facts, so no name.
      if (entry.result === undefined && entry.edits === undefined) {
        expect(facts[at]?.name, `${entry.type} names no notice`).toBeUndefined();
        continue;
      }
      expect(facts[at]?.name).toMatch(/^change\./);
      // A result-only widget has no edits, so no element shape to compare.
      if (entry.edits !== undefined) {
        expect(facts[at]?.shape).toEqual(entry.edits.shape(entry.example.item.props));
      }
    }
  });
});

describe("a chunk's fact `fits`", () => {
  test("is registered exactly when the type's entry gives a result, and agrees with the contract's check", async () => {
    const facts = await registered();
    for (const [at, entry] of WIDGET_TYPES.entries()) {
      const fits = facts[at]?.fits;
      expect(fits !== undefined, `${entry.type}: fits registered exactly with a result`).toBe(
        entry.result !== undefined,
      );
      if (fits === undefined) continue;
      expect(fits).toEqual(
        probesOf(entry).map((result) =>
          widgetResultFits(entry.example.item, result, entry.example.item.props),
        ),
      );
      // A check that said yes to everything or no to everything would pass the agreement trivially.
      expect(new Set(fits).size).toBe(2);
    }
  });

  test("is false for every result the contract's check, schema included, refuses", async () => {
    const facts = await registered();
    for (const [at, entry] of WIDGET_TYPES.entries()) {
      const fits = facts[at]?.fits;
      if (fits === undefined) continue;
      for (const [index, result] of probesOf(entry).entries()) {
        const refused = widgetResultProblems(entry.example.item, result, entry.example.item.props);
        expect(fits[index], `${entry.type}: ${JSON.stringify(result)}`).toBe(refused.length === 0);
      }
    }
  });
});

describe("the Chart's chunk", () => {
  test("names the notice for its type, edits nothing and asks for no reason or confirmation", async () => {
    const facts = (await registered()).find(({ type }) => type === "chart");
    expect(facts?.name).toBe("change.widgetChart");
    expect(facts?.shape).toBeUndefined();
    expect(facts?.confirmsRevision).toBeUndefined();
    expect(facts?.probeReasons).toBeUndefined();
  });

  test("takes a result of the points its props hold and no other", async () => {
    const facts = await registered();
    const at = WIDGET_TYPES.findIndex(({ type }) => type === "chart");
    const entry = WIDGET_TYPES[at];
    if (entry === undefined) throw new Error("the registry holds no Chart");
    const fits = facts[at]?.fits ?? [];
    const probes = probesOf(entry);
    const verdict = (result: unknown) =>
      fits[probes.findIndex((probe) => Bun.deepEquals(probe, result))];
    const { series, categories } = entry.example.item.props as {
      series: { id: string }[];
      categories: { id: string }[];
    };
    const [first, second] = [series[0]?.id, categories[1]?.id];
    expect(verdict({ points: [{ series: first, category: categories[0]?.id }] })).toBe(true);
    expect(
      verdict({
        points: [
          { series: first, category: categories[0]?.id },
          { series: first, category: second },
        ],
      }),
    ).toBe(true);
    expect(verdict({ points: [] })).toBe(false);
    expect(verdict({ points: [{ series: "other", category: categories[0]?.id }] })).toBe(false);
    expect(verdict({ points: [{ series: first }] })).toBe(false);
  });
});

describe("the Approval's chunk", () => {
  test("asks to confirm a revision and names the notice for its type", async () => {
    const facts = (await registered()).find(({ type }) => type === "approval");
    expect(facts?.confirmsRevision).toBe(true);
    expect(facts?.name).toBe("change.widgetApproval");
  });

  test("requires a reason for a decision exactly when the contract's answer check refuses it with no note", async () => {
    const facts = (await registered()).find(({ type }) => type === "approval");
    expect(facts?.reasons).toHaveLength(APPROVAL_DECISIONS.length);
    for (const [at, decision] of APPROVAL_DECISIONS.entries()) {
      const refused =
        widgetAnswerProblems(
          { type: "approval", id: "verdict" },
          { decision },
          { note: undefined, changed: false },
        ).length > 0;
      const pair = facts?.reasons?.[at];
      expect(pair !== null && pair !== undefined).toBe(refused);
      if (refused) {
        expect(pair).toEqual({
          label: "question.reasonRequired",
          missing: "question.reasonMissing",
        });
      }
    }
  });
});

// The seams of design decision 5 stay open to later widgets: this lists no type that may use them,
// it checks what they promise of any type that does.
describe("the facts `reason` and `confirmsRevision` of any registered type", () => {
  const refused = (entry: WidgetType, result: unknown): boolean =>
    widgetAnswerProblems(entry.example.item, result, { note: undefined, changed: false }).length >
    0;

  test("a type that registers `reason` gives a pair for a result exactly when its answer check refuses that result with no note and nothing changed, and has such a result", async () => {
    const facts = await registered();
    for (const [at, entry] of WIDGET_TYPES.entries()) {
      const pairs = facts[at]?.probeReasons;
      if (pairs === undefined) continue;
      const probes = probesOf(entry);
      expect(entry.result, `${entry.type} registers a reason and gives no result`).toBeDefined();
      expect(
        probes.some((result) => refused(entry, result)),
        `${entry.type} can need a reason`,
      ).toBe(true);
      for (const [index, result] of probes.entries()) {
        const pair = pairs[index];
        expect(
          pair !== null && pair !== undefined,
          `${entry.type}: ${JSON.stringify(result)}`,
        ).toBe(refused(entry, result));
      }
    }
  });

  test("a type that registers `confirmsRevision` gives a result, which a revision replaces", async () => {
    const facts = await registered();
    for (const [at, entry] of WIDGET_TYPES.entries()) {
      if (facts[at]?.confirmsRevision === undefined) continue;
      expect(entry.result, `${entry.type} confirms a revision and gives no result`).toBeDefined();
    }
  });
});
