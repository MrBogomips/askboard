import { describe, expect, test } from "bun:test";
import { STRINGS } from "./index.ts";
import type { Template } from "./keys.ts";

// Glyphs the board draws as icons (icon-set, design decision 7; view-and-widgets spec, "Icons
// beside their labels"): no string of any language holds one, so a label's accessible name is its
// text alone. The `key.*` values are key names and stay text. The arrow → is a word of a sentence
// in `tree.adjust.example`, and `navigator.nextOpen` keeps it only while that string exists
// (answering-flow-fixes deletes it, #184; task 6.1 drops the exemption then).

const DRAWN = /[↓↩↻↗✓✕×]/u;
const ARROW = "→";
const ARROW_EXEMPT = new Set(["tree.adjust.example", "navigator.nextOpen"]);

const forms = (template: Template): readonly string[] =>
  typeof template === "string" ? [template] : [template.one, template.other];

describe("glyphs in strings", () => {
  for (const [language, table] of Object.entries(STRINGS)) {
    test(`${language}: no value holds a glyph an icon draws, and → only where it is a word`, () => {
      const problems: string[] = [];
      for (const [key, template] of Object.entries(table)) {
        if (key.startsWith("key.")) continue;
        for (const form of forms(template)) {
          if (DRAWN.test(form)) problems.push(`${key}: ${JSON.stringify(form)}`);
          if (form.includes(ARROW) && !ARROW_EXEMPT.has(key))
            problems.push(`${key}: ${JSON.stringify(form)}`);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});
