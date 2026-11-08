import { describe, expect, test } from "bun:test";
import { draw } from "../../../test/atoms/draw.ts";
import { componentFacts, componentFor } from "../port.ts";
import "../date-field/index.tsx";
import "../money-field/index.tsx";
import "../number-field/index.tsx";
import "../text-field/index.tsx";
import "../toggle/index.tsx";

// The input atoms' required mark and field checks drawn by the server renderer (form-widget, task
// 3.2; view-and-widgets spec: Required fields, A TextField's checks as the user types, Form strings;
// design decisions 3 and 6). Typing, the Tabs' mark and Enter in a browser are
// `form-fields.browser.ts`'s.

const TYPES = {
  "text-field": { label: "Ticket" },
  "number-field": { label: "Ticket" },
  "money-field": { label: "Ticket", currency: "EUR" },
  "date-field": { label: "Ticket" },
  toggle: { label: "Ticket" },
} as const;
type FieldType = keyof typeof TYPES;
const NAMES = Object.keys(TYPES) as FieldType[];

const field = (type: FieldType, extra: Record<string, unknown> = {}, options = {}) =>
  draw(componentFor(type), type, { ...TYPES[type], ...extra }, options);

describe("a required field (view-and-widgets spec: Required fields)", () => {
  for (const type of NAMES) {
    test(`${type}: the label ends with (required) in its own span, and the control is marked required`, () => {
      const { html } = field(type, { required: true });
      expect(html).toMatch(/Ticket\s*<span[^>]*>\(required\)<\/span>/);
      expect(html).toContain('aria-required="true"');
    });

    test(`${type}: a field that is not required shows neither`, () => {
      for (const extra of [{}, { required: false }]) {
        const { html } = field(type, extra);
        expect(html).not.toContain("(required)");
        expect(html).not.toContain('aria-required="true"');
      }
    });

    test(`${type}: read-only, as when answered, it asks for nothing`, () => {
      const { html } = field(type, { required: true }, { disabled: true });
      expect(html).not.toContain("(required)");
      expect(html).not.toContain('aria-required="true"');
    });

    test(`${type}: an Italian board reads (obbligatorio)`, () => {
      const { html } = field(type, { required: true }, { locale: "it-IT" });
      expect(html).toMatch(/Ticket\s*<span[^>]*>\(obbligatorio\)<\/span>/);
      expect(html).not.toContain("(required)");
    });

    test(`${type}: an empty required field shows no field error and is not marked invalid`, () => {
      const { html } = field(type, { required: true });
      expect(html).not.toContain('aria-invalid="true"');
      expect(html).not.toContain("atom:error");
    });

    test(`${type}: the label stays text, the mark is added after it`, () => {
      const { html } = field(type, { required: true, label: "<b>Ticket</b>" });
      expect(html).toContain("&lt;b&gt;Ticket&lt;/b&gt;");
      expect(html).not.toContain("<b>");
    });
  }

  test("a required mark wraps in the card like the label does", () => {
    const { html } = field("text-field", { required: true, label: "x".repeat(200) });
    expect(html).toMatch(/<span class="[^"]*break-words[^"]*">\(required\)<\/span>/);
  });
});

describe("the five fields register their check (design decision 5)", () => {
  for (const type of NAMES) {
    test(`${type}: required fails for no result and passes for any, false and 0 included`, () => {
      const check = componentFacts(type)?.check;
      expect(check).toBeFunction();
      const props = { ...TYPES[type], required: true };
      expect(check?.(undefined, props)).toEqual({ code: "required" });
      expect(check?.(undefined, TYPES[type])).toBeUndefined();
    });
  }

  test("a value of each kind that is not required passes", () => {
    expect(
      componentFacts("toggle")?.check?.(false, { label: "T", required: true }),
    ).toBeUndefined();
    expect(
      componentFacts("number-field")?.check?.(0, { label: "T", required: true }),
    ).toBeUndefined();
  });

  test("the TextField's check is the length, then the pattern", () => {
    const check = componentFacts("text-field")?.check;
    expect(check?.("ab", { label: "T", minLength: 3 })).toEqual({ code: "min-length", min: 3 });
    expect(check?.("abc", { label: "T", minLength: 3 })).toBeUndefined();
    expect(check?.("ab-1", { label: "T", pattern: "^[A-Z]+$" })).toEqual({ code: "pattern" });
    expect(check?.("AB", { label: "T", pattern: "^[A-Z]+$" })).toBeUndefined();
    // The length is named first when both fail.
    expect(check?.("a", { label: "T", minLength: 3, pattern: "^[A-Z]+$" })).toEqual({
      code: "min-length",
      min: 3,
    });
  });

  test("a pattern is compiled once for its string, and one that does not compile fails", () => {
    const Original = RegExp;
    let built = 0;
    class Counting extends Original {
      constructor(source: string | RegExp, flags?: string) {
        super(source, flags);
        built += 1;
      }
    }
    globalThis.RegExp = Counting as unknown as RegExpConstructor;
    try {
      const check = componentFacts("text-field")?.check;
      const props = { label: "T", pattern: "^counted-once-[0-9]$" };
      for (const text of ["counted-once-1", "counted-once-2", "no", "counted-once-3"]) {
        check?.(text, props);
      }
      expect(built).toBe(1);
      expect(check?.("x", { label: "T", pattern: "(" })).toEqual({ code: "pattern" });
      expect(check?.("x", { label: "T", pattern: "(" })).toEqual({ code: "pattern" });
    } finally {
      globalThis.RegExp = Original;
    }
  });
});

describe("a TextField's checks as the user types (view-and-widgets spec)", () => {
  test("a text shorter than minLength shows its field error, and the input is invalid and described by it", () => {
    const { html } = field("text-field", { minLength: 3 }, { result: "ab" });
    expect(html).toContain("At least 3 characters.");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/aria-describedby="[^"]*atom:error/);
    expect(html).toMatch(/<p id="atom:error"[^>]*>At least 3 characters\.<\/p>/);
  });

  test("a text outside the pattern shows Not in the expected form, with the description still named", () => {
    const { html } = field(
      "text-field",
      { pattern: "^[A-Z]{2}-\\d{4}$", description: "Two capitals, a dash, four digits." },
      { result: "ab-1234" },
    );
    expect(html).toContain("Not in the expected form.");
    expect(html).toContain('value="ab-1234"');
    expect(html).toMatch(/aria-describedby="atom:description atom:error"/);
  });

  test("the error clears once the text passes or is emptied", () => {
    const props = { pattern: "^[A-Z]+$", minLength: 2 };
    expect(field("text-field", props, { result: "AB" }).html).not.toContain("field-error");
    expect(field("text-field", props, { result: "AB" }).html).not.toContain('aria-invalid="true"');
    expect(field("text-field", props).html).not.toContain('aria-invalid="true"');
    expect(field("text-field", props).html).not.toContain("atom:error");
  });

  test("the error is in the ask's language", () => {
    const length = field("text-field", { minLength: 3 }, { result: "ab", locale: "it-IT" });
    expect(length.html).toContain("Almeno 3 caratteri.");
    const form = field("text-field", { pattern: "^a$" }, { result: "b", locale: "it-IT" });
    expect(form.html).toContain("Non è nella forma attesa.");
  });

  test("read-only, as when answered, a failing text shows no error", () => {
    const { html } = field("text-field", { pattern: "^a$" }, { result: "b", disabled: true });
    expect(html).not.toContain("Not in the expected form.");
    expect(html).not.toContain('aria-invalid="true"');
  });

  test("the agent's pattern is never drawn, and a multiline field shows the error too", () => {
    const { html } = field("text-field", { pattern: "^<b>$", multiline: true }, { result: "x" });
    expect(html).not.toContain("^&lt;b&gt;$");
    expect(html).toContain("Not in the expected form.");
    expect(html).toMatch(/<textarea[^>]*aria-invalid="true"/);
  });
});
