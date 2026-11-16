import { describe, expect, test } from "bun:test";

// Contrasto's marks (palettes, task 2.5, design decision D8): a 3 px focus ring and 1.5 px borders
// on cards, buttons and inputs, selected by the existing hooks and element names, outside
// Tailwind's layers so they win over `outline-2` and `border`, and imported by `base.css`.

const read = (name: string): Promise<string> => Bun.file(new URL(name, import.meta.url)).text();
const source = await read("./contrast.css");
const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
const SCOPE = ':root[data-palette="contrasto"]';

// The declaration block of the first rule whose selector list holds `selector`.
const ruleOf = (selector: string): string => {
  const at = css.indexOf(selector);
  expect(at).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
};

describe("Contrasto's marks", () => {
  test("the base layer imports the sheet", async () => {
    expect(await read("./base.css")).toContain('@import "./contrast.css";');
  });

  test("the sheet sits outside any layer, so it outranks the utilities", () => {
    expect(css).not.toContain("@layer");
    expect(css).not.toContain("!important");
  });

  test("every rule is under the palette's attribute: no other palette is touched", () => {
    const selectors = [...css.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map((match) =>
      (match[2] ?? "").trim(),
    );
    expect(selectors.length).toBeGreaterThan(0);
    for (const list of selectors) {
      for (const selector of list.split(",")) expect(selector.trim().startsWith(SCOPE)).toBe(true);
    }
  });

  test("the focus ring is 3 px wide, on every focused control", () => {
    expect(ruleOf(`${SCOPE} :focus-visible`)).toContain("outline-width: 3px");
  });

  test("a question card, a bordered button, an input and a text area take 1.5 px borders", () => {
    const block = ruleOf(`${SCOPE} [data-askboard-question]`);
    expect(block).toContain("border-width: 1.5px");
    for (const selector of [
      "[data-askboard-question]",
      "button.border",
      "input.border",
      "textarea.border",
    ]) {
      expect(css).toContain(`${SCOPE} ${selector}`);
    }
  });

  test("a borderless button is left borderless: only the elements that carry the border class", () => {
    expect(css).not.toMatch(new RegExp(`${SCOPE.replace(/[[\]"]/g, "\\$&")} button[ ,{]`));
    expect(css).not.toMatch(new RegExp(`${SCOPE.replace(/[[\]"]/g, "\\$&")} input[ ,{]`));
  });

  test("widths only: no colour, so the palette's tokens stay the one source of colour", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(css).not.toContain("color:");
  });
});
