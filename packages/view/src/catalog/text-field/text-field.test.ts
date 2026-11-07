import { describe, expect, test } from "bun:test";
import { draw } from "../../../test/atoms/draw.ts";
import { componentFacts, componentFor } from "../port.ts";
import "./index.tsx";

// The TextField atom drawn by the server renderer (atoms, task 5.3; view-and-widgets spec: Input
// atoms fill the draft only, Agent content as text; design decision 7). Typing, the cap and the
// read-only look in a browser are `field-atoms.browser.ts`'s.

const field = (props: unknown, options = {}) =>
  draw(componentFor("text-field"), "text-field", props, options);

describe("the TextField's markup", () => {
  test("registers under its type", () => {
    expect(componentFor("text-field")).toBeDefined();
  });

  test("a visible label for the input, and the description under it, which the input is described by", () => {
    const { html } = field({ label: "Name", description: "As in the log." });
    expect(html).toMatch(/<label[^>]*for="atom:field"[^>]*>Name<\/label>/);
    expect(html).toMatch(/<input[^>]*id="atom:field"/);
    expect(html).toContain('id="atom:description"');
    expect(html).toContain('aria-describedby="atom:description"');
    expect(html.indexOf("Name")).toBeLessThan(html.indexOf("As in the log."));
    expect(html).toContain("As in the log.</p>");
  });

  test("without a description the input has none to be described by", () => {
    const { html } = field({ label: "Name" });
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("atom:description");
  });

  test("a single line is an input of type text; multiline is a textarea", () => {
    expect(field({ label: "L" }).html).toMatch(/<input[^>]*type="text"/);
    expect(field({ label: "L" }).html).not.toContain("<textarea");
    const multi = field({ label: "L", multiline: true }).html;
    expect(multi).toContain("<textarea");
    expect(multi).not.toContain("<input");
  });

  test("no maxLength attribute, which would count UTF-16 units", () => {
    expect(field({ label: "L", maxLength: 10 }).html).not.toMatch(/maxlength/i);
    expect(field({ label: "L", multiline: true, maxLength: 10 }).html).not.toMatch(/maxlength/i);
  });

  test("it shows nothing as set before the user acts, and the result as the text once there is one", () => {
    expect(field({ label: "L" }).html).toContain('value=""');
    expect(field({ label: "L" }, { result: "Ada" }).html).toContain('value="Ada"');
    expect(field({ label: "L", multiline: true }, { result: "a\nb" }).html).toContain(
      ">a\nb</textarea>",
    );
  });

  test("a result that is no text shows as an empty field", () => {
    expect(field({ label: "L" }, { result: 5 }).html).toContain('value=""');
  });

  test("answered or locked, the field is read-only, not disabled, so its text can be selected", () => {
    const { html } = field({ label: "L" }, { result: "Ada", disabled: true });
    expect(html).toContain('readOnly=""');
    expect(html).not.toContain("disabled");
  });

  test("a label and a description are text, never markup", () => {
    const { html } = field({ label: "<b>Name</b>", description: "<i>d</i>" });
    expect(html).toContain("&lt;b&gt;Name&lt;/b&gt;");
    expect(html).toContain("&lt;i&gt;d&lt;/i&gt;");
    expect(html).not.toContain("<b>");
  });

  test("props the contract refuses fail the item, naming it", () => {
    expect(() => field({})).toThrow('the TextField "atom" refuses its props');
    expect(() => field({ label: "L", maxLength: 0 })).toThrow("maxLength");
    expect(() => field({ label: "L", extra: 1 })).toThrow("extra");
  });
});

describe("the TextField's facts", () => {
  const facts = () => componentFacts("text-field");

  test("its name in the agent-change notice", () => {
    expect(facts()?.name).toBe("change.widgetTextField");
  });

  test("a result fits by the contract's shape and props checks", () => {
    const props = { label: "L", maxLength: 3 };
    const fits = facts()?.fits;
    expect(fits?.("abc", props)).toBe(true);
    expect(fits?.("abcd", props)).toBe(false);
    expect(fits?.("a\nb", props)).toBe(false);
    expect(fits?.("a\nb", { ...props, multiline: true })).toBe(true);
    expect(fits?.(5, props)).toBe(false);
    expect(fits?.("", props)).toBe(false);
    expect(fits?.("abc", { label: "" })).toBe(false);
  });
});
