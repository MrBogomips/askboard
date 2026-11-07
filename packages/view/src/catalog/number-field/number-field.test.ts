import { describe, expect, test } from "bun:test";
import { draw } from "../../../test/atoms/draw.ts";
import { componentFacts, componentFor } from "../port.ts";
import "./index.tsx";

// The NumberField drawn by the server renderer (atoms, task 5.4; view-and-widgets spec: Number,
// amount and date entry in the fields, An entry blocks Answer, Input atoms fill the draft only).
// Typing and the keyboard are `number-atoms.browser.ts`'s.

const field = (props: unknown, options = {}) =>
  draw(componentFor("number-field"), "number-field", props, options);
const DAYS = { label: "Days", min: 0, max: 20, step: 0.5, unit: "days" };

describe("the NumberField's markup", () => {
  test("registers under its type", () => {
    expect(componentFor("number-field")).toBeDefined();
  });

  test("a text input with a decimal keyboard, never type=number, labelled and with the unit as an affix", () => {
    const { html } = field(DAYS);
    expect(html).toMatch(/<input[^>]*type="text"/);
    expect(html).not.toContain('type="number"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toMatch(/<label[^>]*for="atom:field"[^>]*>Days<\/label>/);
    expect(html).toMatch(/<span[^>]*>days<\/span>/);
  });

  test("nothing shows as set before the user acts: an empty field, no echo, no error", () => {
    const { html } = field(DAYS);
    expect(html).toContain('value=""');
    expect(html).not.toContain("= ");
    expect(html).not.toContain('aria-invalid="');
  });

  test("a result shows as the parser reads it back, with its echo, in each locale", () => {
    const en = field(DAYS, { result: 3.5 }).html;
    expect(en).toContain('value="3.5"');
    expect(en).toContain("= 3.5");
    const it = field(DAYS, { result: 3.5, locale: "it-IT" }).html;
    expect(it).toContain('value="3,5"');
    expect(it).toContain("= 3,5");
  });

  test("an entry shows as typed, with the parser's reason as the field error and the input marked invalid", () => {
    const { html } = field({ label: "L" }, { entry: "1.23", locale: "it-IT" });
    expect(html).toContain('value="1.23"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Usa i punti solo tra gruppi di tre cifre, come in 1.234,5.");
    expect(html).toContain('aria-describedby="atom:error"');
  });

  test("an entry past a bound shows the bound and the echo of what was read, the input described by both", () => {
    const { html } = field(DAYS, { entry: "21" });
    expect(html).toContain('value="21"');
    expect(html).toContain("At most 20.");
    expect(html).toContain("= 21");
    expect(html).toMatch(/aria-describedby="atom:error atom:note"/);
  });

  test("the description is read with the input", () => {
    const { html } = field({ label: "L", description: "Whole days only." });
    expect(html).toContain("Whole days only.");
    expect(html).toContain('aria-describedby="atom:description"');
  });

  test("answered or locked: the value formatted in the ask's locale, read-only, no echo or error", () => {
    const en = field({ label: "L", unit: "kg" }, { result: 1234.5, disabled: true }).html;
    expect(en).toContain('value="1,234.5"');
    expect(en).toContain('readOnly=""');
    expect(en).not.toContain("= 1234.5");
    const it = field({ label: "L" }, { result: 1234.5, disabled: true, locale: "it-IT" }).html;
    expect(it).toContain('value="1.234,5"');
    // An entry the draft still holds is not shown beside an answer.
    const held = field(DAYS, { entry: "21", disabled: true }).html;
    expect(held).toContain('value=""');
    expect(held).not.toContain("At most");
    expect(field(DAYS, { disabled: true }).html).toContain('value=""');
  });

  test("a result that is no number shows as an empty field", () => {
    expect(field(DAYS, { result: "3" }).html).toContain('value=""');
  });

  test("a label is text, and props the contract refuses fail the item", () => {
    expect(field({ label: "<b>L</b>" }).html).toContain("&lt;b&gt;L&lt;/b&gt;");
    expect(() => field({})).toThrow('the NumberField "atom" refuses its props');
    expect(() => field({ label: "L", min: 5, max: 1 })).toThrow("refuses its props");
    expect(() => field({ label: "L", min: -1e15, step: 1 })).toThrow("step");
  });
});

describe("the NumberField's facts", () => {
  test("its name in the agent-change notice, and a result fits by the contract's checks", () => {
    const facts = componentFacts("number-field");
    expect(facts?.name).toBe("change.widgetNumberField");
    expect(facts?.fits?.(3.5, DAYS)).toBe(true);
    expect(facts?.fits?.(21, DAYS)).toBe(false);
    expect(facts?.fits?.(3.25, DAYS)).toBe(false);
    expect(facts?.fits?.("3", DAYS)).toBe(false);
    expect(facts?.fits?.(1e16, { label: "L" })).toBe(false);
  });
});
