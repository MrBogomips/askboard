import { describe, expect, test } from "bun:test";
import { STRINGS, t } from "./index.ts";

// The Scale's strings (view-and-widgets spec: The three widgets' strings; ux-update-draft.md
// block 2): in both tables, an Italian board showing them in Italian.
describe("the Scale's strings", () => {
  test("are in both tables", () => {
    for (const key of ["scale.notSet", "scale.low", "scale.high", "change.widgetScale"]) {
      expect(Object.hasOwn(STRINGS["en-US"], key)).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], key)).toBe(true);
    }
  });

  test("read in English", () => {
    expect(t("en-US", "scale.notSet")).toBe("Not set");
    expect(t("en-US", "scale.low")).toBe("Lower value");
    expect(t("en-US", "scale.high")).toBe("Upper value");
    expect(t("en-US", "change.widgetScale")).toBe("Scale");
  });

  test("read in Italian", () => {
    expect(t("it-IT", "scale.notSet")).toBe("Non impostato");
    expect(t("it-IT", "scale.low")).toBe("Valore minimo");
    expect(t("it-IT", "scale.high")).toBe("Valore massimo");
    expect(t("it-IT", "change.widgetScale")).toBe("Scala");
  });
});
