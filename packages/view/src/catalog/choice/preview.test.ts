import { describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CatalogComponent, ItemProps } from "../port.ts";
import { OptionPreview } from "./preview.tsx";

// An option's preview under its row (atoms, view-and-widgets spec: Option previews in Markdown,
// Option previews): plain text unless the option marks it Markdown, which the Text atom's component
// draws, named after the question so that its links name the question; if that component is not
// loaded the preview falls back to plain text, never to unsanitized markup.

Object.assign(globalThis, { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });

const seen: ItemProps[] = [];
const Stand: CatalogComponent = (props) => {
  seen.push(props);
  return createElement("div", { "data-stand-in": "text" });
};

const draw = (
  preview: string,
  format: "plain" | "markdown" | undefined,
  find: (name: string) => CatalogComponent | undefined,
): string =>
  renderToStaticMarkup(
    createElement(OptionPreview, {
      id: "pick:option:0:preview",
      itemId: "pick",
      preview,
      ...(format === undefined ? {} : { format }),
      find,
    }) as ReactNode as never,
  );

describe("an option's preview", () => {
  test("with no format it is plain text under its ID, asterisks and line breaks kept", () => {
    const html = draw("**x**\ny", undefined, () => Stand);
    expect(html).toContain('id="pick:option:0:preview"');
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).toContain("**x**\ny");
    expect(seen).toHaveLength(0);
  });

  test("`plain` is plain text too, with markup shown as characters", () => {
    const html = draw("<b>x</b>", "plain", () => Stand);
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(seen).toHaveLength(0);
  });

  test("Markdown goes through the Text component with a synthetic Text that names the question", () => {
    const html = draw("```\ncode\n```", "markdown", (name) =>
      name === "text" ? Stand : undefined,
    );
    expect(html).toContain('id="pick:option:0:preview"');
    expect(html).toContain('data-stand-in="text"');
    const [given] = seen;
    expect(given?.item).toEqual({
      type: "text",
      id: "pick",
      props: { text: "```\ncode\n```", format: "markdown" },
    });
    expect(given?.questionId).toBe("pick");
    expect(given?.disabled).toBe(true);
    expect(given?.entry).toBeUndefined();
    expect(() => given?.ready()).not.toThrow();
  });

  test("Markdown with no Text component loaded shows its source as plain text", () => {
    const html = draw("<script>x</script> **y**", "markdown", () => undefined);
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt; **y**");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<strong>");
  });
});
