import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { componentFor, type ItemProps } from "../port.ts";
import "./index.tsx";

// The Text atom as the server renderer draws it (atoms, view-and-widgets spec: Display atoms,
// Markdown rendered as data, Plain text stays plain). Bun has no DOM, so a Markdown Text shows its
// source as plain text here, which is what the component does when no sanitizer is there; the
// rendered Markdown, the link clicks and the policy are `text.browser.ts`'s.

Object.assign(globalThis, {
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
});

const NONE = () => {};

const draw = (props: unknown, id = "intro"): string => {
  const Text = componentFor("text");
  if (Text === undefined) throw new Error("the text chunk registered nothing");
  const given: ItemProps = {
    item: { type: "text", id, props },
    questionId: "q",
    value: undefined,
    onValueChange: NONE,
    onValuesChange: NONE,
    result: undefined,
    onResultChange: NONE,
    disabled: false,
    ready: NONE,
    board: { items: [], draft: new Map(), shown: new Map() },
    onDerived: NONE,
    entry: undefined,
    onEntryChange: NONE,
  };
  return renderToStaticMarkup(createElement(Text as never, given));
};

describe("the Text atom", () => {
  test("registers under its type", () => {
    expect(componentFor("text")).toBeDefined();
  });

  test("plain text shows as text in the body type, asterisks and line breaks kept", () => {
    const html = draw({ text: "**bold**\nsecond line" });
    expect(html).toContain("**bold**\nsecond line");
    expect(html).toContain('data-text-format="plain"');
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).not.toContain("<strong>");
  });

  test("a plain Text with markup shows the characters, never an element", () => {
    const html = draw({ text: "<img src=x onerror=alert(1)>" });
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
  });

  test("`format: plain` is the default's twin", () => {
    expect(draw({ text: "a", format: "plain" })).toContain('data-text-format="plain"');
  });

  test("with no DOM a Markdown Text shows its source as plain text, never unsanitized", () => {
    const html = draw({ text: "<b>x</b> **y**", format: "markdown" });
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt; **y**");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<strong>");
  });

  test("props the contract refuses fail the item, naming it and the problem", () => {
    expect(() => draw({ text: "" }, "intro")).toThrow('the Text "intro" refuses its props');
    expect(() => draw({ text: "a", format: "html" })).toThrow("/format");
    expect(() => draw({ text: "a", extra: 1 })).toThrow('unknown field "extra"');
    expect(() => draw("text")).toThrow("refuses its props");
  });
});
