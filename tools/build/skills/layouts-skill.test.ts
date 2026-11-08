// The layouts' teaching text within the skill's budgets (layouts, task 1.2; contract spec: Teaching
// text of the layouts): the skill generated over the shipped registry with the layouts not yet
// registered, so that the budgets are checked whatever the registry holds, and the shipped skill
// as the registered layouts make it.

import { describe, expect, test } from "bun:test";
import { LAYOUT_WIDGETS, withWidgetTypes } from "@askboard/contract/fixtures";
import { BUDGETS, budgetReport } from "./budgets.ts";
import { generateSkill } from "./generate.ts";

const widgets = withWidgetTypes(...LAYOUT_WIDGETS);
const { files, examples } = generateSkill({ widgets });
const skill = files.get("SKILL.md") ?? "";

describe("the skill with the layouts registered", () => {
  test("lists each layout on one line, with the use of its entry", () => {
    for (const { type, noun, skill: teaching } of LAYOUT_WIDGETS) {
      const line = skill.split("\n").find((each) => each.startsWith(`- ${noun} (\`${type}\`)`));
      expect(line, type).toContain(teaching?.use ?? "no use");
    }
  });

  test("says that a question's items may sit in layouts, once, naming the four", () => {
    const sentences = skill
      .split("\n")
      .filter((line) => line.startsWith("A question's `items` may sit in layouts"));
    expect(sentences).toHaveLength(1);
    for (const { type } of LAYOUT_WIDGETS) expect(sentences[0]).toContain(`\`${type}\``);
    expect(sentences[0]).toContain("four deep at most");
    expect(sentences[0]).toContain("stay in the question's own `items`");
  });

  test("stays within every budget of the skill", () => {
    const { problems } = budgetReport(files);
    expect(problems).toEqual([]);
    expect(skill.length).toBeLessThanOrEqual(BUDGETS.skill);
  });

  test("holds a reference for each layout within its budget, with its fields and its example", () => {
    for (const { type, example } of LAYOUT_WIDGETS) {
      const reference = files.get(`references/widgets/${type}.md`);
      expect(reference, type).toBeDefined();
      expect((reference ?? "").length).toBeLessThanOrEqual(BUDGETS.reference);
      expect(reference).toContain("## Fields");
      expect(reference).toContain(JSON.stringify(example.item.id));
      expect(
        examples.some((each) => each.file === `references/widgets/${type}.md`),
        type,
      ).toBe(true);
    }
  });

  test("lists a layout's items as the union the input format holds, not expanded", () => {
    const reference = files.get("references/widgets/group.md") ?? "";
    expect(reference).toContain("`items` (required, list of `layoutItem`");
    expect(reference.split("\n").filter((line) => line.startsWith("- `")).length).toBeLessThan(12);
  });
});

describe("the shipped skill, as the layouts register", () => {
  test("names the four layouts", () => {
    const shipped = generateSkill().files.get("SKILL.md") ?? "";
    expect(shipped).toContain("may sit in layouts");
    for (const type of ["stack", "row", "group", "tabs"])
      expect(shipped).toContain(`(\`${type}\`)`);
  });
});
