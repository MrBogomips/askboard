import { describe, expect, test } from "bun:test";
import { draw } from "../../../test/atoms/draw.ts";
import { componentFacts, componentFor } from "../port.ts";
import "./index.tsx";

// The MoneyField drawn by the server renderer (atoms, task 5.4; view-and-widgets spec: Number, amount
// and date entry in the fields, An entry blocks Answer). Typing, the currency control by keyboard and
// reloads are `number-atoms.browser.ts`'s.

const field = (props: unknown, options = {}) =>
  draw(componentFor("money-field"), "money-field", props, options);
const FIXED = { label: "Fee", currency: "EUR", min: "0" };
const PICK = { label: "Fee", currencies: ["EUR", "USD", "JPY"] };

describe("the MoneyField's markup", () => {
  test("registers under its type", () => {
    expect(componentFor("money-field")).toBeDefined();
  });

  test("a fixed currency is an affix on a text input, with no control", () => {
    const { html } = field(FIXED);
    expect(html).toMatch(/<input[^>]*type="text"/);
    expect(html).not.toContain('type="number"');
    expect(html).toMatch(/<span[^>]*>EUR<\/span>/);
    expect(html).not.toContain('role="radio"');
  });

  test("currencies are a segmented control after the field, none pressed until picked, no affix", () => {
    const { html } = field(PICK);
    for (const code of ["EUR", "USD", "JPY"])
      expect(html).toMatch(new RegExp(`role="radio"[^>]*>${code}<`));
    expect(html).not.toContain('aria-checked="true"');
    expect(html).toContain('aria-label="Currency"');
    expect(html).not.toMatch(/<span[^>]*font-mono[^>]*>(EUR|USD|JPY)<\/span>/);
    expect(html.indexOf("<input")).toBeLessThan(html.indexOf('role="radiogroup"'));
  });

  test("the control's label is in the ask's language", () => {
    expect(field(PICK, { locale: "it-IT" }).html).toContain('aria-label="Valuta"');
  });

  test("a result shows with the locale's decimal mark, its echo and the pressed currency", () => {
    const result = { amount: "1234.50", currency: "USD" };
    const en = field(PICK, { result }).html;
    expect(en).toContain('value="1234.50"');
    expect(en).toContain("= 1234.50 USD");
    expect(en).toMatch(/aria-checked="true"[^>]*>USD</);
    const it = field(PICK, { result, locale: "it-IT" }).html;
    expect(it).toContain('value="1234,50"');
    expect(it).toContain("= 1234,50 USD");
  });

  test("an amount typed before a currency is picked is an entry: Pick a currency.", () => {
    const { html } = field(PICK, { entry: "12" });
    expect(html).toContain('value="12"');
    expect(html).toContain("Pick a currency.");
    expect(html).toContain('aria-invalid="true"');
    expect(field(PICK, { entry: "12", locale: "it-IT" }).html).toContain("Scegli una valuta.");
  });

  test("an entry the currency cannot take shows the parser's reason; one past a bound the bound", () => {
    expect(field(FIXED, { entry: "12.345" }).html).toContain(
      "EUR takes at most 2 decimals, as in 12.50.",
    );
    const past = field({ ...FIXED, min: "10.00" }, { entry: "9.99" }).html;
    expect(past).toContain("At least €10.00.");
    expect(past).toContain("= 9.99 EUR");
  });

  test("answered or locked: the amount formatted with its currency, read-only, no control, echo or error", () => {
    const result = { amount: "12480.00", currency: "EUR" };
    const it = field(PICK, { result, disabled: true, locale: "it-IT" }).html;
    expect(it).toContain("€ 12.480,00");
    expect(it).toContain('readOnly=""');
    expect(it).not.toContain('role="radio"');
    expect(it).not.toContain("= 12480");
    expect(field(PICK, { disabled: true }).html).toContain('value=""');
    // An entry the draft still holds is not shown beside an answer.
    expect(field(PICK, { entry: "12", disabled: true }).html).not.toContain("Pick a currency.");
  });

  test("a result that is no amount shows as an empty field", () => {
    expect(field(PICK, { result: { amount: 5, currency: "EUR" } }).html).toContain('value=""');
    expect(field(PICK, { result: "5" }).html).toContain('value=""');
  });

  test("props the contract refuses fail the item", () => {
    expect(() => field({ label: "L" })).toThrow('the MoneyField "atom" refuses its props');
    expect(() => field({ label: "L", currency: "EUR", currencies: ["EUR", "USD"] })).toThrow(
      "refuses",
    );
    expect(() => field({ label: "L", currency: "EUR", max: "0.005" })).toThrow("/max");
  });
});

describe("the MoneyField's facts", () => {
  test("its name in the agent-change notice, and a result fits by the contract's checks", () => {
    const facts = componentFacts("money-field");
    expect(facts?.name).toBe("change.widgetMoneyField");
    expect(facts?.fits?.({ amount: "12.50", currency: "EUR" }, PICK)).toBe(true);
    expect(facts?.fits?.({ amount: "12.505", currency: "EUR" }, PICK)).toBe(false);
    expect(facts?.fits?.({ amount: "12.50", currency: "GBP" }, PICK)).toBe(false);
    expect(facts?.fits?.({ amount: "-1.00", currency: "EUR" }, FIXED)).toBe(false);
    expect(facts?.fits?.("12.50", PICK)).toBe(false);
  });
});
