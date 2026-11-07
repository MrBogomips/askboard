// The atoms' teaching text within the skill's budgets (atoms, task 1.2; skills spec: the skill's
// token budget): the skill generated over the shipped registry with the atoms that are not yet
// registered, so that the budget is checked before the registration tasks regenerate the files.
// Each registration task of the atoms adds its type here until the whole set is in.

import { describe, expect, test } from "bun:test";
import { ATOM_TYPES, withWidgetTypes } from "@askboard/contract/fixtures";
import { BUDGETS, budgetReport } from "./budgets.ts";
import { generateSkill } from "./generate.ts";

const widgets = withWidgetTypes(...ATOM_TYPES);
const { files } = generateSkill({ widgets });

describe("the skill with the atoms registered", () => {
  test("lists each atom on one line, with the use of its entry", () => {
    const skill = files.get("SKILL.md") ?? "";
    for (const { type, noun, skill: teaching } of ATOM_TYPES) {
      const line = skill.split("\n").find((each) => each.startsWith(`- ${noun} (\`${type}\`)`));
      expect(line, type).toContain(teaching?.use ?? "no use");
    }
  });

  test("stays within every budget of the skill", () => {
    const { problems } = budgetReport(files);
    expect(problems).toEqual([]);
    const skill = files.get("SKILL.md") ?? "";
    expect(skill.length).toBeLessThanOrEqual(BUDGETS.skill);
  });

  test("holds a reference for each atom within its budget", () => {
    for (const { type } of ATOM_TYPES) {
      const reference = files.get(`references/widgets/${type}.md`);
      expect(reference, type).toBeDefined();
      expect((reference ?? "").length).toBeLessThanOrEqual(BUDGETS.reference);
    }
  });
});
