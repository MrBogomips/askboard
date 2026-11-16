import { describe, expect, test } from "bun:test";

// Forced colours (palettes, task 4.1, design decision D9): inside `@media (forced-colors: active)`
// the focus ring, the borders and the selected and pressed states take system colours, disabled
// controls `GrayText`, state stripes `CanvasText` with their dashed, dotted and solid lines kept,
// and `forced-color-adjust: none` only where colour carries data.

const read = (name: string): Promise<string> => Bun.file(new URL(name, import.meta.url)).text();
const source = await read("./forced-colors.css");
const css = source.replace(/\/\*[\s\S]*?\*\//g, "");

// The text between the media query's braces.
const body = (() => {
  const open = css.indexOf("{", css.indexOf("@media (forced-colors: active)"));
  let depth = 0;
  for (let at = open; at < css.length; at += 1) {
    if (css[at] === "{") depth += 1;
    if (css[at] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, at);
    }
  }
  return "";
})();

// Each rule inside the media query: its selector list and its declarations.
const rules = [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selectors: (match[1] ?? "")
    .split(",")
    .map((selector) => selector.trim())
    .filter((selector) => selector !== ""),
  declarations: (match[2] ?? "").trim(),
}));
const rulesFor = (selector: string) =>
  rules.filter((rule) => rule.selectors.some((candidate) => candidate.includes(selector)));

describe("the forced-colours sheet", () => {
  test("the base layer imports it", async () => {
    expect(await read("./base.css")).toContain('@import "./forced-colors.css";');
  });

  test("everything sits inside the media query, outside any layer, with no !important", () => {
    expect(
      css
        .replace(body, "")
        .replace(/@media \(forced-colors: active\) \{\s*\}/, "")
        .trim(),
    ).toBe("");
    expect(css).not.toContain("@layer");
    expect(css).not.toContain("!important");
    expect(rules.length).toBeGreaterThan(0);
  });

  test("the focus ring is 2 px Highlight, and 3 px under Contrasto", () => {
    const [ring] = rulesFor(":focus-visible");
    expect(ring?.declarations).toContain("outline: 2px solid Highlight");
    const wide = rules.find((rule) =>
      rule.selectors.some((selector) => selector.includes('[data-palette="contrasto"]')),
    );
    expect(wide?.declarations).toContain("outline-width: 3px");
  });

  test("a card, a control, the rail and the ledger take CanvasText borders", () => {
    for (const selector of [
      "[data-askboard-question]",
      "button",
      "input",
      "textarea",
      "[data-askboard-rail]",
      "[data-askboard-ledger]",
    ]) {
      const found = rulesFor(selector).find((rule) =>
        rule.declarations.includes("border-color: CanvasText"),
      );
      expect({ selector, found: found !== undefined }).toEqual({ selector, found: true });
    }
  });

  test("a pressed or selected state is a 2 px Highlight outline", () => {
    for (const selector of [
      '[aria-pressed="true"]',
      '[aria-checked="true"]',
      '[aria-selected="true"]',
      '[data-state="on"]',
      '[data-state="checked"]',
    ]) {
      const found = rulesFor(selector).find((rule) =>
        rule.declarations.includes("outline: 2px solid Highlight"),
      );
      expect({ selector, found: found !== undefined }).toEqual({ selector, found: true });
    }
  });

  test("a disabled control reads GrayText", () => {
    const [disabled] = rulesFor(":disabled");
    expect(disabled?.declarations).toContain("color: GrayText");
    expect(rulesFor('[aria-disabled="true"]')).not.toHaveLength(0);
  });

  test("a state stripe takes CanvasText and keeps its line style: no rule touches border-left-style", () => {
    const [stripe] = rulesFor("[data-askboard-stripe]");
    expect(stripe?.declarations).toContain("border-left-color: CanvasText");
    expect(body).not.toContain("border-left-style");
    expect(body).not.toMatch(/border(-left)?:\s*[^;]*\b(solid|dashed|dotted)\b[^;]*CanvasText/);
  });

  test("forced-color-adjust: none only on the Chart's host, diff marks and the change fill", () => {
    const none = rules.filter((rule) => rule.declarations.includes("forced-color-adjust: none"));
    expect(none).toHaveLength(1);
    expect(none[0]?.selectors.sort()).toEqual(
      ['[class*="bg-diff-"]', '[class~="bg-change-subtle"]', "[data-chart]"].sort(),
    );
    expect(body.match(/forced-color-adjust/g)).toHaveLength(1);
  });

  test("only system colours: no hex, rgb or token variable in the media query", () => {
    expect(body).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(body).not.toContain("rgb(");
    expect(body).not.toContain("var(--");
  });
});
