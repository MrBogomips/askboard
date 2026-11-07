import { describe, expect, test } from "bun:test";
import { draw } from "../../../test/atoms/draw.ts";
import { componentFacts, componentFor } from "../port.ts";
import { pickedDay } from "./calendar.ts";
import "./index.tsx";

// The DateField drawn by the server renderer (atoms, task 5.5; view-and-widgets spec: Number, amount
// and date entry in the fields, The DateField's calendar, An entry blocks Answer). The calendar's
// opening, its keys and the time zones are `date-atom.browser.ts`'s.

const field = (props: unknown, options = {}) =>
  draw(componentFor("date-field"), "date-field", props, options);
const LEAVE = { label: "Leave", min: "2026-03-01", max: "2026-06-30" };

describe("the DateField's markup", () => {
  test("registers under its type", () => {
    expect(componentFor("date-field")).toBeDefined();
  });

  test("a text input, never type=date, labelled, with a calendar button after it", () => {
    const { html } = field(LEAVE);
    expect(html).toMatch(/<input[^>]*type="text"/);
    expect(html).not.toContain('type="date"');
    expect(html).toMatch(/<label[^>]*for="atom:field"[^>]*>Leave<\/label>/);
    expect(html).toMatch(/<button[^>]*aria-label="Choose a date"/);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html.indexOf("<input")).toBeLessThan(html.indexOf("<button"));
  });

  test("in Italian the button is named in Italian", () => {
    expect(field(LEAVE, { locale: "it-IT" }).html).toMatch(/aria-label="Scegli una data"/);
  });

  test("nothing shows as set before the user acts: an empty field, no echo, no error", () => {
    const { html } = field(LEAVE);
    expect(html).toContain('value=""');
    expect(html).not.toContain("= ");
    expect(html).not.toContain('aria-invalid="');
  });

  test("a result shows in the locale's own form, with its echo as a long date", () => {
    const en = field(LEAVE, { result: "2026-03-09" }).html;
    expect(en).toContain('value="3/9/2026"');
    expect(en).toContain("= Mon, Mar 9, 2026");
    const it = field(LEAVE, { result: "2026-03-09", locale: "it-IT" }).html;
    expect(it).toContain('value="09/03/2026"');
    expect(it).toContain("= lun 9 mar 2026");
  });

  test("an entry shows as typed, with the parser's reason or the range broken and the input marked invalid", () => {
    const bad = field(LEAVE, { entry: "13/45/2026" }).html;
    expect(bad).toContain('value="13/45/2026"');
    expect(bad).toContain("13 is not a month");
    expect(bad).toContain('aria-invalid="true"');
    const early = field(LEAVE, { entry: "2/28/2026" }).html;
    expect(early).toContain("On or after 3/1/2026.");
    expect(early).toContain("= Sat, Feb 28, 2026");
    expect(field(LEAVE, { entry: "1/7/2026", locale: "it-IT" }).html).toContain(
      "Fino al 30/06/2026.",
    );
  });

  test("answered or locked: the long date, read-only, with no echo, no error and no calendar button", () => {
    const en = field(LEAVE, { result: "2026-03-09", disabled: true }).html;
    expect(en).toContain('value="Mon, Mar 9, 2026"');
    expect(en).toContain('readOnly=""');
    expect(en).not.toContain("<button");
    expect(en).not.toContain("= Mon");
    const it = field(LEAVE, { result: "2026-03-09", disabled: true, locale: "it-IT" }).html;
    expect(it).toContain('value="lun 9 mar 2026"');
    expect(field(LEAVE, { entry: "7/1/2026", disabled: true }).html).not.toContain("On or before");
    expect(field(LEAVE, { disabled: true }).html).toContain('value=""');
  });

  test("a result that is no date shows as an empty field", () => {
    expect(field(LEAVE, { result: "soon" }).html).toContain('value=""');
    expect(field(LEAVE, { result: 5 }).html).toContain('value=""');
  });

  test("a label is text, and props the contract refuses fail the item", () => {
    expect(field({ label: "<b>L</b>" }).html).toContain("&lt;b&gt;L&lt;/b&gt;");
    expect(() => field({})).toThrow('the DateField "atom" refuses its props');
    expect(() => field({ label: "L", min: "2026-06-30", max: "2026-03-01" })).toThrow("/max");
    expect(() => field({ label: "L", min: "2026-02-30" })).toThrow("/min");
  });
});

describe("a day picked in the calendar", () => {
  test("goes to the draft as its full-date, forgets the typed text and closes the calendar", () => {
    const calls: unknown[] = [];
    pickedDay({
      result: (date) => calls.push(["result", date]),
      remember: (text) => calls.push(["remember", text]),
      close: () => calls.push(["close"]),
    })(new Date(2026, 11, 9, 0, 0, 0));
    expect(calls).toEqual([["result", "2026-12-09"], ["remember", undefined], ["close"]]);
  });
});

describe("the DateField's facts", () => {
  test("its name in the agent-change notice, and a result fits by the contract's checks", () => {
    const facts = componentFacts("date-field");
    expect(facts?.name).toBe("change.widgetDateField");
    expect(facts?.fits?.("2026-03-09", LEAVE)).toBe(true);
    expect(facts?.fits?.("2026-07-01", LEAVE)).toBe(false);
    expect(facts?.fits?.("2026-02-30", LEAVE)).toBe(false);
    expect(facts?.fits?.("soon", LEAVE)).toBe(false);
    expect(facts?.fits?.(5, LEAVE)).toBe(false);
  });
});
