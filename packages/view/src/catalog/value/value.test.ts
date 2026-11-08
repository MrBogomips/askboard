import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { componentFor, type ItemProps, LanguageContext, LocaleContext } from "../port.ts";
import "../divider/index.tsx";
import "./index.tsx";
import { valueText } from "./format.ts";

// The Value atom and the Divider (atoms, task 5.2; view-and-widgets spec: Display atoms; design
// decision 8): a figure formatted in the ask's locale, a rule between items. Neither takes focus
// or gives an answer. The browser file `display-atoms.browser.ts` lays them out.

Object.assign(globalThis, { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });

const NONE = () => {};

const draw = (type: "value" | "divider", props: unknown, locale: "en-US" | "it-IT" = "en-US") => {
  const Component = componentFor(type);
  if (Component === undefined) throw new Error(`no ${type} chunk registered`);
  const given: ItemProps = {
    item: { type, id: "atom", props },
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
    cellEntries: new Map(),
    onCellEntriesChange: NONE,
  };
  return renderToStaticMarkup(
    createElement(
      LanguageContext.Provider,
      { value: locale },
      createElement(
        LocaleContext.Provider,
        { value: locale },
        createElement(Component as never, given),
      ),
    ),
  );
};

describe("a Value's text in the ask's locale", () => {
  test("the spec's Italian board: 1.234,5, 18,5%, € 12.480,00, mer 9 dic 2026 and 12 giorni", () => {
    expect(valueText({ kind: "number", value: 1234.5 }, "it-IT")).toBe("1.234,5");
    expect(valueText({ kind: "percent", value: 0.185 }, "it-IT")).toBe("18,5%");
    expect(valueText({ kind: "money", amount: "12480", currency: "EUR" }, "it-IT")).toBe(
      "€ 12.480,00",
    );
    expect(valueText({ kind: "date", date: "2026-12-09" }, "it-IT")).toBe("mer 9 dic 2026");
    expect(valueText({ kind: "duration", days: 12 }, "it-IT")).toBe("12 giorni");
  });

  test("the same in en-US", () => {
    expect(valueText({ kind: "number", value: 1234.5 }, "en-US")).toBe("1,234.5");
    expect(valueText({ kind: "percent", value: 0.185 }, "en-US")).toBe("18.5%");
    expect(valueText({ kind: "money", amount: "12480.50", currency: "EUR" }, "en-US")).toBe(
      "€12,480.50",
    );
    expect(valueText({ kind: "date", date: "2026-12-09" }, "en-US")).toBe("Wed, Dec 9, 2026");
    expect(valueText({ kind: "duration", days: 12 }, "en-US")).toBe("12 days");
    expect(valueText({ kind: "duration", days: 1 }, "en-US")).toBe("1 day");
    expect(valueText({ kind: "duration", days: 1 }, "it-IT")).toBe("1 giorno");
  });

  test("a number's unit follows it once, after a space", () => {
    expect(valueText({ kind: "number", value: 1234.5, unit: "kg" }, "en-US")).toBe("1,234.5 kg");
    expect(valueText({ kind: "number", value: 1234.5, unit: "kg" }, "it-IT")).toBe("1.234,5 kg");
  });

  test("a figure the contract bounds but the eye cannot take in is still one token, which the layout wraps", () => {
    const text = valueText({ kind: "number", value: 5e-324 }, "en-US");
    expect(text.length).toBe(326);
    expect(text).not.toMatch(/\s/);
  });
});

describe("the Value atom", () => {
  test("registers under its type", () => {
    expect(componentFor("value")).toBeDefined();
  });

  test("shows its label in the label type and its figure in the code type, right-aligned, as a definition", () => {
    const html = draw("value", { label: "Margin", kind: "percent", value: 0.185 });
    expect(html).toContain("<dl");
    expect(html).toMatch(/<dt[^>]*>Margin<\/dt>/);
    expect(html).toMatch(/<dd[^>]*>18\.5%<\/dd>/);
    expect(html).toContain("text-label");
    expect(html).toContain("font-mono");
    expect(html).toContain("text-right");
  });

  test("with no label it shows the figure alone", () => {
    const html = draw("value", { kind: "duration", days: 12 }, "it-IT");
    expect(html).toContain("12 giorni");
    expect(html).not.toContain("<dt");
    expect(html).not.toContain("<dl");
  });

  test("the label is text, never markup", () => {
    const html = draw("value", { label: "<b>Total</b>", kind: "number", value: 3 });
    expect(html).toContain("&lt;b&gt;Total&lt;/b&gt;");
    expect(html).not.toContain("<b>");
  });

  test("the figure wraps within its card, so no number lays out as one long line (U-3)", () => {
    const html = draw("value", { label: "Tiny", kind: "number", value: 5e-324 });
    expect(html).toContain("break-all");
    expect(html).toContain("min-w-0");
  });

  test("it takes no focus: no tabindex, button, input or link", () => {
    const html = draw("value", { label: "L", kind: "number", value: 1 });
    expect(html).not.toMatch(/tabindex|<button|<input|<a /);
  });

  test("props the contract refuses fail the item, naming it", () => {
    expect(() => draw("value", { kind: "number" })).toThrow('the Value "atom" refuses its props');
    expect(() => draw("value", { kind: "date", date: "2026-02-30" })).toThrow("/date");
    expect(() => draw("value", { kind: "percent", value: 1, unit: "x" })).toThrow("unit");
  });
});

describe("the Divider", () => {
  test("is a rule with the divider token, a separator that takes no focus", () => {
    const html = draw("divider", {});
    // An `hr` is a separator by its own role; an explicit one would be redundant.
    expect(html).toContain("<hr");
    expect(html).toContain("border-border");
    expect(html).toContain("my-md");
    expect(html).not.toMatch(/tabindex|<button|<input|<a /);
  });

  test("props the contract refuses fail the item", () => {
    expect(() => draw("divider", { label: "x" })).toThrow('the Divider "atom" refuses its props');
    expect(() => draw("divider", null)).toThrow("refuses its props");
  });
});
