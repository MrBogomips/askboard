// The item catalogue and SKILL.md's links (skill-index, skills spec: The item catalogue and Every
// reference one level from SKILL.md; design decisions 1, 2 and 4).

import { describe, expect, test } from "bun:test";
import { WIDGET_TYPES, type WidgetType } from "@askboard/contract";
import { ATOM_TYPES, PROBE_WIDGET, withWidgetTypes } from "@askboard/contract/fixtures";
import { MOLECULE_SKILLS, READY_MOLECULES } from "@askboard/molecules";
import { BUDGETS, budgetReport } from "./budgets.ts";
import { generateSkill } from "./generate.ts";
import { contextTypes } from "./references.ts";

const { files } = generateSkill();
const skill = files.get("SKILL.md") ?? "";
const catalogue = files.get("references/items.md") ?? "";

const probe = (type: string, use: string): WidgetType => ({
  ...PROBE_WIDGET,
  type,
  noun: `a ${type}`,
  skill: { use },
});

const lines = (text: string): string[] => text.split("\n");

describe("the item catalogue", () => {
  const tree = WIDGET_TYPES.find(({ type }) => type === "tree");

  test("holds the Tree's line with its noun, type and use", () => {
    expect(catalogue).toContain(`- ${tree?.noun} (\`tree\`): ${tree?.skill?.use}`);
  });

  test("has the headings Context items, Widgets and Molecules in that order, after a lead", () => {
    const at = ["## Context items", "## Widgets", "## Molecules"].map((h) => catalogue.indexOf(h));
    expect(at.every((position) => position > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(catalogue.startsWith("# ")).toBe(true);
    expect(catalogue).toContain("what each item type is for");
  });

  test("lists context items, widgets in registry order, then molecules, with their uses", () => {
    const labels = [
      ...contextTypes().map((type) => `- \`${type}\`: `),
      ...WIDGET_TYPES.map(({ noun, type }) => `- ${noun} (\`${type}\`): `),
      ...READY_MOLECULES.map(({ molecule }) => `- \`${molecule}\`: `),
    ];
    const positions = labels.map((label) => catalogue.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const { use } of Object.values(MOLECULE_SKILLS)) expect(catalogue).toContain(use);
  });

  test("measures against the reference budget, naming the file when over", () => {
    const over = new Map(files).set("references/items.md", "x".repeat(6001));
    const { problems } = budgetReport(over);
    expect(problems.some((p) => p.startsWith("references/items.md has 6,001 characters"))).toBe(
      true,
    );
    expect(budgetReport(files).problems).toEqual([]);
  });
});

describe("SKILL.md's links", () => {
  test("link the Tree's reference by type and hold no use", () => {
    const tree = WIDGET_TYPES.find(({ type }) => type === "tree");
    expect(skill).toContain("[`tree`](references/widgets/tree.md)");
    expect(skill).not.toContain(tree?.skill?.use ?? "unreachable");
    for (const { use } of Object.values(MOLECULE_SKILLS)) expect(skill).not.toContain(use);
  });

  test("hold four index lines after the template's lead", () => {
    const marker = "Read the reference of a type before you use it:\n\n";
    const at = skill.indexOf(marker) + marker.length;
    const index = lines(skill.slice(at, skill.indexOf("\n\n", at)));
    expect(index).toHaveLength(4);
    expect(index[0]).toBe("- What each type is for: [items](references/items.md)");
    expect(index[1]).toBe(
      `- Context items, in [context](references/context.md): ${contextTypes()
        .map((type) => `\`${type}\``)
        .join(", ")}`,
    );
    expect(index[2]).toBe(
      `- Widgets: ${WIDGET_TYPES.map(({ type }) => `[\`${type}\`](references/widgets/${type}.md)`).join(", ")}`,
    );
    expect(index[3]).toBe(
      `- Molecules: ${READY_MOLECULES.map(
        ({ molecule }) => `[\`${molecule}\`](references/molecules/${molecule}.md)`,
      ).join(", ")}`,
    );
  });

  test("target every generated file but SKILL.md, and no other file links one", () => {
    const targets = (text: string) =>
      [...text.matchAll(/\]\((references\/[^)]+)\)/g)].map((match) => match[1] ?? "");
    const linked = new Set(targets(skill));
    for (const path of files.keys()) {
      if (path !== "SKILL.md") expect(linked.has(path), path).toBe(true);
    }
    for (const [path, text] of files) {
      if (path !== "SKILL.md") expect(targets(text), path).toEqual([]);
    }
  });
});

describe("a widget type registered", () => {
  test("adds one catalogue line and one link, and nothing else changes", () => {
    const more = generateSkill({
      widgets: [...WIDGET_TYPES, probe("probe", "a pick among options")],
    }).files;
    const diff = (before: string, after: string) => {
      const old = new Set(lines(before));
      return lines(after).filter((line) => !old.has(line));
    };
    expect(diff(catalogue, more.get("references/items.md") ?? "")).toEqual([
      "- a probe (`probe`): a pick among options",
    ]);
    const changed = diff(skill, more.get("SKILL.md") ?? "");
    expect(changed).toHaveLength(1);
    expect(changed[0]).toContain("[`probe`](references/widgets/probe.md)");
    expect(lines(more.get("SKILL.md") ?? "")).toHaveLength(lines(skill).length);
    expect(lines(more.get("references/items.md") ?? "")).toHaveLength(lines(catalogue).length + 1);
  });

  test("twelve more types with uses of 120 characters stay within every budget", () => {
    const extra = Array.from({ length: 12 }, (_unused, n) =>
      probe(`probe-${n}`, `${"u".repeat(119)}.`),
    );
    const { files: many } = generateSkill({ widgets: withWidgetTypes(...ATOM_TYPES, ...extra) });
    expect(budgetReport(many).problems).toEqual([]);
    expect((many.get("SKILL.md") ?? "").length).toBeLessThanOrEqual(BUDGETS.skill);
    expect((many.get("references/items.md") ?? "").length).toBeLessThanOrEqual(BUDGETS.reference);
  });
});
