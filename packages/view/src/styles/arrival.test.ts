import { describe, expect, test } from "bun:test";

// The arrival mark (answer-moves-to-top, D5; DESIGN.md, Arrival mark): the card the move arrives at
// takes the `primary-subtle` fill and a 4 px `primary` edge inside its left border, held for the
// first 25% of 1.2 s and faded to the card's own fill; under forced colours, where engines drop
// the shadow and force the fill, a 3 px `Highlight` outline. The rule is unlayered so that it wins
// over the card's `bg-card` utility. Read as text, as `contrast.test.ts` does.

const read = async (name: string): Promise<string> =>
  (await Bun.file(new URL(name, import.meta.url)).text()).replace(/\/\*[\s\S]*?\*\//g, "");
const motion = await read("./motion.css");
const forced = await read("./forced-colors.css");

/** The text of the block whose header is at `open`'s `{`, braces balanced; and the text after it. */
const blockAt = (text: string, open: number): { body: string; end: number } => {
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    if (text[at] === "{") depth += 1;
    if (text[at] === "}") {
      depth -= 1;
      if (depth === 0) return { body: text.slice(open + 1, at), end: at + 1 };
    }
  }
  return { body: text.slice(open + 1), end: text.length };
};

/** The sheet without its `@layer` blocks: what lies outside every layer. */
const unlayered = (text: string): string => {
  let rest = text;
  for (let at = rest.indexOf("@layer"); at !== -1; at = rest.indexOf("@layer")) {
    const open = rest.indexOf("{", at);
    rest = rest.slice(0, at) + rest.slice(blockAt(rest, open).end);
  }
  return rest;
};

const SELECTOR = "[data-askboard-question][data-askboard-arrived]";
const outside = unlayered(motion);
const ruleOf = (text: string, selector: string): string => {
  const at = text.indexOf(`${selector} {`);
  return at === -1 ? "" : blockAt(text, text.indexOf("{", at)).body;
};

describe("the arrival mark", () => {
  test("the arrived card's rule is outside every layer, on the question and its hook", () => {
    expect(ruleOf(outside, SELECTOR)).not.toBe("");
  });

  test("it sets the primary-subtle fill and a 4 px primary edge inside the border", () => {
    const rule = ruleOf(outside, SELECTOR);
    expect(rule).toContain("background-color: var(--primary-subtle)");
    expect(rule).toContain("box-shadow: inset 4px 0 0 var(--primary)");
  });

  test("with no preference it runs askboard-arrival for 1.2 s, ease-out, forwards", () => {
    const media = outside.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(media).not.toBe(-1);
    const inside = blockAt(outside, outside.indexOf("{", media)).body;
    const rule = ruleOf(inside, SELECTOR);
    expect(rule).toContain("animation: askboard-arrival 1.2s ease-out forwards");
  });

  test("the keyframes hold to 25% and end at the card's own fill with a clear edge", () => {
    const at = outside.indexOf("@keyframes askboard-arrival");
    expect(at).not.toBe(-1);
    const frames = blockAt(outside, outside.indexOf("{", at)).body.replace(/,\s+/g, ", ");
    const held = ruleOf(frames, "0%, 25%");
    expect(held).toContain("background-color: var(--primary-subtle)");
    expect(held).toContain("box-shadow: inset 4px 0 0 var(--primary)");
    const end = ruleOf(frames, "100%");
    expect(end).toContain("background-color: var(--card)");
    expect(end).toContain("box-shadow: inset 4px 0 0 transparent");
  });

  test("the layered mark of the sheet's earlier form is gone", () => {
    expect(motion).not.toContain("inset 2px 0 0");
    expect(motion).not.toMatch(/@layer components \{\s*\[data-askboard-arrived\]/);
  });

  test("the reduced-motion rule still zeroes every animation and transition", () => {
    expect(motion).toContain("@media (prefers-reduced-motion: reduce)");
    expect(motion).toContain("animation-duration: 0s !important");
    expect(motion).toContain("transition-duration: 0s !important");
  });

  test("forced colours draw a 3 px Highlight outline instead", () => {
    const open = forced.indexOf("{", forced.indexOf("@media (forced-colors: active)"));
    const body = blockAt(forced, open).body;
    const rule = ruleOf(body, SELECTOR);
    expect(rule).toContain("outline: 3px solid Highlight");
    expect(rule).toContain("outline-offset: 2px");
  });
});
