// The ask's language in the skill (agent-facing-gaps, task 3.2; skills spec: The ask's language
// taught, Locale and another language taught, A deleted item in the answers reference).

import { describe, expect, test } from "bun:test";
import { contractSchemaResolver, type Schema } from "./fields.ts";
import { generateSkill } from "./generate.ts";

const ASK_ID = "urn:askboard:input:ask";
const askSchema = (): Schema => {
  const found = contractSchemaResolver()(ASK_ID);
  if (found === undefined) throw new Error("no ask schema");
  return found;
};
const enumOf = (schema: Schema, field: string): string[] =>
  ((schema.properties as Record<string, { enum: string[] }>)[field]?.enum ?? []) as string[];

// The ask schema with a change applied to a copy of its `properties`.
const edited = (change: (properties: Record<string, unknown>) => void): Schema => {
  const copy = structuredClone(askSchema()) as { properties: Record<string, unknown> };
  change(copy.properties);
  return copy as unknown as Schema;
};

const { files } = generateSkill();
const skill = files.get("SKILL.md") ?? "";
const answers = files.get("references/answers.md") ?? "";
const section = (text: string): string => {
  const start = text.indexOf("## Language");
  if (start < 0) return "";
  const next = text.indexOf("\n## ", start + 1);
  return text.slice(start, next < 0 ? undefined : next);
};

describe("SKILL.md's language section", () => {
  const language = section(skill);

  test("sits after Keep asks cheap and before Items", () => {
    const at = ["## Keep asks cheap", "## Language", "## Items"].map((h) => skill.indexOf(h));
    expect(at.every((position) => position >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  test("names language, locale and each value the input format admits", () => {
    expect(language).toContain("`language`");
    expect(language).toContain("`locale`");
    for (const value of enumOf(askSchema(), "language")) expect(language).toContain(`\`${value}\``);
    for (const value of enumOf(askSchema(), "locale")) expect(language).toContain(`\`${value}\``);
  });

  test("gives the three sources in order and leaves an unlisted language out", () => {
    const asked = language.indexOf("the one the user asked for");
    const project = language.indexOf("your project's instructions");
    const fallback = language.indexOf("configured default");
    expect(asked).toBeGreaterThan(0);
    expect(project).toBeGreaterThan(asked);
    expect(fallback).toBeGreaterThan(project);
    expect(language).toContain("CLAUDE.md or AGENTS.md, as you have them");
    expect(language).toContain("for another language, or when nothing says, leave it out");
  });

  test("says when to pass locale, that update changes neither, and to close and ask again", () => {
    expect(language).toContain("only when the user's formats for money, dates and numbers differ");
    expect(language).toContain("`update` changes neither");
    expect(language).toContain("close the ask and send a new one");
  });

  test("an input format with a third language adds it to SKILL.md", () => {
    const made = generateSkill({
      askSchema: edited((properties) => {
        properties.language = { enum: ["en-US", "it-IT", "fr-FR"] };
      }),
    });
    const text = section(made.files.get("SKILL.md") ?? "");
    expect(text).toContain("`fr-FR`");
    expect(text).toContain("`en-US`, `it-IT` and `fr-FR`");
  });

  test("an input format with a third locale adds it to the locale list", () => {
    const made = generateSkill({
      askSchema: edited((properties) => {
        properties.locale = { enum: ["en-US", "it-IT", "de-DE"] };
      }),
    });
    expect(section(made.files.get("SKILL.md") ?? "")).toContain("`de-DE`");
  });

  test("an input format without the language enum fails the generator, naming it", () => {
    expect(() =>
      generateSkill({
        askSchema: edited((properties) => {
          delete properties.language;
        }),
      }),
    ).toThrow(/language/);
  });

  test("an input format without the locale enum fails the generator, naming it", () => {
    expect(() =>
      generateSkill({
        askSchema: edited((properties) => {
          delete properties.locale;
        }),
      }),
    ).toThrow(/locale/);
  });

  test("stays within the budget with room to spare", () => {
    expect(skill.length).toBeLessThan(9000);
    expect(skill.split("\n").length - 1).toBeLessThan(250);
  });
});

describe("the answers reference's fetch outcomes", () => {
  test("names deleted and discarded and when each comes", () => {
    expect(answers).toContain("`deleted`");
    expect(answers).toContain("`discarded`");
    expect(answers).toContain("`fetch` of an item you deleted returns the outcome `deleted`");
    expect(answers).toContain("`fetch` of an ask that is gone returns `discarded`");
  });

  test("teaches a molecule reference of a deleted question as deleted, and no expanded ID", () => {
    expect(answers).toContain("a molecule reference of a question you deleted");
    expect(answers).not.toContain("__");
  });

  test("says an item a change dropped, or one the ask never held, is an error", () => {
    expect(answers).toContain("An item a `change` dropped, or one the ask never held, is an error");
  });
});
