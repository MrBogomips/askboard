import { describe, expect, test } from "bun:test";
import { draw } from "../../../test/atoms/draw.ts";
import { componentFacts, componentFor } from "../port.ts";
import "./index.tsx";

// The PickField drawn by the server renderer (form-widget, task 3.3; view-and-widgets spec: The
// PickField, The PickField's filter, Forms read-only and in Snapshots, Form strings; design decision
// 4). The keyboard, the filter's typing, the draft and the hover in a browser are
// `pick-field.browser.ts`'s.

const options = (count: number) =>
  Array.from({ length: count }, (_, at) => ({
    id: `o${at}`,
    label: `Option ${at}`,
    ...(at === 0 ? { description: "The first one." } : {}),
  }));
const PROPS = { label: "Region", options: options(3) };

const pick = (extra: Record<string, unknown> = {}, drawn = {}) =>
  draw(componentFor("pick-field"), "pick-field", { ...PROPS, ...extra }, drawn);

describe("a single PickField's markup", () => {
  test("registers under its type", () => {
    expect(componentFor("pick-field")).toBeDefined();
  });

  test("a radio group named by the visible label, one radio per option in order, with text and description", () => {
    const { html } = pick();
    expect(html).toMatch(/<label[^>]*id="atom:label"[^>]*>Region<\/label>/);
    expect(html).toMatch(/role="radiogroup"[^>]*aria-labelledby="atom:label"/);
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html.indexOf("Option 0")).toBeLessThan(html.indexOf("Option 1"));
    expect(html.indexOf("Option 1")).toBeLessThan(html.indexOf("Option 2"));
    expect(html).toContain("The first one.");
    expect(html).not.toContain('role="checkbox"');
  });

  test("nothing is picked until the user picks, and no Clear shows", () => {
    const { html } = pick();
    expect(html).not.toContain('aria-checked="true"');
    expect(html).not.toContain(">Clear<");
  });

  test("a result checks its option and shows Clear", () => {
    const { html } = pick({}, { result: "o1" });
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="true"[^>]*value="o1"|value="o1"[^>]*aria-checked="true"/);
    expect(html).toContain(">Clear<");
  });

  test("a result that is no option's checks nothing and does not fail the field", () => {
    const { html } = pick({}, { result: "gone" });
    expect(html).not.toContain('aria-checked="true"');
  });

  test("option IDs that are names of Object are options like any other", () => {
    const named = {
      label: "Region",
      options: [
        { id: "constructor", label: "Constructor" },
        { id: "__proto__", label: "Proto" },
        { id: "toString", label: "String" },
      ],
    };
    const { html } = draw(componentFor("pick-field"), "pick-field", named, { result: "__proto__" });
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toMatch(/value="__proto__"/);
  });

  test("read-only, as when answered: the pick checked, the controls disabled, no Clear, no filter", () => {
    const { html } = pick({ options: options(30) }, { result: "o4", disabled: true });
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(30);
    expect(html).not.toContain(">Clear<");
    expect(html).not.toContain("Filter the options");
    // Radix draws a hidden input per radio in the server render only; no text input is the filter.
    expect(html).not.toMatch(/<input[^>]*type="text"/);
  });
});

describe("a multiple PickField's markup", () => {
  const multiple = { multiple: true };

  test("a group named by the label, one checkbox per option, checked for each ID of the result, no Clear", () => {
    const { html } = pick(multiple, { result: ["o0", "o2"] });
    expect(html).toMatch(
      /role="group"[^>]*aria-labelledby="atom:label"|aria-labelledby="atom:label"[^>]*role="group"|<fieldset[^>]*aria-labelledby="atom:label"/,
    );
    expect(html.match(/role="checkbox"/g)).toHaveLength(3);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(2);
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain(">Clear<");
  });

  test("nothing is checked while there is no result", () => {
    expect(pick(multiple).html).not.toContain('aria-checked="true"');
  });

  test("fewer picks than minItems show Pick at least, more than maxItems Pick at most, both described", () => {
    const few = pick({ ...multiple, minItems: 2 }, { result: ["o0"] }).html;
    expect(few).toContain("Pick at least 2.");
    expect(few).toMatch(/aria-describedby="[^"]*atom:error/);
    const many = pick({ ...multiple, maxItems: 1 }, { result: ["o0", "o1"] }).html;
    expect(many).toContain("Pick at most 1.");
  });

  test("within the counts, or with no pick, no error shows", () => {
    expect(pick({ ...multiple, minItems: 2 }, { result: ["o0", "o1"] }).html).not.toContain(
      "Pick at",
    );
    expect(pick({ ...multiple, minItems: 2 }).html).not.toContain("Pick at");
    expect(
      pick({ ...multiple, minItems: 2 }, { result: ["o0"], disabled: true }).html,
    ).not.toContain("Pick at");
  });

  test("the errors are Italian on an Italian board", () => {
    const few = pick({ ...multiple, minItems: 2 }, { result: ["o0"], locale: "it-IT" }).html;
    expect(few).toContain("Scegline almeno 2.");
    const many = pick({ ...multiple, maxItems: 1 }, { result: ["o0", "o1"], locale: "it-IT" }).html;
    expect(many).toContain("Scegline al massimo 1.");
  });
});

describe("the filter (view-and-widgets spec: The PickField's filter)", () => {
  test("above 10 options a filter input shows, named Filter the options; at 10 none does", () => {
    const over = pick({ options: options(11) }).html;
    expect(over).toMatch(/<input[^>]*aria-label="Filter the options"/);
    expect(pick({ options: options(10) }).html).not.toContain("Filter the options");
  });

  test("it is Italian on an Italian board", () => {
    const { html } = pick({ options: options(11) }, { locale: "it-IT" });
    expect(html).toContain('aria-label="Filtra le opzioni"');
  });

  test("it starts empty, so every option shows, and a multiple pick has one too", () => {
    const { html } = pick({ options: options(12), multiple: true });
    expect(html.match(/role="checkbox"/g)).toHaveLength(12);
    expect(html).toContain("Filter the options");
    expect(html).toMatch(/<input[^>]*value=""/);
  });
});

describe("required, labels and agent text", () => {
  test("the label ends with (required) and a single group is marked required", () => {
    const { html } = pick({ required: true });
    expect(html).toMatch(/Region\s*<span[^>]*>\(required\)<\/span>/);
    expect(html).toContain('aria-required="true"');
  });

  test("a multiple group's accessible name carries the mark, since a group takes no aria-required", () => {
    const { html } = pick({ required: true, multiple: true });
    expect(html).toMatch(/Region\s*<span[^>]*>\(required\)<\/span>/);
    expect(html).toContain('aria-labelledby="atom:label"');
  });

  test("an empty required field shows no field error, and read-only none of the mark", () => {
    const empty = pick({ required: true, multiple: true, minItems: 1 }).html;
    expect(empty).not.toContain("Pick at");
    const done = pick({ required: true }, { disabled: true, result: "o0" }).html;
    expect(done).not.toContain("(required)");
    expect(done).not.toContain('aria-required="true"');
  });

  test("a label, a description and option texts are text, and long runs wrap", () => {
    const long = "x".repeat(200);
    const { html } = pick({
      label: "<b>Region</b>",
      description: "<i>d</i>",
      options: [
        { id: "a", label: "<u>A</u>", description: long },
        { id: "b", label: long },
      ],
    });
    expect(html).toContain("&lt;b&gt;Region&lt;/b&gt;");
    expect(html).toContain("&lt;u&gt;A&lt;/u&gt;");
    expect(html).not.toMatch(/<(b|i|u)>/);
    expect(html).toMatch(new RegExp(`<span[^>]*break-words[^>]*>${long}</span>`));
  });

  test("props the contract refuses fail the item, naming it", () => {
    expect(() => draw(componentFor("pick-field"), "pick-field", { label: "L" })).toThrow(
      'the PickField "atom" refuses its props',
    );
    expect(() => draw(componentFor("pick-field"), "pick-field", { ...PROPS, minItems: 1 })).toThrow(
      "minItems",
    );
  });
});

describe("the PickField's facts", () => {
  const facts = () => componentFacts("pick-field");

  test("its name in the agent-change notice", () => {
    expect(facts()?.name).toBe("change.widgetPickField");
  });

  test("a result fits by the contract's shape and props checks", () => {
    const fits = facts()?.fits;
    const single = PROPS;
    const multiple = { ...PROPS, multiple: true };
    expect(fits?.("o1", single)).toBe(true);
    expect(fits?.("gone", single)).toBe(false);
    expect(fits?.(["o1"], single)).toBe(false);
    expect(fits?.(["o0", "o2"], multiple)).toBe(true);
    expect(fits?.(["o2", "o0"], multiple)).toBe(false);
    expect(fits?.("o0", multiple)).toBe(false);
    expect(fits?.("", single)).toBe(false);
    expect(fits?.(null, single)).toBe(false);
  });

  test("its check is the contract's: required, then the counts", () => {
    const check = facts()?.check;
    expect(check?.(undefined, { ...PROPS, required: true })).toEqual({ code: "required" });
    expect(check?.(undefined, PROPS)).toBeUndefined();
    const counted = { ...PROPS, multiple: true, minItems: 2, maxItems: 2 };
    expect(check?.(["o0"], counted)).toEqual({ code: "min-items", min: 2 });
    expect(check?.(["o0", "o1"], counted)).toBeUndefined();
    expect(check?.(["o0", "o1", "o2"], { ...counted, minItems: 1 })).toEqual({
      code: "max-items",
      max: 2,
    });
  });
});
