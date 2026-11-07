// The PickField's and the Form's teaching text within the skill's budgets (form-widget, task 1.3;
// contract spec: The PickField and forms in the registry and the skill; design decision 7): the
// skill generated over the shipped registry with the PickField not yet registered, so that the
// budgets are checked before the registration task regenerates the files.

import { describe, expect, test } from "bun:test";
import { FORM_TYPES, withWidgetTypes } from "@askboard/contract/fixtures";
import { BUDGETS, budgetReport } from "./budgets.ts";
import { generateSkill } from "./generate.ts";

const FORM_SENTENCE =
  "For a form, put fields in the question, a Group per section; a `required` field must be filled.";

const widgets = withWidgetTypes(...FORM_TYPES);
const { files, examples } = generateSkill({ widgets });
const skill = files.get("SKILL.md") ?? "";
const reference = files.get("references/widgets/pick-field.md") ?? "";

describe("the skill with the PickField registered", () => {
  test("lists the PickField on one line, with the use of its entry", () => {
    const [entry] = FORM_TYPES;
    const line = skill.split("\n").find((each) => each.startsWith("- a PickField (`pick-field`)"));
    expect(line).toContain(entry?.skill?.use ?? "no use");
    expect(line).toContain("references/widgets/pick-field.md");
  });

  test("says how to build a form once, within 100 characters", () => {
    const sentences = skill.split("\n").filter((line) => line.startsWith("For a form,"));
    expect(sentences).toEqual([FORM_SENTENCE]);
    expect(FORM_SENTENCE.length).toBeLessThanOrEqual(100);
  });

  test("stays within every budget of the skill, and says how much room is left", () => {
    const { problems } = budgetReport(files);
    expect(problems).toEqual([]);
    expect(skill.length).toBeLessThanOrEqual(BUDGETS.skill);
  });

  test("holds a reference that lists the field checks' props and words the result", () => {
    expect(reference.length).toBeLessThanOrEqual(BUDGETS.reference);
    for (const field of ["required", "multiple", "minItems", "maxItems", "options"]) {
      expect(reference, field).toContain(`\`${field}\``);
    }
    expect(reference).toContain("an option ID, or a list of option IDs");
    expect(reference).toContain("`results` holds, under the item's ID");
    expect(examples.some((each) => each.file === "references/widgets/pick-field.md")).toBe(true);
  });

  test("gives the elicitation mapping and teaches the TextField's new props", () => {
    expect(reference).toContain("MCP form");
    const text = files.get("references/widgets/text-field.md") ?? "";
    expect(text).toContain("`minLength`");
    expect(text).toContain("`pattern`");
    expect(text).toContain("`required`");
  });
});

describe("the skill without the PickField", () => {
  test("holds no form sentence and no PickField line", () => {
    const shipped = generateSkill().files.get("SKILL.md") ?? "";
    if (shipped.includes("(`pick-field`)")) return;
    expect(shipped).not.toContain("For a form,");
    expect(shipped).not.toContain("PickField");
  });
});
