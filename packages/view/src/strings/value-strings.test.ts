import { describe, expect, test } from "bun:test";
import { STRINGS, t } from "./index.ts";

// The Value's strings (atoms, task 5.2; view-and-widgets spec: Display atoms, Atom strings;
// ux-update-draft.md block 6): the durations in both tables, the Italian texts to review.
describe("the Value's strings", () => {
  test("are in both tables, as count forms holding {count}", () => {
    for (const language of ["en-US", "it-IT"] as const) {
      const form = STRINGS[language]["value.days"];
      expect(typeof form).toBe("object");
      if (typeof form === "object") {
        expect(form.other).toContain("{count}");
        expect(form.one).toContain("{count}");
      }
    }
  });

  test("read in English", () => {
    expect(t("en-US", "value.days", { count: 1 })).toBe("1 day");
    expect(t("en-US", "value.days", { count: 12 })).toBe("12 days");
    expect(t("en-US", "value.days", { count: 0 })).toBe("0 days");
  });

  test("read in Italian", () => {
    expect(t("it-IT", "value.days", { count: 1 })).toBe("1 giorno");
    expect(t("it-IT", "value.days", { count: 12 })).toBe("12 giorni");
    expect(t("it-IT", "value.days", { count: 0 })).toBe("0 giorni");
  });
});
