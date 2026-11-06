import { describe, expect, test } from "bun:test";
import { BUTTON_SECONDARY } from "../shell/styles.ts";

const read = (name: string): Promise<string> => Bun.file(new URL(name, import.meta.url)).text();
const css = await read("./hover.css");

// The declaration block of the first rule whose selector holds `selector`.
const ruleOf = (selector: string): string => {
  const at = css.indexOf(selector);
  expect(at).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
};

describe("the shared hover, cursor and focus layer", () => {
  test("both documents' base layer imports it", async () => {
    expect(await read("./base.css")).toContain('@import "./hover.css";');
  });

  test("a pointer on every enabled control: buttons, switches, segments, checkboxes, chevrons", () => {
    const pointer = ruleOf(
      ':not(:disabled, [aria-disabled="true"], [data-disabled]) {\n    cursor: pointer',
    );
    expect(pointer).toContain("cursor: pointer");
    for (const role of ["button", "switch", "radio", "checkbox", "option"]) {
      expect(css).toContain(`[role="${role}"]`);
    }
    expect(css).toContain("[data-chevron]");
    expect(css).toContain("a[href]");
  });

  test("a disabled control reads not allowed", () => {
    const at = css.indexOf(':is(:disabled, [aria-disabled="true"], [data-disabled]) {');
    expect(at).toBeGreaterThan(0);
    expect(css.slice(at, css.indexOf("}", at))).toContain("cursor: not-allowed");
  });

  test("text on an editable cell, grab on a handle, a column resize on an edge", () => {
    expect(ruleOf("[data-editable] {")).toContain("cursor: text");
    expect(ruleOf("[data-grab] {")).toContain("cursor: grab");
    expect(ruleOf('[data-resize="column"] {')).toContain("cursor: col-resize");
  });

  test("the hover pair is the muted fill, the border-strong outline and the card fill", () => {
    const pair = ruleOf(":is(:root, .dark) {");
    expect(pair).toContain("--hover-fill: var(--muted)");
    expect(pair).toContain("--hover-outline: var(--border-strong)");
    expect(pair).toContain("--hover-tool-fill: var(--card)");
  });

  test("a toolbar button takes the border-strong border and the card fill, never when disabled", () => {
    const selector = 'button.bg-muted.border-border:not(:disabled, [aria-disabled="true"]):hover';
    const rule = ruleOf(selector);
    expect(rule).toContain("background-color: var(--hover-tool-fill)");
    expect(rule).toContain("border-color: var(--hover-outline)");
    // The selector's anchor is the class pair every secondary button carries.
    expect(BUTTON_SECONDARY).toContain(" bg-muted ");
    expect(BUTTON_SECONDARY).toContain(" border-border ");
  });

  test("an editable cell and a column edge show a 1px inset outline, not over the focus ring", () => {
    const rule = ruleOf("[data-editable]:hover:not(:focus-visible)");
    expect(rule).toContain("outline: 1px solid var(--hover-outline)");
    expect(rule).toContain("outline-offset: -1px");
  });

  test("a card takes the muted fill, a disabled one nothing", () => {
    const selector =
      '[data-interactive="row"]:not(:disabled, [aria-disabled="true"], [data-disabled]):hover';
    expect(ruleOf(selector)).toContain("background-color: var(--hover-fill)");
  });

  test("hover alone never draws the focus ring: no rule sets the ring's colour", () => {
    expect(css).not.toContain("outline-ring");
    expect(css).not.toContain("--ring");
  });

  // The layer is in `@layer base`, so a utility on the element beats it: an item that carries
  // `cursor-default` would never show the pointer (task 7.1's audit).
  test("a menu item's own classes leave the cursor to the layer", async () => {
    const card = await read("../shell/question-actions.tsx");
    const tree = await read("../../../widgets/src/tree/classes.ts");
    const cardItem = /const MENU_ITEM = `([^`]*)`/.exec(card)?.[1] ?? "";
    const treeItem = /export const MENU_ITEM =((?:\s*"[^"]*"\s*\+?)+);/.exec(tree)?.[1] ?? "";
    for (const classes of [cardItem, treeItem]) {
      expect(classes).not.toBe("");
      expect(classes).not.toContain("cursor-default");
      expect(classes).toContain("cursor-pointer");
      expect(classes).toContain("data-[disabled]:cursor-not-allowed");
    }
  });
});
